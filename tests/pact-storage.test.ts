import { describe, expect, it } from "vitest";
import { startPACTSession } from "../src/domain/pact";
import {
  clearPACTSession,
  loadPACTSession,
  PACT_STORAGE_KEY,
  PACTStorageError,
  savePACTSession,
  type StorageLike,
} from "../src/domain/pactStorage";

class MemoryStorage implements StorageLike {
  readonly values = new Map<string, string>();
  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
  removeItem(key: string): void {
    this.values.delete(key);
  }
}

describe("sesión PACT local", () => {
  it("guarda y recupera solo el avance tipado, sin identificador personal", () => {
    const storage = new MemoryStorage();
    const session = startPACTSession("range-exclusive");
    savePACTSession(storage, session);

    expect(loadPACTSession(storage)).toEqual(session);
    expect(JSON.parse(storage.values.get(PACT_STORAGE_KEY) ?? "{}")).not.toHaveProperty("studentId");
  });

  it("devuelve null si no hay sesión y permite borrar el avance", () => {
    const storage = new MemoryStorage();
    expect(loadPACTSession(storage)).toBeNull();
    savePACTSession(storage, startPACTSession("accumulator"));
    clearPACTSession(storage);
    expect(loadPACTSession(storage)).toBeNull();
  });

  it("rechaza datos guardados malformados en vez de tratarlos como una sesión válida", () => {
    const storage = new MemoryStorage();
    storage.setItem(PACT_STORAGE_KEY, "{");
    expect(() => loadPACTSession(storage)).toThrow(PACTStorageError);
    storage.setItem(PACT_STORAGE_KEY, JSON.stringify({ schemaVersion: 1, patternId: "other" }));
    expect(() => loadPACTSession(storage)).toThrow(/sesión TRAZA válida/);
  });

  it("expone errores de almacenamiento", () => {
    const broken: StorageLike = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("full");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    expect(() => loadPACTSession(broken)).toThrow(/leer el avance/);
    expect(() => savePACTSession(broken, startPACTSession("range-exclusive"))).toThrow(/guardar el avance/);
    expect(() => clearPACTSession(broken)).toThrow(/borrar el avance/);
  });
});
