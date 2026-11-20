import { describe, expect, it } from "vitest";
import { MAX_MICROTESTS_PER_SESSION, selectMicrotest } from "../../src/domain/diagnosis/selection";

describe("selección adaptativa de micropruebas (misión 0.6.0)", () => {
  it("selecciona de forma determinista la primera microprueba discriminante de RANGE", () => {
    const result = selectMicrotest({ patternId: "RANGE", answers: [] });
    expect(result.action).toBe("selected");
    expect(result.microtestId).toBe("range-cero-01");
    expect(result.reason).toContain("permite distinguir");
  });

  it("selecciona la microprueba que separa la sustitución del acumulador y la dificultad de inicialización", () => {
    const result = selectMicrotest({ patternId: "ACUMULADORES", answers: [] });
    expect(result.action).toBe("selected");
    expect(result.microtestId).toBe("acc-final-01");
  });

  it("no repite micropruebas ya respondidas", () => {
    const first = selectMicrotest({ patternId: "ACUMULADORES", answers: [] });
    if (!first.microtestId) throw new Error("Sin microprueba");
    const second = selectMicrotest({
      patternId: "ACUMULADORES",
      answers: [{ microtestId: first.microtestId, response: "No estoy seguro" }],
    });
    expect(second.microtestId).not.toBe(first.microtestId);
  });

  it("se vuelve determinista para las mismas condiciones de entrada", () => {
    const a = selectMicrotest({ patternId: "RANGE", answers: [] });
    const b = selectMicrotest({ patternId: "RANGE", answers: [] });
    expect(a).toEqual(b);
  });

  it("no presenta pruebas innecesarias cuando la evidencia ya es suficiente", () => {
    const resolved = selectMicrotest({
      patternId: "RANGE",
      answers: [{ microtestId: "range-iteracion-01", response: "1, 2, 3, 4" }],
    });
    expect(resolved.action).toBe("sufficient");
  });

  it("permite evidencia insuficiente cuando ninguna prueba pendiente resuelve la ambigüedad", () => {
    const unresolved = selectMicrotest({
      patternId: "ACUMULADORES",
      answers: [
        { microtestId: "acc-final-01", response: "No estoy seguro" },
        { microtestId: "acc-secuencia-01", response: "No estoy seguro" },
        { microtestId: "acc-imprime-01", response: "No estoy seguro" },
        { microtestId: "acc-general-01", response: "No estoy seguro" },
        { microtestId: "acc-parcial-01", response: "No estoy seguro" },
        { microtestId: "acc-inicial-01", response: "No estoy seguro" },
        { microtestId: "acc-inicial-cero-02", response: "No estoy seguro" },
      ],
    });
    expect(unresolved.action).toBe("insufficient");
  });

  it("resuelve la ambigüedad entre sustitución e inicialización con la nueva acc-inicial-cero-02", () => {
    const first = selectMicrotest({
      patternId: "ACUMULADORES",
      answers: [
        { microtestId: "acc-final-01", response: "No estoy seguro" },
        { microtestId: "acc-secuencia-01", response: "No estoy seguro" },
        { microtestId: "acc-imprime-01", response: "No estoy seguro" },
        { microtestId: "acc-general-01", response: "No estoy seguro" },
        { microtestId: "acc-parcial-01", response: "No estoy seguro" },
        { microtestId: "acc-inicial-01", response: "No estoy seguro" },
      ],
    });
    expect(first.action).toBe("selected");
    expect(first.microtestId).toBe("acc-inicial-cero-02");
  });

  it("limita la cantidad de micropruebas por sesión", () => {
    const answered = Array.from({ length: MAX_MICROTESTS_PER_SESSION + 2 }, (_, i) => ({
      microtestId: `range-iteracion-0${(i % 9) + 1}`,
      response: "1, 2, 3",
    }));
    const result = selectMicrotest({ patternId: "RANGE", answers: answered });
    expect(result.action).toBe("limit");
  });
});
