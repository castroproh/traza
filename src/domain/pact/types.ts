/**
 * Modelo del recorrido PACT de TRAZA (misión 0.7.0).
 *
 * El dominio no depende de Vue ni del Worker: describe la sesión, sus etapas y
 * las transiciones permitidas. La interfaz solo interpreta este estado.
 */

import type { EvidenceEvaluation, EvidenceStatus } from "../diagnosis/hypotheses";
import type { DiagnosisPatternId } from "../diagnosis/hypotheses";
import type { PactExerciseId } from "../exercises";
import type { TraceValue } from "../types";

/** Versión del esquema de sesión. Cambia solo si el formato deja de ser compatible. */
export const PACT_SCHEMA_VERSION = 1;

/** Versión del instrumento que produce la sesión. */
export const PACT_INSTRUMENT_VERSION = "0.8.0";

export const PACT_STAGES = ["prediction", "analysis", "contrast", "transfer", "completed"] as const;
export type PactStage = (typeof PACT_STAGES)[number];

export const PACT_STAGE_LABELS: Readonly<Record<PactStage, string>> = {
  prediction: "Predicción",
  analysis: "Análisis",
  contrast: "Contraste",
  transfer: "Transferencia",
  completed: "Completado",
};

export interface PredictionInput {
  expectedOutput: string;
  /** Solo se incluyen las variables que el estudiante decidió responder. */
  expectedVariables: Record<string, number>;
  expectedIterations: number[];
  explanation: string;
  /** 0–100. No es una calificación. */
  confidence: number;
}

export interface PactPrediction extends PredictionInput {
  submittedAt: string;
}

export interface VariableDiff {
  name: string;
  expected: number;
  actual: number | undefined;
  matches: boolean;
}

export type DivergenceKind = "none" | "output" | "iterations" | "variables" | "unknown";

export interface Divergence {
  kind: DivergenceKind;
  description: string;
  /** Línea del bucle cuando la diferencia se puede atribuir a las iteraciones. */
  line?: number;
}

export interface PactAnalysis {
  outputMatches: boolean;
  expectedOutput: string;
  observedOutput: string;
  variableDiffs: VariableDiff[];
  iterationsPredicted: boolean;
  iterationsMatch: boolean;
  expectedIterations: number[];
  observedIterations: number[];
  allMatch: boolean;
  divergence: Divergence;
  observedFinalState: Record<string, TraceValue>;
  durationMs: number;
  analyzedAt: string;
}

export interface ContrastAnswer {
  microtestId: string;
  response: string;
  /** Salida real de ejecutar la microprueba en Pyodide. */
  observedOutput: string;
  evaluations: EvidenceEvaluation[];
  answeredAt: string;
}

export interface ContrastState {
  answers: ContrastAnswer[];
  evaluations: EvidenceEvaluation[];
  statuses: Record<string, EvidenceStatus>;
  unresolved: string[];
  resolved: boolean;
  completed: boolean;
  completedAt: string | null;
}

export interface TransferEvidence {
  correct: boolean;
  /** Observación puntual; nunca se presenta como comprensión consolidada. */
  note: string;
}

export interface TransferState {
  exerciseId: PactExerciseId;
  prediction: PactPrediction | null;
  analysis: PactAnalysis | null;
  evidence: TransferEvidence | null;
}

export interface PactSession {
  schemaVersion: number;
  instrumentVersion: string;
  /** Identificador local no personal. */
  sessionId: string;
  patternId: DiagnosisPatternId;
  stage: PactStage;
  mainExerciseId: PactExerciseId;
  prediction: PactPrediction | null;
  analysis: PactAnalysis | null;
  contrast: ContrastState;
  transfer: TransferState | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export class PactTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PactTransitionError";
  }
}
