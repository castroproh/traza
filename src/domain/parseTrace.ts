import { normalizeState, normalizeValue } from "./normalize";
import type {
  ConditionBranch,
  ProgramErrorKind,
  TraceCondition,
  TraceEventKind,
  TraceSnapshot,
} from "./types";

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

const ERROR_KINDS: readonly ProgramErrorKind[] = ["syntax", "unsupported", "runtime", "resource"];

const EVENTS: readonly TraceEventKind[] = ["call", "line", "return", "exception"];
const BRANCHES: readonly ConditionBranch[] = ["then", "elif", "else", "none"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1;
}

function parseCondition(raw: unknown, index: number): TraceCondition {
  if (!isRecord(raw)) throw new EngineProtocolError(`Evento ${index}: condición inválida.`);
  const { id, line, expression, result, hasElse, branch, branchLine, notExecuted } = raw;
  if (typeof id !== "string" || id.length === 0) {
    throw new EngineProtocolError(`Evento ${index}: la condición no tiene identificador.`);
  }
  if (!isPositiveInteger(line)) {
    throw new EngineProtocolError(`Evento ${index}: la condición tiene una línea inválida.`);
  }
  if (typeof expression !== "string" || expression.length === 0) {
    throw new EngineProtocolError(`Evento ${index}: la condición no tiene expresión.`);
  }
  if (typeof result !== "boolean") {
    throw new EngineProtocolError(`Evento ${index}: el resultado de la condición no es booleano.`);
  }
  if (typeof hasElse !== "boolean") {
    throw new EngineProtocolError(`Evento ${index}: la condición no indica si tiene else.`);
  }
  if (typeof branch !== "string" || !(BRANCHES as readonly string[]).includes(branch)) {
    throw new EngineProtocolError(`Evento ${index}: la rama de la condición es desconocida.`);
  }
  const condition: TraceCondition = {
    id,
    line,
    expression,
    result,
    hasElse,
    branch: branch as ConditionBranch,
  };
  if (branchLine !== undefined) {
    if (!isPositiveInteger(branchLine)) {
      throw new EngineProtocolError(`Evento ${index}: la línea de la rama es inválida.`);
    }
    condition.branchLine = branchLine;
  }
  if (notExecuted !== undefined) {
    if (notExecuted !== "then" && notExecuted !== "else") {
      throw new EngineProtocolError(`Evento ${index}: la rama no ejecutada es inválida.`);
    }
    condition.notExecuted = notExecuted;
  }
  return condition;
}

function parseSnapshot(raw: unknown, index: number): TraceSnapshot {
  if (!isRecord(raw)) throw new EngineProtocolError(`Evento ${index}: formato inválido.`);
  const {
    sequence,
    line,
    event,
    iteration,
    before,
    after,
    detail,
    function: fn,
    callType,
    depth,
    callId,
    scope,
    globals,
    returnValue,
    condition,
  } = raw;

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
  if (kind !== "call" && index === 0) {
    throw new EngineProtocolError("El primer evento debe ser \"call\".");
  }
  if (kind === "call" && index === 0) {
    if (callType !== undefined && callType !== "program") {
      throw new EngineProtocolError('El primer "call" debe ser el inicio del programa.');
    }
  }
  if (kind === "call" && index > 0 && callType !== "function") {
    throw new EngineProtocolError(`Evento ${index}: un "call" posterior debe ser de función.`);
  }
  if (kind !== "call" && callType !== undefined) {
    throw new EngineProtocolError(`Evento ${index}: "callType" solo corresponde a un "call".`);
  }

  const snapshot: TraceSnapshot = { sequence: index, line, event: kind, before: normalizeState(before) };
  if (iteration !== undefined) {
    if (!isPositiveInteger(iteration)) {
      throw new EngineProtocolError(`Evento ${index}: iteración inválida.`);
    }
    snapshot.iteration = iteration;
  }
  if (after !== undefined) snapshot.after = normalizeState(after);
  if (detail !== undefined) {
    if (typeof detail !== "string") throw new EngineProtocolError(`Evento ${index}: detalle inválido.`);
    snapshot.detail = detail;
  }

  if (fn !== undefined) {
    if (typeof fn !== "string" || fn.length === 0) {
      throw new EngineProtocolError(`Evento ${index}: función inválida.`);
    }
    snapshot.function = fn;
  }
  if (callType !== undefined) snapshot.callType = callType as "program" | "function";
  if (depth !== undefined) {
    if (!isNonNegativeInteger(depth)) throw new EngineProtocolError(`Evento ${index}: profundidad inválida.`);
    snapshot.depth = depth;
  }
  if (callId !== undefined) {
    if (!isPositiveInteger(callId)) throw new EngineProtocolError(`Evento ${index}: identificador de llamada inválido.`);
    snapshot.callId = callId;
  }
  if (scope !== undefined) {
    if (scope !== "module" && scope !== "function") {
      throw new EngineProtocolError(`Evento ${index}: ámbito inválido.`);
    }
    snapshot.scope = scope;
  }
  if (globals !== undefined) snapshot.globals = normalizeState(globals);
  if (returnValue !== undefined) snapshot.returnValue = normalizeValue(returnValue);
  if (condition !== undefined) snapshot.condition = parseCondition(condition, index);
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
  if (errorKind !== undefined && (typeof errorKind !== "string" || !(ERROR_KINDS as readonly string[]).includes(errorKind))) {
    throw new EngineProtocolError("Tipo de error del programa desconocido.");
  }
  if (errorLine !== undefined && (!Number.isInteger(errorLine) || (errorLine as number) < 1)) {
    throw new EngineProtocolError("Línea del error inválida.");
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
