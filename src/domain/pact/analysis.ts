/**
 * Predicción, comparación y punto de divergencia del ciclo PACT.
 *
 * Las funciones son puras y no inventan información: si la predicción no
 * permite localizar una divergencia concreta, se declara como tal.
 */

import { finalState, observedIterations } from "../compare";
import { getExercise } from "../exercises";
import type { ExecutionResult, TraceValue } from "../types";
import type { AnswerFormat, PactExerciseDefinition } from "./exercises";
import type {
  Divergence,
  PactAnalysis,
  PactPrediction,
  PredictionInput,
  TransferEvidence,
  VariableDiff,
} from "./types";

const MIN_EXPLANATION_LENGTH = 3;

/** Extrae números en orden para comparar secuencias aunque cambie el formato. */
function canonicalNumbers(value: string): string {
  return (value.match(/-?\d+/g) ?? []).join(",");
}

function canonicalText(value: string): string {
  return value
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join("\n");
}

export function canonicalizeAnswer(value: string, format: AnswerFormat): string {
  return format === "numbers" ? canonicalNumbers(value) : canonicalText(value);
}

/** Valida los datos mínimos antes de congelar una predicción. */
export function validatePrediction(input: PredictionInput): string[] {
  const errors: string[] = [];
  if (input.expectedOutput.trim().length === 0) {
    errors.push("Escribe el resultado que esperas.");
  }
  if (input.explanation.trim().length < MIN_EXPLANATION_LENGTH) {
    errors.push("Explica brevemente tu razonamiento.");
  }
  if (!Number.isInteger(input.confidence) || input.confidence < 0 || input.confidence > 100) {
    errors.push("La confianza debe ser un número entero entre 0 y 100.");
  }
  for (const [name, value] of Object.entries(input.expectedVariables)) {
    if (!Number.isFinite(value)) errors.push(`El valor de ${name} debe ser un número.`);
  }
  for (const iteration of input.expectedIterations) {
    if (!Number.isInteger(iteration) || iteration < 1) {
      errors.push("Las iteraciones deben ser números enteros positivos.");
      break;
    }
  }
  return errors;
}

/** Parsea una lista de iteraciones escrita por el estudiante ("1, 2, 3"). */
export function parseIterations(text: string): number[] | null {
  const trimmed = text.trim();
  if (trimmed.length === 0) return [];
  const parts = trimmed.split(/[,\s]+/).filter((part) => part.length > 0);
  const values = parts.map((part) => Number(part));
  if (values.some((value) => !Number.isInteger(value) || value < 1)) return null;
  return values;
}

/** Línea del primer bucle del ejercicio; `undefined` si no se encuentra. */
export function findLoopLine(code: string): number | undefined {
  const index = code.split("\n").findIndex((line) => /^\s*(for|while)\s+/.test(line));
  return index >= 0 ? index + 1 : undefined;
}

function sameNumberList(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function variableDiffs(
  expected: Readonly<Record<string, number>>,
  result: ExecutionResult,
): VariableDiff[] {
  const state = finalState(result) ?? {};
  return Object.entries(expected).map(([name, expectedValue]) => {
    const raw = state[name];
    const actual = typeof raw === "number" ? raw : undefined;
    return { name, expected: expectedValue, actual, matches: actual === expectedValue };
  });
}

function buildDivergence(input: {
  allMatch: boolean;
  outputMatches: boolean;
  iterationsPredicted: boolean;
  iterationsMatch: boolean;
  expectedIterations: readonly number[];
  observedIterations: readonly number[];
  diffs: readonly VariableDiff[];
  expectedOutput: string;
  observedOutput: string;
  loopLine: number | undefined;
}): Divergence {
  if (input.allMatch) {
    return {
      kind: "none",
      description: "Tu predicción coincide con la ejecución observada en los datos registrados.",
    };
  }

  if (input.iterationsPredicted && !input.iterationsMatch) {
    const loop = input.loopLine === undefined ? "el bucle del programa" : `el bucle de la línea ${input.loopLine}`;
    return {
      kind: "iterations",
      description:
        `Esperabas ${input.expectedIterations.length} iteraciones (${input.expectedIterations.join(", ")}) ` +
        `y la ejecución muestra ${input.observedIterations.length} (${input.observedIterations.join(", ")}). ` +
        `La diferencia aparece en ${loop}, que decide cuántas veces se repite el cuerpo.`,
      ...(input.loopLine === undefined ? {} : { line: input.loopLine }),
    };
  }

  const mismatchedVariables = input.diffs.filter((diff) => !diff.matches);
  if (mismatchedVariables.length > 0) {
    const detail = mismatchedVariables
      .map((diff) => `${diff.name}: esperabas ${diff.expected} y la ejecución muestra ${diff.actual ?? "sin valor"}`)
      .join("; ");
    return {
      kind: "variables",
      description: `La diferencia aparece en el valor final de las variables. ${detail}.`,
    };
  }

  if (!input.outputMatches) {
    return {
      kind: "output",
      description:
        `La salida final no coincide: esperabas "${input.expectedOutput}" y la ejecución produjo ` +
        `"${input.observedOutput}".`,
    };
  }

  return {
    kind: "unknown",
    description:
      "La predicción no permite localizar un punto de divergencia concreto con los datos registrados.",
  };
}

/** Congela la predicción original con la hora de envío. */
export function freezePrediction(input: PredictionInput, now: Date): PactPrediction {
  return {
    expectedOutput: input.expectedOutput.trim(),
    expectedVariables: { ...input.expectedVariables },
    expectedIterations: [...input.expectedIterations].sort((a, b) => a - b),
    explanation: input.explanation.trim(),
    confidence: input.confidence,
    submittedAt: now.toISOString(),
  };
}

/** Compara una predicción congelada con la ejecución real. */
export function analyzeResult(
  prediction: PactPrediction,
  result: ExecutionResult,
  exercise: PactExerciseDefinition,
  now: Date,
): PactAnalysis {
  const expectedCanonical = canonicalizeAnswer(prediction.expectedOutput, exercise.answerFormat);
  const observedCanonical = canonicalizeAnswer(result.output, exercise.answerFormat);
  const outputMatches = expectedCanonical.length > 0 && expectedCanonical === observedCanonical;
  const diffs = variableDiffs(prediction.expectedVariables, result);
  const observed = observedIterations(result);
  const expectedIterations = [...prediction.expectedIterations].sort((a, b) => a - b);
  const iterationsPredicted = expectedIterations.length > 0;
  const iterationsMatch = !iterationsPredicted || sameNumberList(expectedIterations, observed);
  const allMatch = outputMatches && diffs.every((diff) => diff.matches) && iterationsMatch;

  const divergence = buildDivergence({
    allMatch,
    outputMatches,
    iterationsPredicted,
    iterationsMatch,
    expectedIterations,
    observedIterations: observed,
    diffs,
    expectedOutput: prediction.expectedOutput,
    observedOutput: result.output.trim(),
    loopLine: findLoopLine(getExercise(exercise.exerciseId)?.code ?? ""),
  });

  return {
    outputMatches,
    expectedOutput: prediction.expectedOutput,
    observedOutput: result.output.trim(),
    variableDiffs: diffs,
    iterationsPredicted,
    iterationsMatch,
    expectedIterations,
    observedIterations: observed,
    allMatch,
    divergence,
    observedFinalState: finalState(result) ?? {},
    durationMs: result.durationMs,
    analyzedAt: now.toISOString(),
  };
}

/** Evidencia de transferencia: una observación puntual, sin conclusiones absolutas. */
export function transferEvidence(analysis: PactAnalysis): TransferEvidence {
  if (analysis.allMatch) {
    return {
      correct: true,
      note:
        "La predicción de transferencia coincidió con la ejecución observada. " +
        "Es una observación de un solo ejercicio: no demuestra por sí sola una comprensión consolidada.",
    };
  }
  return {
    correct: false,
    note:
      "La predicción de transferencia no coincidió con la ejecución observada. " +
      "Es una oportunidad para revisar el concepto en otro contexto; no se interpreta como un diagnóstico definitivo.",
  };
}

/** Estado final legible para el resumen (sin objetos no serializables). */
export function readableFinalState(state: Readonly<Record<string, TraceValue>>): string {
  return Object.entries(state)
    .map(([name, value]) => `${name} = ${typeof value === "string" ? `'${value}'` : String(value)}`)
    .join(", ");
}
