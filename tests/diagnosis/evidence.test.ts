import { describe, expect, it } from "vitest";
import { evaluateMicrotest, evaluatePattern, educationalFeedback, interpretResponse, normalizeResponse } from "../../src/domain/diagnosis/evidence";
import { getMicrotest } from "../../src/domain/diagnosis/microtests";

describe("motor de interpretación de evidencias (misión 0.6.0)", () => {
  it("normaliza respuestas para comparar (sin espacios)", () => {
    expect(normalizeResponse("  1, 2, 3  ")).toBe("1,2,3");
    expect(normalizeResponse("1, 2, 3")).toBe("1,2,3");
  });

  it("marca como apoyo cuando la respuesta coincide con la predicción de la hipótesis", () => {
    const m = getMicrotest("range-iteracion-01");
    if (!m) throw new Error("Falta range-iteracion-01");
    const evaluation = interpretResponse(m, "H-RANGE-01", "1, 2, 3, 4");
    expect(evaluation.state).toBe("supports");
    expect(evaluation.hypothesisId).toBe("H-RANGE-01");
    expect(evaluation.microtestId).toBe("range-iteracion-01");
  });

  it("marca como contradicción cuando la respuesta coincide con el resultado correcto", () => {
    const m = getMicrotest("range-iteracion-01");
    if (!m) throw new Error("Falta range-iteracion-01");
    const evaluation = interpretResponse(m, "H-RANGE-01", "1, 2, 3");
    expect(evaluation.state).toBe("contradicts");
  });

  it("marca como insuficiente una respuesta ambigua", () => {
    const m = getMicrotest("acc-final-01");
    if (!m) throw new Error("Falta acc-final-01");
    const evaluation = interpretResponse(m, "H-ACC-01", "No estoy seguro");
    expect(evaluation.state).toBe("insufficient");
  });

  it("evalúa todas las hipótesis objetivo de una microprueba", () => {
    const m = getMicrotest("acc-final-01");
    if (!m) throw new Error("Falta acc-final-01");
    const evaluations = evaluateMicrotest(m, "6");
    expect(evaluations.map((e) => e.hypothesisId)).toEqual(["H-ACC-01", "H-ACC-02"]);
    expect(evaluations.find((e) => e.hypothesisId === "H-ACC-01")?.state).toBe("supports");
    expect(evaluations.find((e) => e.hypothesisId === "H-ACC-02")?.state).toBe("contradicts");
  });

  it("mantiene la evidencia insuficiente cuando la respuesta está catalogada como ambigua", () => {
    const m = getMicrotest("range-tabla-01");
    if (!m) throw new Error("Falta range-tabla-01");
    const evaluations = evaluateMicrotest(m, "del 1 al 3");
    expect(evaluations.every((e) => e.state === "insufficient")).toBe(true);
  });

  it("no asigna apoyo a una respuesta incorrecta", () => {
    const m = getMicrotest("acc-final-01");
    if (!m) throw new Error("Falta acc-final-01");
    const evaluation = interpretResponse(m, "H-ACC-01", "9");
    expect(evaluation.state).not.toBe("supports");
  });

  it("evalúa el patrón completo y resume el estado de cada hipótesis", () => {
    const outcome = evaluatePattern("RANGE", [{ microtestId: "range-iteracion-01", response: "1, 2, 3, 4" }]);
    expect(outcome.statuses["H-RANGE-01"]).toBe("supported");
    expect(outcome.statuses["H-RANGE-02"]).toBe("contradicted");
    expect(outcome.resolved).toBe(true);
    expect(outcome.unresolved).toEqual([]);

    const accOutcome = evaluatePattern("ACUMULADORES", [{ microtestId: "acc-inicial-01", response: "16" }]);
    expect(accOutcome.statuses["H-ACC-01"]).toBe("supported");
    expect(accOutcome.statuses["H-ACC-02"]).toBe("contradicted");
    expect(accOutcome.statuses["H-ACC-03"]).toBe("contradicted");
  });

  it("produce retroalimentación centrada en la evidencia", () => {
    const m = getMicrotest("acc-final-01");
    if (!m) throw new Error("Falta acc-final-01");
    const supports = interpretResponse(m, "H-ACC-01", "6");
    const contradicts = interpretResponse(m, "H-ACC-02", "6");
    const insufficient = interpretResponse(m, "H-ACC-01", "No estoy seguro");
    expect(educationalFeedback(supports)).toMatch(/predicción coincide/);
    expect(educationalFeedback(contradicts)).toMatch(/coincide con el comportamiento correcto/);
    expect(educationalFeedback(insufficient)).toMatch(/no permite distinguir/);
  });
});
