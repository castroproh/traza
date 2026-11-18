import { normalizeState } from "./normalize";
import type { ProgramErrorKind, TraceEventKind, TraceSnapshot } from "./types";

export class EngineProtocolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EngineProtocolError";
  }
}

export interface RawEngineResult {
  output: string;
  snapshots: TraceSnapshot[];
  error?: string;
  errorKind?: ProgramErrorKind;
  errorLine?: number;
  pythonMs: number;
}

const EVENTS: readonly TraceEventKind[] = ["call", "line", "return", "exception"];
const ERROR_KINDS: readonly ProgramErrorKind[] = ["syntax", "unsupported", "runtime", "resource"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseSnapshot(raw: unknown, index: number): TraceSnapshot {
  if (!isRecord(raw)) throw new EngineProtocolError(`Evento ${index}: formato inválido.`);
  const { sequence, line, event, iteration, before, after, detail } = raw;

  if (sequence !== index) {
    throw new EngineProtocolError(`Evento ${index}: orden roto (sequence=${String(sequence)}).`);
  }
  if (typeof line !== "number" || !Number.isInteger(line) || line < 0) {
    throw new EngineProtocolError(`Evento ${index}: número de línea inválido.`);
  }
  if (typeof event !== "string" || !(EVENTS as readonly string[]).includes(event)) {
    throw new EngineProtocolError(`Evento ${index}: tipo de evento desconocido.`);
  }
  const kind = event as TraceEventKind;
  if (kind === "call" && index !== 0) {
    throw new EngineProtocolError(`Evento ${index}: "call" solo puede ser el primero.`);
  }
  if (kind !== "call" && index === 0) {
    throw new EngineProtocolError("El primer evento debe ser \"call\".");
  }

  const snapshot: TraceSnapshot = { sequence: index, line, event: kind, before: normalizeState(before) };
  if (iteration !== undefined) {
    if (typeof iteration !== "number" || !Number.isInteger(iteration) || iteration < 1) {
      throw new EngineProtocolError(`Evento ${index}: iteración inválida.`);
    }
    snapshot.iteration = iteration;
  }
  if (after !== undefined) snapshot.after = normalizeState(after);
  if (detail !== undefined) {
    if (typeof detail !== "string") throw new EngineProtocolError(`Evento ${index}: detalle inválido.`);
    snapshot.detail = detail;
  }
  return snapshot;
}

/** Valida y normaliza el JSON que devuelve `run_traced` (Python). */
export function parseEngineJson(json: string): RawEngineResult {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new EngineProtocolError("El motor devolvió datos que no son JSON.");
  }
  if (!isRecord(data)) throw new EngineProtocolError("El motor devolvió un formato inesperado.");
  const { output, snapshots, error, errorKind, errorLine, pythonMs } = data;
  if (typeof output !== "string") throw new EngineProtocolError("Falta la salida del programa.");
  if (!Array.isArray(snapshots)) throw new EngineProtocolError("Falta la lista de eventos.");
  if (error !== null && error !== undefined && typeof error !== "string") {
    throw new EngineProtocolError("Error del programa con formato inválido.");
  }
  if (
    errorKind !== null &&
    errorKind !== undefined &&
    (typeof errorKind !== "string" || !(ERROR_KINDS as readonly string[]).includes(errorKind))
  ) {
    throw new EngineProtocolError("Tipo de error del programa inválido.");
  }
  if (
    errorLine !== null &&
    errorLine !== undefined &&
    (typeof errorLine !== "number" || !Number.isInteger(errorLine) || errorLine < 1)
  ) {
    throw new EngineProtocolError("Línea del error del programa inválida.");
  }
  const result: RawEngineResult = {
    output,
    snapshots: snapshots.map((s, i) => parseSnapshot(s, i)),
    pythonMs: typeof pythonMs === "number" ? pythonMs : 0,
  };
  if (typeof error === "string") result.error = error;
  if (typeof errorKind === "string") result.errorKind = errorKind as ProgramErrorKind;
  if (typeof errorLine === "number") result.errorLine = errorLine;
  return result;
}
