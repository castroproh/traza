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
  const runTraced = pyodide.globals.get("run_traced");
  try {
    return parseEngineJson(runTraced(EXERCISES["suma-1-3"].code));
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
});
