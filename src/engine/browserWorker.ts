import type { WorkerLike } from "./client";
import type { WorkerRequest, WorkerResponse } from "./messages";

/** Crea el Worker real (tipo módulo) y lo adapta a `WorkerLike`. */
export function createBrowserWorker(): WorkerLike {
  const worker = new Worker(new URL("./pyodide.worker.ts", import.meta.url), { type: "module" });
  return {
    post: (message: WorkerRequest) => worker.postMessage(message),
    listen: (onMessage, onFailure) => {
      worker.onmessage = (event: MessageEvent<WorkerResponse>) => onMessage(event.data);
      worker.onerror = (event: ErrorEvent) =>
        onFailure(event.message || "El motor de Python dejó de responder.");
      worker.onmessageerror = () => onFailure("No se pudo leer un mensaje del motor.");
    },
    terminate: () => worker.terminate(),
  };
}
