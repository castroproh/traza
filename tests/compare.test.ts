import { describe, expect, it } from "vitest";
import demo from "./fixtures/demo-trace.cpython.json";
import { comparePrediction, finalState, observedIterations } from "../src/domain/compare";
import { parseEngineJson } from "../src/domain/parseTrace";
import type { ExecutionResult, StudentPrediction } from "../src/domain/types";

const raw = parseEngineJson(JSON.stringify(demo));
const result: ExecutionResult = {
  success: true,
  output: raw.output,
  snapshots: raw.snapshots,
  durationMs: 1,
};

const correct: StudentPrediction = {
  expectedOutput: "6",
  expectedVariables: { total: 6, numero: 3 },
  expectedVariableValues: { total: [1, 3, 6], numero: [1, 2, 3] },
  expectedIterations: [1, 2, 3],
  confidence: 80,
  explanation: "",
};

describe("comparePrediction", () => {
  it("obtiene el estado final y las iteraciones observadas", () => {
    expect(finalState(result)).toEqual({ total: 6, numero: 3 });
    expect(observedIterations(result)).toEqual([1, 2, 3]);
  });

  it("acepta una predicción correcta", () => {
    const cmp = comparePrediction(correct, result);
    expect(cmp.allMatch).toBe(true);
  });

  it("detecta una salida incorrecta", () => {
    const cmp = comparePrediction({ ...correct, expectedOutput: "7" }, result);
    expect(cmp.outputMatches).toBe(false);
    expect(cmp.allMatch).toBe(false);
  });

  it("detecta variables distintas y las que no existen", () => {
    const cmp = comparePrediction({ ...correct, expectedVariables: { total: 5, otra: 1 } }, result);
    expect(cmp.variables).toEqual([
      { name: "total", expected: 5, actual: 6, matches: false },
      { name: "otra", expected: 1, actual: undefined, matches: false },
    ]);
  });

  it("detecta un número de iteraciones distinto", () => {
    const cmp = comparePrediction({ ...correct, expectedIterations: [1, 2] }, result);
    expect(cmp.iterationsMatch).toBe(false);
    expect(cmp.observedIterations).toEqual([1, 2, 3]);
  });

  it("ignora saltos de línea finales en la salida", () => {
    expect(comparePrediction(correct, { ...result, output: "6\n" }).outputMatches).toBe(true);
  });
});
