<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import ExecutionReview from "./components/ExecutionReview.vue";
import PACTProgress from "./components/PACTProgress.vue";
import PredictionForm from "./components/PredictionForm.vue";
import { useTraceEngine } from "./composables/useTraceEngine";
import { comparePrediction } from "./domain/compare";
import { EXERCISES } from "./domain/exercises";
import {
  assessTransfer,
  canAccessPACTStage,
  contrastComplete,
  createPACTSession,
  evaluateDiagnostic,
  getPACTPattern,
  startPACTSession,
  type EvidenceStatus,
  type DiagnosticMicrotest,
  type PACTPatternId,
  type PACTSession,
  type PACTStage,
} from "./domain/pact";
import {
  clearPACTSession,
  loadPACTSession,
  savePACTSession,
} from "./domain/pactStorage";
import type { StudentPrediction } from "./domain/types";

const stageHeading: Record<PACTStage, string> = {
  prediction: "Predicción",
  analysis: "Análisis",
  contrast: "Contraste",
  transfer: "Transferencia",
};
const stageInstructions: Record<PACTStage, string> = {
  prediction: "Registra qué esperas antes de ejecutar el programa.",
  analysis: "Compara tu modelo con la ejecución real y localiza la primera diferencia.",
  contrast: "Prueba explicaciones rivales con modificaciones pequeñas.",
  transfer: "Aplica la idea a un ejercicio nuevo, sin pistas previas.",
};
const evidenceLabel: Record<EvidenceStatus, string> = {
  supports: "Evidencia que apoya",
  insufficient: "Evidencia insuficiente",
  contradicts: "Evidencia que contradice",
};

const session = ref<PACTSession>(createPACTSession());
const persistenceEnabled = ref(true);
const storageMessage = ref<string | null>(null);
const sessionMessage = ref<string | null>(null);
const { status, result: engineResult, errorMessage, run, initialize } = useTraceEngine();

const pattern = computed(() =>
  session.value.patternId ? getPACTPattern(session.value.patternId) : null,
);
const mainExercise = computed(() =>
  pattern.value ? EXERCISES[pattern.value.mainExerciseId] : null,
);
const transferExercise = computed(() =>
  pattern.value ? EXERCISES[pattern.value.transferExerciseId] : null,
);
const canAccess = computed<Record<PACTStage, boolean>>(() => ({
  prediction: canAccessPACTStage(session.value, "prediction"),
  analysis: canAccessPACTStage(session.value, "analysis"),
  contrast: canAccessPACTStage(session.value, "contrast"),
  transfer: canAccessPACTStage(session.value, "transfer"),
}));
const mainComparison = computed(() => {
  if (!pattern.value || !session.value.mainPrediction || !session.value.mainResult) return null;
  return comparePrediction(
    session.value.mainPrediction,
    session.value.mainResult,
    loopHeaderLine(pattern.value.mainExerciseId),
  );
});
const transferAssessment = computed(() => {
  if (!pattern.value || !session.value.transferPrediction || !session.value.transferResult) {
    return null;
  }
  return assessTransfer(
    session.value.transferPrediction,
    session.value.transferResult,
    loopHeaderLine(pattern.value.transferExerciseId),
  );
});
const pythonStatus = computed(() => {
  switch (status.value) {
    case "idle":
    case "loading":
      return "Cargando Python…";
    case "ready":
      return "Python listo";
    case "running":
      return "Ejecutando…";
    case "success":
      return "Ejecución terminada";
    case "error":
      return "El motor necesita atención";
  }
  return "";
});
const allContrastComplete = computed(
  () => !!pattern.value && contrastComplete(session.value, pattern.value),
);
const canExecute = computed(() =>
  ["ready", "success", "error"].includes(status.value),
);

onMounted(() => {
  try {
    const saved = loadPACTSession(window.localStorage);
    if (saved) {
      session.value = saved;
      sessionMessage.value = "Se recuperó el avance guardado en este navegador.";
    }
  } catch (cause) {
    storageMessage.value =
      cause instanceof Error ? cause.message : "No se pudo leer el avance guardado.";
  }
});

function persist(next: PACTSession): void {
  if (!persistenceEnabled.value) return;
  try {
    savePACTSession(window.localStorage, next);
    storageMessage.value = null;
  } catch (cause) {
    storageMessage.value =
      cause instanceof Error ? cause.message : "No se pudo guardar el avance.";
  }
}

function updateSession(next: PACTSession): void {
  session.value = next;
  sessionMessage.value = null;
  persist(next);
}

function choosePattern(patternId: PACTPatternId): void {
  updateSession(startPACTSession(patternId));
}

function selectStage(stage: PACTStage): void {
  if (!canAccessPACTStage(session.value, stage)) return;
  updateSession({ ...session.value, stage });
}

function saveMainPrediction(prediction: StudentPrediction): void {
  updateSession({
    ...session.value,
    stage: "analysis",
    mainPrediction: prediction,
    mainResult: undefined,
    contrastPredictions: {},
    contrastResults: {},
    transferPrediction: undefined,
    transferResult: undefined,
  });
}

function saveContrastPrediction(test: DiagnosticMicrotest, prediction: StudentPrediction): void {
  updateSession({
    ...session.value,
    contrastPredictions: { ...session.value.contrastPredictions, [test.id]: prediction },
  });
}

function saveTransferPrediction(prediction: StudentPrediction): void {
  updateSession({ ...session.value, transferPrediction: prediction, transferResult: undefined });
}

async function executeMain(): Promise<void> {
  if (!pattern.value || !session.value.mainPrediction) return;
  await run(pattern.value.mainExerciseId);
  if (engineResult.value?.success) {
    updateSession({ ...session.value, mainResult: engineResult.value });
  }
}

async function executeContrast(test: DiagnosticMicrotest): Promise<void> {
  if (!session.value.contrastPredictions[test.id]) return;
  await run(test.exerciseId);
  if (engineResult.value?.success) {
    updateSession({
      ...session.value,
      contrastResults: { ...session.value.contrastResults, [test.id]: engineResult.value },
    });
  }
}

async function executeTransfer(): Promise<void> {
  if (!pattern.value || !session.value.transferPrediction) return;
  await run(pattern.value.transferExerciseId);
  if (engineResult.value?.success) {
    updateSession({ ...session.value, transferResult: engineResult.value });
  }
}

function diagnosticFor(test: DiagnosticMicrotest) {
  const prediction = session.value.contrastPredictions[test.id];
  const result = session.value.contrastResults[test.id];
  return prediction && result ? evaluateDiagnostic(test, prediction, result) : null;
}

function hypothesisTitle(id: string): string {
  return pattern.value?.hypotheses.find((hypothesis) => hypothesis.id === id)?.title ?? id;
}

function formatHypothesisValues(values: Record<string, number[]> | undefined): string {
  if (!values) return "—";
  return Object.entries(values)
    .map(([name, sequence]) => `${name}: ${sequence.join(", ")}`)
    .join("; ");
}

function microtestUnlocked(index: number): boolean {
  if (!pattern.value || index === 0) return true;
  const previous = pattern.value.microtests[index - 1];
  return previous !== undefined && session.value.contrastResults[previous.id]?.success === true;
}

function setPersistence(event: Event): void {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  persistenceEnabled.value = target.checked;
  storageMessage.value = null;
  if (persistenceEnabled.value) {
    persist(session.value);
    sessionMessage.value = "El avance se guardará en este navegador.";
    return;
  }
  try {
    clearPACTSession(window.localStorage);
    sessionMessage.value = "El avance guardado se borró; las respuestas actuales siguen en esta página.";
  } catch (cause) {
    storageMessage.value =
      cause instanceof Error ? cause.message : "No se pudo borrar el avance guardado.";
  }
}

function resetSession(): void {
  try {
    clearPACTSession(window.localStorage);
    session.value = createPACTSession();
    storageMessage.value = null;
    sessionMessage.value = "Sesión reiniciada. Las respuestas anteriores se borraron.";
  } catch (cause) {
    storageMessage.value =
      cause instanceof Error ? cause.message : "No se pudo borrar la sesión guardada.";
  }
}

function clearInvalidSavedSession(): void {
  try {
    clearPACTSession(window.localStorage);
    storageMessage.value = null;
    sessionMessage.value = "El avance guardado se borró. Puedes empezar una sesión nueva.";
  } catch (cause) {
    storageMessage.value =
      cause instanceof Error ? cause.message : "No se pudo borrar el avance guardado.";
  }
}

function retryEngine(): void {
  void initialize();
}

function loopHeaderLine(exerciseId: keyof typeof EXERCISES): number | undefined {
  const index = EXERCISES[exerciseId].code.split("\n").findIndex((line) => /^\s*for\b/.test(line));
  return index < 0 ? undefined : index + 1;
}
</script>

<template>
  <main class="page">
    <header class="masthead">
      <div>
        <h1>TRAZA</h1>
        <p class="tagline">Laboratorio de diagnóstico del razonamiento algorítmico</p>
      </div>
      <p class="python-status" role="status" aria-live="polite">{{ pythonStatus }}</p>
    </header>

    <section class="privacy-bar" aria-label="Preferencias de sesión">
      <label class="save-toggle">
        <input type="checkbox" :checked="persistenceEnabled" @change="setPersistence" />
        Guardar avance en este navegador
      </label>
      <p>No se necesita una cuenta. No escribas nombres ni otros datos personales.</p>
      <button v-if="session.patternId" type="button" class="secondary" @click="resetSession">
        Reiniciar sesión
      </button>
    </section>
    <p v-if="storageMessage" class="alert" role="alert">
      {{ storageMessage }}
      <button type="button" class="text-button" @click="clearInvalidSavedSession">
        Borrar avance guardado
      </button>
    </p>
    <p v-if="sessionMessage" class="notice" role="status">{{ sessionMessage }}</p>
    <div v-if="errorMessage" class="alert engine-alert" role="alert">
      {{ errorMessage }}
      <button v-if="status === 'error'" type="button" class="text-button" @click="retryEngine">
        Reintentar motor
      </button>
    </div>

    <section v-if="!pattern" class="block pattern-picker" aria-labelledby="start-title">
      <p class="eyebrow">Ciclo PACT</p>
      <h2 id="start-title">Elige un patrón para investigar</h2>
      <p>Primero registrarás lo que piensas; la ejecución real se mostrará después.</p>
      <div class="pattern-grid">
        <button
          type="button"
          class="pattern-card"
          @click="choosePattern('range-exclusive')"
        >
          <span class="pattern-number">Patrón 1</span>
          <strong>Límites de range()</strong>
          <span>Predice qué valores recorre un bucle.</span>
        </button>
        <button
          type="button"
          class="pattern-card"
          @click="choosePattern('accumulator')"
        >
          <span class="pattern-number">Patrón 2</span>
          <strong>Acumuladores</strong>
          <span>Explora cómo se conserva y actualiza un total.</span>
        </button>
      </div>
    </section>

    <template v-else>
      <PACTProgress :stage="session.stage" :accessible="canAccess" @select="selectStage" />
      <section class="block active-pattern">
        <p class="eyebrow">{{ pattern.title }}</p>
        <h2>{{ stageHeading[session.stage] }}</h2>
        <p>{{ stageInstructions[session.stage] }}</p>
      </section>

      <section v-if="session.stage === 'prediction' && mainExercise" class="block">
        <PredictionForm
          v-if="!session.mainPrediction"
          :exercise="mainExercise"
          heading="Antes de ejecutar: registra tu predicción"
          instructions="Predice la salida, cuántas vueltas ocurrirán y cómo cambiarán las variables. Tu confianza se registra por separado."
          action-label="Registrar predicción y continuar"
          @prediction="saveMainPrediction"
        />
        <div v-else class="saved-prediction">
          <p>Tu predicción original se conserva y no se modifica al revisar la ejecución.</p>
          <p><strong>Salida:</strong> {{ session.mainPrediction.expectedOutput }}</p>
          <p><strong>Iteraciones previstas:</strong> {{ session.mainPrediction.expectedIterations.length }}</p>
          <p><strong>Confianza:</strong> {{ session.mainPrediction.confidence }}/100</p>
          <p><strong>Razonamiento:</strong> {{ session.mainPrediction.explanation }}</p>
          <button type="button" class="primary" @click="selectStage('analysis')">
            Ir al análisis
          </button>
        </div>
      </section>

      <section v-else-if="session.stage === 'analysis' && pattern && mainExercise" class="block">
        <div v-if="session.mainPrediction && !session.mainResult" class="run-card">
          <h3>Tu predicción ya está registrada</h3>
          <p>Ahora puedes ejecutar el programa y contrastarla con los pasos que observó Python.</p>
          <button
            type="button"
            class="primary"
            :disabled="!canExecute"
            @click="executeMain"
          >
            Ejecutar programa
          </button>
        </div>
        <ExecutionReview
          v-if="session.mainPrediction && session.mainResult && mainComparison"
          :exercise-id="pattern.mainExerciseId"
          :result="session.mainResult"
          :prediction="session.mainPrediction"
          :comparison="mainComparison"
          :insight="pattern.analysisInsight"
        />
        <button
          v-if="session.mainResult?.success"
          type="button"
          class="primary stage-action"
          @click="selectStage('contrast')"
        >
          Continuar a Contraste
        </button>
      </section>

      <section v-else-if="session.stage === 'contrast' && pattern" class="block">
        <div class="hypothesis-list" aria-label="Hipótesis que se contrastarán">
          <h3>Explicaciones posibles</h3>
          <article v-for="hypothesis in pattern.hypotheses" :key="hypothesis.id" class="hypothesis">
            <h4>{{ hypothesis.title }}</h4>
            <p>{{ hypothesis.description }}</p>
          </article>
        </div>

        <article
          v-for="(test, index) in pattern.microtests"
          :key="test.id"
          class="microtest block"
          :aria-labelledby="`micro-${test.id}`"
        >
          <p class="eyebrow">Microprueba {{ index + 1 }} de {{ pattern.microtests.length }}</p>
          <h3 :id="`micro-${test.id}`">{{ test.title }}</h3>
          <p>{{ test.situation }}</p>
          <p class="hint">{{ test.modification }}</p>
          <PredictionForm
            v-if="microtestUnlocked(index) && !session.contrastPredictions[test.id]"
            :exercise="EXERCISES[test.exerciseId]"
            heading="Predice antes de ejecutar esta microprueba"
            instructions="Esta respuesta se compara con las predicciones de cada hipótesis; no se guarda como una etiqueta sobre ti."
            action-label="Registrar predicción"
            @prediction="saveContrastPrediction(test, $event)"
          />
          <div
            v-else-if="!microtestUnlocked(index)"
            class="locked-card"
            role="status"
          >
            Completa la microprueba anterior para desbloquear esta.
          </div>
          <div v-else-if="session.contrastPredictions[test.id] && !session.contrastResults[test.id]" class="run-card">
            <p>Tu predicción quedó registrada antes de mostrar la ejecución.</p>
            <p><strong>Salida prevista:</strong> {{ session.contrastPredictions[test.id]?.expectedOutput }}</p>
            <p><strong>Confianza:</strong> {{ session.contrastPredictions[test.id]?.confidence }}/100</p>
            <button
              type="button"
              class="primary"
              :disabled="!canExecute"
              @click="executeContrast(test)"
            >
              Ejecutar microprueba
            </button>
          </div>
          <div v-if="session.contrastPredictions[test.id] && session.contrastResults[test.id]">
            <ExecutionReview
              :exercise-id="test.exerciseId"
              :result="session.contrastResults[test.id]!"
              :prediction="session.contrastPredictions[test.id]!"
              :comparison="comparePrediction(session.contrastPredictions[test.id]!, session.contrastResults[test.id]!, loopHeaderLine(test.exerciseId))"
            />
            <section class="evidence-panel" :aria-label="`Evidencia de ${test.title}`">
              <h4>Evidencia de esta microprueba</h4>
              <p>{{ diagnosticFor(test)?.explanation }}</p>
              <ul>
                <li v-for="item in diagnosticFor(test)?.evidence" :key="item.hypothesisId">
                  <strong>{{ hypothesisTitle(item.hypothesisId) }}:</strong>
                  <span class="evidence-status" :class="`evidence-${item.status}`">{{ evidenceLabel[item.status] }}</span>
                  <span>{{ item.explanation }}</span>
                </li>
              </ul>
              <h5>Respuesta prevista por cada hipótesis</h5>
              <p class="hint">Se muestra después de que registraste tu predicción y revisaste la ejecución.</p>
              <dl class="hypothesis-responses">
                <div v-for="hypothesis in pattern.hypotheses" :key="hypothesis.id">
                  <dt>{{ hypothesis.title }}</dt>
                  <dd>
                    Salida: «{{ test.hypothesisResponses[hypothesis.id]?.output ?? "sin predicción definida" }}»;
                    vueltas: {{ test.hypothesisResponses[hypothesis.id]?.iterations ?? "—" }};
                    valores por vuelta: {{ formatHypothesisValues(test.hypothesisResponses[hypothesis.id]?.variableValues) }}.
                  </dd>
                </div>
              </dl>
              <p class="hint">{{ test.interpretationRule }}</p>
            </section>
          </div>
        </article>
        <p v-if="allContrastComplete" class="stage-complete" role="status">
          Completaste las micropruebas. La evidencia se conserva por prueba y no se convierte en una etiqueta permanente.
        </p>
        <button
          v-if="allContrastComplete"
          type="button"
          class="primary stage-action"
          @click="selectStage('transfer')"
        >
          Continuar a Transferencia
        </button>
      </section>

      <section v-else-if="session.stage === 'transfer' && pattern && transferExercise" class="block">
        <PredictionForm
          v-if="!session.transferPrediction"
          :exercise="transferExercise"
          heading="Predice primero en esta situación nueva"
          instructions="El contexto y los valores cambiaron. No verás la ejecución hasta registrar tu predicción."
          action-label="Registrar predicción"
          @prediction="saveTransferPrediction"
        />
        <div v-else-if="!session.transferResult" class="run-card">
          <h3>Predicción de transferencia registrada</h3>
          <p><strong>Salida prevista:</strong> {{ session.transferPrediction.expectedOutput }}</p>
          <p><strong>Iteraciones previstas:</strong> {{ session.transferPrediction.expectedIterations.length }}</p>
          <p><strong>Confianza:</strong> {{ session.transferPrediction.confidence }}/100</p>
          <p><strong>Razonamiento:</strong> {{ session.transferPrediction.explanation }}</p>
          <button
            type="button"
            class="primary"
            :disabled="!canExecute"
            @click="executeTransfer"
          >
            Ejecutar ejercicio nuevo
          </button>
        </div>
        <template v-else-if="session.transferPrediction && session.transferResult && transferAssessment">
          <ExecutionReview
            :exercise-id="pattern.transferExerciseId"
            :result="session.transferResult"
            :prediction="session.transferPrediction"
            :comparison="transferAssessment.comparison"
          />
          <section class="transfer-result" :class="`transfer-${transferAssessment.status}`" aria-live="polite">
            <h3>Resultado de transferencia</h3>
            <p>{{ transferAssessment.explanation }}</p>
            <p>La confianza registrada ({{ session.transferPrediction.confidence }}/100) se conserva por separado; no modifica esta valoración.</p>
          </section>
        </template>
      </section>
    </template>
  </main>
</template>
