import type { ExecutionResult, TraceSnapshot, VariableState } from "../../src/domain/types";
import type { PactSession, PredictionInput } from "../../src/domain/pact/types";
import {
  completeContrast,
  completeSession,
  createPactSession,
  enterContrast,
  recordAnalysis,
  recordContrastAnswer,
  recordTransferAnalysis,
  submitPrediction,
  submitTransferPrediction,
} from "../../src/domain/pact/session";

/** Resultado sintético con la forma que produce el Worker real (para pruebas puras). */
export function syntheticResult(
  output: string,
  finalState: VariableState,
  iterations: number[],
): ExecutionResult {
  const snapshots: TraceSnapshot[] = [{ sequence: 0, line: 0, event: "call", before: {} }];
  let sequence = 1;
  for (const iteration of iterations) {
    snapshots.push({
      sequence: sequence++,
      line: 1,
      event: "line",
      iteration,
      before: finalState,
      after: finalState,
    });
    snapshots.push({
      sequence: sequence++,
      line: 2,
      event: "line",
      iteration,
      before: finalState,
      after: finalState,
    });
  }
  snapshots.push({ sequence: sequence++, line: 1, event: "line", before: finalState });
  snapshots.push({ sequence, line: 0, event: "return", before: finalState });
  return { success: true, output, snapshots, durationMs: 12 };
}

export const rangeMainResult = syntheticResult("2\n3\n4\n5\n", { numero: 5 }, [1, 2, 3, 4]);
export const accumulatorMainResult = syntheticResult("6\n", { total: 6, numero: 3 }, [1, 2, 3]);
export const rangeTransferResult = syntheticResult(
  "Página 5\nPágina 6\nPágina 7\nPágina 8\n",
  { pagina: 8 },
  [1, 2, 3, 4],
);
export const accumulatorTransferResult = syntheticResult(
  "60\n80\n110\n150\n",
  { ahorro: 150, mes: 4 },
  [1, 2, 3, 4],
);

export const rangePrediction: PredictionInput = {
  expectedOutput: "2, 3, 4, 5",
  expectedVariables: { numero: 5 },
  expectedIterations: [1, 2, 3, 4],
  explanation: "El límite superior 6 no se incluye; empieza en 2.",
  confidence: 75,
};

export const accumulatorPrediction: PredictionInput = {
  expectedOutput: "6",
  expectedVariables: { total: 6, numero: 3 },
  expectedIterations: [1, 2, 3],
  explanation: "Se conserva el total: 0+1=1, 1+2=3, 3+3=6.",
  confidence: 80,
};

export const rangeTransferPrediction: PredictionInput = {
  expectedOutput: "5, 6, 7, 8",
  expectedVariables: { pagina: 8 },
  expectedIterations: [1, 2, 3, 4],
  explanation: "range(5, 9) termina antes de 9.",
  confidence: 70,
};

export const accumulatorTransferPrediction: PredictionInput = {
  expectedOutput: "60, 80, 110, 150",
  expectedVariables: { ahorro: 150, mes: 4 },
  expectedIterations: [1, 2, 3, 4],
  explanation: "El ahorro anterior se conserva y se suma el importe del mes.",
  confidence: 65,
};

const fixedNow = new Date("2026-11-18T10:00:00.000Z");

/** Recorrido RANGE completo con evidencia concluyente (para resumen y exportación). */
export function completedRangeSession(): PactSession {
  let session = createPactSession({ patternId: "RANGE", now: fixedNow, sessionId: "local-test-session" });
  session = submitPrediction(session, rangePrediction, fixedNow);
  session = recordAnalysis(session, rangeMainResult, fixedNow);
  session = enterContrast(session, fixedNow);
  session = recordContrastAnswer(
    session,
    { microtestId: "range-cero-01", response: "0, 1, 2", observedOutput: "0\n1\n2\n" },
    fixedNow,
  );
  session = completeContrast(session, fixedNow);
  session = submitTransferPrediction(session, rangeTransferPrediction, fixedNow);
  session = recordTransferAnalysis(session, rangeTransferResult, fixedNow);
  return completeSession(session, fixedNow);
}
