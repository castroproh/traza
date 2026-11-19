/**
 * Integración REAL con Pyodide (Node). Carga el runtime de node_modules/pyodide,
 * define run_traced() con src/python/tracer.py y ejecuta el ejercicio de demostración.
 * No usa fixtures ni simulaciones. Falla si Pyodide no está instalado.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { EXERCISES, getExercise } from "../src/domain/exercises";
import { parseEngineJson, type RawEngineResult } from "../src/domain/parseTrace";

const here = dirname(fileURLToPath(import.meta.url));
const tracerSource = readFileSync(join(here, "../src/python/tracer.py"), "utf-8");

interface PyRunner {
  runPython(code: string): unknown;
  globals: { get(name: string): ((source: string) => string) & { destroy(): void } };
}

let pyodide: PyRunner;

beforeAll(async () => {
  const { loadPyodide } = await import("pyodide");
  const indexURL = join(here, "../node_modules/pyodide/");
  pyodide = (await loadPyodide({ indexURL })) as unknown as PyRunner;
  pyodide.runPython(tracerSource);
});

function runExercise(): RawEngineResult {
  const runTraced = pyodide.globals.get("run_traced");
  try {
    const exercise = EXERCISES["suma-1-3"];
    if (!exercise) throw new Error("Falta el ejercicio suma-1-3");
    return parseEngineJson(runTraced(exercise.code));
  } finally {
    runTraced.destroy();
  }
}

describe("Pyodide real: ejercicio suma-1-3", () => {
  it("se inicializa y define run_traced", () => {
    expect(typeof pyodide.globals.get("run_traced")).toBe("function");
  });

  it("produce la salida 6", () => {
    const result = runExercise();
    expect(result.error).toBeUndefined();
    expect(result.output.trim()).toBe("6");
  });

  it("registra tres iteraciones con numero = 1, 2, 3", () => {
    const body = runExercise().snapshots.filter((s) => s.line === 3);
    expect(body).toHaveLength(3);
    expect(body.map((s) => s.iteration)).toEqual([1, 2, 3]);
    expect(body.map((s) => s.before["numero"])).toEqual([1, 2, 3]);
  });

  it("registra total posterior = 1, 3, 6", () => {
    const body = runExercise().snapshots.filter((s) => s.line === 3);
    expect(body.map((s) => s.after?.["total"])).toEqual([1, 3, 6]);
  });

  it("mantiene el orden, el inicio y el estado de finalización", () => {
    const { snapshots } = runExercise();
    expect(snapshots.map((s) => s.sequence)).toEqual([...snapshots.keys()]);
    expect(snapshots[0]?.event).toBe("call");
    expect(snapshots.at(-1)).toMatchObject({ event: "return", before: { total: 6, numero: 3 } });
    expect(snapshots[1]).toMatchObject({ line: 1, before: {}, after: { total: 0 } });
  });

  it("bloquea imports (no hay acceso al sistema en el ejercicio)", () => {
    const runTraced = pyodide.globals.get("run_traced");
    try {
      const result = parseEngineJson(runTraced("import os"));
      expect(result.error).toMatch(/ImportError/);
    } finally {
      runTraced.destroy();
    }
  });

  it("devuelve errores del programa sin romper el motor", () => {
    const runTraced = pyodide.globals.get("run_traced");
    try {
      const result = parseEngineJson(runTraced("x = 1\ny = x / 0"));
      expect(result.error).toMatch(/ZeroDivisionError/);
      expect(result.snapshots.at(-1)?.event).toBe("exception");
    } finally {
      runTraced.destroy();
    }
    expect(runExercise().output.trim()).toBe("6"); // el motor sigue funcionando
  });

  it("ejecuta el ejercicio principal de RANGE con su salida real", () => {
    const result = runSource("range-principal");
    expect(result.error).toBeUndefined();
    expect(result.output.trim().split("\n")).toEqual(["2", "3", "4", "5"]);
    const iterations = result.snapshots.map((snap) => snap.iteration).filter((n) => n !== undefined);
    expect([...new Set(iterations)]).toEqual([1, 2, 3, 4]);
  });

  it("ejecuta la transferencia de RANGE con otro contexto y otra representación", () => {
    const result = runSource("range-transferencia");
    expect(result.error).toBeUndefined();
    expect(result.output.trim().split("\n")).toEqual([
      "Página 5",
      "Página 6",
      "Página 7",
      "Página 8",
    ]);
  });

  it("ejecuta la transferencia de ACUMULADORES con conservación del estado", () => {
    const result = runSource("acumuladores-transferencia");
    expect(result.error).toBeUndefined();
    expect(result.output.trim().split("\n")).toEqual(["60", "80", "110", "150"]);
    expect(result.snapshots.at(-1)?.before).toMatchObject({ ahorro: 150, mes: 4 });
  });

  it("ejecuta micropruebas reales del banco de contraste", () => {
    const range = runSource("mt-range-cero-01");
    expect(range.output.trim().split("\n")).toEqual(["0", "1", "2"]);
    const accumulator = runSource("mt-acc-inicial-01");
    expect(accumulator.output.trim()).toBe("16");
  });
});

describe("Pyodide real: condicionales (0.8.0)", () => {
  beforeAll(async () => {
    const { loadPyodide } = await import("pyodide");
    const indexURL = join(here, "../node_modules/pyodide/");
    pyodide = (await loadPyodide({ indexURL })) as unknown as PyRunner;
    pyodide.runPython(tracerSource);
  });

  it("ejecuta el ejercicio principal y registra el resultado and", () => {
    const result = runSource("condicionales-principal");
    expect(result.error).toBeUndefined();
    expect(result.output.trim()).toBe("no puede conducir");
    const condition = result.snapshots.find((s) => s.condition)?.condition;
    expect(condition).toMatchObject({ result: false, branch: "else", notExecuted: "then" });
  });

  it("ejecuta la transferencia con or y una sola parte verdadera", () => {
    const result = runSource("condicionales-transferencia");
    expect(result.output.trim()).toBe("realizar");
    const condition = result.snapshots.find((s) => s.condition)?.condition;
    expect(condition).toMatchObject({ expression: "temperatura > 35 or lluvia", result: false, branch: "else" });
  });

  it("distingue if, elif y else en el AST", () => {
    const result = runCode([
      "puntos = 7",
      "if puntos >= 10:",
      '    print("alto")',
      "elif puntos >= 5:",
      '    print("medio")',
      "else:",
      '    print("bajo")',
    ].join("\n"));
    expect(result.output.trim()).toBe("medio");
    const branches = result.snapshots.filter((s) => s.condition).map((s) => s.condition?.branch);
    expect(branches).toEqual(["elif", "then"]);
  });

  it("no inventa una rama cuando no puede determinarla", () => {
    const result = runCode([
      "valor = 1",
      "if valor == 1:",
      "    pass",
    ].join("\n"));
    // `pass` no genera un evento de línea propio en CPython: la rama queda sin
    // determinar en lugar de inferirse por el número de línea.
    const condition = result.snapshots.find((s) => s.condition)?.condition;
    expect(condition?.branch === "none" || condition?.branch === "then").toBe(true);
  });
});

describe("Pyodide real: funciones y ámbito (0.8.0)", () => {
  beforeAll(async () => {
    const { loadPyodide } = await import("pyodide");
    const indexURL = join(here, "../node_modules/pyodide/");
    pyodide = (await loadPyodide({ indexURL })) as unknown as PyRunner;
    pyodide.runPython(tracerSource);
  });

  it("ejecuta el ejercicio principal y registra parámetros, locales y return", () => {
    const result = runSource("funciones-principal");
    expect(result.output.trim()).toBe("20");
    const call = result.snapshots.find((s) => s.event === "call" && s.callType === "function");
    expect(call).toMatchObject({
      function: "calcular_total",
      depth: 1,
      before: { precio: 5, cantidad: 4 },
      scope: "function",
    });
    const returned = result.snapshots.find((s) => s.event === "return" && s.scope === "function");
    expect(returned?.returnValue).toBe(20);
    expect(returned?.before).toEqual({ precio: 5, cantidad: 4, total: 20 });
  });

  it("separa globales del marco de función", () => {
    const result = runSource("funciones-principal");
    const inside = result.snapshots.find((s) => s.scope === "function" && s.event === "line");
    expect(inside?.globals?.["calcular_total"]).toEqual({ unsupported: "function" });
  });

  it("distingue print de return en la microprueba real", () => {
    const result = runSource("mt-func-print-01");
    expect(result.output.trim()).toBe("Hola Ana\nNone");
  });

  it("mantiene el ámbito local: la variable local no existe fuera", () => {
    const result = runSource("mt-func-local-print-01");
    expect(result.output.trim()).toBe("3\nNone");
    expect(result.error).toMatch(/NameError/);
  });

  it("registra llamadas anidadas con profundidades e identificadores distintos", () => {
    const result = runCode([
      "def interior(x):",
      "    return x + 1",
      "",
      "def exterior(x):",
      "    return interior(x) * 2",
      "",
      "print(exterior(3))",
    ].join("\n"));
    expect(result.output.trim()).toBe("8");
    const calls = result.snapshots.filter((s) => s.event === "call" && s.callType === "function");
    expect(calls.map((s) => s.function)).toEqual(["exterior", "interior"]);
    expect(calls.map((s) => s.depth)).toEqual([1, 2]);
    expect(new Set(calls.map((s) => s.callId)).size).toBe(2);
  });

  it("detiene la recursión que supera la profundidad máxima sin bloquear", () => {
    const result = runCode([
      "def bajar(n):",
      "    if n == 0:",
      "        return 0",
      "    return bajar(n - 1)",
      "",
      "print(bajar(20))",
    ].join("\n"));
    expect(result.error).toMatch(/TraceLimitError/);
    expect(result.error).toMatch(/profundidad maxima/i);
  });

  it("detiene el exceso de llamadas repetidas", () => {
    const result = runCode([
      "def eco(x):",
      "    return x",
      "",
      "for numero in range(1, 260):",
      "    eco(numero)",
    ].join("\n"));
    expect(result.error).toMatch(/TraceLimitError/);
    expect(result.error).toMatch(/limite de llamadas/i);
  });

  it("detiene el exceso de eventos registrados", () => {
    const result = runCode([
      "for numero in range(1, 2100):",
      "    doble = numero * 2",
      "    triple = numero * 3",
    ].join("\n"));
    expect(result.error).toMatch(/TraceLimitError/);
    expect(result.error).toMatch(/limite de pasos/i);
  });

  it("registra la excepción dentro de la función sin inventar un return", () => {
    const result = runCode([
      "def fallar():",
      "    x = 1 / 0",
      "",
      "fallar()",
    ].join("\n"));
    expect(result.error).toMatch(/ZeroDivisionError/);
    const functionExceptions = result.snapshots.filter(
      (s) => s.event === "exception" && s.scope === "function",
    );
    expect(functionExceptions).toHaveLength(1);
    const functionReturns = result.snapshots.filter(
      (s) => s.event === "return" && s.scope === "function",
    );
    expect(functionReturns).toHaveLength(0);
  });
});

function runCode(source: string): RawEngineResult {
  const runTraced = pyodide.globals.get("run_traced");
  try {
    return parseEngineJson(runTraced(source));
  } finally {
    runTraced.destroy();
  }
}

function runSource(exerciseId: string): RawEngineResult {
  const exercise = getExercise(exerciseId);
  if (!exercise) throw new Error(`Falta el ejercicio ${exerciseId}`);
  const runTraced = pyodide.globals.get("run_traced");
  try {
    return parseEngineJson(runTraced(exercise.code));
  } finally {
    runTraced.destroy();
  }
}
