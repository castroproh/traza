"""TRAZA: bounded tracer for the small Python subset used by built-in exercises.

The AST checks and runtime limits constrain this demonstration engine; they are
not a security sandbox for hostile code.
"""

import ast
import io
import json
import math
import operator
import sys
import time
from contextlib import redirect_stdout

FILENAME = "<traza>"
LIMITS = {
    "source_chars": 4096,
    "ast_nodes": 512,
    "ast_depth": 48,
    "integer_bits": 53,
    "float_magnitude": 1e100,
    "string_chars": 1024,
    "collection_items": 100,
    "variables": 50,
    "range_iterations": 1000,
    "output_chars": 8192,
    "print_arguments": 20,
    "snapshots": 2000,
    "snapshot_string_chars": 200,
    "snapshot_depth": 3,
    "snapshot_items": 50,
}
SAFE_INT = 2**53 - 1


class UnsupportedProgramError(Exception):
    def __init__(self, feature, line):
        super().__init__(feature)
        self.feature = feature
        self.line = line


class ResourceLimitError(Exception):
    def __init__(self, line=None):
        super().__init__("Se excedió un límite de ejecución.")
        self.line = line


class TraceLimitError(ResourceLimitError):
    """Se superó el límite de eventos registrados."""


class ProgramValidator(ast.NodeVisitor):
    ALLOWED_NODES = (
        ast.Module,
        ast.Assign,
        ast.AugAssign,
        ast.For,
        ast.If,
        ast.Expr,
        ast.Call,
        ast.Name,
        ast.Load,
        ast.Store,
        ast.Constant,
        ast.BinOp,
        ast.UnaryOp,
        ast.Compare,
        ast.BoolOp,
        ast.List,
        ast.Tuple,
        ast.Dict,
        ast.keyword,
        ast.Add,
        ast.Sub,
        ast.Mult,
        ast.Div,
        ast.FloorDiv,
        ast.Mod,
        ast.UAdd,
        ast.USub,
        ast.Not,
        ast.Eq,
        ast.NotEq,
        ast.Lt,
        ast.LtE,
        ast.Gt,
        ast.GtE,
        ast.And,
        ast.Or,
        ast.Pass,
        ast.Break,
        ast.Continue,
    )

    def __init__(self, tree):
        self.tree = tree
        self.loop_depth = 0
        self.variables = set()
        self.allowed_ranges = set()

    def validate(self):
        count = 0
        stack = [(self.tree, 1)]
        while stack:
            node, depth = stack.pop()
            count += 1
            if count > LIMITS["ast_nodes"] or depth > LIMITS["ast_depth"]:
                raise ResourceLimitError(getattr(node, "lineno", 1))
            stack.extend((child, depth + 1) for child in ast.iter_child_nodes(node))
        self.visit(self.tree)
        if len(self.variables) > LIMITS["variables"]:
            raise ResourceLimitError(1)

    def generic_visit(self, node):
        if not isinstance(node, self.ALLOWED_NODES):
            raise UnsupportedProgramError(self._feature(node), getattr(node, "lineno", 1))
        super().generic_visit(node)

    @staticmethod
    def _feature(node):
        features = {
            ast.Attribute: "el acceso a atributos",
            ast.FunctionDef: "las funciones",
            ast.AsyncFunctionDef: "las funciones",
            ast.Lambda: "las funciones",
            ast.Import: "las importaciones",
            ast.ImportFrom: "las importaciones",
            ast.While: "los bucles while",
            ast.With: "los bloques with",
            ast.Try: "los bloques try",
            ast.ListComp: "las comprensiones",
            ast.DictComp: "las comprensiones",
            ast.SetComp: "las comprensiones",
            ast.GeneratorExp: "las comprensiones",
            ast.Pow: "la potencia",
            ast.Subscript: "el acceso por índice",
        }
        for node_type, feature in features.items():
            if isinstance(node, node_type):
                return feature
        return "esta construcción"

    def visit_Name(self, node):
        if node.id.startswith("_") or node.id in ("print", "range") and isinstance(node.ctx, ast.Store):
            raise UnsupportedProgramError("el uso de nombres reservados", node.lineno)
        if isinstance(node.ctx, ast.Store):
            self.variables.add(node.id)

    def visit_Constant(self, node):
        value = node.value
        if isinstance(value, int) and not isinstance(value, bool):
            if value.bit_length() > LIMITS["integer_bits"]:
                raise ResourceLimitError(node.lineno)
        elif isinstance(value, float):
            if not math.isfinite(value) or abs(value) > LIMITS["float_magnitude"]:
                raise ResourceLimitError(node.lineno)
        elif isinstance(value, str) and len(value) > LIMITS["string_chars"]:
            raise ResourceLimitError(node.lineno)
        elif value is not None and not isinstance(value, (bool, int, float, str)):
            raise UnsupportedProgramError("este tipo de literal", node.lineno)

    def visit_List(self, node):
        if len(node.elts) > LIMITS["collection_items"]:
            raise ResourceLimitError(node.lineno)
        self.generic_visit(node)

    def visit_Tuple(self, node):
        if len(node.elts) > LIMITS["collection_items"]:
            raise ResourceLimitError(node.lineno)
        self.generic_visit(node)

    def visit_Dict(self, node):
        if len(node.keys) > LIMITS["collection_items"]:
            raise ResourceLimitError(node.lineno)
        self.generic_visit(node)

    def visit_Assign(self, node):
        for target in node.targets:
            if not isinstance(target, ast.Name):
                raise UnsupportedProgramError("la asignación a destinos compuestos", node.lineno)
        self.generic_visit(node)

    def visit_AugAssign(self, node):
        if not isinstance(node.target, ast.Name):
            raise UnsupportedProgramError("la asignación a destinos compuestos", node.lineno)
        self.generic_visit(node)

    def visit_For(self, node):
        if self.loop_depth:
            raise UnsupportedProgramError("los bucles anidados", node.lineno)
        if node.orelse:
            raise UnsupportedProgramError("el bloque else de un bucle", node.lineno)
        if not isinstance(node.target, ast.Name):
            raise UnsupportedProgramError("los destinos compuestos en un bucle", node.lineno)
        if not (
            isinstance(node.iter, ast.Call)
            and isinstance(node.iter.func, ast.Name)
            and node.iter.func.id == "range"
        ):
            raise UnsupportedProgramError("los bucles for deben usar range()", node.lineno)
        self.allowed_ranges.add(id(node.iter))
        self.loop_depth += 1
        try:
            self.generic_visit(node)
        finally:
            self.loop_depth -= 1

    def visit_Call(self, node):
        if not isinstance(node.func, ast.Name) or node.func.id not in ("print", "range"):
            raise UnsupportedProgramError("esta llamada a función", node.lineno)
        if node.func.id == "range":
            if id(node) not in self.allowed_ranges:
                raise UnsupportedProgramError("range() fuera del encabezado de un for", node.lineno)
            if not 1 <= len(node.args) <= 3 or node.keywords:
                raise UnsupportedProgramError("los argumentos de range()", node.lineno)
        else:
            if len(node.args) > LIMITS["print_arguments"]:
                raise ResourceLimitError(node.lineno)
            if any(keyword.arg not in ("sep", "end") for keyword in node.keywords):
                raise UnsupportedProgramError("los argumentos de print()", node.lineno)
        self.generic_visit(node)


class SafeOperatorTransformer(ast.NodeTransformer):
    def visit_BinOp(self, node):
        self.generic_visit(node)
        call = ast.Call(
            func=ast.Name(id="__traza_safe_binary", ctx=ast.Load()),
            args=[ast.Constant(type(node.op).__name__), node.left, node.right],
            keywords=[],
        )
        return ast.copy_location(call, node)

    def visit_AugAssign(self, node):
        self.generic_visit(node)
        call = ast.Call(
            func=ast.Name(id="__traza_safe_binary", ctx=ast.Load()),
            args=[
                ast.Constant("I" + type(node.op).__name__),
                ast.Name(id=node.target.id, ctx=ast.Load()),
                node.value,
            ],
            keywords=[],
        )
        return ast.copy_location(ast.Assign(targets=[node.target], value=call), node)


def _check_value(value, line=None, depth=0):
    if depth > LIMITS["snapshot_depth"]:
        raise ResourceLimitError(line)
    if value is None or isinstance(value, bool):
        return
    if isinstance(value, int):
        if value.bit_length() > LIMITS["integer_bits"]:
            raise ResourceLimitError(line)
        return
    if isinstance(value, float):
        if not math.isfinite(value) or abs(value) > LIMITS["float_magnitude"]:
            raise ResourceLimitError(line)
        return
    if isinstance(value, str):
        if len(value) > LIMITS["string_chars"]:
            raise ResourceLimitError(line)
        return
    if isinstance(value, (list, tuple)):
        if len(value) > LIMITS["collection_items"]:
            raise ResourceLimitError(line)
        for item in value:
            _check_value(item, line, depth + 1)
        return
    if isinstance(value, dict):
        if len(value) > LIMITS["collection_items"]:
            raise ResourceLimitError(line)
        for key, item in value.items():
            _check_value(key, line, depth + 1)
            _check_value(item, line, depth + 1)
        return
    raise UnsupportedProgramError("este tipo de valor", line or 1)


def _safe_binary(operation_name, left, right):
    _check_value(left)
    _check_value(right)
    if operation_name in ("Mult", "IMult"):
        sequence, count = (left, right) if isinstance(right, int) else (right, left)
        if isinstance(sequence, (str, list, tuple)) and isinstance(count, int):
            limit_key = "string_chars" if isinstance(sequence, str) else "collection_items"
            if len(sequence) * max(0, count) > LIMITS[limit_key]:
                raise ResourceLimitError()
    operations = {
        "Add": operator.add,
        "Sub": operator.sub,
        "Mult": operator.mul,
        "Div": operator.truediv,
        "FloorDiv": operator.floordiv,
        "Mod": operator.mod,
        "IAdd": operator.iadd,
        "ISub": operator.isub,
        "IMult": operator.imul,
        "IDiv": operator.itruediv,
        "IFloorDiv": operator.ifloordiv,
        "IMod": operator.imod,
    }
    operation = operations.get(operation_name)
    if operation is None:
        raise UnsupportedProgramError("esta operación", 1)
    result = operation(left, right)
    _check_value(result)
    return result


def _bounded_range(*args):
    if any(type(value) is not int for value in args):
        raise UnsupportedProgramError("range() requiere números enteros", 1)
    try:
        result = range(*args)
        count = len(result)
    except (OverflowError, TypeError):
        raise ResourceLimitError() from None
    if count > LIMITS["range_iterations"]:
        raise ResourceLimitError()
    return result


def _bounded_print(buffer):
    written = 0

    def print_values(*values, sep=" ", end="\n"):
        nonlocal written
        if not isinstance(sep, str) or not isinstance(end, str):
            raise UnsupportedProgramError("sep y end deben ser cadenas", 1)
        text = sep.join(str(value) for value in values) + end
        if written + len(text) > LIMITS["output_chars"]:
            raise ResourceLimitError()
        buffer.write(text)
        written += len(text)

    return print_values


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
        limit = LIMITS["snapshot_string_chars"]
        return value if len(value) <= limit else value[:limit] + "..."
    if depth >= LIMITS["snapshot_depth"]:
        return {"unsupported": "profundidad máxima"}
    if isinstance(value, (list, tuple)):
        limit = LIMITS["snapshot_items"]
        return [normalize(v, depth + 1) for v in list(value)[:limit]]
    if isinstance(value, dict):
        out = {}
        limit = LIMITS["snapshot_items"]
        for key, item in list(value.items())[:limit]:
            out[str(key)] = normalize(item, depth + 1)
        return out
    return {"unsupported": type(value).__name__}


def capture_state(frame):
    state = {}
    values = [(name, value) for name, value in frame.f_locals.items() if not name.startswith("__")]
    if len(values) > LIMITS["variables"]:
        raise ResourceLimitError(frame.f_lineno)
    for name, value in values:
        _check_value(value, frame.f_lineno)
        state[name] = normalize(value)
    return state


def find_loops(tree):
    """Devuelve {línea_encabezado: (primera_línea_cuerpo, última_línea_cuerpo)}."""
    loops = {}
    for node in ast.walk(tree):
        if isinstance(node, ast.For) and node.body:
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

    def _add(self, snap):
        if len(self.snapshots) >= LIMITS["snapshots"]:
            raise TraceLimitError()
        snap["sequence"] = len(self.snapshots)
        self.snapshots.append(snap)
        return snap

    def _loop_for_line(self, line):
        if line in self.loops:
            return line, True
        best = None
        for header, (first, last) in self.loops.items():
            if first <= line <= last and (best is None or header > best):
                best = header
        return best, False

    def _close_pending(self, frame, next_line):
        pending = self.pending
        if pending is None:
            return
        pending["after"] = capture_state(frame)
        header = self._pending_header
        if header is not None and next_line is not None:
            first, last = self.loops[header]
            if not (first <= next_line <= last):
                pending.pop("iteration", None)
        self.pending = None
        self._pending_header = None

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
            detail = "No se puede dividir entre cero." if isinstance(exc, ZeroDivisionError) else "La instrucción produjo un error."
            self._add({
                "line": frame.f_lineno,
                "event": "exception",
                "before": capture_state(frame),
                "detail": detail,
            })
            self.raised = True
        elif event == "return":
            self._close_pending(frame, frame.f_lineno)
            if not self.raised:
                self._add({
                    "line": frame.f_lineno,
                    "event": "return",
                    "before": capture_state(frame),
                })
        return self.local_trace


def _error_line(exc):
    line = getattr(exc, "line", None) or getattr(exc, "lineno", None)
    traceback = exc.__traceback__
    while traceback:
        if traceback.tb_frame.f_code.co_filename == FILENAME:
            line = traceback.tb_lineno
        traceback = traceback.tb_next
    return line


def _error_details(exc):
    if isinstance(exc, SyntaxError):
        return "syntax", "Hay un error de sintaxis.", exc.lineno
    if isinstance(exc, UnsupportedProgramError):
        return "unsupported", f"Todavía no admitimos {exc.feature}.", exc.line
    if isinstance(exc, ResourceLimitError):
        return "resource", "El programa excedió un límite de tamaño o ejecución.", _error_line(exc)
    if isinstance(exc, ZeroDivisionError):
        return "runtime", "No se puede dividir entre cero.", _error_line(exc)
    if isinstance(exc, NameError):
        return "runtime", "El programa usa una variable que no está definida.", _error_line(exc)
    if isinstance(exc, TypeError):
        return "runtime", "El programa intentó combinar valores incompatibles.", _error_line(exc)
    if isinstance(exc, MemoryError):
        return "resource", "El programa superó la memoria permitida.", _error_line(exc)
    return "runtime", "No se pudo completar el programa.", _error_line(exc)


def run_traced(source):
    """Ejecuta un programa limitado y devuelve un JSON (str)."""
    snapshots = []
    output = ""
    error = None
    error_kind = None
    error_line = None
    started = time.perf_counter()
    tracer = None
    buffer = io.StringIO()
    try:
        if not isinstance(source, str) or len(source) > LIMITS["source_chars"]:
            raise ResourceLimitError(1)
        tree = ast.parse(source, FILENAME)
        ProgramValidator(tree).validate()
        transformed = SafeOperatorTransformer().visit(tree)
        ast.fix_missing_locations(transformed)
        code = compile(transformed, FILENAME, "exec")
        tracer = Tracer(find_loops(tree))
        namespace = {
            "__builtins__": {
                "print": _bounded_print(buffer),
                "range": _bounded_range,
            },
            "__traza_safe_binary": _safe_binary,
        }
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
    except Exception as exc:
        error_kind, error, error_line = _error_details(exc)
    if tracer is not None:
        snapshots = tracer.snapshots
    return json.dumps({
        "output": output,
        "snapshots": snapshots,
        "error": error,
        "errorKind": error_kind,
        "errorLine": error_line,
        "pythonMs": round((time.perf_counter() - started) * 1000, 3),
    })
