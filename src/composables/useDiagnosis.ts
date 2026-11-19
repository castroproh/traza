/**
 * Composable de estado de diagnóstico de TRAZA (misión 0.6.0).
 *
 * Encapsula la sesión diagnóstica: patrón actual, respuestas, selección
 * adaptativa y conclusiones. La lógica vive en `src/domain/diagnosis`.
 */
import { computed, ref } from "vue";
import { answerSession, createSession, type AnswerSessionResult, type DiagnosticSession } from "../domain/session";
import { HYPOTHESES, PATTERNS, type DiagnosisPatternId, type MisconceptionHypothesis } from "../domain/diagnosis/hypotheses";
import { type EvidenceOutcome } from "../domain/diagnosis/evidence";
import { selectMicrotest, type SelectionResult } from "../domain/diagnosis/selection";

export interface DiagnosisState {
  patternId: DiagnosisPatternId;
  session: DiagnosticSession | null;
  outcome: EvidenceOutcome | null;
  selection: SelectionResult;
}

export function useDiagnosis() {
  const patternId = ref<DiagnosisPatternId>("RANGE");
  const session = ref<DiagnosticSession | null>(null);
  const outcome = ref<EvidenceOutcome | null>(null);
  const selection = ref<SelectionResult>(selectMicrotest({ patternId: "RANGE", answers: [] }));

  const hypotheses = computed<MisconceptionHypothesis[]>(() =>
    PATTERNS.filter((p) => p.id === patternId.value).flatMap((p) => HYPOTHESES.filter((h) => h.patternId === p.id)),
  );

  function startSession(nextPatternId: DiagnosisPatternId = patternId.value): void {
    patternId.value = nextPatternId;
    const created = createSession({ patternId: nextPatternId });
    session.value = created;
    outcome.value = null;
    const result = selectMicrotest({ patternId: nextPatternId, answers: [] });
    selection.value = result;
  }

  function respond(microtestId: string, response: string): AnswerSessionResult | null {
    const current = session.value;
    if (!current) return null;
    const result = answerSession(current, { microtestId, response });
    session.value = result.session;
    outcome.value = result.outcome;
    const nextSelection = selectMicrotest({
      patternId: current.patternId,
      answers: current.answers.map((a) => ({ microtestId: a.microtestId, response: a.response })),
    });
    selection.value = nextSelection;
    return result;
  }

  const canContinue = computed(() => selection.value.action === "sufficient");

  function statusText(): string {
    if (selection.value.action === "sufficient") return "Evidencia suficiente para continuar";
    if (selection.value.action === "limit") return "Límite de micropruebas alcanzado";
    if (selection.value.action === "insufficient") return "Evidencia insuficiente";
    return `Microprueba seleccionada: ${selection.value.microtestId ?? ""}`;
  }

  return {
    patternId,
    patterns: PATTERNS,
    hypotheses,
    session,
    outcome,
    selection,
    canContinue,
    statusText,
    startSession,
    respond,
  };
}
