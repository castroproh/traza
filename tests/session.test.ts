import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { answerSession, clearSession, createSession, deserializeSession, loadSession, saveSession, serializeSession } from "../src/domain/session";
import { evaluatePattern } from "../src/domain/diagnosis/evidence";

const memoryStorage = new Map<string, string>();

beforeAll(() => {
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (key: string) => memoryStorage.get(key) ?? null,
    setItem: (key: string, value: string) => void memoryStorage.set(key, value),
    removeItem: (key: string) => void memoryStorage.delete(key),
  } as Storage;
});

describe("sesión diagnóstica (misión 0.6.0)", () => {
  beforeEach(() => {
    saveSession(createSession({ patternId: "RANGE" }));
  });
  afterEach(() => {
    clearSession();
  });

  it("crea una sesión vacía con patrón y sin respuestas", () => {
    const session = createSession({ patternId: "ACUMULADORES" });
    expect(session.patternId).toBe("ACUMULADORES");
    expect(session.answers).toEqual([]);
  });

  it("responde y registra la evaluación con estado", () => {
    const session = createSession({ patternId: "RANGE" });
    const result = answerSession(session, { microtestId: "range-iteracion-01", response: "1, 2, 3, 4" });
    expect(result.session.answers).toHaveLength(1);
    expect(result.session.answers[0]?.microtestId).toBe("range-iteracion-01");
    expect(result.outcome.evaluations).toHaveLength(2);
    expect(result.outcome.statuses["H-RANGE-01"]).toBe("supported");
    expect(result.outcome.statuses["H-RANGE-02"]).toBe("contradicted");
  });

  it("serializa y deserializa una sesión de forma round-trip", () => {
    const session = createSession({ patternId: "ACUMULADORES" });
    const answered = answerSession(session, { microtestId: "acc-inicial-01", response: "6" });
    const json = serializeSession(answered.session);
    const restored = deserializeSession(json);
    expect(restored).not.toBeNull();
    expect(restored?.patternId).toBe("ACUMULADORES");
    expect(restored?.answers).toHaveLength(1);
    expect(restored?.answers[0]?.response).toBe("6");
  });

  it("rechaza JSON inválido al deserializar", () => {
    expect(deserializeSession("{no")).toBeNull();
    expect(deserializeSession(JSON.stringify({}))).toBeNull();
  });

  it("persiste y recupera la sesión en almacenamiento local", () => {
    const session = createSession({ patternId: "RANGE" });
    saveSession(session);
    expect(loadSession()?.patternId).toBe("RANGE");
    clearSession();
    expect(loadSession()).toBeNull();
  });

  it("funciona el ciclo diagnóstico sobre una sesión recuperada", () => {
    const session = createSession({ patternId: "ACUMULADORES" });
    const answered = answerSession(session, { microtestId: "acc-final-01", response: "6" });
    const json = serializeSession(answered.session);
    const restored = deserializeSession(json);
    if (!restored) throw new Error("No se pudo restaurar la sesión");
    const next = answerSession(restored, { microtestId: "acc-inicial-01", response: "6" });
    // La hipótesis de inicialización se evalúa con la nueva evidencia recuperada.
    expect(next.outcome.statuses["H-ACC-03"]).toBe("supported");
    expect(next.outcome.evaluations.length).toBeGreaterThan(0);
  });

  it("el motor de evidencia se puede ejecutar directamente sobre respuestas", () => {
    const outcome = evaluatePattern("RANGE", [{ microtestId: "range-iteracion-01", response: "1, 2, 3, 4" }]);
    expect(outcome.evaluations.length).toBe(2);
  });
});
