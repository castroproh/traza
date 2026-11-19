/**
 * Selección adaptativa de micropruebas (misión 0.6.0).
 *
 * Reglas implementadas (deterministas, explicables, sin azar):
 *  - Priorizar hipótesis que todavía no puedan distinguirse.
 *  - Evitar repetir micropruebas equivalentes (no se repite lo ya respondido).
 *  - Seleccionar pruebas que separen hipótesis rivales.
 *  - No presentar pruebas innecesarias cuando ya exista evidencia suficiente.
 *  - Permitir evidencia insuficiente cuando ninguna prueba disponible resuelva la ambigüedad.
 *  - Limitar la cantidad de micropruebas por sesión.
 *
 * La selección es determinista para las mismas condiciones de entrada y cada
 * decisión devuelve una razón auditable.
 */

import { getMicrotest, microtestsByPattern, type DiagnosticMicrotest } from "./microtests";
import { matrixForPattern } from "./discrimination";
import { patternHypotheses, type DiscriminationPair } from "./hypotheses";
import { evaluateMicrotest } from "./evidence";
export const MAX_MICROTESTS_PER_SESSION = 8;

export type SelectionAction = "selected" | "sufficient" | "insufficient" | "limit";

export interface SelectionResult {
  action: SelectionAction;
  microtestId?: string;
  reason: string;
}

export interface SelectionInput {
  patternId: string;
  /** Micropruebas ya respondidas en la sesión: microtestId + respuesta observada. */
  answers: ReadonlyArray<{ microtestId: string; response: string }>;
  maxPerSession?: number;
}

/**
 * Una pareja queda separada cuando una microprueba discriminatoria respondida
 * contradice a al menos una de las dos hipótesis. No exigimos que ambas sean
 * concluyentes: descartar una explicación ya separa la pareja, y evita forzar
 * más pruebas de las necesarias.
 */
function pairResolved(pair: DiscriminationPair, answers: ReadonlyArray<{ microtestId: string; response: string }>): boolean {
  for (const id of pair.discriminatingMicrotests) {
    const answer = answers.find((a) => a.microtestId === id);
    const microtest = getMicrotest(id);
    if (!answer || !microtest) continue;
    const evaluations = evaluateMicrotest(microtest, answer.response);
    const a = evaluations.find((e) => e.hypothesisId === pair.hypothesisAId);
    const b = evaluations.find((e) => e.hypothesisId === pair.hypothesisBId);
    if (a?.state === "contradicts" || b?.state === "contradicts") return true;
  }
  return false;
}

/** Hipótesis que ya recibieron una evaluación concluyente en la sesión. */
function decidedHypotheses(answers: ReadonlyArray<{ microtestId: string; response: string }>): Set<string> {
  const decided = new Set<string>();
  for (const answer of answers) {
    const microtest = getMicrotest(answer.microtestId);
    if (!microtest) continue;
    for (const evaluation of evaluateMicrotest(microtest, answer.response)) {
      if (evaluation.state === "supports" || evaluation.state === "contradicts") {
        decided.add(evaluation.hypothesisId);
      }
    }
  }
  return decided;
}

/** Una microprueba puede contradecir a la hipótesis si predice algo distinto del resultado correcto. */
function canChallenge(microtest: DiagnosticMicrotest, hypothesisId: string): boolean {
  const responses = microtest.responseSignatures[hypothesisId] ?? [];
  return responses.some((response) => response.trim() !== microtest.expectedOutcome.trim());
}

export function selectMicrotest(input: SelectionInput): SelectionResult {
  const { patternId, answers, maxPerSession = MAX_MICROTESTS_PER_SESSION } = input;
  const matrix = matrixForPattern(patternId);
  const pairs = matrix?.pairs ?? [];

  if (answers.length >= maxPerSession) {
    return { action: "limit", reason: `Se alcanzó el límite de micropruebas por sesión (${maxPerSession}).` };
  }

  const answeredIds = new Set(answers.map((a) => a.microtestId));
  const decided = decidedHypotheses(answers);

  // Cobertura: ninguna hipótesis del patrón debería quedar sin una evaluación
  // concluyente si existe una prueba capaz de desafiarla.
  const uncovered = patternHypotheses(patternId).filter((hypothesis) => !decided.has(hypothesis.id));
  if (uncovered.length > 0) {
    const coverageCandidates = microtestsByPattern(patternId).filter((microtest) => {
      if (answeredIds.has(microtest.id)) return false;
      return uncovered.some(
        (hypothesis) =>
          microtest.targetHypotheses.includes(hypothesis.id) && canChallenge(microtest, hypothesis.id),
      );
    });
    if (coverageCandidates.length > 0) {
      coverageCandidates.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
      const chosen = coverageCandidates[0];
      if (chosen) {
        const targeted = uncovered.find(
          (hypothesis) => chosen.targetHypotheses.includes(hypothesis.id) && canChallenge(chosen, hypothesis.id),
        );
        return {
          action: "selected",
          microtestId: chosen.id,
          reason: `Se seleccionó la microprueba ${chosen.id} porque permite distinguir explicaciones rivales y todavía no hay evidencia concluyente sobre ${targeted?.id ?? "una hipótesis pendiente"}.`,
        };
      }
    }
  }

  const unresolvedPairs = pairs.filter((p) => !pairResolved(p, answers));
  const firstUnresolvedPair = unresolvedPairs[0];
  const firstUnresolved = firstUnresolvedPair
    ? `${firstUnresolvedPair.hypothesisAId} vs ${firstUnresolvedPair.hypothesisBId}`
    : "las hipótesis pendientes";

  if (unresolvedPairs.length === 0) {
    return { action: "sufficient", reason: "Ya existen micropruebas que separan las hipótesis rivales con evidencia concluyente; no hace falta más." };
  }

  const candidates = microtestsByPattern(patternId).filter((m: DiagnosticMicrotest) => {
    if (answeredIds.has(m.id)) return false;
    return pairs.some((p) => p.discriminatingMicrotests.includes(m.id) && !pairResolved(p, answers));
  });

  if (candidates.length === 0) {
    return { action: "insufficient", reason: `Ninguna microprueba pendiente resuelve la ambigüedad entre ${firstUnresolved}.` };
  }

  candidates.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const chosen: DiagnosticMicrotest | undefined = candidates[0];
  if (!chosen) {
    return { action: "insufficient", reason: "Ninguna microprueba candidata quedó disponible." };
  }
  const targetPair = pairs.find((p) => p.discriminatingMicrotests.includes(chosen.id) && !pairResolved(p, answers));
  const pairLabel = targetPair ? `${targetPair.hypothesisAId} y ${targetPair.hypothesisBId}` : "las hipótesis pendientes";

  return {
    action: "selected",
    microtestId: chosen.id,
    reason: `Se seleccionó la microprueba ${chosen.id} porque permite distinguir entre ${pairLabel}.`,
  };
}
