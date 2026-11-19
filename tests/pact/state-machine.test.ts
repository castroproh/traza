import { describe, expect, it } from "vitest";
import { MAX_MICROTESTS_PER_SESSION } from "../../src/domain/diagnosis/selection";
import {
  canCompleteContrast,
  completeContrast,
  completeSession,
  contrastSelection,
  createPactSession,
  enterContrast,
  recordAnalysis,
  recordContrastAnswer,
  recordTransferAnalysis,
  submitPrediction,
  submitTransferPrediction,
} from "../../src/domain/pact/session";
import { PactTransitionError } from "../../src/domain/pact/types";
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

const t0 = new Date("2026-11-18T10:00:00.000Z");
const t1 = new Date("2026-11-18T10:01:00.000Z");
const t2 = new Date("2026-11-18T10:02:00.000Z");

describe("máquina de estados PACT (misión 0.7.0)", () => {
  it("crea una sesión en predicción con el ejercicio principal del patrón", () => {
    const range = createPactSession({ patternId: "RANGE", now: t0, sessionId: "local-test" });
    expect(range.stage).toBe("prediction");
    expect(range.mainExerciseId).toBe("range-principal");
    expect(range.prediction).toBeNull();
    expect(range.contrast.answers).toEqual([]);
    expect(range.schemaVersion).toBe(1);
    expect(range.instrumentVersion).toBe("0.8.0");

    const accumulators = createPactSession({ patternId: "ACUMULADORES", now: t0 });
    expect(accumulators.mainExerciseId).toBe("suma-1-3");
  });

  it("no permite saltar de predicción a contraste", () => {
    const session = createPactSession({ patternId: "RANGE", now: t0 });
    expect(() => enterContrast(session, t1)).toThrow(PactTransitionError);
    expect(() => recordAnalysis(session, rangeMainResult, t1)).toThrow(PactTransitionError);
  });

  it("guarda la predicción original y la hace inmutable", () => {
    const session = createPactSession({ patternId: "RANGE", now: t0 });
    const submitted = submitPrediction(session, rangePrediction, t1);
    expect(submitted.stage).toBe("analysis");
    expect(submitted.prediction?.expectedOutput).toBe("2, 3, 4, 5");
    expect(submitted.prediction?.submittedAt).toBe(t1.toISOString());
    expect(() => submitPrediction(submitted, rangePrediction, t2)).toThrow(/etapa|predicción/i);
  });

  it("rechaza predicciones incompletas", () => {
    const session = createPactSession({ patternId: "RANGE", now: t0 });
    expect(() =>
      submitPrediction(session, { ...rangePrediction, expectedOutput: " ", explanation: "" }, t1),
    ).toThrow(PactTransitionError);
  });

  it("registra el análisis real y solo entonces permite entrar en contraste", () => {
    let session = submitPrediction(createPactSession({ patternId: "RANGE", now: t0 }), rangePrediction, t1);
    expect(() => enterContrast(session, t2)).toThrow(/ejecutar/i);
    session = recordAnalysis(session, rangeMainResult, t2);
    expect(session.stage).toBe("analysis");
    expect(session.analysis?.allMatch).toBe(true);
    expect(session.analysis?.observedIterations).toEqual([1, 2, 3, 4]);
    const contrast = enterContrast(session, t2);
    expect(contrast.stage).toBe("contrast");
  });

  it("no permite completar el contraste sin micropruebas", () => {
    let session = submitPrediction(createPactSession({ patternId: "RANGE", now: t0 }), rangePrediction, t1);
    session = recordAnalysis(session, rangeMainResult, t2);
    session = enterContrast(session, t2);
    expect(canCompleteContrast(session)).toBe(false);
    expect(() => completeContrast(session, t2)).toThrow(/microprueba/i);
  });

  it("completa el recorrido RANGE con evidencia concluyente y transferencia", () => {
    let session = submitPrediction(createPactSession({ patternId: "RANGE", now: t0 }), rangePrediction, t1);
    session = recordAnalysis(session, rangeMainResult, t2);
    session = enterContrast(session, t2);

    const first = contrastSelection(session);
    expect(first.action).toBe("selected");
    expect(first.microtestId).toBe("range-cero-01");

    session = recordContrastAnswer(
      session,
      { microtestId: "range-cero-01", response: "0, 1, 2", observedOutput: "0\n1\n2\n" },
      t2,
    );
    expect(session.contrast.statuses["H-RANGE-01"]).toBe("contradicted");
    expect(session.contrast.statuses["H-RANGE-02"]).toBe("supported");
    expect(canCompleteContrast(session)).toBe(true);
    expect(() =>
      recordContrastAnswer(
        session,
        { microtestId: "range-cero-01", response: "0, 1, 2", observedOutput: "0\n1\n2\n" },
        t2,
      ),
    ).toThrow(/ya se respondió/i);

    session = completeContrast(session, t2);
    expect(session.stage).toBe("transfer");
    expect(session.transfer?.exerciseId).toBe("range-transferencia");
    expect(session.contrast.completed).toBe(true);

    session = submitTransferPrediction(session, rangeTransferPrediction, t2);
    expect(session.transfer?.prediction?.expectedOutput).toBe("5, 6, 7, 8");
    session = recordTransferAnalysis(session, rangeTransferResult, t2);
    expect(session.transfer?.evidence?.correct).toBe(true);
    expect(session.stage).toBe("transfer");
    session = completeSession(session, t2);
    expect(session.stage).toBe("completed");
    expect(session.completedAt).toBe(t2.toISOString());
  });

  it("completa el recorrido ACUMULADORES distinguiendo sustitución e inicialización", () => {
    let session = submitPrediction(
      createPactSession({ patternId: "ACUMULADORES", now: t0 }),
      accumulatorPrediction,
      t1,
    );
    session = recordAnalysis(session, accumulatorMainResult, t2);
    session = enterContrast(session, t2);

    expect(contrastSelection(session).microtestId).toBe("acc-final-01");
    session = recordContrastAnswer(
      session,
      { microtestId: "acc-final-01", response: "6", observedOutput: "6\n" },
      t2,
    );
    expect(session.contrast.statuses["H-ACC-01"]).toBe("supported");
    expect(session.contrast.statuses["H-ACC-02"]).toBe("contradicted");
    expect(session.contrast.statuses["H-ACC-03"]).toBe("insufficient");
    expect(canCompleteContrast(session)).toBe(false);

    expect(contrastSelection(session).microtestId).toBe("acc-inicial-01");
    session = recordContrastAnswer(
      session,
      { microtestId: "acc-inicial-01", response: "16", observedOutput: "16\n" },
      t2,
    );
    expect(session.contrast.statuses["H-ACC-01"]).toBe("supported");
    expect(session.contrast.statuses["H-ACC-02"]).toBe("contradicted");
    expect(session.contrast.statuses["H-ACC-03"]).toBe("contradicted");
    expect(session.contrast.unresolved).toEqual([]);
    expect(canCompleteContrast(session)).toBe(true);

    session = completeContrast(session, t2);
    expect(session.transfer?.exerciseId).toBe("acumuladores-transferencia");
    session = submitTransferPrediction(session, accumulatorTransferPrediction, t2);
    session = recordTransferAnalysis(session, accumulatorTransferResult, t2);
    expect(session.transfer?.evidence?.correct).toBe(true);
    session = completeSession(session, t2);
    expect(session.stage).toBe("completed");
  });

  it("permite terminar con evidencia insuficiente cuando se agotan las micropruebas", () => {
    let session = submitPrediction(createPactSession({ patternId: "RANGE", now: t0 }), rangePrediction, t1);
    session = recordAnalysis(session, rangeMainResult, t2);
    session = enterContrast(session, t2);

    let guard = 0;
    while (contrastSelection(session).action === "selected" && guard < MAX_MICROTESTS_PER_SESSION) {
      const selected = contrastSelection(session);
      if (!selected.microtestId) throw new Error("Selección sin microprueba");
      session = recordContrastAnswer(
        session,
        { microtestId: selected.microtestId, response: "No estoy seguro", observedOutput: "" },
        t2,
      );
      guard += 1;
    }
    expect(contrastSelection(session).action).toBe("insufficient");
    expect(session.contrast.unresolved).toEqual(["H-RANGE-01", "H-RANGE-02"]);
    expect(canCompleteContrast(session)).toBe(true);
  });

  it("rechaza micropruebas de otro patrón o respuestas vacías", () => {
    let session = submitPrediction(createPactSession({ patternId: "RANGE", now: t0 }), rangePrediction, t1);
    session = recordAnalysis(session, rangeMainResult, t2);
    session = enterContrast(session, t2);
    expect(() =>
      recordContrastAnswer(session, { microtestId: "acc-final-01", response: "6", observedOutput: "6" }, t2),
    ).toThrow(/no pertenece/i);
    expect(() =>
      recordContrastAnswer(session, { microtestId: "range-cero-01", response: " ", observedOutput: "" }, t2),
    ).toThrow(/vacía/i);
  });

  it("no completa la sesión sin analizar la transferencia", () => {
    let session = submitPrediction(createPactSession({ patternId: "RANGE", now: t0 }), rangePrediction, t1);
    session = recordAnalysis(session, rangeMainResult, t2);
    session = enterContrast(session, t2);
    session = recordContrastAnswer(
      session,
      { microtestId: "range-cero-01", response: "0, 1, 2", observedOutput: "0\n1\n2\n" },
      t2,
    );
    session = completeContrast(session, t2);
    session = submitTransferPrediction(session, rangeTransferPrediction, t2);
    expect(() => completeSession(session, t2)).toThrow(/ejecutar y analizar/i);
  });
});
