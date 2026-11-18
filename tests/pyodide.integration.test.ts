/**
 * Integración REAL con Pyodide (Node). Carga el runtime de node_modules/pyodide,
 * define run_traced() con src/python/tracer.py y ejecuta el ejercicio de demostración.
 * No usa fixtures ni simulaciones. Falla si Pyodide no está instalado.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { EXERCISES } from "../src/domain/exercises";
import { parseEngineJson, type RawEngineResult } from "../src/domain/parseTrace";

const here = dirname(fileURLToPath(import.meta.url));
const tracerSource = readFileSync(join(here, "../src/python/tracer.py"), "utf-8");

interface PyRunner {
  runPython(code: string): unknown;
  globals: { get(name: string): ((source: string) => string) & { destroy(): void } };
}

let pyodide: PyRunner;

function runExercise(): RawEngineResult {
  return runSource(EXERCISES["suma-1-3"].code);
}

function runSource(source: string): RawEngineResult {
  const runTraced = pyodide.globals.get("run_traced");
  try {
    return parseEngineJson(runTraced(source));
  } finally {
    runTraced.destroy();
  }
}

describe("Pyodide real: ejercicio suma-1-3", () => {
  beforeAll(async () => {
    const { loadPyodide } = await import("pyodide");
    // Carga el runtime desde el paquete instalado (necesario en ejecución bajo Vitest/Node).
    const indexURL = join(here, "../node_modules/pyodide/");
    pyodide = (await loadPyodide({ indexURL })) as unknown as PyRunner;
    pyodide.runPython(tracerSource);
  });

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

  it("no cuenta como iteración la comprobación final de un for al terminar el programa", () => {
    const result = runSource("total = 0\nfor i in range(1):\n    total = total + i");
    const headers = result.snapshots.filter((snapshot) => snapshot.event === "line" && snapshot.line === 2);
    expect(headers.map((snapshot) => snapshot.iteration)).toEqual([1, undefined]);
  });

  it("mantiene el orden, el inicio y el estado de finalización", () => {
    const { snapshots } = runExercise();
    expect(snapshots.map((s) => s.sequence)).toEqual([...snapshots.keys()]);
    expect(snapshots[0]?.event).toBe("call");
    expect(snapshots.at(-1)).toMatchObject({ event: "return", before: { total: 6, numero: 3 } });
    expect(snapshots[1]).toMatchObject({ line: 1, before: {}, after: { total: 0 } });
  });

  it("rechaza construcciones no admitidas antes de ejecutarlas", () => {
    for (const source of [
      "import os",
      "def f():\n    return 1",
      "for i in range(2):\n    for j in range(2):\n        print(i, j)",
      "while True:\n    pass",
      "x = 2 ** 100",
    ]) {
      const result = runSource(source);
      expect(result.errorKind).toBe("unsupported");
      expect(result.snapshots).toEqual([]);
    }
  });

  it("devuelve errores de sintaxis y ejecución con tipo y línea sin filtrar excepciones", () => {
    const syntax = runSource("x =");
    expect(syntax.errorKind).toBe("syntax");
    expect(syntax.errorLine).toBe(1);
    expect(syntax.snapshots).toEqual([]);

    const runtime = runSource("x = 1\ny = x / 0");
    expect(runtime.errorKind).toBe("runtime");
    expect(runtime.errorLine).toBe(2);
    expect(runtime.error).toMatch(/dividir entre cero/);
    expect(runtime.error).not.toMatch(/ZeroDivisionError/);
    expect(runtime.snapshots.at(-1)?.event).toBe("exception");
  });

  it("rechaza entradas que exceden los límites de tamaño antes de ejecutarlas", () => {
    const tooLong = runSource(`x = 1\n#${"x".repeat(5000)}`);
    const tooManyNodes = runSource("x = 1\n".repeat(200));
    const tooDeep = runSource(`x = ${"-".repeat(60)}1`);
    const hugeInteger = runSource(`x = ${"9".repeat(30)}`);
    const longString = runSource(`x = "${"a".repeat(1100)}"`);
    const largeCollection = runSource(`x = [${Array.from({ length: 101 }, () => "0").join(",")}]`);

    for (const result of [tooLong, tooManyNodes, tooDeep, hugeInteger, longString, largeCollection]) {
      expect(result.errorKind).toBe("resource");
      expect(result.snapshots).toEqual([]);
    }
  });

  it("limita range, crecimiento aritmético, colecciones y salida", () => {
    const range = runSource("for i in range(1001):\n    pass");
    const growth = runSource("x = 2\nfor i in range(20):\n    x = x * x");
    const collection = runSource("x = [0] * 101");
    const output = runSource('print("a" * 9000)');

    for (const result of [range, growth, collection, output]) {
      expect(result.errorKind).toBe("resource");
    }
    expect(growth.errorLine).toBe(3);
  });

  it("detiene una traza excesiva y permite volver a usar Pyodide", () => {
    const result = runSource("total = 0\nfor i in range(1000):\n    total = total + i");
    expect(result.errorKind).toBe("resource");
    expect(result.error).toMatch(/límite/);
    expect(runExercise().output.trim()).toBe("6"); // el motor sigue funcionando
  });
});
