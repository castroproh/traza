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
  variableSequences: VariableSequenceDiff[];
  firstDivergence: PredictionDivergence | undefined;
  allMatch: boolean;
}

export interface VariableSequenceDiff {
  name: string;
  expected: number[];
  actual: (number | undefined)[];
  matches: boolean;
}

export interface PredictionDivergence {
  kind: "iteration" | "variable" | "output";
  iteration?: number;
  line?: number;
  variable?: string;
  expected?: number | string;
  actual?: number | string;
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
  loopHeaderLine?: number,
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
  const statesByIteration = new Map<number, { line: number; state: VariableState }>();
  for (const snapshot of result.snapshots) {
    if (snapshot.event === "line" && snapshot.iteration !== undefined && snapshot.after) {
      statesByIteration.set(snapshot.iteration, {
        line: snapshot.line,
        state: snapshot.after,
      });
    }
  }
  const variableSequences = Object.entries(prediction.expectedVariableValues).map(
    ([name, expected]) => {
      const actual = observed.map((iteration) => {
        const value = statesByIteration.get(iteration)?.state[name];
        return typeof value === "number" ? value : undefined;
      });
      return {
        name,
        expected,
        actual,
        matches:
          actual.length === expected.length &&
          actual.every((value, index) => value === expected[index]),
      };
    },
  );
  const divergences: Array<{ position: number; value: PredictionDivergence }> = [];
  const iterationIndex = observed.findIndex((iteration, index) => iteration !== expectedIt[index]);
  if (iterationIndex >= 0 || observed.length !== expectedIt.length) {
    const position = iterationIndex >= 0 ? iterationIndex : Math.min(observed.length, expectedIt.length);
    divergences.push({
      position,
      value: {
        kind: "iteration",
        iteration: observed[position] ?? expectedIt[position] ?? position + 1,
        line:
          observed[position] !== undefined
            ? statesByIteration.get(observed[position])?.line ?? loopHeaderLine
            : loopHeaderLine,
        expected: expectedIt[position],
        actual: observed[position],
      },
    });
  }
  for (const sequence of variableSequences) {
    const index = sequence.actual.findIndex((value, itemIndex) => value !== sequence.expected[itemIndex]);
    if (index >= 0 || sequence.actual.length !== sequence.expected.length) {
      const position = index >= 0 ? index : Math.min(sequence.actual.length, sequence.expected.length);
      const iteration = observed[position] ?? expectedIt[position] ?? position + 1;
      divergences.push({
        position,
        value: {
          kind: "variable",
          iteration,
          line: statesByIteration.get(iteration)?.line ?? loopHeaderLine,
          variable: sequence.name,
          expected: sequence.expected[position],
          actual: sequence.actual[position],
        },
      });
    }
  }
  if (!outputMatches) {
    divergences.push({
      position: Math.max(observed.length, expectedIt.length) + 1,
      value: {
        kind: "output",
        expected: normalizeOutput(prediction.expectedOutput),
        actual: normalizeOutput(result.output),
      },
    });
  }
  divergences.sort((a, b) => a.position - b.position);
  return {
    outputMatches,
    variables,
    iterationsMatch,
    observedIterations: observed,
    variableSequences,
    firstDivergence: divergences[0]?.value,
    allMatch:
      outputMatches &&
      iterationsMatch &&
      variables.every((v) => v.matches) &&
      variableSequences.every((sequence) => sequence.matches),
  };
}
