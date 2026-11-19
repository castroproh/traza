import { describe, expect, it } from "vitest";
import { MICROTESTS, getMicrotest, microtestsByPattern } from "../../src/domain/diagnosis/microtests";
import { MICROTEST_IDS } from "../../src/domain/diagnosis/microtests";
import { validateBank, validateMicrotest } from "../../src/domain/diagnosis/validation";
import type { DiagnosticMicrotest } from "../../src/domain/diagnosis/microtests";

describe("banco de micropruebas (misión 0.6.0)", () => {
  it("tiene 6 micropruebas por patrón (24 en total)", () => {
    expect(microtestsByPattern("RANGE")).toHaveLength(6);
    expect(microtestsByPattern("ACUMULADORES")).toHaveLength(6);
    expect(microtestsByPattern("CONDICIONALES")).toHaveLength(6);
    expect(microtestsByPattern("FUNCIONES")).toHaveLength(6);
    expect(MICROTESTS).toHaveLength(24);
  });

  it("usa prefijos estables cond- y func- en las nuevas micropruebas", () => {
    expect(microtestsByPattern("CONDICIONALES").every((m) => m.id.startsWith("cond-"))).toBe(true);
    expect(microtestsByPattern("FUNCIONES").every((m) => m.id.startsWith("func-"))).toBe(true);
  });

  it("tiene identificadores únicos", () => {
    expect(new Set(MICROTEST_IDS).size).toBe(MICROTEST_IDS.length);
  });

  it("cada microprueba tiene contrato estructural completo", () => {
    for (const m of MICROTESTS) {
      expect(m.version).toBeGreaterThan(0);
      expect(m.patternId.length).toBeGreaterThan(0);
      expect(m.objective.length).toBeGreaterThan(0);
      expect(m.predictionQuestion.length).toBeGreaterThan(0);
      expect(m.interpretationRule.length).toBeGreaterThan(0);
      expect(m.explanation.length).toBeGreaterThan(0);
      expect(["beginner", "intermediate"]).toContain(m.difficulty);
      expect(["numbers", "text"]).toContain(m.answerFormat);
      expect(Array.isArray(m.ambiguityCases)).toBe(true);
      expect(Array.isArray(m.prerequisites)).toBe(true);
      expect(m.targetHypotheses.length).toBeGreaterThan(0);
      expect(Object.keys(m.responseSignatures).sort()).toEqual([...m.targetHypotheses].sort());
    }
  });

  it("todas las respuestas previstas son no vacías", () => {
    for (const m of MICROTESTS) {
      for (const [hypothesisId, responses] of Object.entries(m.responseSignatures)) {
        expect(Object.keys(m.responseSignatures)).toContain(hypothesisId);
        expect(responses.length).toBeGreaterThan(0);
        for (const r of responses) expect(r.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("el banco real no reporta problemas estructurales", () => {
    const report = validateBank();
    expect(report.valid).toBe(true);
    expect(report.issues).toEqual([]);
  });

  it("detecta una microprueba con código vacío", () => {
    const bad = { ...base(), code: "   \n  " };
    const issues = validateMicrotest(bad);
    expect(issues.some((i) => i.code === "empty-code")).toBe(true);
  });

  it("detecta una microprueba que no discrimina (todas las hipótesis predicen lo mismo)", () => {
    const bad = {
      ...base(),
      responseSignatures: { "H-RANGE-01": ["1, 2, 3"], "H-RANGE-02": ["1, 2, 3"] },
    };
    const issues = validateMicrotest(bad);
    expect(issues.some((i) => i.code === "no-discrimination")).toBe(true);
  });

  it("detecta una microprueba con respuesta esperada ausente", () => {
    const bad = { ...base(), responseSignatures: {} };
    const issues = validateMicrotest(bad);
    expect(issues.some((i) => i.code === "missing-response")).toBe(true);
  });

  function base(): DiagnosticMicrotest {
    const existing = getMicrotest("range-iteracion-01");
    if (!existing) throw new Error("Falta range-iteracion-01");
    return existing;
  }
});
