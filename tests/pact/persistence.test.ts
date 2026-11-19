import { beforeEach, describe, expect, it } from "vitest";
import {
  PACT_LEGACY_STORAGE_KEY,
  PACT_STORAGE_KEY,
  clearPactSession,
  createPactSession,
  deserializePactSession,
  loadPactSession,
  recordContrastAnswer,
  savePactSession,
  serializePactSession,
  type StorageLike,
} from "../../src/domain/pact/session";
import { buildSessionExport, buildSessionExportJson } from "../../src/domain/pact/summary";
import { completedRangeSession, rangePrediction } from "./helpers";

function memoryStorage(initial: Record<string, string> = {}): StorageLike & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

const now = new Date("2026-11-18T10:00:00.000Z");

describe("persistencia de la sesión PACT (misión 0.7.0)", () => {
  let storage: ReturnType<typeof memoryStorage>;

  beforeEach(() => {
    storage = memoryStorage();
  });

  it("guarda y recupera una sesión completa con su etapa", () => {
    const session = completedRangeSession();
    expect(savePactSession(session, storage)).toBe(true);
    const loaded = loadPactSession(storage);
    expect(loaded.status).toBe("ok");
    if (loaded.status !== "ok") throw new Error("No se recuperó");
    expect(loaded.session.stage).toBe("completed");
    expect(loaded.session.sessionId).toBe("local-test-session");
    expect(loaded.session.contrast.statuses["H-RANGE-02"]).toBe("supported");
    expect(loaded.session.transfer?.analysis?.allMatch).toBe(true);
  });

  it("devuelve none cuando no hay sesión", () => {
    expect(loadPactSession(storage).status).toBe("none");
  });

  it("reconstruye las evidencias desde las respuestas y no confía en lo guardado", () => {
    let session = createPactSession({ patternId: "RANGE", now, sessionId: "local-tamper" });
    session = {
      ...session,
      stage: "contrast",
      prediction: {
        ...rangePrediction,
        submittedAt: now.toISOString(),
      },
      analysis: {
        outputMatches: true,
        expectedOutput: "2, 3, 4, 5",
        observedOutput: "2\n3\n4\n5",
        variableDiffs: [],
        iterationsPredicted: true,
        iterationsMatch: true,
        expectedIterations: [1, 2, 3, 4],
        observedIterations: [1, 2, 3, 4],
        allMatch: true,
        divergence: { kind: "none", description: "ok" },
        observedFinalState: { numero: 5 },
        durationMs: 1,
        analyzedAt: now.toISOString(),
      },
    };
    session = recordContrastAnswer(
      session,
      { microtestId: "range-cero-01", response: "0, 1, 2", observedOutput: "0\n1\n2\n" },
      now,
    );
    const raw = JSON.parse(serializePactSession(session)) as Record<string, unknown>;
    const contrast = raw["contrast"] as Record<string, unknown>;
    contrast["evaluations"] = [];
    contrast["statuses"] = { "H-RANGE-01": "supported", "H-RANGE-02": "supported" };
    contrast["unresolved"] = [];
    const loaded = deserializePactSession(JSON.stringify(raw));
    expect(loaded.status).toBe("ok");
    if (loaded.status !== "ok") throw new Error("No se recuperó");
    expect(loaded.session.contrast.statuses["H-RANGE-01"]).toBe("contradicted");
    expect(loaded.session.contrast.statuses["H-RANGE-02"]).toBe("supported");
    expect(loaded.session.contrast.evaluations).toHaveLength(2);
  });

  it("rechaza un esquema incompatible sin borrar otros datos", () => {
    const session = createPactSession({ patternId: "RANGE", now });
    const raw = JSON.parse(serializePactSession(session)) as Record<string, unknown>;
    raw["schemaVersion"] = 999;
    storage.setItem(PACT_STORAGE_KEY, JSON.stringify(raw));
    storage.setItem("traza:otra-clave", "se-conserva");
    const loaded = loadPactSession(storage);
    expect(loaded.status).toBe("incompatible");
    expect(storage.getItem("traza:otra-clave")).toBe("se-conserva");
  });

  it("detecta JSON corrupto y saltos de etapa", () => {
    expect(deserializePactSession("{no").status).toBe("corrupt");
    const session = createPactSession({ patternId: "RANGE", now });
    const raw = JSON.parse(serializePactSession(session)) as Record<string, unknown>;
    raw["stage"] = "transfer";
    expect(deserializePactSession(JSON.stringify(raw)).status).toBe("corrupt");
  });

  it("detecta una sesión de la versión 0.6.0 y no la destruye", () => {
    storage.setItem(PACT_LEGACY_STORAGE_KEY, JSON.stringify({ patternId: "RANGE", answers: [] }));
    const loaded = loadPactSession(storage);
    expect(loaded.status).toBe("legacy");
    expect(storage.getItem(PACT_LEGACY_STORAGE_KEY)).not.toBeNull();
  });

  it("elimina solo la sesión PACT al reiniciar", () => {
    storage.setItem(PACT_STORAGE_KEY, serializePactSession(createPactSession({ patternId: "RANGE", now })));
    storage.setItem(PACT_LEGACY_STORAGE_KEY, "legado");
    storage.setItem("traza:ajustes", "otra-cosa");
    clearPactSession(storage);
    expect(storage.getItem(PACT_STORAGE_KEY)).toBeNull();
    expect(storage.getItem(PACT_LEGACY_STORAGE_KEY)).toBe("legado");
    expect(storage.getItem("traza:ajustes")).toBe("otra-cosa");
  });

  it("exporta la sesión con versión de esquema y sin datos personales", () => {
    const session = completedRangeSession();
    const exported = buildSessionExport(session, now);
    expect(exported.schemaVersion).toBe(1);
    expect(exported.instrumentVersion).toBe("0.8.0");
    expect(exported.summary.supported).toEqual(["H-RANGE-02"]);
    const json = buildSessionExportJson(session, now);
    const parsed = JSON.parse(json) as { schemaVersion: number; session: { schemaVersion: number } };
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.session.schemaVersion).toBe(1);

    // No se guardan campos personales: se revisan las claves, no el texto
    // explicativo (que sí menciona que no se recogen correos).
    const personalKey = /^(email|correo|correoElectronico|password|contraseña|nombre|apellidos?|telefono|dni)$/i;
    const keys: string[] = [];
    const collectKeys = (value: unknown): void => {
      if (Array.isArray(value)) {
        for (const item of value) collectKeys(item);
      } else if (typeof value === "object" && value !== null) {
        for (const [key, child] of Object.entries(value)) {
          keys.push(key);
          collectKeys(child);
        }
      }
    };
    collectKeys(parsed);
    expect(keys.filter((key) => personalKey.test(key))).toEqual([]);
  });
});
