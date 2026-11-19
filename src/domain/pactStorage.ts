import { canAccessPACTStage, getPACTPattern, type PACTSession, type PACTStage } from "./pact";
import { parseEngineJson } from "./parseTrace";
import type { ExecutionResult, StudentPrediction } from "./types";

export const PACT_STORAGE_KEY = "traza:pact-session:v1";
const MAX_SESSION_CHARS = 1_000_000;
const STAGES: readonly PACTStage[] = ["prediction", "analysis", "contrast", "transfer"];

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export class PACTStorageError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, { cause });
    this.name = "PACTStorageError";
  }
}

export function loadPACTSession(storage: StorageLike): PACTSession | null {
  let serialized: string | null;
  try {
    serialized = storage.getItem(PACT_STORAGE_KEY);
  } catch (cause) {
    throw new PACTStorageError("No se pudo leer el avance guardado en este navegador.", cause);
  }
  if (serialized === null) return null;
  if (serialized.length > MAX_SESSION_CHARS) {
    throw new PACTStorageError("El avance guardado supera el tamaño permitido.");
  }

  let value: unknown;
  try {
    value = JSON.parse(serialized);
  } catch (cause) {
    throw new PACTStorageError("El avance guardado no es válido.", cause);
  }
  if (!isPACTSession(value)) {
    throw new PACTStorageError("El avance guardado no coincide con una sesión TRAZA válida.");
  }
  return value;
}

export function savePACTSession(storage: StorageLike, session: PACTSession): void {
  try {
    storage.setItem(PACT_STORAGE_KEY, JSON.stringify(session));
  } catch (cause) {
    throw new PACTStorageError("No se pudo guardar el avance en este navegador.", cause);
  }
}

export function clearPACTSession(storage: StorageLike): void {
  try {
    storage.removeItem(PACT_STORAGE_KEY);
  } catch (cause) {
    throw new PACTStorageError("No se pudo borrar el avance guardado.", cause);
  }
}

export function isPACTSession(value: unknown): value is PACTSession {
  if (!isRecord(value) || value["schemaVersion"] !== 1) return false;
  const patternId = value["patternId"];
  const stage = value["stage"];
  const mainPrediction = value["mainPrediction"];
  const mainResult = value["mainResult"];
  const contrastPredictions = value["contrastPredictions"];
  const contrastResults = value["contrastResults"];
  const transferPrediction = value["transferPrediction"];
  const transferResult = value["transferResult"];

  if (
    (patternId !== null && patternId !== "range-exclusive" && patternId !== "accumulator") ||
    typeof stage !== "string" ||
    !(STAGES as readonly string[]).includes(stage) ||
    !isRecord(contrastPredictions) ||
    !isRecord(contrastResults)
  ) {
    return false;
  }
  if (patternId === null) {
    return (
      stage === "prediction" &&
      mainPrediction === undefined &&
      mainResult === undefined &&
      transferPrediction === undefined &&
      transferResult === undefined &&
      Object.keys(contrastPredictions).length === 0 &&
      Object.keys(contrastResults).length === 0
    );
  }

  const pattern = getPACTPattern(patternId);
  if (
    (mainPrediction !== undefined && !isStudentPrediction(mainPrediction)) ||
    (mainResult !== undefined && !isExecutionResult(mainResult)) ||
    (transferPrediction !== undefined && !isStudentPrediction(transferPrediction)) ||
    (transferResult !== undefined && !isExecutionResult(transferResult)) ||
    (mainResult !== undefined && mainPrediction === undefined) ||
    (transferResult !== undefined && transferPrediction === undefined)
  ) {
    return false;
  }

  for (const [testId, prediction] of Object.entries(contrastPredictions)) {
    if (
      !pattern.microtests.some((test) => test.id === testId) ||
      !isStudentPrediction(prediction)
    ) {
      return false;
    }
  }
  for (const [testId, result] of Object.entries(contrastResults)) {
    if (
      !pattern.microtests.some((test) => test.id === testId) ||
      !isExecutionResult(result) ||
      contrastPredictions[testId] === undefined
    ) {
      return false;
    }
  }
  const session: PACTSession = {
    schemaVersion: 1,
    patternId,
    stage: stage as PACTStage,
    contrastPredictions: contrastPredictions as PACTSession["contrastPredictions"],
    contrastResults: contrastResults as PACTSession["contrastResults"],
  };
  if (mainPrediction !== undefined) session.mainPrediction = mainPrediction;
  if (mainResult !== undefined) session.mainResult = mainResult;
  if (transferPrediction !== undefined) session.transferPrediction = transferPrediction;
  if (transferResult !== undefined) session.transferResult = transferResult;
  return canAccessPACTStage(session, session.stage);
}

function isStudentPrediction(value: unknown): value is StudentPrediction {
  if (
    !isRecord(value) ||
    typeof value["expectedOutput"] !== "string" ||
    value["expectedOutput"].length > 8192 ||
    !isRecord(value["expectedVariables"]) ||
    !isRecord(value["expectedVariableValues"]) ||
    !Array.isArray(value["expectedIterations"]) ||
    value["expectedIterations"].length > 1000 ||
    !value["expectedIterations"].every((iteration) => Number.isInteger(iteration) && iteration > 0) ||
    !Number.isInteger(value["confidence"]) ||
    (value["confidence"] as number) < 0 ||
    (value["confidence"] as number) > 100 ||
    typeof value["explanation"] !== "string" ||
    value["explanation"].length > 2000
  ) {
    return false;
  }
  const finalValues = Object.values(value["expectedVariables"]);
  const sequences = Object.values(value["expectedVariableValues"]);
  return (
    finalValues.length <= 20 &&
    finalValues.every(isFiniteNumber) &&
    sequences.length <= 20 &&
    sequences.every(
      (sequence) =>
        Array.isArray(sequence) && sequence.length <= 1000 && sequence.every(isFiniteNumber),
    )
  );
}

function isExecutionResult(value: unknown): value is ExecutionResult {
  if (
    !isRecord(value) ||
    typeof value["success"] !== "boolean" ||
    typeof value["output"] !== "string" ||
    value["output"].length > 8192 ||
    !Array.isArray(value["snapshots"]) ||
    value["snapshots"].length > 2000 ||
    !isFiniteNumber(value["durationMs"]) ||
    value["durationMs"] < 0 ||
    (value["error"] !== undefined && typeof value["error"] !== "string") ||
    (value["errorKind"] !== undefined &&
      !["syntax", "unsupported", "runtime", "resource"].includes(String(value["errorKind"]))) ||
    (value["errorLine"] !== undefined &&
      (!Number.isInteger(value["errorLine"]) || (value["errorLine"] as number) < 1))
  ) {
    return false;
  }
  try {
    parseEngineJson(
      JSON.stringify({
        output: value["output"],
        snapshots: value["snapshots"],
        error: value["error"] ?? null,
        errorKind: value["errorKind"] ?? null,
        errorLine: value["errorLine"] ?? null,
        pythonMs: value["durationMs"],
      }),
    );
    return value["success"] === (value["error"] === undefined);
  } catch {
    return false;
  }
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
