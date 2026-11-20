import { loadPyodide, type PyodideInterface } from "pyodide";
import tracerSource from "../../src/python/tracer.py?raw";
import { getExercise } from "../../src/domain/exercises";
import { parseEngineJson } from "../../src/domain/parseTrace";
import type { ExecutionResult } from "../../src/domain/types";
import type { WorkerResponse } from "../../src/engine/messages";

const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<unknown>) => void) | null;
  postMessage(message: WorkerResponse): void;
};

interface TestRequest {
  type: "init" | "run";
  requestId?: number;
  exerciseId?: string;
  hang?: boolean;
  runtimeFailure?: boolean;
}

let pyodidePromise: Promise<PyodideInterface> | null = null;

function getPyodide(): Promise<PyodideInterface> {
  if (!pyodidePromise) {
    const indexURL = new URL("/pyodide/", self.location.href).href;
    pyodidePromise = loadPyodide({ indexURL }).then((pyodide) => {
      pyodide.runPython(tracerSource);
      return pyodide;
    });
  }
  return pyodidePromise;
}

async function runProgram(request: TestRequest): Promise<ExecutionResult> {
  const pyodide = await getPyodide();
  if (request.hang) {
    pyodide.runPython("while True:\n    pass");
    throw new Error("El bucle de prueba debía bloquearse hasta terminar el Worker.");
  }
  const source = request.runtimeFailure
    ? "x = 1\ny = x / 0"
    : (getExercise("suma-1-3")?.code ?? "");
  const runTraced = pyodide.globals.get("run_traced") as ((code: string) => string) & {
    destroy(): void;
  };
  let json: string;
  try {
    json = runTraced(source);
  } finally {
    runTraced.destroy();
  }
  const raw = parseEngineJson(json);
  const result: ExecutionResult = {
    success: raw.error === undefined,
    output: raw.output,
    snapshots: raw.snapshots,
    durationMs: raw.pythonMs,
  };
  if (raw.error !== undefined) result.error = raw.error;
  if (raw.errorKind !== undefined) result.errorKind = raw.errorKind;
  if (raw.errorLine !== undefined) result.errorLine = raw.errorLine;
  return result;
}

workerScope.onmessage = (event) => {
  const request = event.data as TestRequest;
  if (request.type === "init") {
    void getPyodide().then(
      () => workerScope.postMessage({ type: "status", status: "ready" }),
      (cause: unknown) =>
        workerScope.postMessage({
          type: "error",
          phase: "init",
          message: cause instanceof Error ? cause.message : "No se pudo iniciar Pyodide.",
        }),
    );
    return;
  }
  if (request.type === "run" && typeof request.requestId === "number") {
    const requestId = request.requestId;
    void runProgram(request).then(
      (result) => workerScope.postMessage({ type: "result", requestId, result }),
      (cause: unknown) =>
        workerScope.postMessage({
          type: "error",
          phase: "run",
          requestId,
          message: cause instanceof Error ? cause.message : "Falló la prueba del motor.",
        }),
    );
  }
};
