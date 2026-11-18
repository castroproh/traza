import { isUnsupported } from "./normalize";
import type { ExecutionResult, StudentPrediction, VariableState } from "./types";

export interface VariableDiff {
  name: string;
  expected: number;
  /** `undefined` si la variable no existió al terminar. */
  actual: number | undefined;
  matches: boolean;
}

export interface PredictionComparison {
  outputMatches: boolean;
  variables: VariableDiff[];
  iterationsMatch: boolean;
  observedIterations: number[];
  allMatch: boolean;
}

/** Estado final observado: el del evento "return"; si no hay, el último `after`. */
export function finalState(result: ExecutionResult): VariableState | undefined {
  const last = result.snapshots[result.snapshots.length - 1];
  if (last?.event === "return") return last.before;
  for (let i = result.snapshots.length - 1; i >= 0; i--) {
    const after = result.snapshots[i]?.after;
    if (after) return after;
  }
  return undefined;
}

export function observedIterations(result: ExecutionResult): number[] {
  const found = new Set<number>();
  for (const snap of result.snapshots) {
    if (snap.iteration !== undefined) found.add(snap.iteration);
  }
  return [...found].sort((a, b) => a - b);
}

function normalizeOutput(text: string): string {
  return text.replace(/\r\n/g, "\n").trim();
}

export function comparePrediction(
  prediction: StudentPrediction,
  result: ExecutionResult,
): PredictionComparison {
  const state = finalState(result) ?? {};
  const variables = Object.entries(prediction.expectedVariables).map(([name, expected]) => {
    const raw = state[name];
    const actual = typeof raw === "number" && !isUnsupported(raw) ? raw : undefined;
    return { name, expected, actual, matches: actual === expected };
  });
  const observed = observedIterations(result);
  const expectedIt = [...prediction.expectedIterations].sort((a, b) => a - b);
  const iterationsMatch =
    observed.length === expectedIt.length && observed.every((n, i) => n === expectedIt[i]);
  const outputMatches =
    normalizeOutput(prediction.expectedOutput) === normalizeOutput(result.output);
  return {
    outputMatches,
    variables,
    iterationsMatch,
    observedIterations: observed,
    allMatch: outputMatches && iterationsMatch && variables.every((v) => v.matches),
  };
}
