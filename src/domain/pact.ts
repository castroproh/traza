import { comparePrediction, type PredictionComparison } from "./compare";
import { EXERCISES, type ExerciseId } from "./exercises";
import { PACT_PATTERNS } from "./pactContent";
import type { ExecutionResult, StudentPrediction } from "./types";

export type PACTStage = "prediction" | "analysis" | "contrast" | "transfer";
export type PACTPatternId = "range-exclusive" | "accumulator";
export type EvidenceStatus = "supports" | "insufficient" | "contradicts";

export interface MisconceptionHypothesis {
  id: string;
  title: string;
  description: string;
}

export interface HypothesisResponse {
  output: string;
  iterations: number;
  variableValues: Record<string, number[]>;
}

export interface DiagnosticMicrotest {
  id: string;
  title: string;
  situation: string;
  modification: string;
  exerciseId: ExerciseId;
  hypothesisResponses: Record<string, HypothesisResponse>;
  interpretationRule: string;
}

export interface PACTPattern {
  id: PACTPatternId;
  title: string;
  description: string;
  concept: string;
  analysisInsight: string;
  mainExerciseId: ExerciseId;
  hypotheses: readonly MisconceptionHypothesis[];
  microtests: readonly DiagnosticMicrotest[];
  transferExerciseId: ExerciseId;
}

export interface DiagnosticEvidence {
  hypothesisId: string;
  status: EvidenceStatus;
  observations: string[];
  explanation: string;
}

export interface DiagnosticResult {
  microtestId: string;
  evidence: DiagnosticEvidence[];
  explanation: string;
}

export interface TransferAssessment {
  status: "consistent" | "partial" | "not-observed" | "insufficient";
  comparison: PredictionComparison;
  explanation: string;
}

export interface PACTSession {
  schemaVersion: 1;
  patternId: PACTPatternId | null;
  stage: PACTStage;
  mainPrediction?: StudentPrediction;
  mainResult?: ExecutionResult;
  contrastPredictions: Record<string, StudentPrediction>;
  contrastResults: Record<string, ExecutionResult>;
  transferPrediction?: StudentPrediction;
  transferResult?: ExecutionResult;
}

export function createPACTSession(): PACTSession {
  return {
    schemaVersion: 1,
    patternId: null,
    stage: "prediction",
    contrastPredictions: {},
    contrastResults: {},
  };
}

export function startPACTSession(patternId: PACTPatternId): PACTSession {
  return { ...createPACTSession(), patternId };
}

export function getPACTPattern(patternId: PACTPatternId): PACTPattern {
  return PACT_PATTERNS[patternId];
}

export function contrastComplete(session: PACTSession, pattern: PACTPattern): boolean {
  return pattern.microtests.every((test) => session.contrastResults[test.id]?.success === true);
}

export function canAccessPACTStage(session: PACTSession, stage: PACTStage): boolean {
  if (!session.patternId) return false;
  const pattern = getPACTPattern(session.patternId);
  switch (stage) {
    case "prediction":
      return true;
    case "analysis":
      return session.mainPrediction !== undefined;
    case "contrast":
      return session.mainResult?.success === true;
    case "transfer":
      return contrastComplete(session, pattern);
  }
}

export function evaluateDiagnostic(
  test: DiagnosticMicrotest,
  prediction: StudentPrediction,
  result: ExecutionResult,
): DiagnosticResult {
  const observations = [
    `Predicción registrada: salida «${normalizeOutput(prediction.expectedOutput)}» y ${prediction.expectedIterations.length} iteraciones.`,
    `Valores previstos por vuelta: ${Object.entries(prediction.expectedVariableValues ?? {})
      .map(([name, values]) => `${name} = ${values.join(", ")}`)
      .join("; ") || "sin variables especificadas"}.`,
    `Ejecución observada: salida «${normalizeOutput(result.output)}».`,
  ];
  const expectedExerciseOutput = normalizeOutput(EXERCISES[test.exerciseId]?.expectedOutput ?? "");
  if (!result.success || normalizeOutput(result.output) !== expectedExerciseOutput) {
    return {
      microtestId: test.id,
      evidence: Object.keys(test.hypothesisResponses).map((hypothesisId) => ({
        hypothesisId,
        status: "insufficient",
        observations,
        explanation: "La microprueba no produjo el resultado esperado; no permite distinguir hipótesis.",
      })),
      explanation: "No se interpreta esta respuesta porque la ejecución de referencia no fue válida.",
    };
  }

  const matches = Object.entries(test.hypothesisResponses)
    .filter(([, response]) => predictionMatches(response, prediction))
    .map(([hypothesisId]) => hypothesisId);
  const evidence = Object.keys(test.hypothesisResponses).map((hypothesisId): DiagnosticEvidence => {
    if (matches.length > 1) {
      const ambiguous = matches.includes(hypothesisId);
      return {
        hypothesisId,
        status: ambiguous ? "insufficient" : "contradicts",
        observations,
        explanation: ambiguous
          ? "La respuesta coincide con más de una hipótesis; esta prueba no las distingue."
          : "La respuesta no coincide con esta hipótesis, aunque sigue siendo ambigua entre otras.",
      };
    }
    if (matches.length === 1) {
      const supports = matches[0] === hypothesisId;
      return {
        hypothesisId,
        status: supports ? "supports" : "contradicts",
        observations,
        explanation: supports
          ? "Esta predicción es compatible con la hipótesis en esta microprueba; no es una etiqueta permanente."
          : "Esta predicción no coincide con lo que anticipa la hipótesis en esta microprueba.",
      };
    }
    return {
      hypothesisId,
      status: "insufficient",
      observations,
      explanation: "La respuesta no coincide claramente con una hipótesis de esta prueba.",
    };
  });

  return {
    microtestId: test.id,
    evidence,
    explanation:
      matches.length === 1
        ? "La respuesta distingue una explicación posible; se conserva como evidencia puntual, no como diagnóstico cierto."
        : "La respuesta no permite distinguir con seguridad entre las hipótesis.",
  };
}

export function assessTransfer(
  prediction: StudentPrediction,
  result: ExecutionResult,
  loopHeaderLine?: number,
): TransferAssessment {
  const comparison = comparePrediction(prediction, result, loopHeaderLine);
  if (!result.success) {
    return {
      status: "insufficient",
      comparison,
      explanation: "La ejecución no terminó correctamente; no se puede valorar la transferencia.",
    };
  }
  if (comparison.allMatch && prediction.explanation.trim()) {
    return {
      status: "consistent",
      comparison,
      explanation:
        "Tu predicción y explicación son consistentes con este ejercicio nuevo. Un acierto aislado no demuestra por sí solo comprensión estable.",
    };
  }
  if (
    comparison.outputMatches ||
    comparison.iterationsMatch ||
    comparison.variableSequences.some((sequence) => sequence.matches)
  ) {
    return {
      status: "partial",
      comparison,
      explanation: "Algunas partes coinciden; la transferencia todavía no queda establecida.",
    };
  }
  return {
    status: "not-observed",
    comparison,
    explanation: "En este ejercicio no se observó una predicción coincidente; esto no etiqueta tu capacidad.",
  };
}

export function normalizeOutput(output: string): string {
  return output.replace(/\r\n/g, "\n").trim();
}

function predictionMatches(
  response: HypothesisResponse,
  prediction: StudentPrediction,
): boolean {
  if (
    normalizeOutput(response.output) !== normalizeOutput(prediction.expectedOutput) ||
    prediction.expectedIterations.length !== response.iterations
  ) {
    return false;
  }
  return Object.entries(response.variableValues).every(([name, expected]) => {
    const actual = prediction.expectedVariableValues?.[name];
    return actual !== undefined && arraysMatch(expected, actual);
  });
}

function arraysMatch(left: readonly number[], right: readonly number[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
