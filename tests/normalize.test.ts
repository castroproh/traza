import { describe, expect, it } from "vitest";
import { isUnsupported, normalizeState, normalizeValue } from "../src/domain/normalize";

describe("normalizeValue", () => {
  it("conserva primitivos serializables", () => {
    expect(normalizeValue(6)).toBe(6);
    expect(normalizeValue("hola")).toBe("hola");
    expect(normalizeValue(true)).toBe(true);
    expect(normalizeValue(null)).toBeNull();
  });

  it("marca como no compatibles NaN, Infinity, undefined, funciones y símbolos", () => {
    for (const bad of [NaN, Infinity, -Infinity, undefined, () => 1, Symbol("x")]) {
      const out = normalizeValue(bad);
      expect(isUnsupported(out)).toBe(true);
    }
  });

  it("convierte bigint seguro a número y marca el que no lo es", () => {
    expect(normalizeValue(10n)).toBe(10);
    expect(isUnsupported(normalizeValue(10n ** 30n))).toBe(true);
  });

  it("convierte Map y Set a datos JSON", () => {
    expect(normalizeValue(new Map([["a", 1]]))).toEqual({ a: 1 });
    expect(normalizeValue(new Set([1, 2]))).toEqual([1, 2]);
  });

  it("normaliza listas y objetos anidados", () => {
    expect(normalizeValue([1, [2, NaN]])).toEqual([1, [2, { unsupported: "número no finito" }]]);
  });

  it("marca instancias de clases y no se cae con referencias circulares", () => {
    class Raro {}
    expect(normalizeValue(new Raro())).toEqual({ unsupported: "Raro" });
    const circular: Record<string, unknown> = {};
    circular["yo"] = circular;
    expect(() => normalizeValue(circular)).not.toThrow();
  });

  it("recorta cadenas muy largas", () => {
    const out = normalizeValue("x".repeat(500));
    expect(typeof out === "string" && out.length).toBeLessThan(500);
  });

  it("el resultado siempre se puede serializar a JSON", () => {
    const out = normalizeValue({ a: NaN, b: [undefined, 1n], c: new Map([[1, 2]]) });
    expect(() => JSON.stringify(out)).not.toThrow();
  });
});

describe("normalizeState", () => {
  it("normaliza cada variable", () => {
    expect(normalizeState({ total: 0, numero: 1 })).toEqual({ total: 0, numero: 1 });
  });
  it("rechaza lo que no es un objeto", () => {
    expect(() => normalizeState(null)).toThrow(TypeError);
    expect(() => normalizeState([1])).toThrow(TypeError);
    expect(() => normalizeState("x")).toThrow(TypeError);
  });
});
