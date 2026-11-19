/**
 * Composable del recorrido PACT (misión 0.7.0).
 *
 * Mantiene el estado de sesión y delega todas las reglas en `src/domain/pact`.
 * La interfaz nunca cambia la etapa por su cuenta: solo llama a transiciones
 * validadas. Cada cambio se persiste en localStorage.
 */

import { computed, ref } from "vue";
import { patternHypotheses, type DiagnosisPatternId } from "../domain/diagnosis/hypotheses";
import { getMicrotest, type DiagnosticMicrotest } from "../domain/diagnosis/microtests";
import type { SelectionResult } from "../domain/diagnosis/selection";
import { buildSessionExportJson, buildSessionSummary, type SessionSummary } from "../domain/pact/summary";
import {
  canCompleteContrast as domainCanCompleteContrast,
  clearPactSession,
  completeContrast,
  completeSession,
  contrastSelection,
  createPactSession,
  enterContrast,
  loadPactSession,
  recordAnalysis,
  recordContrastAnswer,
  recordTransferAnalysis,
  savePactSession,
  submitPrediction,
  submitTransferPrediction as submitTransferPredictionDomain,
} from "../domain/pact/session";
import {
  mainExerciseFor,
  pactExerciseById,
  transferExerciseFor,
  type PactExerciseDefinition,
} from "../domain/pact/exercises";
import type {
  PactSession,
  PredictionInput,
} from "../domain/pact/types";
import type { ExecutionResult } from "../domain/types";

export type LoadState = "none" | "ok" | "legacy" | "incompatible" | "corrupt";

export function usePact() {
  const loaded = loadPactSession();
  const session = ref<PactSession | null>(loaded.status === "ok" ? loaded.session : null);
  const loadState = ref<LoadState>(loaded.status);
  const resumed = ref(loaded.status === "ok");
  const loadMessage = ref<string | null>(
    loaded.status === "legacy" || loaded.status === "incompatible" || loaded.status === "corrupt"
      ? loaded.message
      : null,
  );
  const error = ref<string | null>(null);
  const persistenceWarning = ref<string | null>(null);

  function persist(next: PactSession): void {
    const saved = savePactSession(next);
    persistenceWarning.value = saved
      ? null
      : "No se pudo guardar la sesión en este navegador. Puedes continuar, pero no se recuperará al recargar.";
  }

  function apply(action: () => PactSession): boolean {
    try {
      const next = action();
      session.value = next;
      error.value = null;
      persist(next);
      return true;
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : "No se pudo completar la acción.";
      return false;
    }
  }

  function startSession(patternId: DiagnosisPatternId): void {
    const next = createPactSession({ patternId });
    session.value = next;
    error.value = null;
    loadState.value = "ok";
    resumed.value = false;
    loadMessage.value = null;
    persist(next);
  }

  /** Descarta solo la sesión PACT; no toca otras claves del navegador. */
  function discardSavedSession(): void {
    clearPactSession();
    session.value = null;
    loadState.value = "none";
    resumed.value = false;
    loadMessage.value = null;
    error.value = null;
  }

  function restartSession(): void {
    if (!session.value) {
      discardSavedSession();
      return;
    }
    startSession(session.value.patternId);
  }

  function submitMainPrediction(input: PredictionInput): boolean {
    return apply(() => {
      if (!session.value) throw new Error("No hay sesión activa.");
      return submitPrediction(session.value, input);
    });
  }

  function recordMainAnalysis(result: ExecutionResult): boolean {
    return apply(() => {
      if (!session.value) throw new Error("No hay sesión activa.");
      return recordAnalysis(session.value, result);
    });
  }

  function goToContrast(): boolean {
    return apply(() => {
      if (!session.value) throw new Error("No hay sesión activa.");
      return enterContrast(session.value);
    });
  }

  function answerContrast(input: {
    microtestId: string;
    response: string;
    observedOutput: string;
  }): boolean {
    return apply(() => {
      if (!session.value) throw new Error("No hay sesión activa.");
      return recordContrastAnswer(session.value, input);
    });
  }

  function finishContrast(): boolean {
    return apply(() => {
      if (!session.value) throw new Error("No hay sesión activa.");
      return completeContrast(session.value);
    });
  }

  function submitTransferPrediction(input: PredictionInput): boolean {
    return apply(() => {
      if (!session.value) throw new Error("No hay sesión activa.");
      return submitTransferPredictionDomain(session.value, input);
    });
  }

  function recordTransferResult(result: ExecutionResult): boolean {
    return apply(() => {
      if (!session.value) throw new Error("No hay sesión activa.");
      return recordTransferAnalysis(session.value, result);
    });
  }

  function finishSession(): boolean {
    return apply(() => {
      if (!session.value) throw new Error("No hay sesión activa.");
      return completeSession(session.value);
    });
  }

  const stage = computed(() => session.value?.stage ?? null);

  const hypotheses = computed(() =>
    session.value
      ? patternHypotheses(session.value.patternId).map((hypothesis) => ({
          id: hypothesis.id,
          title: hypothesis.title,
          description: hypothesis.description,
          expectedBehavior: hypothesis.expectedBehavior,
          limitations: hypothesis.limitations,
        }))
      : [],
  );

  const mainExercise = computed<PactExerciseDefinition | null>(() =>
    session.value ? pactExerciseById(session.value.mainExerciseId) ?? null : null,
  );

  const transferExercise = computed<PactExerciseDefinition | null>(() =>
    session.value?.transfer ? pactExerciseById(session.value.transfer.exerciseId) ?? null : null,
  );

  const selection = computed<SelectionResult>(() =>
    session.value
      ? contrastSelection(session.value)
      : { action: "selected", reason: "Inicia una sesión para comenzar." },
  );

  const currentMicrotest = computed<DiagnosticMicrotest | null>(() => {
    if (!session.value || session.value.stage !== "contrast") return null;
    const id = selection.value.microtestId;
    return id ? getMicrotest(id) ?? null : null;
  });

  const canCompleteContrast = computed(() =>
    session.value ? domainCanCompleteContrast(session.value) : false,
  );

  const summary = computed<SessionSummary | null>(() =>
    session.value ? buildSessionSummary(session.value) : null,
  );

  function exportJson(): string | null {
    return session.value ? buildSessionExportJson(session.value) : null;
  }

  function mainExerciseForPattern(patternId: DiagnosisPatternId): PactExerciseDefinition {
    return mainExerciseFor(patternId);
  }

  function transferExerciseForPattern(patternId: DiagnosisPatternId): PactExerciseDefinition {
    return transferExerciseFor(patternId);
  }

  return {
    session,
    stage,
    hypotheses,
    mainExercise,
    transferExercise,
    selection,
    currentMicrotest,
    canCompleteContrast,
    summary,
    loadState,
    resumed,
    loadMessage,
    error,
    persistenceWarning,
    startSession,
    discardSavedSession,
    restartSession,
    submitMainPrediction,
    recordMainAnalysis,
    goToContrast,
    answerContrast,
    finishContrast,
    submitTransferPrediction,
    recordTransferResult,
    finishSession,
    exportJson,
    mainExerciseForPattern,
    transferExerciseForPattern,
  };
}
