import { describe, expect, it } from "vitest";
import { createPactSession } from "../../src/domain/pact/session";
import { buildSessionSummary } from "../../src/domain/pact/summary";
import { completedRangeSession } from "./helpers";

describe("resumen de sesión PACT (misión 0.7.0)", () => {
  it("resume patrón, predicción, ejecución, micropruebas y transferencia", () => {
    const summary = buildSessionSummary(completedRangeSession());
    expect(summary.patternId).toBe("RANGE");
    expect(summary.patternName).toMatch(/range/i);
    expect(summary.mainExercise?.title).toMatch(/rango/i);
    expect(summary.prediction?.expectedOutput).toBe("2, 3, 4, 5");
    expect(summary.analysis?.observedOutput).toBe("2\n3\n4\n5");
    expect(summary.microtests).toHaveLength(1);
    expect(summary.microtests[0]?.response).toBe("0, 1, 2");
    expect(summary.transfer?.evidenceNote).toMatch(/no demuestra/i);
    expect(summary.stage).toBe("completed");
  });

  it("separa hipótesis apoyadas, contradichas y sin resolver", () => {
    const summary = buildSessionSummary(completedRangeSession());
    expect(summary.supported).toEqual(["H-RANGE-02"]);
    expect(summary.contradicted).toEqual(["H-RANGE-01"]);
    expect(summary.unresolved).toEqual([]);
    expect(summary.hypotheses.find((item) => item.id === "H-RANGE-02")?.label).toBe("apoyada");
  });

  it("separa observaciones de inferencias y declara limitaciones", () => {
    const summary = buildSessionSummary(completedRangeSession());
    expect(summary.observations.length).toBeGreaterThan(0);
    expect(summary.inferences.length).toBeGreaterThan(0);
    expect(summary.limitations.length).toBeGreaterThan(0);
    expect(summary.observations.join(" ")).toMatch(/predicción inicial/i);
    expect(summary.observations.join(" ")).toMatch(/ejecución real/i);
    expect(summary.inferences.join(" ")).toMatch(/no son una etiqueta/i);
    expect(summary.limitations.join(" ")).toMatch(/no es una validación psicométrica/i);
  });

  it("una sesión sin completar también se resume sin inventar datos", () => {
    const summary = buildSessionSummary(
      createPactSession({ patternId: "RANGE", now: new Date("2026-11-18T10:00:00.000Z") }),
    );
    expect(summary.prediction).toBeNull();
    expect(summary.analysis).toBeNull();
    expect(summary.transfer).toBeNull();
    expect(summary.observations).toEqual([]);
  });
});
