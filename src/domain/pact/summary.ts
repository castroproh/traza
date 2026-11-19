/**
 * Resumen y exportación de una sesión PACT.
 *
 * El resumen separa observaciones (lo que se registró) de inferencias (lo que
 * la evidencia permite decir). No etiqueta al estudiante ni incluye datos
 * personales.
 */

import {
  PATTERNS,
  hypothesisById,
  type EvidenceState,
  type EvidenceStatus,
} from "../diagnosis/hypotheses";
import { getMicrotest } from "../diagnosis/microtests";
import { getExercise } from "../exercises";
import { pactExerciseById } from "./exercises";
import { PACT_INSTRUMENT_VERSION, PACT_SCHEMA_VERSION } from "./types";
import type { PactAnalysis, PactPrediction, PactSession, PactStage } from "./types";

export interface SummaryHypothesis {
  id: string;
  title: string;
  status: EvidenceStatus;
  label: string;
}

export interface SummaryMicrotest {
  id: string;
  objective: string;
  predictionQuestion: string;
  response: string;
  observedOutput: string;
  expectedOutcome: string;
  explanation: string;
  evaluations: Array<{
    hypothesisId: string;
    hypothesisTitle: string;
    state: EvidenceState;
    reason: string;
  }>;
}

export interface SummaryTransfer {
  exerciseId: string;
  title: string;
  predictionQuestion: string;
  prediction: PactPrediction | null;
  analysis: PactAnalysis | null;
  evidenceNote: string | null;
}

export interface SessionSummary {
  patternId: string;
  patternName: string;
  patternConcept: string;
  stage: PactStage;
  mainExercise: {
    title: string;
    description: string;
    code: string;
  } | null;
  prediction: PactPrediction | null;
  analysis: PactAnalysis | null;
  microtests: SummaryMicrotest[];
  hypotheses: SummaryHypothesis[];
  supported: string[];
  contradicted: string[];
  unresolved: string[];
  transfer: SummaryTransfer | null;
  observations: string[];
  inferences: string[];
  limitations: string[];
  completedAt: string | null;
}

const STATE_LABELS: Readonly<Record<EvidenceState, string>> = {
  supports: "apoya",
  insufficient: "insuficiente",
  contradicts: "contradice",
};

const STATUS_LABELS: Readonly<Record<EvidenceStatus, string>> = {
  supported: "apoyada",
  contradicted: "contradicha",
  insufficient: "sin resolver",
};

export function evidenceStateLabel(state: EvidenceState): string {
  return STATE_LABELS[state];
}

export function evidenceStatusLabel(status: EvidenceStatus): string {
  return STATUS_LABELS[status];
}

export function buildSessionSummary(session: PactSession): SessionSummary {
  const pattern = PATTERNS.find((item) => item.id === session.patternId);
  const mainDefinition = pactExerciseById(session.mainExerciseId);
  const mainExercise = getExercise(session.mainExerciseId);

  const microtests: SummaryMicrotest[] = session.contrast.answers.map((answer) => {
    const microtest = getMicrotest(answer.microtestId);
    const evaluations = answer.evaluations.map((evaluation) => {
      const hypothesis = hypothesisById(evaluation.hypothesisId);
      return {
        hypothesisId: evaluation.hypothesisId,
        hypothesisTitle: hypothesis?.title ?? evaluation.hypothesisId,
        state: evaluation.state,
        reason: evaluation.reason,
      };
    });
    return {
      id: answer.microtestId,
      objective: microtest?.objective ?? answer.microtestId,
      predictionQuestion: microtest?.predictionQuestion ?? "",
      response: answer.response,
      observedOutput: answer.observedOutput,
      expectedOutcome: microtest?.expectedOutcome ?? "",
      explanation: microtest?.explanation ?? "",
      evaluations,
    };
  });

  const hypotheses: SummaryHypothesis[] = Object.entries(session.contrast.statuses).map(
    ([id, status]) => ({
      id,
      title: hypothesisById(id)?.title ?? id,
      status,
      label: STATUS_LABELS[status],
    }),
  );

  const transferDefinition = session.transfer ? pactExerciseById(session.transfer.exerciseId) : null;
  const transfer: SummaryTransfer | null = session.transfer
    ? {
        exerciseId: session.transfer.exerciseId,
        title: transferDefinition?.title ?? session.transfer.exerciseId,
        predictionQuestion: transferDefinition?.predictionQuestion ?? "",
        prediction: session.transfer.prediction,
        analysis: session.transfer.analysis,
        evidenceNote: session.transfer.evidence?.note ?? null,
      }
    : null;

  const observations: string[] = [];
  if (session.prediction) {
    observations.push(
      `Se registró una predicción inicial para "${mainDefinition?.title ?? session.mainExerciseId}": ` +
        `"${session.prediction.expectedOutput}" con confianza ${session.prediction.confidence}/100.`,
    );
  }
  if (session.analysis) {
    observations.push(`La ejecución real produjo: "${session.analysis.observedOutput}".`);
    observations.push(
      `Se observaron ${session.analysis.observedIterations.length} iteraciones ` +
        `(${session.analysis.observedIterations.join(", ")}) y ${session.analysis.durationMs} ms de ejecución.`,
    );
  }
  if (session.contrast.answers.length === 1) {
    observations.push("Se respondió 1 microprueba de contraste.");
  } else if (session.contrast.answers.length > 1) {
    observations.push(`Se respondieron ${session.contrast.answers.length} micropruebas de contraste.`);
  }
  if (session.transfer?.analysis) {
    observations.push(
      `En la transferencia "${transferDefinition?.title ?? session.transfer.exerciseId}" la ejecución produjo: ` +
        `"${session.transfer.analysis.observedOutput}".`,
    );
  }
  if (session.completedAt) {
    observations.push(`La sesión se completó el ${session.completedAt}.`);
  }

  const inferences: string[] = [];
  for (const hypothesis of hypotheses) {
    if (hypothesis.status === "supported") {
      inferences.push(
        `La evidencia de esta sesión apoya la explicación ${hypothesis.id} ("${hypothesis.title}").`,
      );
    } else if (hypothesis.status === "contradicted") {
      inferences.push(
        `La evidencia de esta sesión contradice la explicación ${hypothesis.id} ("${hypothesis.title}").`,
      );
    } else {
      inferences.push(
        `La evidencia de esta sesión no permite decidir sobre ${hypothesis.id} ("${hypothesis.title}").`,
      );
    }
  }
  if (session.transfer?.evidence) {
    inferences.push(session.transfer.evidence.note);
  }
  inferences.push(
    "Estas inferencias se limitan a las respuestas observadas en esta sesión y no son una etiqueta del estudiante.",
  );

  const limitations = [
    "TRAZA no es una validación psicométrica ni una prueba de efectividad educativa.",
    "Una respuesta correcta o incorrecta aislada no demuestra comprensión consolidada.",
    "La selección adaptativa es determinista y se limita al banco de micropruebas disponible.",
    "La transferencia es una observación puntual en un ejercicio, no una medida de dominio.",
    "No se recogieron nombres, correos ni otros datos personales.",
  ];

  return {
    patternId: session.patternId,
    patternName: pattern?.name ?? session.patternId,
    patternConcept: pattern?.concept ?? "",
    stage: session.stage,
    mainExercise: mainExercise
      ? {
          title: mainExercise.title,
          description: mainExercise.description,
          code: mainExercise.code,
        }
      : null,
    prediction: session.prediction,
    analysis: session.analysis,
    microtests,
    hypotheses,
    supported: hypotheses.filter((item) => item.status === "supported").map((item) => item.id),
    contradicted: hypotheses.filter((item) => item.status === "contradicted").map((item) => item.id),
    unresolved: hypotheses.filter((item) => item.status === "insufficient").map((item) => item.id),
    transfer,
    observations,
    inferences,
    limitations,
    completedAt: session.completedAt,
  };
}

export interface PactSessionExport {
  schemaVersion: number;
  instrumentVersion: string;
  exportedAt: string;
  session: PactSession;
  summary: SessionSummary;
}

/** Exporta la sesión completa con versión de esquema y sin datos personales. */
export function buildSessionExport(session: PactSession, now = new Date()): PactSessionExport {
  return {
    schemaVersion: PACT_SCHEMA_VERSION,
    instrumentVersion: PACT_INSTRUMENT_VERSION,
    exportedAt: now.toISOString(),
    session,
    summary: buildSessionSummary(session),
  };
}

export function buildSessionExportJson(session: PactSession, now = new Date()): string {
  return JSON.stringify(buildSessionExport(session, now), null, 2);
}
