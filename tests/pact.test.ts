import { describe, expect, it } from "vitest";
import demo from "./fixtures/demo-trace.cpython.json";
import { comparePrediction } from "../src/domain/compare";
import { EXERCISES } from "../src/domain/exercises";
import {
  assessTransfer,
  canAccessPACTStage,
  createPACTSession,
  evaluateDiagnostic,
  getPACTPattern,
  startPACTSession,
} from "../src/domain/pact";
import { parseEngineJson } from "../src/domain/parseTrace";
import type { ExecutionResult, StudentPrediction } from "../src/domain/types";

function prediction(
  output: string,
  iterations: number,
  expectedVariableValues: Record<string, number[]>,
  confidence = 70,
): StudentPrediction {
  const expectedVariables: Record<string, number> = {};
  for (const [name, values] of Object.entries(expectedVariableValues)) {
    const finalValue = values.at(-1);
    if (finalValue !== undefined) expectedVariables[name] = finalValue;
  }
  return {
    expectedOutput: output,
    expectedVariables,
    expectedVariableValues,
    expectedIterations: Array.from({ length: iterations }, (_, index) => index + 1),
    confidence,
    explanation: "Seguí las actualizaciones de arriba hacia abajo.",
  };
}

function result(output: string, success = true): ExecutionResult {
  return { success, output, snapshots: [], durationMs: 1 };
}

/** Salida esperada del ejercicio heredado; falla si el catálogo está incompleto. */
function expectedOutputOf(exerciseId: string): string {
  const exercise = EXERCISES[exerciseId];
  if (!exercise) throw new Error(`Falta el ejercicio ${exerciseId}`);
  return exercise.expectedOutput;
}

const demoResult = (() => {
  const raw = parseEngineJson(JSON.stringify(demo));
  return { success: true, output: raw.output, snapshots: raw.snapshots, durationMs: 1 };
})();

describe("comparación de predicciones PACT", () => {
  it("encuentra la primera variable y línea que divergen", () => {
    const expected = prediction("6", 3, { numero: [1, 2, 3], total: [1, 4, 6] });
    const comparison = comparePrediction(expected, demoResult, 2);

    expect(comparison.firstDivergence).toMatchObject({
      kind: "variable",
      variable: "total",
      iteration: 2,
      line: 3,
      expected: 4,
      actual: 3,
    });
    expect(comparison.allMatch).toBe(false);
  });

  it("mantiene la confianza separada de la comparación del resultado", () => {
    const confident = prediction("6", 3, { numero: [1, 2, 3], total: [1, 3, 6] }, 100);
    const uncertain = { ...confident, confidence: 0 };
    expect(comparePrediction(confident, demoResult, 2).allMatch).toBe(true);
    expect(comparePrediction(uncertain, demoResult, 2).allMatch).toBe(true);
  });
});

describe("evidencia diagnóstica contrastiva", () => {
  it("distingue las dos interpretaciones de range() y contrasta otro intervalo", () => {
    const pattern = getPACTPattern("range-exclusive");
    const first = pattern.microtests[0]!;
    const second = pattern.microtests[1]!;
    const firstInclusive = first.hypothesisResponses["range-inclusive"]!;
    const firstEvidence = evaluateDiagnostic(
      first,
      prediction(firstInclusive.output, firstInclusive.iterations, firstInclusive.variableValues),
      result(expectedOutputOf(first.exerciseId)),
    );
    expect(firstEvidence.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ hypothesisId: "range-inclusive", status: "supports" }),
        expect.objectContaining({ hypothesisId: "range-exclusive", status: "contradicts" }),
      ]),
    );

    const secondExclusive = second.hypothesisResponses["range-exclusive"]!;
    const secondEvidence = evaluateDiagnostic(
      second,
      prediction(secondExclusive.output, secondExclusive.iterations, secondExclusive.variableValues),
      result(expectedOutputOf(second.exerciseId)),
    );
    expect(secondEvidence.evidence.find((item) => item.hypothesisId === "range-exclusive")?.status)
      .toBe("supports");
  });

  it("deja insuficiente la respuesta ambigua sobre el inicio cero", () => {
    const test = getPACTPattern("accumulator").microtests[0]!;
    const matchingResponse = test.hypothesisResponses["accumulate"]!;
    const evidence = evaluateDiagnostic(
      test,
      prediction(matchingResponse.output, matchingResponse.iterations, matchingResponse.variableValues),
      result(expectedOutputOf(test.exerciseId)),
    );

    expect(evidence.evidence.find((item) => item.hypothesisId === "accumulate")?.status)
      .toBe("insufficient");
    expect(evidence.evidence.find((item) => item.hypothesisId === "ignore-seed")?.status)
      .toBe("insufficient");
    expect(evidence.evidence.find((item) => item.hypothesisId === "replace")?.status)
      .toBe("contradicts");
  });

  it("separa la hipótesis sobre inicialización y no fuerza una etiqueta si no hay coincidencia", () => {
    const test = getPACTPattern("accumulator").microtests[1]!;
    const ignoresSeed = test.hypothesisResponses["ignore-seed"]!;
    const evidence = evaluateDiagnostic(
      test,
      prediction(ignoresSeed.output, ignoresSeed.iterations, ignoresSeed.variableValues),
      result(expectedOutputOf(test.exerciseId)),
    );
    expect(evidence.evidence.find((item) => item.hypothesisId === "ignore-seed")?.status)
      .toBe("supports");

    const unmatched = evaluateDiagnostic(
      test,
      prediction("999", 1, { pago: [99], saldo: [999] }),
      result(expectedOutputOf(test.exerciseId)),
    );
    expect(unmatched.evidence.every((item) => item.status === "insufficient")).toBe(true);
  });

  it("no interpreta respuestas cuando falla la ejecución de referencia", () => {
    const test = getPACTPattern("range-exclusive").microtests[0]!;
    const response = test.hypothesisResponses["range-exclusive"]!;
    const evidence = evaluateDiagnostic(
      test,
      prediction(response.output, response.iterations, response.variableValues),
      result("salida inesperada"),
    );
    expect(evidence.evidence.every((item) => item.status === "insufficient")).toBe(true);
  });
});

describe("transferencia y recorrido PACT", () => {
  it("describe un acierto explicado como evidencia consistente, no como certeza", () => {
    const expected = prediction("6", 3, { numero: [1, 2, 3], total: [1, 3, 6] }, 0);
    const assessment = assessTransfer(expected, demoResult, 2);
    expect(assessment.status).toBe("consistent");
    expect(assessment.explanation).toMatch(/no demuestra por sí solo/);
  });

  it("impide saltar etapas sin completar las condiciones previas", () => {
    const initial = createPACTSession();
    expect(canAccessPACTStage(initial, "analysis")).toBe(false);
    expect(canAccessPACTStage(initial, "contrast")).toBe(false);
    expect(canAccessPACTStage(initial, "transfer")).toBe(false);

    const selected = startPACTSession("range-exclusive");
    expect(canAccessPACTStage(selected, "prediction")).toBe(true);
    expect(canAccessPACTStage(selected, "analysis")).toBe(false);
  });
});
