import { describe, expect, it } from "vitest";
import demo from "./fixtures/demo-trace.cpython.json";
import { EXERCISES, sourceLine } from "../src/domain/exercises";
import { EngineProtocolError, parseEngineJson } from "../src/domain/parseTrace";
import { buildRows, formatValue, variableColumns } from "../src/domain/rows";

// El fixture es la salida REAL de src/python/tracer.py ejecutada con CPython 3.13.
const parsed = parseEngineJson(JSON.stringify(demo));
const code = EXERCISES["suma-1-3"].code;

describe("parseEngineJson (traza del ejercicio)", () => {
  it("conserva el orden de los eventos", () => {
    expect(parsed.snapshots.map((s) => s.sequence)).toEqual([...parsed.snapshots.keys()]);
    expect(parsed.snapshots[0]?.event).toBe("call");
    expect(parsed.snapshots.at(-1)?.event).toBe("return");
  });

  it("identifica los números de línea del código original", () => {
    const lines = parsed.snapshots.filter((s) => s.event === "line").map((s) => s.line);
    expect(lines).toEqual([1, 2, 3, 2, 3, 2, 3, 2, 4]);
    expect(sourceLine(code, 1)).toBe("total = 0");
    expect(sourceLine(code, 3).trim()).toBe("total = total + numero");
    expect(sourceLine(code, 4)).toBe("print(total)");
  });

  it("separa estado previo y posterior de cada instrucción", () => {
    const body = parsed.snapshots.filter((s) => s.line === 3);
    expect(body.map((s) => s.before["total"])).toEqual([0, 1, 3]);
    expect(body.map((s) => s.after?.["total"])).toEqual([1, 3, 6]);
    expect(body.map((s) => s.before["numero"])).toEqual([1, 2, 3]);
  });

  it("la inicialización deja total = 0 y numero sin definir", () => {
    const init = parsed.snapshots[1];
    expect(init?.before).toEqual({});
    expect(init?.after).toEqual({ total: 0 });
  });

  it("numera tres iteraciones y la comprobación de salida del bucle no cuenta", () => {
    const iterations = parsed.snapshots.map((s) => s.iteration).filter((n) => n !== undefined);
    expect(iterations).toEqual([1, 1, 2, 2, 3, 3]);
    const exit = parsed.snapshots[8];
    expect(exit?.line).toBe(2);
    expect(exit?.iteration).toBeUndefined();
  });

  it("el estado de finalización no inventa un estado posterior", () => {
    const last = parsed.snapshots.at(-1);
    expect(last?.before).toEqual({ total: 6, numero: 3 });
    expect(last?.after).toBeUndefined();
    expect(parsed.snapshots[0]?.after).toBeUndefined();
  });

  it("la salida capturada es 6", () => {
    expect(parsed.output.trim()).toBe("6");
    expect(parsed.error).toBeUndefined();
  });
});

describe("parseEngineJson (errores de protocolo)", () => {
  const base = { output: "", snapshots: [], error: null, pythonMs: 0 };
  const call = { sequence: 0, line: 0, event: "call", before: {} };

  it("rechaza JSON inválido", () => {
    expect(() => parseEngineJson("{no")).toThrow(EngineProtocolError);
  });
  it("rechaza eventos fuera de orden", () => {
    const bad = { ...base, snapshots: [call, { sequence: 5, line: 1, event: "line", before: {} }] };
    expect(() => parseEngineJson(JSON.stringify(bad))).toThrow(/orden/);
  });
  it("rechaza tipos de evento y líneas inválidas", () => {
    const ev = { ...base, snapshots: [call, { sequence: 1, line: 1, event: "otro", before: {} }] };
    expect(() => parseEngineJson(JSON.stringify(ev))).toThrow(/evento/);
    const ln = { ...base, snapshots: [call, { sequence: 1, line: -2, event: "line", before: {} }] };
    expect(() => parseEngineJson(JSON.stringify(ln))).toThrow(/línea/);
  });
  it("exige que el primer evento sea call", () => {
    const bad = { ...base, snapshots: [{ sequence: 0, line: 1, event: "line", before: {} }] };
    expect(() => parseEngineJson(JSON.stringify(bad))).toThrow(/call/);
  });
  it("devuelve el error del programa como texto", () => {
    const withError = { ...base, error: "ZeroDivisionError: division by zero" };
    expect(parseEngineJson(JSON.stringify(withError)).error).toBe("ZeroDivisionError: division by zero");
  });
  it("valida y conserva el tipo y la línea del error estructurado", () => {
    const withError = { ...base, error: "No se puede dividir entre cero.", errorKind: "runtime", errorLine: 2 };
    expect(parseEngineJson(JSON.stringify(withError))).toMatchObject({
      errorKind: "runtime",
      errorLine: 2,
    });
    expect(() => parseEngineJson(JSON.stringify({ ...withError, errorKind: "secret" }))).toThrow(/Tipo de error/);
    expect(() => parseEngineJson(JSON.stringify({ ...withError, errorLine: 0 }))).toThrow(/Línea del error/);
  });
});

describe("representación de variables", () => {
  it("formatea valores como Python", () => {
    expect(formatValue(undefined)).toBe("—");
    expect(formatValue(null)).toBe("None");
    expect(formatValue(true)).toBe("True");
    expect(formatValue("a")).toBe("'a'");
    expect(formatValue([1, 2])).toBe("[1, 2]");
    expect(formatValue({ unsupported: "x" })).toBe("‹valor no compatible›");
  });

  it("ordena columnas por primera aparición: total y luego numero", () => {
    expect(variableColumns(parsed.snapshots)).toEqual(["total", "numero"]);
  });

  it("construye filas con los valores reales y marca los cambios", () => {
    const rows = buildRows(parsed.snapshots, variableColumns(parsed.snapshots));
    const third = rows[3]; // línea 3, iteración 1
    expect(third?.cells["total"]).toEqual({ before: "0", after: "1", changed: true });
    expect(third?.cells["numero"]).toEqual({ before: "1", after: "1", changed: false });
    expect(rows[0]?.label).toBe("Inicio");
    expect(rows.at(-1)?.cells["total"]).toEqual({ before: "6", after: "", changed: false });
  });
});
