import { onBeforeUnmount, onMounted, ref, shallowRef } from "vue";
import type { ExerciseId } from "../domain/exercises";
import type { EngineStatus, ExecutionResult } from "../domain/types";
import { createBrowserWorker } from "../engine/browserWorker";
import { TraceEngineClient } from "../engine/client";
import { describeError, describeProgramError } from "../engine/errors";

export function useTraceEngine() {
  const status = ref<EngineStatus>("idle");
  const result = shallowRef<ExecutionResult | null>(null);
  const errorMessage = ref<string | null>(null);

  const client = new TraceEngineClient(createBrowserWorker, {
    onStatus: (next) => {
      // "running"/"success" los decide run(); aquí solo la carga del motor.
      if (status.value !== "running") status.value = next;
    },
  });

  async function initialize(): Promise<void> {
    errorMessage.value = null;
    try {
      await client.init();
      if (status.value !== "running") status.value = "ready";
    } catch (cause) {
      status.value = "error";
      errorMessage.value = describeError(cause);
    }
  }

  async function run(exerciseId: ExerciseId): Promise<ExecutionResult | null> {
    if (status.value === "running" || status.value === "loading") return null;
    status.value = "running";
    errorMessage.value = null;
    result.value = null;
    try {
      const outcome = await client.run(exerciseId);
      result.value = outcome;
      if (outcome.success) {
        status.value = "success";
      } else {
        status.value = "error";
        errorMessage.value = describeProgramError(outcome.error ?? "", outcome.errorKind, outcome.errorLine);
      }
      return outcome;
    } catch (cause) {
      status.value = "error";
      errorMessage.value = describeError(cause);
      return null;
    }
  }

  /** Descarta el aviso de error de un programa cuando el error forma parte del resultado esperado. */
  function clearProgramError(): void {
    errorMessage.value = null;
    if (status.value === "error" && result.value) status.value = "success";
  }

  /** Reinicio voluntario del motor: termina el Worker y lo vuelve a cargar. */
  function restart(): void {
    client.terminate();
    result.value = null;
    errorMessage.value = null;
    status.value = "idle";
    void initialize();
  }

  onMounted(() => {
    void initialize();
  });
  onBeforeUnmount(() => client.terminate());

  return { status, result, errorMessage, run, initialize, restart, clearProgramError };
}
