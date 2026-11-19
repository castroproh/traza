import { describe, expect, it } from "vitest";
import demo from "../fixtures/demo-trace.cpython.json";
import { comparePrediction, finalState, observedIterations } from "../../src/domain/compare";
import { parseEngineJson } from "../../src/domain/parseTrace";
import { evaluatePattern } from "../../src/domain/diagnosis/evidence";
import { answerSession, createSession, deserializeSession, serializeSession } from "../../src/domain/session";
import { buildBankExportJson } from "../../src/domain/diagnosis/export";
import type { ExecutionResult, StudentPrediction } from "../../src/domain/types";

const raw = parseEngineJson(JSON.stringify(demo));
const result: ExecutionResult = { success: true, output: raw.output, snapshots: raw.snapshots, durationMs: 1 };

const correctPrediction: StudentPrediction = {
  expectedOutput: "6",
  expectedVariables: { total: 6, numero: 3 },
  expectedIterations: [1, 2, 3],
  confidence: 80,
  explanation: "",
};

describe("integración con el ciclo PACT y diagnóstico (misión 0.6.0)", () => {
  it("PACT: la predicción se analiza contra la ejecución real (conserva predicciones)", () => {
    const comparison = comparePrediction(correctPrediction, result);
    expect(comparison.allMatch).toBe(true);
    expect(finalState(result)).toEqual({ total: 6, numero: 3 });
    expect(observedIterations(result)).toEqual([1, 2, 3]);
  });

  it("PACT: una predicción incorrecta se contrasta sin romper el análisis", () => {
    const comparison = comparePrediction({ ...correctPrediction, expectedOutput: "7" }, result);
    expect(comparison.allMatch).toBe(false);
  });

  it("contraste: la evidencia del diagnóstico se registra en la sesión", () => {
    const session = createSession({ patternId: "RANGE" });
    const answer = answerSession(session, { microtestId: "range-iteracion-01", response: "1, 2, 3, 4" });
    expect(answer.outcome.statuses["H-RANGE-01"]).toBe("supported");
    expect(answer.outcome.statuses["H-RANGE-02"]).toBe("contradicted");
  });

  it("persistencia: recuperar la sesión permite registrar nueva evidencia", () => {
    const session = createSession({ patternId: "RANGE" });
    const answered = answerSession(session, { microtestId: "range-iteracion-01", response: "1, 2, 3, 4" });
    const restored = deserializeSession(serializeSession(answered.session));
    if (!restored) throw new Error("No se pudo restaurar la sesión");
    const next = answerSession(restored, { microtestId: "range-cero-01", response: "0, 1, 2" });
    // La sesión recuperada acumula la nueva evidencia sobre la anterior.
    expect(next.outcome.evaluations.length).toBeGreaterThan(0);
    expect(next.outcome.statuses["H-RANGE-01"]).toBe("contradicted");
    expect(next.outcome.statuses["H-RANGE-02"]).toBe("contradicted");
  });

  it("exportación: el JSON del banco incluye la versión del instrumento", () => {
    const parsed = JSON.parse(buildBankExportJson()) as { instrument: { version: string } };
    expect(parsed.instrument.version).toBe("0.8.0");
  });

  it("evaluación: el motor de evidencia sigue siendo reproducible", () => {
    const a = evaluatePattern("RANGE", [{ microtestId: "range-iteracion-01", response: "1, 2, 3, 4" }]);
    const b = evaluatePattern("RANGE", [{ microtestId: "range-iteracion-01", response: "1, 2, 3, 4" }]);
    expect(a).toEqual(b);
  });
});
