/**
 * Worker de tipo módulo que aloja Pyodide.
 *
 * - Pyodide se inicializa UNA vez por instancia de Worker (promesa memoizada).
 * - No usa importScripts(): se importa el paquete ESM `pyodide`.
 * - Los recursos del runtime (WASM, stdlib) se sirven desde `public/pyodide/`
 *   (copiados desde node_modules por scripts/copy-pyodide.mjs): carga LOCAL, sin CDN.
 * - Solo ejecuta ejercicios de EXERCISES. Un mensaje nunca trae código.
 * - Un Worker NO es un sandbox de seguridad (ver docs/ARQUITECTURA.md).
 */
import { loadPyodide, type PyodideInterface } from "pyodide";
import tracerSource from "../python/tracer.py?raw";
import { EXERCISES, isExerciseId } from "../domain/exercises";
import { parseEngineJson } from "../domain/parseTrace";
import type { ExecutionResult } from "../domain/types";
import { isWorkerRequest, type WorkerResponse } from "./messages";

// Tipado mínimo del ámbito global del Worker (evita mezclar lib "DOM" y "WebWorker").
const ctx = self as unknown as {
  postMessage(message: WorkerResponse): void;
  onmessage: ((event: { data: unknown }) => void) | null;
  location: { href: string };
};

function send(message: WorkerResponse): void {
  ctx.postMessage(message);
}

function errorText(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

let pyodidePromise: Promise<PyodideInterface> | null = null;

function getPyodide(): Promise<PyodideInterface> {
  if (pyodidePromise) return pyodidePromise;
  const indexURL = new URL(`${import.meta.env.BASE_URL}pyodide/`, ctx.location.href).href;
  pyodidePromise = (async () => {
    const pyodide = await loadPyodide({ indexURL });
    pyodide.runPython(tracerSource); // define run_traced() en el espacio global de Python
    return pyodide;
  })();
  pyodidePromise.catch(() => {
    pyodidePromise = null; // permite reintentar tras un fallo de carga
  });
  return pyodidePromise;
}

async function runExercise(exerciseId: string): Promise<ExecutionResult> {
  if (!isExerciseId(exerciseId)) throw new Error("Ejercicio desconocido.");
  const exercise = EXERCISES[exerciseId];
  const pyodide = await getPyodide();
  const started = performance.now();
  const runTraced = pyodide.globals.get("run_traced") as ((source: string) => string) & {
    destroy(): void;
  };
  let json: string;
  try {
    json = runTraced(exercise.code);
  } finally {
    runTraced.destroy();
  }
  const raw = parseEngineJson(json);
  const result: ExecutionResult = {
    success: raw.error === undefined,
    output: raw.output,
    snapshots: raw.snapshots,
    durationMs: Math.round((performance.now() - started) * 100) / 100,
  };
  if (raw.error !== undefined) result.error = raw.error;
  if (raw.errorKind !== undefined) result.errorKind = raw.errorKind;
  if (raw.errorLine !== undefined) result.errorLine = raw.errorLine;
  return result;
}

ctx.onmessage = (event) => {
  const request = event.data;
  if (!isWorkerRequest(request)) return;
  if (request.type === "init") {
    send({ type: "status", status: "loading" });
    getPyodide().then(
      () => send({ type: "status", status: "ready" }),
      (cause: unknown) => send({ type: "error", phase: "init", message: errorText(cause) }),
    );
    return;
  }
  runExercise(request.exerciseId).then(
    (result) => send({ type: "result", requestId: request.requestId, result }),
    (cause: unknown) =>
      send({ type: "error", phase: "run", requestId: request.requestId, message: errorText(cause) }),
  );
};
