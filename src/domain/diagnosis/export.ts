/**
 * Exportación del banco de micropruebas y sus matrices de discriminación (misión 0.6.0).
 *
 * El JSON incluye: definiciones de patrones, hipótesis, micropruebas, respuestas
 * esperadas, reglas de interpretación, limitaciones conocidas y versión de cada
 * elemento. Es la vista que prepara la revisión docente.
 */

import { HYPOTHESES, PATTERNS } from "./hypotheses";
import { MICROTESTS } from "./microtests";
import { DISCRIMINATION_MATRICES, matrixForPattern } from "./discrimination";

export const INSTRUMENT_VERSION = "0.8.0";

export interface BankExportElement {
  /** Versión del elemento dentro del banco. */
  version: number;
}

export interface BankExport {
  instrument: { name: string; version: string };
  generatedBy: string;
  patterns: Array<{ id: string; name: string; concept: string; description: string } & BankExportElement>;
  hypotheses: Array<{
    id: string;
    patternId: string;
    title: string;
    description: string;
    expectedBehavior: string;
    expectedResponses: string[];
    supportingEvidence: string[];
    contradictingEvidence: string[];
    alternatives: string[];
    limitations: string[];
    version: number;
  }>;
  microtests: Array<{
    id: string;
    version: number;
    patternId: string;
    targetHypotheses: string[];
    objective: string;
    code: string;
    predictionQuestion: string;
    responseSignatures: Record<string, string[]>;
    expectedOutcome: string;
    answerFormat: string;
    interpretationRule: string;
    explanation: string;
    difficulty: string;
    ambiguityCases: string[];
    prerequisites: string[];
  }>;
  discriminationMatrices: Array<{
    patternId: string;
    pairs: Array<{
      hypothesisAId: string;
      hypothesisBId: string;
      discriminatingMicrotests: string[];
      insufficientWhen: string;
    }>;
  }>;
  limitations: string[];
}

export function buildBankExport(): BankExport {
  return {
    instrument: { name: "traza", version: INSTRUMENT_VERSION },
    generatedBy: "TRAZA 0.8.0",
    patterns: PATTERNS.map((p) => ({ ...p, version: 1 })),
    hypotheses: HYPOTHESES.map((h) => ({
      id: h.id,
      patternId: h.patternId,
      title: h.title,
      description: h.description,
      expectedBehavior: h.expectedBehavior,
      expectedResponses: [...h.expectedResponses],
      supportingEvidence: [...h.supportingEvidence],
      contradictingEvidence: [...h.contradictingEvidence],
      alternatives: [...h.alternatives],
      limitations: [...h.limitations],
      version: 1,
    })),
    microtests: MICROTESTS.map((m) => ({
      id: m.id,
      version: m.version,
      patternId: m.patternId,
      targetHypotheses: [...m.targetHypotheses],
      objective: m.objective,
      code: m.code,
      predictionQuestion: m.predictionQuestion,
      responseSignatures: Object.fromEntries(Object.entries(m.responseSignatures).map(([k, v]) => [k, [...v]])),
      expectedOutcome: m.expectedOutcome,
      answerFormat: m.answerFormat,
      interpretationRule: m.interpretationRule,
      explanation: m.explanation,
      difficulty: m.difficulty,
      ambiguityCases: [...m.ambiguityCases],
      prerequisites: [...m.prerequisites],
    })),
    discriminationMatrices: DISCRIMINATION_MATRICES.map((m) => ({
      patternId: m.patternId,
      pairs: m.pairs.map((p) => ({
        hypothesisAId: p.hypothesisAId,
        hypothesisBId: p.hypothesisBId,
        discriminatingMicrotests: [...p.discriminatingMicrotests],
        insufficientWhen: p.insufficientWhen,
      })),
    })),
    limitations: [
      "El instrumento no constituye validación psicométrica ni prueba de efectividad educativa.",
      "Las reglas diagnósticas no convierten respuestas en certezas absolutas.",
      "El Worker no es un sandbox de seguridad.",
    ],
  };
}

export function buildBankExportJson(): string {
  return JSON.stringify(buildBankExport(), null, 2);
}

export function matrixExport(patternId: string) {
  const matrix = matrixForPattern(patternId);
  if (!matrix) throw new Error(`No existe matriz para el patrón ${patternId}.`);
  return matrix;
}
