import { describe, expect, it } from "vitest";
import { buildBankExport } from "../../src/domain/diagnosis/export";
import bankJsonRaw from "../../analysis/simulator/bank.json";

describe("consistencia TS <-> Python (banco exportado vs bank.json)", () => {
  const ts = buildBankExport();
  const py = bankJsonRaw as unknown as {
    instrument: { version: string; generatedBy: string };
    patterns: Array<{ id: string }>;
    hypotheses: Array<{ id: string; patternId: string; normative: boolean }>;
    microtests: Array<{
      id: string;
      patternId: string;
      responseSignatures: Record<string, string[]>;
      expectedOutcome: string;
    }>;
    discriminationMatrices: Array<{
      patternId: string;
      pairs: Array<{
        hypothesisAId: string;
        hypothesisBId: string;
        discriminatingMicrotests: string[];
      }>;
    }>;
  };

  it("el banco exportado desde TypeScript es el que lee el simulador Python", () => {
    expect(ts.instrument.version).toBe("0.8.0");
    expect(py.instrument.version).toBe("0.8.0");
    expect(ts.patterns.map((p) => p.id)).toEqual(py.patterns.map((p) => p.id));
    expect(ts.patterns.length).toBe(4);
    expect(ts.hypotheses.length).toBe(11);
    expect(ts.microtests.length).toBe(26);
    expect(py.microtests.length).toBe(26);
    expect(ts.discriminationMatrices.length).toBe(4);
    expect(py.discriminationMatrices.length).toBe(4);
  });

  it("las hipótesis coinciden entre el motor TypeScript y el simulador Python", () => {
    expect(ts.hypotheses.map((h) => h.id)).toEqual(py.hypotheses.map((h) => h.id));
    for (const h of ts.hypotheses) {
      const pyH = py.hypotheses.find((x) => x.id === h.id);
      expect(pyH).toBeDefined();
      expect(pyH!.patternId).toBe(h.patternId);
      expect(pyH!.normative).toBe(h.normative === true);
    }
  });

  it("las firmas de respuesta coinciden entre TypeScript y Python", () => {
    expect(ts.microtests.map((m) => m.id).sort()).toEqual(
      py.microtests.map((m) => m.id).sort(),
    );
    for (const m of ts.microtests) {
      const pyM = py.microtests.find((x) => x.id === m.id);
      expect(pyM).toBeDefined();
      expect(pyM!.patternId).toBe(m.patternId);
      expect(pyM!.expectedOutcome).toBe(m.expectedOutcome);
      expect(Object.keys(pyM!.responseSignatures).sort()).toEqual(
        Object.keys(m.responseSignatures).sort(),
      );
      for (const [hypothesisId, responses] of Object.entries(
        m.responseSignatures,
      )) {
        expect(pyM!.responseSignatures[hypothesisId]).toEqual(responses);
      }
    }
  });

  it("las parejas de discriminación coinciden entre TypeScript y Python", () => {
    const tsPairs = ts.discriminationMatrices.flatMap((mat) =>
      mat.pairs.map((p) => ({
        pattern: mat.patternId,
        a: p.hypothesisAId,
        b: p.hypothesisBId,
        tests: [...p.discriminatingMicrotests].sort(),
      })),
    );
    const pyPairs = py.discriminationMatrices.flatMap((mat) =>
      mat.pairs.map((p) => ({
        pattern: mat.patternId,
        a: p.hypothesisAId,
        b: p.hypothesisBId,
        tests: [...p.discriminatingMicrotests].sort(),
      })),
    );
    expect(tsPairs.sort((x, y) => `${x.a}|${x.b}`.localeCompare(`${y.a}|${y.b}`))).toEqual(
      pyPairs.sort((x, y) => `${x.a}|${x.b}`.localeCompare(`${y.a}|${y.b}`)),
    );
  });
});
