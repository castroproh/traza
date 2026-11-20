"""TRAZA - motor de seguimiento de ejecucion basado en sys.settrace().

Modelo de captura
-----------------
sys.settrace() emite el evento "line" ANTES de ejecutar la linea. Por eso
cada evento "line" abre una instruccion "pendiente" con su estado previo
(`before`). Ese mismo estado, observado cuando llega el SIGUIENTE evento
del MISMO marco (otra linea, "return" o "exception"), es el estado posterior
(`after`) de la instruccion pendiente. Nada se calcula ni se infiere: solo se
copian estados observados en el frame.

Eventos emitidos:
  call       inicio del programa o entrada a una funcion propia
  line       instruccion: before al llegar, after al llegar el siguiente evento
  return     fin de una funcion o del programa; before = estado final del marco
  exception  la instruccion pendiente fallo: after = estado al fallar

Cada snapshot incluye, cuando aplica:
  function    "<module>" o el nombre de la funcion
  depth       profundidad de llamada (0 = modulo)
  callId      identificador de la llamada (1 = programa)
  scope       "module" | "function"
  globals     estado de las variables globales (solo en marcos de funcion)
  returnValue valor devuelto por una funcion propia
  condition   resultado observado de una condicion if (ver abajo)

Las condiciones se instrumentan en el AST: cada `if`/`elif` se envuelve en
`__traza_cond__(id, linea, expresion, prueba)`, que registra el resultado
booleano real y devuelve el mismo valor. La rama ejecutada se determina
comparando la siguiente linea observada con los rangos reales del AST; si no
puede determinarse, se informa "none" y no se inventa una rama.

Alcance: solo ejecuta ejercicios controlados de la lista blanca. NO es un
sandbox de seguridad (ver docs/SEGURIDAD.md).
"""

import ast
import io
import json
import math
import sys
import time
from contextlib import redirect_stdout

FILENAME = "<traza>"
MAX_SNAPSHOTS = 2000
MAX_CALL_DEPTH = 8
MAX_CALLS = 200
MAX_STR = 200
MAX_DEPTH = 3
MAX_ITEMS = 50
SAFE_INT = 2**53 - 1

# Solo lo imprescindible para los ejercicios controlados.
SAFE_BUILTINS = {"print": print, "range": range}


class TraceLimitError(Exception):
    """Se supero el limite de eventos, llamadas o profundidad."""


def normalize(value, depth=0):
    """Convierte un valor de Python en datos JSON seguros."""
    if value is None or isinstance(value, bool):
        return value
    if isinstance(value, int):
        if abs(value) > SAFE_INT:
            return {"unsupported": "int fuera de rango seguro"}
        return value
    if isinstance(value, float):
        if math.isnan(value) or math.isinf(value):
            return {"unsupported": "float no finito"}
        return value
    if isinstance(value, str):
        return value if len(value) <= MAX_STR else value[:MAX_STR] + "..."
    if depth >= MAX_DEPTH:
        return {"unsupported": "profundidad maxima"}
    if isinstance(value, (list, tuple)):
        return [normalize(v, depth + 1) for v in list(value)[:MAX_ITEMS]]
    if isinstance(value, dict):
        out = {}
        for k, v in list(value.items())[:MAX_ITEMS]:
            out[str(k)] = normalize(v, depth + 1)
        return out
    # No se llama a repr() de objetos desconocidos: podria ejecutar codigo.
    return {"unsupported": type(value).__name__}


def capture_state(frame):
    """Copia las variables observables de un marco (sin nombres internos)."""
    state = {}
    for name, value in list(frame.f_locals.items()):
        if name.startswith("__"):
            continue
        state[name] = normalize(value)
    return state


def find_loops(tree):
    """Devuelve {linea_encabezado: (primera_linea_cuerpo, ultima_linea_cuerpo)}."""
    loops = {}
    for node in ast.walk(tree):
        if isinstance(node, (ast.For, ast.While)) and node.body:
            last = max(getattr(n, "end_lineno", n.lineno) for n in node.body)
            loops[node.lineno] = (node.body[0].lineno, last)
    return loops


def _end_line(node):
    return getattr(node, "end_lineno", None) or node.lineno


def find_conditionals(tree, source):
    """Instrumenta condiciones y devuelve {id: metadatos de rama}.

    Se ejecuta ANTES de compilar. La prueba original se conserva como argumento,
    de modo que `and`, `or`, `not` y los cortocircuitos mantienen su semantica.
    """
    conditions = {}
    counter = [0]

    def visit(node, parent_if=None):
        if isinstance(node, ast.If):
            counter[0] += 1
            cid = "cond-%d-L%d" % (counter[0], node.lineno)
            expression = ast.get_source_segment(source, node.test) or ""
            body_first = node.body[0].lineno
            body_last = max(_end_line(n) for n in node.body)
            orelse_first = None
            orelse_last = None
            starts_elif = False
            if node.orelse:
                orelse_first = node.orelse[0].lineno
                orelse_last = max(_end_line(n) for n in node.orelse)
                starts_elif = isinstance(node.orelse[0], ast.If)
            conditions[cid] = {
                "line": node.lineno,
                "expression": expression,
                "body_first": body_first,
                "body_last": body_last,
                "orelse_first": orelse_first,
                "orelse_last": orelse_last,
                "starts_elif": starts_elif,
            }
            call = ast.Call(
                func=ast.Name(id="__traza_cond__", ctx=ast.Load()),
                args=[
                    ast.Constant(value=cid),
                    ast.Constant(value=node.lineno),
                    ast.Constant(value=expression),
                    node.test,
                ],
                keywords=[],
            )
            ast.copy_location(call, node.test)
            node.test = call
            for child in node.body:
                visit(child)
            for child in node.orelse:
                visit(child, node)
            return
        for child in ast.iter_child_nodes(node):
            # Solo un `If` que ocupa el lugar del `else` es un `elif`.
            visit(child, None)

    visit(tree)
    ast.fix_missing_locations(tree)
    return conditions


def make_condition_recorder(tracer):
    """Crea el helper que registra el resultado real de una condicion."""

    def __traza_cond__(condition_id, line, expression, value):
        tracer.record_condition(sys._getframe(1), condition_id, line, expression, value)
        return value

    return __traza_cond__


class Tracer:
    def __init__(self, loops, conditions):
        self.loops = loops
        self.conditions = conditions
        self.snapshots = []
        self.pending = {}
        self.header_counts = {}
        self.raised = set()
        self.depth = {}
        self.call_ids = {}
        self.module_frame = None
        self.started = False
        self.next_call_id = 2
        self.call_count = 0

    # --- utilidades -------------------------------------------------
    def _add(self, snap):
        if len(self.snapshots) >= MAX_SNAPSHOTS:
            raise TraceLimitError("Se supero el limite de pasos registrados")
        snap["sequence"] = len(self.snapshots)
        self.snapshots.append(snap)
        return snap

    def _scope(self, frame):
        fid = id(frame)
        depth = self.depth.get(fid, 0)
        call_id = self.call_ids.get(fid, 1)
        snap = {
            "function": "<module>" if depth == 0 else frame.f_code.co_name,
            "depth": depth,
            "callId": call_id,
            "scope": "module" if depth == 0 else "function",
        }
        if depth > 0 and self.module_frame is not None:
            snap["globals"] = capture_state(self.module_frame)
        return snap

    def _loop_for_line(self, line):
        """Devuelve (header, es_encabezado) del bucle mas interno que contiene la linea."""
        if line in self.loops:
            return line, True
        best = None
        for header, (first, last) in self.loops.items():
            if first <= line <= last and (best is None or header > best):
                best = header
        return best, False

    def _close_pending(self, frame, next_line):
        fid = id(frame)
        pending = self.pending.pop(fid, None)
        if pending is None:
            return
        snap = pending["snap"]
        snap["after"] = capture_state(frame)
        header = pending.get("header")
        if header is not None:
            first, last = self.loops[header]
            # El encabezado que no entra al cuerpo es la comprobacion de salida:
            # no pertenece a ninguna iteracion.
            if next_line is None or not (first <= next_line <= last):
                snap.pop("iteration", None)

        condition = snap.get("condition")
        meta = pending.get("condition_meta")
        if condition is not None and meta is not None:
            branch = "none"
            branch_line = None
            if next_line is not None:
                if meta["body_first"] <= next_line <= meta["body_last"]:
                    branch = "then"
                    branch_line = next_line
                elif (
                    meta["orelse_first"] is not None
                    and meta["orelse_first"] <= next_line <= meta["orelse_last"]
                ):
                    branch = (
                        "elif"
                        if meta["starts_elif"] and next_line == meta["orelse_first"]
                        else "else"
                    )
                    branch_line = next_line
            condition["branch"] = branch
            condition["hasElse"] = meta["orelse_first"] is not None
            if branch_line is not None:
                condition["branchLine"] = branch_line
            # La rama no ejecutada solo se informa cuando es determinable.
            if branch == "then" and meta["orelse_first"] is not None:
                condition["notExecuted"] = "else"
            elif branch in ("elif", "else"):
                condition["notExecuted"] = "then"

    # --- condiciones ------------------------------------------------
    def record_condition(self, frame, condition_id, line, expression, value):
        pending = self.pending.get(id(frame))
        if pending is None:
            return
        meta = self.conditions.get(condition_id)
        pending["snap"]["condition"] = {
            "id": condition_id,
            "line": line,
            "expression": expression,
            "result": bool(value),
            "hasElse": bool(meta and meta["orelse_first"] is not None),
        }
        pending["condition_meta"] = meta

    # --- funciones de trazado ---------------------------------------
    def global_trace(self, frame, event, arg):
        if event != "call" or frame.f_code.co_filename != FILENAME:
            return None

        if not self.started:
            # Inicio del programa (marco del modulo).
            self.started = True
            self.module_frame = frame
            self.depth[id(frame)] = 0
            self.call_ids[id(frame)] = 1
            self._add(
                {
                    "line": 0,
                    "event": "call",
                    "callType": "program",
                    "function": "<module>",
                    "depth": 0,
                    "callId": 1,
                    "scope": "module",
                    "before": {},
                }
            )
            return self.local_trace

        # Entrada a una funcion propia.
        depth = 0
        parent = frame.f_back
        while parent is not None:
            if parent.f_code.co_filename != FILENAME:
                break
            depth += 1
            parent = parent.f_back
        if depth > MAX_CALL_DEPTH:
            raise TraceLimitError(
                "Se supero la profundidad maxima de llamadas (%d)" % MAX_CALL_DEPTH
            )
        self.call_count += 1
        if self.call_count > MAX_CALLS:
            raise TraceLimitError("Se supero el limite de llamadas (%d)" % MAX_CALLS)

        call_id = self.next_call_id
        self.next_call_id += 1
        self.depth[id(frame)] = depth
        self.call_ids[id(frame)] = call_id
        snap = {
            "line": frame.f_lineno,
            "event": "call",
            "callType": "function",
            "function": frame.f_code.co_name,
            "depth": depth,
            "callId": call_id,
            "scope": "function",
            "before": capture_state(frame),
        }
        if self.module_frame is not None:
            snap["globals"] = capture_state(self.module_frame)
        self._add(snap)
        return self.local_trace

    def local_trace(self, frame, event, arg):
        fid = id(frame)
        if event == "line":
            self.raised.discard(fid)
            line = frame.f_lineno
            self._close_pending(frame, line)
            snap = {"line": line, "event": "line", "before": capture_state(frame)}
            snap.update(self._scope(frame))
            header, is_header = self._loop_for_line(line)
            if header is not None:
                key = (self.call_ids.get(fid, 1), header)
                if is_header:
                    self.header_counts[key] = self.header_counts.get(key, 0) + 1
                    snap["iteration"] = self.header_counts[key]
                else:
                    snap["iteration"] = self.header_counts.get(key, 0)
            pending = {"snap": self._add(snap), "header": header if is_header else None}
            self.pending[fid] = pending
        elif event == "exception":
            self._close_pending(frame, frame.f_lineno)
            exc = arg[1]
            snap = {
                "line": frame.f_lineno,
                "event": "exception",
                "before": capture_state(frame),
                "detail": "%s: %s" % (type(exc).__name__, exc),
            }
            snap.update(self._scope(frame))
            self._add(snap)
            self.raised.add(fid)
        elif event == "return":
            self._close_pending(frame, frame.f_lineno)
            if fid not in self.raised:
                snap = {
                    "line": frame.f_lineno,
                    "event": "return",
                    "before": capture_state(frame),
                }
                snap.update(self._scope(frame))
                if self.depth.get(fid, 0) > 0:
                    snap["returnValue"] = normalize(arg)
                self._add(snap)
            # Al salir de la funcion, sus locales dejan de existir: no se
            # mezclan con el marco llamador.
            self.pending.pop(fid, None)
            self.depth.pop(fid, None)
            self.call_ids.pop(fid, None)
            self.raised.discard(fid)
        return self.local_trace


def _error_line(exc):
    """Última línea del código del estudiante en la traza del error."""
    tb = exc.__traceback__
    line = None
    while tb is not None:
        if tb.tb_frame.f_code.co_filename == FILENAME:
            line = tb.tb_lineno
        tb = tb.tb_next
    return line


def run_traced(source):
    """Ejecuta `source` con seguimiento y devuelve un JSON (str)."""
    snapshots = []
    output = ""
    error = None
    error_kind = None
    error_line = None
    started = time.perf_counter()
    tracer = None
    try:
        tree = ast.parse(source, FILENAME)
        loops = find_loops(tree)
        conditions = find_conditionals(tree, source)
        code = compile(tree, FILENAME, "exec")
        tracer = Tracer(loops, conditions)
        namespace = {
            "__builtins__": dict(SAFE_BUILTINS),
            "__name__": "__traza__",
            "__traza_cond__": make_condition_recorder(tracer),
        }
        buffer = io.StringIO()
        previous = sys.gettrace()
        try:
            with redirect_stdout(buffer):
                sys.settrace(tracer.global_trace)
                try:
                    exec(code, namespace)
                finally:
                    sys.settrace(previous)
        finally:
            output = buffer.getvalue()
    except SyntaxError as exc:
        error = "SyntaxError: %s (linea %s)" % (exc.msg, exc.lineno)
        error_kind = "syntax"
        error_line = exc.lineno
    except TraceLimitError as exc:
        error = "TraceLimitError: %s" % exc
        error_kind = "resource"
    except Exception as exc:  # noqa: BLE001 - se informa al estudiante
        error = "%s: %s" % (type(exc).__name__, exc)
        error_kind = "runtime"
        error_line = _error_line(exc)
    if tracer is not None:
        snapshots = tracer.snapshots
    result = {
        "output": output,
        "snapshots": snapshots,
        "error": error,
        "pythonMs": round((time.perf_counter() - started) * 1000, 3),
    }
    if error is not None:
        result["errorKind"] = error_kind
        if error_line is not None:
            result["errorLine"] = error_line
    return json.dumps(result)
