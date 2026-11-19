import { describe, expect, it } from "vitest";
import { evaluatePattern } from "../../src/domain/diagnosis/evidence";
import { selectMicrotest } from "../../src/domain/diagnosis/selection";
import { buildBankExport, buildBankExportJson } from "../../src/domain/diagnosis/export";

/**
 * Perfiles simulados (misión 0.6.0, sección 9).
 *
 * Cada perfil representa una hipótesis de razonamiento definida explícitamente.
 * Estos tests NO son validación psicométrica ni prueba de efectividad educativa:
 * solo comprueban la coherencia lógica de las reglas diagnósticas.
 */

describe("perfiles simulados (reglas contra perfiles de respuesta)", () => {
  it("perfil de interpretación inclusiva de range(): H-RANGE-01 recibe apoyo y H-RANGE-02 contradicción", () => {
    const outcome = evaluatePattern("RANGE", [{ microtestId: "range-iteracion-01", response: "1, 2, 3, 4" }]);
    expect(outcome.statuses["H-RANGE-01"]).toBe("supported");
    expect(outcome.statuses["H-RANGE-02"]).toBe("contradicted");
    expect(outcome.resolved).toBe(true);
  });

  it("perfil de interpretación correcta de range(): H-RANGE-02 recibe apoyo y H-RANGE-01 contradicción", () => {
    const outcome = evaluatePattern("RANGE", [{ microtestId: "range-iteracion-01", response: "1, 2, 3" }]);
    expect(outcome.statuses["H-RANGE-02"]).toBe("supported");
    expect(outcome.statuses["H-RANGE-01"]).toBe("contradicted");
    expect(outcome.resolved).toBe(true);
  });

  it("perfil de acumulación correcta: H-ACC-01 apoya y las hipótesis erróneas se contradicen", () => {
    const outcome = evaluatePattern("ACUMULADORES", [
      { microtestId: "acc-final-01", response: "6" },
      { microtestId: "acc-inicial-01", response: "16" },
    ]);
    expect(outcome.statuses["H-ACC-01"]).toBe("supported");
    expect(outcome.statuses["H-ACC-02"]).toBe("contradicted");
    expect(outcome.statuses["H-ACC-03"]).toBe("contradicted");
  });

  it("perfil de sustitución del acumulador: H-ACC-02 recibe apoyo y H-ACC-01 contradicción", () => {
    const outcome = evaluatePattern("ACUMULADORES", [{ microtestId: "acc-final-01", response: "3" }]);
    expect(outcome.statuses["H-ACC-02"]).toBe("supported");
    expect(outcome.statuses["H-ACC-01"]).toBe("contradicted");
  });

  it("perfil de dificultad con inicialización: H-ACC-03 recibe apoyo", () => {
    const outcome = evaluatePattern("ACUMULADORES", [{ microtestId: "acc-inicial-01", response: "6" }]);
    expect(outcome.statuses["H-ACC-03"]).toBe("supported");
  });

  it("perfil mixto no genera conclusiones excesivas", () => {
    const outcome = evaluatePattern("ACUMULADORES", [
      { microtestId: "acc-final-01", response: "6" },
      { microtestId: "acc-inicial-01", response: "3" },
    ]);
    expect(outcome.statuses["H-ACC-03"]).toBe("insufficient");
    expect(outcome.resolved).toBe(false);
  });

  it("perfil con respuestas ambiguas permanece sin resolver", () => {
    const outcome = evaluatePattern("RANGE", [{ microtestId: "range-tabla-01", response: "del 1 al 3" }]);
    expect(outcome.resolved).toBe(false);
    expect(outcome.unresolved.length).toBeGreaterThan(0);
  });

  it("perfil con respuesta aleatoria no produce un apoyo sostenido", () => {
    const outcome = evaluatePattern("RANGE", [{ microtestId: "range-iteracion-01", response: "No estoy seguro" }]);
    expect(outcome.resolved).toBe(false);
    expect(outcome.unresolved.length).toBeGreaterThan(0);
  });

  it("una respuesta correcta aislada no se interpreta como dominio consolidado", () => {
    const outcome = evaluatePattern("RANGE", [{ microtestId: "range-iteracion-01", response: "1, 2, 3" }]);
    expect(outcome.statuses["H-RANGE-02"]).toBe("supported");
    expect(outcome.statuses["H-RANGE-01"]).toBe("contradicted");
    const accOutcome = evaluatePattern("ACUMULADORES", [{ microtestId: "acc-final-01", response: "6" }]);
    expect(accOutcome.resolved).toBe(false);
  });

  it("la exportación JSON del banco incluye patrones, hipótesis, micropruebas y matrices", () => {
    const json = buildBankExportJson();
    const parsed = JSON.parse(json) as {
      instrument: { version: string };
      patterns: unknown[];
      hypotheses: unknown[];
      microtests: unknown[];
      discriminationMatrices: unknown[];
    };
    expect(parsed.instrument.version).toBe("0.8.0");
    expect(parsed.patterns.length).toBe(4);
    expect(parsed.hypotheses.length).toBe(11);
    expect(parsed.microtests.length).toBe(24);
    expect(parsed.discriminationMatrices.length).toBe(4);
    const bank = buildBankExport();
    expect(bank.instrument.version).toBe("0.8.0");
  });

  it("perfil de confusión and/or: H-COND-01 recibe apoyo con una condición and", () => {
    const outcome = evaluatePattern("CONDICIONALES", [
      { microtestId: "cond-and-01", response: "adolescente" },
    ]);
    expect(outcome.statuses["H-COND-01"]).toBe("supported");
    expect(outcome.statuses["H-COND-02"]).toBe("contradicted");
  });

  it("perfil de confusión or/and: H-COND-02 recibe apoyo con una condición or", () => {
    const outcome = evaluatePattern("CONDICIONALES", [
      { microtestId: "cond-or-01", response: "dia laborable" },
    ]);
    expect(outcome.statuses["H-COND-02"]).toBe("supported");
  });

  it("perfil de mala interpretación de not: H-COND-03 recibe apoyo", () => {
    const outcome = evaluatePattern("CONDICIONALES", [
      { microtestId: "cond-not-01", response: "promocionar" },
    ]);
    expect(outcome.statuses["H-COND-03"]).toBe("supported");
  });

  it("perfil correcto de condicionales contradice las tres confusiones", () => {
    const outcome = evaluatePattern("CONDICIONALES", [
      { microtestId: "cond-and-01", response: "otra etapa" },
      { microtestId: "cond-or-01", response: "fin de semana" },
      { microtestId: "cond-not-01", response: "recuperar" },
    ]);
    expect(outcome.statuses["H-COND-01"]).toBe("contradicted");
    expect(outcome.statuses["H-COND-02"]).toBe("contradicted");
    expect(outcome.statuses["H-COND-03"]).toBe("contradicted");
  });

  it("perfil de confusión return/print: H-FUNC-01 recibe apoyo", () => {
    const outcome = evaluatePattern("FUNCIONES", [
      { microtestId: "func-param-01", response: "None" },
    ]);
    expect(outcome.statuses["H-FUNC-01"]).toBe("supported");
  });

  it("perfil de confusión parámetro/argumento: H-FUNC-02 recibe apoyo", () => {
    const outcome = evaluatePattern("FUNCIONES", [
      { microtestId: "func-param-01", response: "-7" },
    ]);
    expect(outcome.statuses["H-FUNC-02"]).toBe("supported");
  });

  it("perfil de ámbito local no reconocido: H-FUNC-03 recibe apoyo", () => {
    const outcome = evaluatePattern("FUNCIONES", [
      { microtestId: "func-local-param-01", response: "local\nlocal" },
    ]);
    expect(outcome.statuses["H-FUNC-03"]).toBe("supported");
  });

  it("perfil correcto de funciones contradice las tres confusiones", () => {
    const outcome = evaluatePattern("FUNCIONES", [
      { microtestId: "func-param-01", response: "7" },
      { microtestId: "func-print-01", response: "Hola Ana\nNone" },
      { microtestId: "func-local-param-01", response: "local\nglobal" },
    ]);
    expect(outcome.statuses["H-FUNC-01"]).toBe("contradicted");
    expect(outcome.statuses["H-FUNC-02"]).toBe("contradicted");
    expect(outcome.statuses["H-FUNC-03"]).toBe("contradicted");
  });

  it("una respuesta correcta en una prueba neutral no apoya una confusión", () => {
    const outcome = evaluatePattern("CONDICIONALES", [
      { microtestId: "cond-and-01", response: "otra etapa" },
    ]);
    // H-COND-02 predice el resultado correcto en una prueba and; no debe
    // recibir apoyo por ello.
    expect(outcome.statuses["H-COND-02"]).toBe("insufficient");
  });

  it("la selección sigue determinista para el patrón completo tras una respuesta concluyente", () => {
    const first = selectMicrotest({ patternId: "RANGE", answers: [] });
    if (!first.microtestId) throw new Error("Sin microprueba");
    const second = selectMicrotest({ patternId: "RANGE", answers: [{ microtestId: first.microtestId, response: "0, 1, 2" }] });
    expect(second.action).toBe("sufficient");
  });
});
