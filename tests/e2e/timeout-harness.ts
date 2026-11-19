import { EngineError, TraceEngineClient, type WorkerLike } from "../../src/engine/client";
import { describeError, describeProgramError } from "../../src/engine/errors";
import type { ExecutionResult } from "../../src/domain/types";
import type { WorkerRequest, WorkerResponse } from "../../src/engine/messages";

let hangNextRun = true;
let failNextRun = false;

function createTestWorker(): WorkerLike {
  const worker = new Worker(new URL("./timeout.worker.ts", import.meta.url), { type: "module" });
  return {
    post(message: WorkerRequest): void {
      if (message.type === "run" && hangNextRun) {
        hangNextRun = false;
        worker.postMessage({ ...message, hang: true });
      } else if (message.type === "run" && failNextRun) {
        failNextRun = false;
        worker.postMessage({ ...message, runtimeFailure: true });
      } else {
        worker.postMessage(message);
      }
    },
    listen(
      onMessage: (response: WorkerResponse) => void,
      onFailure: (reason: string) => void,
    ): void {
      worker.onmessage = (event: MessageEvent<WorkerResponse>) => onMessage(event.data);
      worker.onerror = (event: ErrorEvent) => onFailure(event.message);
      worker.onmessageerror = () => onFailure("No se pudo leer un mensaje del motor.");
    },
    terminate(): void {
      worker.terminate();
    },
  };
}

const client = new TraceEngineClient(createTestWorker, { runTimeoutMs: 500 });
const button = document.querySelector("button");
if (!button) throw new Error("Falta el botón de prueba.");

button.addEventListener("click", async () => {
  button.disabled = true;
  try {
    await client.run("suma-1-3");
  } catch (cause) {
    document.querySelector('[data-testid="timeout-error"]')!.textContent =
      describeError(cause instanceof EngineError ? cause : new Error("Error inesperado."));
  }

  try {
    const first = await client.run("suma-1-3");
    document.querySelector('[data-testid="first-recovery"]')!.textContent = first.output.trim();

    failNextRun = true;
    const failed: ExecutionResult = await client.run("suma-1-3");
    document.querySelector('[data-testid="program-error"]')!.textContent = describeProgramError(
      failed.error ?? "",
      failed.errorKind,
      failed.errorLine,
    );

    const second = await client.run("suma-1-3");
    document.querySelector('[data-testid="second-recovery"]')!.textContent = second.output.trim();
  } finally {
    button.disabled = false;
  }
});
