/**
 * Motor de interpretación de evidencias (misión 0.6.0).
 *
 * Funciones puras, sin dependencia de la interfaz Vue, diseñadas para ser
 * auditables y reproducibles:
 *   1. Reciben las respuestas observadas.
 *   2. Consultan las firmas esperadas de las hipótesis.
 *   3. Comparan los resultados.
 *   4. Identifican coincidencias y contradicciones.
 *   5. Detectan ambigüedades.
 *   6. Asignan estados de evidencia.
 *   7. Explican la decisión.
 *   8. Conservan las observaciones originales.
 *
 * No usa IA generativa ni probabilidades: cada estado se deriva de reglas
 * deterministas sobre las respuestas previstas por hipótesis.
 */

import { hypothesisById, patternHypotheses, type EvidenceEvaluation, type EvidenceState, type EvidenceStatus } from "./hypotheses";
import { getMicrotest, type DiagnosticMicrotest } from "./microtests";

/** Normaliza una respuesta para comparar: sin espacios y sin mayúsculas? (solo espacios). */
export function normalizeResponse(response: string): string {
  return response.trim().replace(/\s+/g, "");
}

function sameResponse(a: string, b: string): boolean {
  return normalizeResponse(a) === normalizeResponse(b);
}

/**
 * Respuestas de incertidumbre explícita: nunca se interpretan como apoyo ni
 * como contradicción, aunque la hipótesis "acertada" prediga el resultado.
 * Se normalizan espacios, mayúsculas y acentos.
 */
const UNCERTAIN_RESPONSES = new Set([
  "noestoyseguro",
  "noestoysegura",
  "noseguro",
  "nosegura",
  "nose",
  "nolose",
  "nolase",
]);

function isUncertainResponse(response: string): boolean {
  const normalized = normalizeResponse(response)
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
  return UNCERTAIN_RESPONSES.has(normalized);
}

export interface EvidenceOutcome {
  evaluations: EvidenceEvaluation[];
  /** Estado resultante por hipótesis del patrón evaluado. */
  statuses: Record<string, EvidenceStatus>;
  /** Hipótesis que aún no pueden distinguirse (evidencia insuficiente). */
  unresolved: string[];
  /** ¿Todas las parejas del patrón ya fueron discriminadas de forma concluyente? */
  resolved: boolean;
}

/**
 * Interpreta una respuesta observada de una microprueba frente a una hipótesis.
 * Reglas:
 *  - Si la respuesta está catalogada como ambigua -> "insufficient".
 *  - Si la respuesta coincide con una predicción de la hipótesis -> "supports".
 *  - Si la hipótesis predijo el comportamiento correcto y la respuesta no lo
 *    respalda -> "contradicts".
 *  - Si la respuesta coincide con el resultado correcto y la hipótesis predijo otra
 *    cosa -> "contradicts". Nunca se infiere dominio consolidado desde la respuesta
 *    correcta por sí sola: aquí solo se compara la hipótesis contra la evidencia.
 *  - En cualquier otro caso -> "insufficient" (la ambigüedad queda abierta).
 */
export function interpretResponse(
  microtest: DiagnosticMicrotest,
  hypothesisId: string,
  observedResponse: string,
): EvidenceEvaluation {
  const hypothesis = hypothesisById(hypothesisId);
  const patternId = hypothesis?.patternId ?? microtest.patternId;
  const predictedResponses = microtest.responseSignatures[hypothesisId] ?? [];
  const observed = observedResponse.trim();
  const predictedMatches = predictedResponses.some((r) => sameResponse(r, observed));
  const includesExpected = predictedResponses.some((r) => sameResponse(r, microtest.expectedOutcome));
  const isCorrect = sameResponse(observed, microtest.expectedOutcome);
  const ambiguous = microtest.ambiguityCases.some((c) => sameResponse(c, observed));
  const allPredicted = Object.values(microtest.responseSignatures).flat();
  const hasDistinctWrongPrediction = allPredicted.some((r) => !sameResponse(r, microtest.expectedOutcome));

  let state: EvidenceState;
  let reason: string;
  if (ambiguous || isUncertainResponse(observed)) {
    state = "insufficient";
    reason = "La respuesta expresa ambigüedad o incertidumbre; se mantiene la evidencia sin resolver.";
  } else if (predictedMatches && isCorrect && !hypothesis?.normative && hasDistinctWrongPrediction) {
    // Una hipótesis no normativa que predice el resultado correcto en esta prueba
    // es compatible con la respuesta, pero la respuesta no la distingue de una
    // comprensión correcta. Se declara insuficiente en lugar de apoyo.
    state = "insufficient";
    reason =
      "La respuesta coincide con el resultado correcto y también sería compatible con esta explicación; " +
      "la prueba no permite distinguirla de una comprensión correcta.";
  } else if (predictedMatches) {
    state = "supports";
    reason = `La respuesta observada coincide con una predicción de la hipótesis (${predictedResponses.join(" | ")}).`;
  } else if (includesExpected) {
    state = "contradicts";
    reason = `La hipótesis predecía (${predictedResponses.join(" | ")}), que coincide con el resultado correcto (${microtest.expectedOutcome}); la respuesta observada no la respalda.`;
  } else if (isCorrect) {
    state = "contradicts";
    reason = `La respuesta observada coincide con el resultado correcto (${microtest.expectedOutcome}) y la hipótesis predice otra cosa (${predictedResponses.join(" | ")}).`;
  } else {
    state = "insufficient";
    reason = "La respuesta no coincide con la predicción de la hipótesis ni con el resultado correcto; no permite distinguir.";
  }

  return {
    hypothesisId,
    patternId,
    microtestId: microtest.id,
    state,
    observedResponse: observed,
    predictedResponses: [...predictedResponses],
    reason,
  };
}

/**
 * Evalúa todas las hipótesis objetivo de una microprueba con una respuesta
 * observada, delegando en la regla de interpretación.
 */
export function evaluateMicrotest(microtest: DiagnosticMicrotest, observedResponse: string): EvidenceEvaluation[] {
  const evaluations: EvidenceEvaluation[] = [];
  for (const hypothesisId of microtest.targetHypotheses) {
    const evaluation = interpretResponse(microtest, hypothesisId, observedResponse);
    evaluations.push(evaluation);
  }
  return evaluations;
}

/**
 * Evalúa el conjunto de respuestas de un patrón y resume el estado de cada
 * hipótesis. No acumula probabilidades: solo decide por reglas deterministas.
 */
export function evaluatePattern(
  patternId: string,
  answers: ReadonlyArray<{ microtestId: string; response: string }>,
): EvidenceOutcome {
  const hypotheses = patternHypotheses(patternId);
  const evaluations: EvidenceEvaluation[] = [];
  const byHypothesis = new Map<string, EvidenceEvaluation[]>();

  for (const answer of answers) {
    const microtest = getMicrotest(answer.microtestId);
    if (!microtest || microtest.patternId !== patternId) continue;
    for (const evaluation of evaluateMicrotest(microtest, answer.response)) {
      evaluations.push(evaluation);
      const list = byHypothesis.get(evaluation.hypothesisId) ?? [];
      list.push(evaluation);
      byHypothesis.set(evaluation.hypothesisId, list);
    }
  }

  const statuses: Record<string, EvidenceStatus> = {};
  const unresolved: string[] = [];
  for (const hypothesis of hypotheses) {
    const evals = byHypothesis.get(hypothesis.id) ?? [];
    const states = evals.map((e) => e.state);
    const hasSupport = states.includes("supports");
    const hasContradiction = states.includes("contradicts");
    const status: EvidenceStatus = hasContradiction ? "contradicted" : hasSupport ? "supported" : "insufficient";
    statuses[hypothesis.id] = status;
    if (status === "insufficient") unresolved.push(hypothesis.id);
  }

  // Una pareja se considera resuelta cuando alguna microprueba discriminante
  // respondida de forma concluyente (supports/contradicts) separa a ambas.
  const resolved = hypotheses.every((h) => statuses[h.id] !== "insufficient");

  return { evaluations, statuses, unresolved, resolved };
}

/**
 * Mensaje de retroalimentación educativa a partir de una evaluación. Está
 * centrado en la evidencia, no en juicios absolutos sobre el estudiante.
 */
export function educationalFeedback(evaluation: EvidenceEvaluation): string {
  const hypothesis = hypothesisById(evaluation.hypothesisId);
  const label = hypothesis ? `${hypothesis.id} (${hypothesis.title})` : evaluation.hypothesisId;
  switch (evaluation.state) {
    case "supports":
      return `Tu predicción coincide con la interpretación de ${label}. Vamos a contrastarla con otra microprueba.`;
    case "contradicts":
      return `Tu predicción coincide con el comportamiento correcto y descarta la interpretación de ${label}.`;
    case "insufficient":
      return "Esta respuesta no permite distinguir entre dos explicaciones posibles. Necesitamos otra evidencia.";
  }
}

/**
 * Conclusión legible para la retroalimentación educativa. Nunca afirma
 * "el estudiante sabe X": se limita a describir la evidencia acumulada.
 */
export function describeConclusion(outcome: EvidenceOutcome): string {
  const parts = Object.entries(outcome.statuses).map(([hypothesisId, status]) => {
    const hypothesis = hypothesisById(hypothesisId);
    const label = hypothesis ? `${hypothesis.id} (${hypothesis.title})` : hypothesisId;
    if (status === "supported") {
      return `${label}: la evidencia disponible apoya esta hipótesis.`;
    }
    if (status === "contradicted") {
      return `${label}: la evidencia disponible la contradice.`;
    }
    return `${label}: la evidencia disponible es insuficiente.`;
  });
  const open = outcome.unresolved.length > 0;
  return open
    ? `Evidencia insuficiente para cerrar el caso. ${parts.join(" ")}`
    : `Se evaluaron ${Object.keys(outcome.statuses).length} hipótesis del patrón. ${parts.join(" ")}`;
}
