"""TRAZA - motor de seguimiento de ejecucion basado en sys.settrace().

Modelo de captura
-----------------
sys.settrace() emite el evento "line" ANTES de ejecutar la linea. Por eso
cada evento "line" abre una instruccion "pendiente" con su estado previo
(`before`). Ese mismo estado, observado cuando llega el SIGUIENTE evento
(otra linea, "return" o "exception"), es el estado posterior (`after`) de la
instruccion pendiente. Nada se calcula ni se infiere: solo se copian estados
observados en el frame.

Eventos emitidos:
  call       inicio de la ejecucion (estado previo vacio)
  line       instruccion: before al llegar, after al llegar el siguiente evento
  return     fin del programa: before = estado final (no hay after)
  exception  la instruccion pendiente fallo: after = estado al fallar

Alcance: solo ejecuta ejercicios de demostracion de confianza. NO es un
sandbox de seguridad (ver docs/ARQUITECTURA.md).
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
MAX_STR = 200
MAX_DEPTH = 3
MAX_ITEMS = 50
SAFE_INT = 2**53 - 1

# Solo lo imprescindible para el ejercicio de demostracion.
SAFE_BUILTINS = {"print": print, "range": range}


class TraceLimitError(Exception):
    """Se supero el limite de eventos registrados."""


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


class Tracer:
    def __init__(self, loops):
        self.loops = loops
        self.snapshots = []
        self.pending = None
        self.header_counts = {}
        self.raised = False
        self._pending_header = None

    # --- utilidades -------------------------------------------------
    def _add(self, snap):
        if len(self.snapshots) >= MAX_SNAPSHOTS:
            raise TraceLimitError("Se supero el limite de pasos registrados")
        snap["sequence"] = len(self.snapshots)
        self.snapshots.append(snap)
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
        p = self.pending
        if p is None:
            return
        p["after"] = capture_state(frame)
        header = self._pending_header
        if header is not None and next_line is not None:
            first, last = self.loops[header]
            # El encabezado que no entra al cuerpo es la comprobacion de salida:
            # no pertenece a ninguna iteracion.
            if not (first <= next_line <= last):
                p.pop("iteration", None)
        self.pending = None
        self._pending_header = None

    # --- funciones de trazado ---------------------------------------
    def global_trace(self, frame, event, arg):
        if event == "call" and frame.f_code.co_filename == FILENAME:
            self._add({"line": 0, "event": "call", "before": {}})
            return self.local_trace
        return None

    def local_trace(self, frame, event, arg):
        if event == "line":
            self.raised = False
            line = frame.f_lineno
            self._close_pending(frame, line)
            snap = {"line": line, "event": "line", "before": capture_state(frame)}
            header, is_header = self._loop_for_line(line)
            if header is not None:
                if is_header:
                    self.header_counts[header] = self.header_counts.get(header, 0) + 1
                    self._pending_header = header
                snap["iteration"] = self.header_counts.get(header, 0)
            self.pending = self._add(snap)
        elif event == "exception":
            self._close_pending(frame, None)
            exc = arg[1]
            self._add({
                "line": frame.f_lineno,
                "event": "exception",
                "before": capture_state(frame),
                "detail": f"{type(exc).__name__}: {exc}",
            })
            self.raised = True
        elif event == "return":
            self._close_pending(frame, None)
            if not self.raised:
                self._add({
                    "line": frame.f_lineno,
                    "event": "return",
                    "before": capture_state(frame),
                })
        return self.local_trace


def run_traced(source):
    """Ejecuta `source` con seguimiento y devuelve un JSON (str)."""
    snapshots = []
    output = ""
    error = None
    started = time.perf_counter()
    tracer = None
    try:
        tree = ast.parse(source, FILENAME)
        code = compile(tree, FILENAME, "exec")
        tracer = Tracer(find_loops(tree))
        namespace = {"__builtins__": dict(SAFE_BUILTINS), "__name__": "__traza__"}
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
        error = f"SyntaxError: {exc.msg} (linea {exc.lineno})"
    except Exception as exc:  # noqa: BLE001 - se informa al estudiante
        error = f"{type(exc).__name__}: {exc}"
    if tracer is not None:
        snapshots = tracer.snapshots
    return json.dumps({
        "output": output,
        "snapshots": snapshots,
        "error": error,
        "pythonMs": round((time.perf_counter() - started) * 1000, 3),
    })
