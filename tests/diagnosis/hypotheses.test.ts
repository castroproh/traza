import { describe, expect, it } from "vitest";
import { HYPOTHESES, PATTERN_IDS, PATTERNS, patternHypotheses } from "../../src/domain/diagnosis/hypotheses";
import { isDiagnosisPatternId, isHypothesisId } from "../../src/domain/diagnosis/hypotheses";

describe("modelo de hipótesis (misiones 0.6.0 y 0.8.0)", () => {
  it("define los cuatro patrones esperados", () => {
    expect(PATTERN_IDS).toEqual(["RANGE", "ACUMULADORES", "CONDICIONALES", "FUNCIONES"]);
    expect(PATTERNS.map((p) => p.id)).toEqual(["RANGE", "ACUMULADORES", "CONDICIONALES", "FUNCIONES"]);
  });

  it("expone identificadores de patrón tipados", () => {
    expect(isDiagnosisPatternId("RANGE")).toBe(true);
    expect(isDiagnosisPatternId("ACUMULADORES")).toBe(true);
    expect(isDiagnosisPatternId("CONDICIONALES")).toBe(true);
    expect(isDiagnosisPatternId("FUNCIONES")).toBe(true);
    expect(isDiagnosisPatternId("DESCONOCIDO")).toBe(false);
  });

  it("define las once hipótesis con identificación estable", () => {
    expect(HYPOTHESES.map((h) => h.id)).toEqual([
      "H-RANGE-01",
      "H-RANGE-02",
      "H-ACC-01",
      "H-ACC-02",
      "H-ACC-03",
      "H-COND-01",
      "H-COND-02",
      "H-COND-03",
      "H-FUNC-01",
      "H-FUNC-02",
      "H-FUNC-03",
    ]);
    expect(HYPOTHESES.map((h) => h.patternId)).toEqual([
      "RANGE",
      "RANGE",
      "ACUMULADORES",
      "ACUMULADORES",
      "ACUMULADORES",
      "CONDICIONALES",
      "CONDICIONALES",
      "CONDICIONALES",
      "FUNCIONES",
      "FUNCIONES",
      "FUNCIONES",
    ]);
  });

  it("cada hipótesis tiene descripción, comportamiento, evidencias, alternativas y limitaciones", () => {
    for (const h of HYPOTHESES) {
      expect(h.title.length).toBeGreaterThan(0);
      expect(h.description.length).toBeGreaterThan(0);
      expect(h.expectedBehavior.length).toBeGreaterThan(0);
      expect(h.expectedResponses.length).toBeGreaterThan(0);
      expect(h.supportingEvidence.length).toBeGreaterThan(0);
      expect(h.contradictingEvidence.length).toBeGreaterThan(0);
      expect(h.alternatives.length).toBeGreaterThan(0);
      expect(h.limitations.length).toBeGreaterThan(0);
      expect(h.patternId).toBeTruthy();
    }
  });

  it("marca solo las concepciones normativas de RANGE y ACUMULADORES", () => {
    expect(HYPOTHESES.filter((h) => h.normative).map((h) => h.id)).toEqual(["H-RANGE-02", "H-ACC-01"]);
  });

  it("permite consultar hipótesis por identificador", () => {
    expect(isHypothesisId("H-RANGE-01")).toBe(true);
    expect(isHypothesisId("H-ACC-03")).toBe(true);
    expect(isHypothesisId("H-COND-02")).toBe(true);
    expect(isHypothesisId("H-FUNC-03")).toBe(true);
    expect(isHypothesisId("H-XXX-99")).toBe(false);
  });

  it("agrupa las hipótesis por patrón", () => {
    expect(patternHypotheses("RANGE").map((h) => h.id)).toEqual(["H-RANGE-01", "H-RANGE-02"]);
    expect(patternHypotheses("ACUMULADORES").map((h) => h.id)).toEqual(["H-ACC-01", "H-ACC-02", "H-ACC-03"]);
    expect(patternHypotheses("CONDICIONALES").map((h) => h.id)).toEqual(["H-COND-01", "H-COND-02", "H-COND-03"]);
    expect(patternHypotheses("FUNCIONES").map((h) => h.id)).toEqual(["H-FUNC-01", "H-FUNC-02", "H-FUNC-03"]);
  });
});
