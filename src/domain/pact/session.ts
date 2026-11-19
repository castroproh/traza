/**
 * Sesión PACT: máquina de estados, transiciones y persistencia local.
 *
 * El estado vive aquí y no en variables locales de Vue, de modo que una recarga
 * puede recuperar el recorrido. No se guarda información personal: solo el
 * estado del instrumento en el navegador.
 */

import {
  isDiagnosisPatternId,
  patternHypotheses,
  type DiagnosisPatternId,
  type EvidenceEvaluation,
  type EvidenceStatus,
} from "../diagnosis/hypotheses";
import { evaluateMicrotest, evaluatePattern } from "../diagnosis/evidence";
import { getMicrotest } from "../diagnosis/microtests";
import { selectMicrotest, type SelectionResult } from "../diagnosis/selection";
import type { ExecutionResult } from "../types";
import { analyzeResult, freezePrediction, transferEvidence, validatePrediction } from "./analysis";
import { mainExerciseFor, pactExerciseById, transferExerciseFor } from "./exercises";
import { PACT_INSTRUMENT_VERSION, PACT_SCHEMA_VERSION, PactTransitionError } from "./types";
import type {
  ContrastAnswer,
  ContrastState,
  PactAnalysis,
  PactPrediction,
  PactSession,
  PactStage,
  PredictionInput,
  TransferState,
} from "./types";

const STORAGE_KEY = "traza:pact-session";
const LEGACY_STORAGE_KEY = "traza:diagnostic-session";

export const PACT_STORAGE_KEY = STORAGE_KEY;
export const PACT_LEGACY_STORAGE_KEY = LEGACY_STORAGE_KEY;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function storageOrNull(): StorageLike | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function nowIso(now: Date): string {
  return now.toISOString();
}

function newSessionId(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === "function") {
    return `local-${cryptoApi.randomUUID()}`;
  }
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function emptyContrast(): ContrastState {
  return {
    answers: [],
    evaluations: [],
    statuses: {},
    unresolved: patternHypotheses("RANGE").map((h) => h.id),
    resolved: false,
    completed: false,
    completedAt: null,
  };
}

/** Crea una sesión nueva en la etapa de predicción. */
export function createPactSession(input: {
  patternId: DiagnosisPatternId;
  now?: Date;
  sessionId?: string;
}): PactSession {
  const now = input.now ?? new Date();
  const main = mainExerciseFor(input.patternId);
  return {
    schemaVersion: PACT_SCHEMA_VERSION,
    instrumentVersion: PACT_INSTRUMENT_VERSION,
    sessionId: input.sessionId ?? newSessionId(),
    patternId: input.patternId,
    stage: "prediction",
    mainExerciseId: main.exerciseId,
    prediction: null,
    analysis: null,
    contrast: { ...emptyContrast(), unresolved: patternHypotheses(input.patternId).map((h) => h.id) },
    transfer: null,
    createdAt: nowIso(now),
    updatedAt: nowIso(now),
    completedAt: null,
  };
}

function updated(session: PactSession, patch: Partial<PactSession>, now: Date): PactSession {
  return { ...session, ...patch, updatedAt: nowIso(now) };
}

function assertStage(session: PactSession, stage: PactStage): void {
  if (session.stage !== stage) {
    throw new PactTransitionError(
      `La acción requiere la etapa "${stage}" y la sesión está en "${session.stage}".`,
    );
  }
}

/** Guarda la predicción original y avanza a análisis. */
export function submitPrediction(session: PactSession, input: PredictionInput, now = new Date()): PactSession {
  assertStage(session, "prediction");
  if (session.prediction) throw new PactTransitionError("La predicción ya se envió y no puede alterarse.");
  const errors = validatePrediction(input);
  if (errors.length > 0) throw new PactTransitionError(errors.join(" "));
  return updated(session, { stage: "analysis", prediction: freezePrediction(input, now) }, now);
}

/** Registra el resultado real del ejercicio principal. Sigue en análisis para revisarlo. */
export function recordAnalysis(
  session: PactSession,
  result: ExecutionResult,
  now = new Date(),
): PactSession {
  assertStage(session, "analysis");
  if (!session.prediction) throw new PactTransitionError("No hay predicción que comparar.");
  if (session.analysis) throw new PactTransitionError("El análisis ya se registró.");
  const exercise = pactExerciseById(session.mainExerciseId);
  if (!exercise) throw new PactTransitionError("El ejercicio principal no existe en el banco.");
  const analysis = analyzeResult(session.prediction, result, exercise, now);
  return updated(session, { analysis }, now);
}

/** El estudiante decide pasar al contraste después de revisar la comparación. */
export function enterContrast(session: PactSession, now = new Date()): PactSession {
  assertStage(session, "analysis");
  if (!session.analysis) throw new PactTransitionError("Primero hay que ejecutar y analizar el ejercicio.");
  return updated(session, { stage: "contrast" }, now);
}

export function contrastAnswers(session: PactSession): Array<{ microtestId: string; response: string }> {
  return session.contrast.answers.map((answer) => ({
    microtestId: answer.microtestId,
    response: answer.response,
  }));
}

/** Selección adaptativa recalculada desde las respuestas (nunca desde la UI). */
export function contrastSelection(session: PactSession): SelectionResult {
  return selectMicrotest({ patternId: session.patternId, answers: contrastAnswers(session) });
}

export function canCompleteContrast(session: PactSession): boolean {
  if (session.stage !== "contrast" || session.contrast.answers.length === 0) return false;
  return contrastSelection(session).action !== "selected";
}

/** Registra una respuesta de contraste y actualiza las evidencias. */
export function recordContrastAnswer(
  session: PactSession,
  input: { microtestId: string; response: string; observedOutput: string },
  now = new Date(),
): PactSession {
  assertStage(session, "contrast");
  if (session.contrast.completed) throw new PactTransitionError("El contraste ya está completado.");
  if (input.response.trim().length === 0) throw new PactTransitionError("La respuesta está vacía.");
  const microtest = getMicrotest(input.microtestId);
  if (!microtest) throw new PactTransitionError(`La microprueba ${input.microtestId} no existe.`);
  if (microtest.patternId !== session.patternId) {
    throw new PactTransitionError("La microprueba no pertenece al patrón de la sesión.");
  }
  if (session.contrast.answers.some((answer) => answer.microtestId === input.microtestId)) {
    throw new PactTransitionError("Esa microprueba ya se respondió en esta sesión.");
  }

  const answer: ContrastAnswer = {
    microtestId: input.microtestId,
    response: input.response.trim(),
    observedOutput: input.observedOutput.trim(),
    evaluations: evaluateMicrotest(microtest, input.response),
    answeredAt: nowIso(now),
  };
  const answers = [...session.contrast.answers, answer];
  const outcome = evaluatePattern(
    session.patternId,
    answers.map((item) => ({ microtestId: item.microtestId, response: item.response })),
  );
  const contrast: ContrastState = {
    answers,
    evaluations: outcome.evaluations,
    statuses: outcome.statuses,
    unresolved: outcome.unresolved,
    resolved: outcome.resolved,
    completed: false,
    completedAt: null,
  };
  return updated(session, { contrast }, now);
}

/** Cierra el contraste y prepara la transferencia. */
export function completeContrast(session: PactSession, now = new Date()): PactSession {
  assertStage(session, "contrast");
  if (!canCompleteContrast(session)) {
    throw new PactTransitionError(
      "Todavía hay una microprueba pertinente pendiente: respóndela antes de continuar.",
    );
  }
  const transferExercise = transferExerciseFor(session.patternId);
  const contrast: ContrastState = {
    ...session.contrast,
    completed: true,
    completedAt: nowIso(now),
  };
  const transfer: TransferState = {
    exerciseId: transferExercise.exerciseId,
    prediction: null,
    analysis: null,
    evidence: null,
  };
  return updated(session, { stage: "transfer", contrast, transfer }, now);
}

/** Guarda la predicción de transferencia (también inmutable). */
export function submitTransferPrediction(
  session: PactSession,
  input: PredictionInput,
  now = new Date(),
): PactSession {
  assertStage(session, "transfer");
  const transfer = session.transfer;
  if (!transfer) throw new PactTransitionError("No hay ejercicio de transferencia preparado.");
  if (transfer.prediction) throw new PactTransitionError("La predicción de transferencia ya se envió.");
  const errors = validatePrediction(input);
  if (errors.length > 0) throw new PactTransitionError(errors.join(" "));
  return updated(session, { transfer: { ...transfer, prediction: freezePrediction(input, now) } }, now);
}

/** Registra la ejecución de transferencia y deja la sesión lista para finalizar. */
export function recordTransferAnalysis(
  session: PactSession,
  result: ExecutionResult,
  now = new Date(),
): PactSession {
  assertStage(session, "transfer");
  const transfer = session.transfer;
  if (!transfer) throw new PactTransitionError("No hay transferencia preparada.");
  if (!transfer.prediction) throw new PactTransitionError("Primero hay que enviar la predicción de transferencia.");
  if (transfer.analysis) throw new PactTransitionError("La transferencia ya se analizó.");
  const exercise = pactExerciseById(transfer.exerciseId);
  if (!exercise) throw new PactTransitionError("El ejercicio de transferencia no existe en el banco.");
  const analysis = analyzeResult(transfer.prediction, result, exercise, now);
  return updated(
    session,
    { transfer: { ...transfer, analysis, evidence: transferEvidence(analysis) } },
    now,
  );
}

/** Cierra el recorrido después de revisar la transferencia. */
export function completeSession(session: PactSession, now = new Date()): PactSession {
  assertStage(session, "transfer");
  if (!session.transfer?.analysis) {
    throw new PactTransitionError("Primero hay que ejecutar y analizar la transferencia.");
  }
  return updated(
    session,
    { stage: "completed", completedAt: nowIso(now) },
    now,
  );
}

// --------------------------------------------------------------- persistencia

export type LoadPactSessionResult =
  | { status: "ok"; session: PactSession }
  | { status: "none" }
  | { status: "legacy"; message: string }
  | { status: "incompatible"; message: string }
  | { status: "corrupt"; message: string };

export function serializePactSession(session: PactSession): string {
  return JSON.stringify(session);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPositiveIntegerArray(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.every((item) => typeof item === "number" && Number.isInteger(item) && item >= 1)
  );
}

function isPredictionShape(value: unknown): value is PactPrediction {
  if (!isRecord(value)) return false;
  if (typeof value["expectedOutput"] !== "string") return false;
  if (typeof value["explanation"] !== "string") return false;
  if (
    typeof value["confidence"] !== "number" ||
    !Number.isInteger(value["confidence"]) ||
    value["confidence"] < 0 ||
    value["confidence"] > 100
  ) {
    return false;
  }
  if (!isPositiveIntegerArray(value["expectedIterations"])) return false;
  if (!isRecord(value["expectedVariables"])) return false;
  if (!Object.values(value["expectedVariables"]).every((item) => typeof item === "number" && Number.isFinite(item))) {
    return false;
  }
  return typeof value["submittedAt"] === "string";
}

const DIVERGENCE_KINDS = new Set(["none", "output", "iterations", "variables", "unknown"]);

function isVariableDiffShape(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (typeof value["name"] !== "string") return false;
  if (typeof value["expected"] !== "number" || !Number.isFinite(value["expected"])) return false;
  if (value["actual"] !== undefined && (typeof value["actual"] !== "number" || !Number.isFinite(value["actual"]))) {
    return false;
  }
  return typeof value["matches"] === "boolean";
}

function isAnalysisShape(value: unknown): value is PactAnalysis {
  if (!isRecord(value)) return false;
  if (typeof value["outputMatches"] !== "boolean") return false;
  if (typeof value["observedOutput"] !== "string") return false;
  if (typeof value["expectedOutput"] !== "string") return false;
  if (!Array.isArray(value["variableDiffs"]) || !value["variableDiffs"].every(isVariableDiffShape)) return false;
  if (!isPositiveIntegerArray(value["expectedIterations"])) return false;
  if (!isPositiveIntegerArray(value["observedIterations"])) return false;
  if (typeof value["iterationsPredicted"] !== "boolean" || typeof value["iterationsMatch"] !== "boolean") {
    return false;
  }
  if (typeof value["allMatch"] !== "boolean") return false;
  if (!isRecord(value["divergence"])) return false;
  if (typeof value["divergence"]["kind"] !== "string" || !DIVERGENCE_KINDS.has(value["divergence"]["kind"])) {
    return false;
  }
  if (typeof value["divergence"]["description"] !== "string") return false;
  if (
    value["divergence"]["line"] !== undefined &&
    (typeof value["divergence"]["line"] !== "number" || !Number.isInteger(value["divergence"]["line"]))
  ) {
    return false;
  }
  if (!isRecord(value["observedFinalState"])) return false;
  if (typeof value["durationMs"] !== "number" || !Number.isFinite(value["durationMs"])) return false;
  return typeof value["analyzedAt"] === "string";
}

function rebuildContrast(
  patternId: DiagnosisPatternId,
  raw: unknown,
): ContrastState | null {
  if (!isRecord(raw) || !Array.isArray(raw["answers"])) return null;
  const answers: ContrastAnswer[] = [];
  for (const item of raw["answers"]) {
    if (!isRecord(item)) return null;
    const microtestId = item["microtestId"];
    const response = item["response"];
    const observedOutput = item["observedOutput"];
    const answeredAt = item["answeredAt"];
    if (
      typeof microtestId !== "string" ||
      typeof response !== "string" ||
      typeof observedOutput !== "string" ||
      typeof answeredAt !== "string"
    ) {
      return null;
    }
    const microtest = getMicrotest(microtestId);
    if (!microtest || microtest.patternId !== patternId) return null;
    if (answers.some((answer) => answer.microtestId === microtestId)) return null;
    answers.push({
      microtestId,
      response,
      observedOutput,
      evaluations: evaluateMicrotest(microtest, response),
      answeredAt,
    });
  }
  const outcome = evaluatePattern(
    patternId,
    answers.map((answer) => ({ microtestId: answer.microtestId, response: answer.response })),
  );
  return {
    answers,
    evaluations: outcome.evaluations,
    statuses: outcome.statuses,
    unresolved: outcome.unresolved,
    resolved: outcome.resolved,
    completed: raw["completed"] === true,
    completedAt: typeof raw["completedAt"] === "string" ? raw["completedAt"] : null,
  };
}

/** Valida y reconstruye una sesión desde JSON. No confía en evidencias guardadas. */
export function deserializePactSession(json: string): LoadPactSessionResult {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { status: "corrupt", message: "La sesión guardada no es un JSON válido." };
  }
  if (!isRecord(raw)) return { status: "corrupt", message: "La sesión guardada tiene un formato inesperado." };

  const schemaVersion = raw["schemaVersion"];
  if (schemaVersion !== PACT_SCHEMA_VERSION) {
    return {
      status: "incompatible",
      message:
        "La sesión guardada pertenece a otra versión del esquema. Puedes iniciar una sesión nueva; " +
        "los datos anteriores no se borrarán automáticamente.",
    };
  }

  const patternId = raw["patternId"];
  if (!isDiagnosisPatternId(patternId)) {
    return { status: "corrupt", message: "La sesión guardada tiene un patrón desconocido." };
  }
  const stage = raw["stage"];
  if (
    stage !== "prediction" &&
    stage !== "analysis" &&
    stage !== "contrast" &&
    stage !== "transfer" &&
    stage !== "completed"
  ) {
    return { status: "corrupt", message: "La sesión guardada tiene una etapa desconocida." };
  }

  const main = mainExerciseFor(patternId);
  if (raw["mainExerciseId"] !== main.exerciseId) {
    return { status: "corrupt", message: "El ejercicio principal no corresponde al patrón guardado." };
  }
  if (typeof raw["sessionId"] !== "string" || raw["sessionId"].length === 0) {
    return { status: "corrupt", message: "Falta el identificador local de la sesión." };
  }
  if (typeof raw["createdAt"] !== "string" || typeof raw["updatedAt"] !== "string") {
    return { status: "corrupt", message: "Faltan las fechas de la sesión." };
  }

  const prediction = raw["prediction"];
  if (prediction !== null && !isPredictionShape(prediction)) {
    return { status: "corrupt", message: "La predicción guardada está incompleta." };
  }
  const analysis = raw["analysis"];
  if (analysis !== null && !isAnalysisShape(analysis)) {
    return { status: "corrupt", message: "El análisis guardado está incompleto." };
  }
  const contrast = rebuildContrast(patternId, raw["contrast"]);
  if (!contrast) return { status: "corrupt", message: "Las respuestas de contraste no son válidas." };

  let transfer: TransferState | null = null;
  const rawTransfer = raw["transfer"];
  if (rawTransfer !== null) {
    if (!isRecord(rawTransfer)) return { status: "corrupt", message: "La transferencia guardada no es válida." };
    const expected = transferExerciseFor(patternId);
    if (rawTransfer["exerciseId"] !== expected.exerciseId) {
      return { status: "corrupt", message: "El ejercicio de transferencia no corresponde al patrón." };
    }
    const transferPrediction = rawTransfer["prediction"];
    const transferAnalysis = rawTransfer["analysis"];
    if (transferPrediction !== null && !isPredictionShape(transferPrediction)) {
      return { status: "corrupt", message: "La predicción de transferencia está incompleta." };
    }
    if (transferAnalysis !== null && !isAnalysisShape(transferAnalysis)) {
      return { status: "corrupt", message: "El análisis de transferencia está incompleto." };
    }
    const evidence = rawTransfer["evidence"];
    if (
      evidence !== null &&
      (!isRecord(evidence) || typeof evidence["correct"] !== "boolean" || typeof evidence["note"] !== "string")
    ) {
      return { status: "corrupt", message: "La evidencia de transferencia no es válida." };
    }
    transfer = {
      exerciseId: expected.exerciseId,
      prediction: transferPrediction as PactPrediction | null,
      analysis: transferAnalysis as PactAnalysis | null,
      evidence: evidence as TransferState["evidence"],
    };
  }

  // Coherencia entre etapa y datos: nunca se acepta un salto de etapa.
  if (stage === "prediction" && (prediction !== null || analysis !== null || transfer !== null)) {
    return { status: "corrupt", message: "La etapa de predicción contiene datos posteriores." };
  }
  if (stage === "analysis" && (prediction === null || transfer !== null)) {
    return { status: "corrupt", message: "La etapa de análisis no tiene una predicción válida." };
  }
  if (stage === "contrast" && (prediction === null || analysis === null || transfer !== null)) {
    return { status: "corrupt", message: "La etapa de contraste no tiene el análisis previo." };
  }
  if (stage === "contrast" && contrast.completed) {
    return { status: "corrupt", message: "El contraste figura completado antes de cambiar de etapa." };
  }
  if (stage === "transfer" && (prediction === null || analysis === null || !contrast.completed || transfer === null)) {
    return { status: "corrupt", message: "La etapa de transferencia no tiene el contraste completo." };
  }
  if (stage === "completed" && (transfer === null || transfer.analysis === null || contrast.completed !== true)) {
    return { status: "corrupt", message: "La sesión completada no tiene el resultado de transferencia." };
  }

  const session: PactSession = {
    schemaVersion: PACT_SCHEMA_VERSION,
    instrumentVersion: typeof raw["instrumentVersion"] === "string" ? raw["instrumentVersion"] : PACT_INSTRUMENT_VERSION,
    sessionId: raw["sessionId"],
    patternId,
    stage,
    mainExerciseId: main.exerciseId,
    prediction: prediction as PactPrediction | null,
    analysis: analysis as PactAnalysis | null,
    contrast,
    transfer,
    createdAt: raw["createdAt"],
    updatedAt: raw["updatedAt"],
    completedAt: typeof raw["completedAt"] === "string" ? raw["completedAt"] : null,
  };
  return { status: "ok", session };
}

export function loadPactSession(storage: StorageLike | null = storageOrNull()): LoadPactSessionResult {
  if (!storage) return { status: "none" };
  let raw: string | null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return { status: "none" };
  }
  if (!raw) {
    try {
      if (storage.getItem(LEGACY_STORAGE_KEY)) {
        return {
          status: "legacy",
          message:
            "Hay una sesión diagnóstica de la versión 0.6.0 en este navegador. El recorrido PACT usa " +
            "otro formato; puedes iniciar una sesión nueva sin borrar esos datos.",
        };
      }
    } catch {
      // sin almacenamiento legible
    }
    return { status: "none" };
  }
  return deserializePactSession(raw);
}

export function savePactSession(session: PactSession, storage: StorageLike | null = storageOrNull()): boolean {
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, serializePactSession(session));
    return true;
  } catch {
    return false;
  }
}

export function clearPactSession(storage: StorageLike | null = storageOrNull()): void {
  try {
    storage?.removeItem(STORAGE_KEY);
  } catch {
    // sin almacenamiento disponible
  }
}

/** Estado de evidencias vacío para un patrón (lo usa la UI al iniciar). */
export function emptyEvidenceStatuses(patternId: DiagnosisPatternId): Record<string, EvidenceStatus> {
  return Object.fromEntries(patternHypotheses(patternId).map((hypothesis) => [hypothesis.id, "insufficient"]));
}

export function answerEvaluations(session: PactSession): EvidenceEvaluation[] {
  return session.contrast.evaluations;
}
