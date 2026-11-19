import { describe, expect, it } from "vitest";
import {
  analyzeResult,
  canonicalizeAnswer,
  findLoopLine,
  freezePrediction,
  parseIterations,
  transferEvidence,
  validatePrediction,
} from "../../src/domain/pact/analysis";
import { mainExerciseFor, transferExerciseFor } from "../../src/domain/pact/exercises";
import {
  accumulatorMainResult,
  accumulatorPrediction,
  accumulatorTransferPrediction,
  accumulatorTransferResult,
  rangeMainResult,
  rangePrediction,
  rangeTransferPrediction,
  rangeTransferResult,
} from "./helpers";

const now = new Date("2026-11-18T10:00:00.000Z");
const rangeDefinition = mainExerciseFor("RANGE");
const rangeTransferDefinition = transferExerciseFor("RANGE");
const accumulatorDefinition = mainExerciseFor("ACUMULADORES");
const accumulatorTransferDefinition = transferExerciseFor("ACUMULADORES");

describe("análisis de predicciones PACT (misión 0.7.0)", () => {
  it("detecta coincidencia completa sin inventar divergencias", () => {
    const analysis = analyzeResult(freezePrediction(rangePrediction, now), rangeMainResult, rangeDefinition, now);
    expect(analysis.outputMatches).toBe(true);
    expect(analysis.iterationsMatch).toBe(true);
    expect(analysis.allMatch).toBe(true);
    expect(analysis.divergence.kind).toBe("none");
    expect(analysis.observedIterations).toEqual([1, 2, 3, 4]);
  });

  it("localiza la divergencia en las iteraciones y en la línea del bucle", () => {
    const prediction = freezePrediction({ ...rangePrediction, expectedIterations: [1, 2, 3] }, now);
    const analysis = analyzeResult(prediction, rangeMainResult, rangeDefinition, now);
    expect(analysis.allMatch).toBe(false);
    expect(analysis.divergence.kind).toBe("iterations");
    expect(analysis.divergence.line).toBe(1);
    expect(analysis.divergence.description).toMatch(/3 iteraciones.*4/);
  });

  it("localiza la divergencia en el valor final de una variable", () => {
    const prediction = freezePrediction({ ...accumulatorPrediction, expectedVariables: { total: 5, numero: 3 } }, now);
    const analysis = analyzeResult(prediction, accumulatorMainResult, accumulatorDefinition, now);
    expect(analysis.divergence.kind).toBe("variables");
    expect(analysis.divergence.description).toMatch(/total/);
    expect(analysis.variableDiffs.find((diff) => diff.name === "total")?.matches).toBe(false);
  });

  it("localiza la divergencia en la salida cuando estructura y variables coinciden", () => {
    const prediction = freezePrediction({ ...rangePrediction, expectedOutput: "2, 3, 4" }, now);
    const analysis = analyzeResult(prediction, rangeMainResult, rangeDefinition, now);
    expect(analysis.divergence.kind).toBe("output");
    expect(analysis.divergence.description).toMatch(/La salida final no coincide/);
  });

  it("no penaliza las iteraciones cuando no se registraron", () => {
    const prediction = freezePrediction({ ...rangePrediction, expectedIterations: [] }, now);
    const analysis = analyzeResult(prediction, rangeMainResult, rangeDefinition, now);
    expect(analysis.iterationsPredicted).toBe(false);
    expect(analysis.iterationsMatch).toBe(true);
    expect(analysis.allMatch).toBe(true);
  });

  it("compara secuencias aunque cambie el formato de representación", () => {
    const prediction = freezePrediction(rangeTransferPrediction, now);
    const analysis = analyzeResult(prediction, rangeTransferResult, rangeTransferDefinition, now);
    expect(analysis.allMatch).toBe(true);
    expect(analysis.outputMatches).toBe(true);
  });

  it("analiza la transferencia de acumuladores con su propio ejercicio", () => {
    const prediction = freezePrediction(accumulatorTransferPrediction, now);
    const analysis = analyzeResult(prediction, accumulatorTransferResult, accumulatorTransferDefinition, now);
    expect(analysis.allMatch).toBe(true);
    expect(analysis.observedFinalState).toMatchObject({ ahorro: 150, mes: 4 });
  });

  it("la evidencia de transferencia no afirma dominio consolidado", () => {
    const good = analyzeResult(freezePrediction(rangeTransferPrediction, now), rangeTransferResult, rangeTransferDefinition, now);
    expect(transferEvidence(good)).toMatchObject({ correct: true });
    expect(transferEvidence(good).note).toMatch(/no demuestra/i);
    const bad = analyzeResult(
      freezePrediction({ ...rangeTransferPrediction, expectedOutput: "5, 6, 7, 8, 9" }, now),
      rangeTransferResult,
      rangeTransferDefinition,
      now,
    );
    expect(transferEvidence(bad).correct).toBe(false);
    expect(transferEvidence(bad).note).toMatch(/no se interpreta como un diagnóstico definitivo/i);
  });

  it("normaliza respuestas numéricas y de texto", () => {
    expect(canonicalizeAnswer("Página 5\nPágina 6", "numbers")).toBe("5,6");
    expect(canonicalizeAnswer("  A  \n\n B ", "text")).toBe("A\nB");
    expect(canonicalizeAnswer("-3, -2, -1", "numbers")).toBe("-3,-2,-1");
  });

  it("parsea iteraciones y rechaza valores inválidos", () => {
    expect(parseIterations("1, 2, 3")).toEqual([1, 2, 3]);
    expect(parseIterations("")).toEqual([]);
    expect(parseIterations("1, cero")).toBeNull();
    expect(parseIterations("0, 1")).toBeNull();
  });

  it("valida los campos de una predicción", () => {
    expect(validatePrediction(rangePrediction)).toEqual([]);
    expect(validatePrediction({ ...rangePrediction, expectedOutput: "", explanation: "", confidence: 101 })).toHaveLength(3);
    expect(validatePrediction({ ...rangePrediction, expectedIterations: [0] })).toHaveLength(1);
  });

  it("encuentra la línea del bucle del ejercicio", () => {
    expect(findLoopLine("total = 0\nfor numero in range(1, 4):\n    total = total + numero")).toBe(2);
    expect(findLoopLine("print(1)")).toBeUndefined();
  });
});
