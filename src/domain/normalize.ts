import type { TraceValue, VariableState } from "./types";

const MAX_DEPTH = 4;
const MAX_STRING = 200;
const MAX_ITEMS = 50;

export function unsupported(reason: string): TraceValue {
  return { unsupported: reason };
}

export function isUnsupported(value: TraceValue): value is { unsupported: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    typeof value["unsupported"] === "string"
  );
}

function isPlainObject(value: object): boolean {
  const proto: unknown = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/** Convierte cualquier valor en datos JSON seguros. Nunca lanza. */
export function normalizeValue(input: unknown, depth = 0): TraceValue {
  if (input === null) return null;
  switch (typeof input) {
    case "boolean":
      return input;
    case "number":
      return Number.isFinite(input) ? input : unsupported("número no finito");
    case "string":
      return input.length > MAX_STRING ? `${input.slice(0, MAX_STRING)}…` : input;
    case "bigint":
      return input >= BigInt(Number.MIN_SAFE_INTEGER) && input <= BigInt(Number.MAX_SAFE_INTEGER)
        ? Number(input)
        : unsupported("entero fuera de rango seguro");
    case "undefined":
      return unsupported("undefined");
    case "function":
    case "symbol":
      return unsupported(typeof input);
    default:
      break;
  }
  const obj = input as object;
  if (depth >= MAX_DEPTH) return unsupported("profundidad máxima");
  if (Array.isArray(obj)) {
    return obj.slice(0, MAX_ITEMS).map((item) => normalizeValue(item, depth + 1));
  }
  if (obj instanceof Set) {
    return [...obj].slice(0, MAX_ITEMS).map((item) => normalizeValue(item, depth + 1));
  }
  if (obj instanceof Map) {
    const out: { [key: string]: TraceValue } = {};
    for (const [key, value] of [...obj.entries()].slice(0, MAX_ITEMS)) {
      out[String(key)] = normalizeValue(value, depth + 1);
    }
    return out;
  }
  if (isPlainObject(obj)) {
    const out: { [key: string]: TraceValue } = {};
    for (const [key, value] of Object.entries(obj).slice(0, MAX_ITEMS)) {
      out[key] = normalizeValue(value, depth + 1);
    }
    return out;
  }
  return unsupported(obj.constructor?.name ?? "objeto");
}

/** Normaliza un estado de variables. Lanza TypeError si no es un objeto. */
export function normalizeState(input: unknown): VariableState {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new TypeError("El estado de variables debe ser un objeto.");
  }
  const state: VariableState = {};
  for (const [name, value] of Object.entries(input)) {
    state[name] = normalizeValue(value);
  }
  return state;
}
