<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { EvidenceEvaluation, EvidenceStatus } from "../domain/diagnosis/hypotheses";
import type { DiagnosticMicrotest } from "../domain/diagnosis/microtests";
import { MAX_MICROTESTS_PER_SESSION } from "../domain/diagnosis/selection";
import type { SelectionResult } from "../domain/diagnosis/selection";
import { hypothesisById } from "../domain/diagnosis/hypotheses";
import { canonicalizeAnswer } from "../domain/pact/analysis";
import { evidenceStateLabel, evidenceStatusLabel } from "../domain/pact/summary";
import type { ContrastState } from "../domain/pact/types";
import type { EngineStatus } from "../domain/types";

const props = withDefaults(
  defineProps<{
    patternName: string;
    hypotheses: Array<{
      id: string;
      title: string;
      description: string;
      expectedBehavior: string;
      limitations: readonly string[];
    }>;
    selection: SelectionResult;
    microtest: DiagnosticMicrotest | null;
    contrast: ContrastState;
    canComplete: boolean;
    engineStatus: EngineStatus;
    engineError?: string | null;
    testIdPrefix?: string;
  }>(),
  {
    engineError: null,
    testIdPrefix: "contrast",
  },
);

const emit = defineEmits<{
  check: [microtestId: string, response: string];
  complete: [];
  retryEngine: [];
}>();

const selectedResponse = ref<string | null>(null);

watch(
  () => props.microtest?.id,
  () => {
    selectedResponse.value = null;
  },
  { immediate: true },
);

const options = computed<string[]>(() => {
  const microtest = props.microtest;
  if (!microtest) return [];
  const values = new Set<string>();
  for (const hypothesisId of microtest.targetHypotheses) {
    for (const response of microtest.responseSignatures[hypothesisId] ?? []) values.add(response);
  }
  for (const ambiguous of microtest.ambiguityCases) values.add(ambiguous);
  // La respuesta correcta debe poder elegirse aunque ninguna hipótesis la prediga.
  values.add(microtest.expectedOutcome);
  values.add("No estoy seguro");
  return [...values];
});

const checking = computed(() => props.engineStatus === "running" || props.engineStatus === "loading");
const maxMicrotests = MAX_MICROTESTS_PER_SESSION;

const answeredCount = computed(() => props.contrast.answers.length);

function hypothesisTitle(id: string): string {
  return hypothesisById(id)?.title ?? id;
}

function feedbackFor(evaluation: EvidenceEvaluation): string {
  if (evaluation.state === "supports") {
    return `Tu respuesta coincide con la explicación «${hypothesisTitle(evaluation.hypothesisId)}». En esta prueba recibe apoyo; el conjunto de evidencias indicará si ya se distingue de las demás.`;
  }
  if (evaluation.state === "contradicts") {
    return `Tu respuesta coincide con el comportamiento correcto y resta apoyo a la explicación «${hypothesisTitle(evaluation.hypothesisId)}».`;
  }
  return "Esta respuesta no permite distinguir entre las explicaciones posibles. Necesitamos otra evidencia.";
}

function statusFor(id: string): EvidenceStatus {
  return props.contrast.statuses[id] ?? "insufficient";
}

function canonicalObservation(value: string, format: "numbers" | "text"): string {
  if (format === "numbers") return canonicalizeAnswer(value, "numbers");
  // Las líneas de excepción incluyen un mensaje variable; para comparar la
  // predicción con el resultado solo importa el tipo de error.
  return canonicalizeAnswer(value, "text")
    .split("\n")
    .map((line) => {
      const match = line.match(/^([A-Za-z_][\w.]*(?:Error|Exception|Interrupt|Exit))\b/);
      return match?.[1] ?? line;
    })
    .join("\n");
}

function observationMatches(answer: { response: string; observedOutput: string }): boolean {
  const format = props.microtest?.answerFormat ?? "numbers";
  return canonicalObservation(answer.response, format) === canonicalObservation(answer.observedOutput, format);
}

function check(): void {
  const microtest = props.microtest;
  if (!microtest || !selectedResponse.value) return;
  emit("check", microtest.id, selectedResponse.value);
}
</script>

<template>
  <section class="contrast" :data-testid="`${testIdPrefix}-stage`">
    <p class="stage-purpose">
      Contrastamos explicaciones posibles sobre {{ patternName.toLowerCase() }} con micropruebas.
      Cada respuesta es evidencia; ninguna prueba aislada es un diagnóstico definitivo.
    </p>

    <div class="hypotheses" :data-testid="`${testIdPrefix}-hypotheses`">
      <h3>Explicaciones posibles</h3>
      <ul>
        <li v-for="hypothesis in hypotheses" :key="hypothesis.id">
          <strong>{{ hypothesis.title }}</strong>
          <span class="muted"> — {{ hypothesis.description }}</span>
          <span class="status-badge" :class="`st-${statusFor(hypothesis.id)}`">
            {{ evidenceStatusLabel(statusFor(hypothesis.id)) }}
          </span>
        </li>
      </ul>
    </div>

    <div v-if="microtest" class="microtest" :data-testid="`${testIdPrefix}-microtest`">
      <div class="microtest-head">
        <h3>{{ microtest.objective }}</h3>
        <span class="counter">Microprueba {{ answeredCount + 1 }} · límite {{ maxMicrotests }} por sesión</span>
      </div>
      <p class="question" :data-testid="`${testIdPrefix}-question`">{{ microtest.predictionQuestion }}</p>
      <pre class="code" aria-label="Código de la microprueba"><code><span
          v-for="(text, i) in microtest.code.split('\n')" :key="i" class="code-line"><span class="ln">{{ i + 1 }}</span>{{ text }}
        </span></code></pre>

      <fieldset class="options" :data-testid="`${testIdPrefix}-options`">
        <legend>Elige la predicción que te parezca correcta</legend>
        <label v-for="(value, index) in options" :key="value" class="option">
          <input
            v-model="selectedResponse"
            type="radio"
            name="contrast-option"
            :value="value"
            :data-testid="`${testIdPrefix}-option-${index}`"
          />
          <span class="option-text">{{ value }}</span>
        </label>
      </fieldset>

      <div class="actions">
        <button
          type="button"
          class="btn btn-primary"
          :disabled="!selectedResponse || checking"
          :data-testid="`${testIdPrefix}-check`"
          @click="check"
        >
          {{ checking ? "Ejecutando en Python…" : "Comprobar con Python" }}
        </button>
        <span class="muted">La microprueba se ejecuta de verdad en el navegador.</span>
      </div>

      <p v-if="engineError" class="alert" role="alert" :data-testid="`${testIdPrefix}-engine-error`">
        {{ engineError }}
        <button type="button" class="btn btn-small" :data-testid="`${testIdPrefix}-retry-engine`" @click="emit('retryEngine')">
          Reintentar motor
        </button>
      </p>
    </div>

    <div v-else-if="!canComplete" class="alert warn" :data-testid="`${testIdPrefix}-no-microtest`">
      No hay una microprueba pendiente en este momento.
    </div>

    <p v-if="selection.action === 'sufficient' && canComplete" class="alert ok" :data-testid="`${testIdPrefix}-sufficient`">
      La evidencia disponible ya separa las explicaciones rivales de este patrón.
    </p>
    <p v-else-if="selection.action === 'insufficient'" class="alert warn" :data-testid="`${testIdPrefix}-insufficient`">
      La evidencia disponible es insuficiente para decidir entre todas las explicaciones. Se reconoce así; no se fuerza una conclusión.
    </p>
    <p v-else-if="selection.action === 'limit'" class="alert warn" :data-testid="`${testIdPrefix}-limit`">
      Se alcanzó el límite de micropruebas por sesión. Continuamos con la evidencia reunida.
    </p>

    <div v-if="contrast.answers.length" class="evidence" :data-testid="`${testIdPrefix}-evidence`">
      <h3>Evidencias registradas</h3>
      <article v-for="answer in contrast.answers" :key="answer.microtestId" class="evidence-item">
        <h4>{{ answer.microtestId }}</h4>
        <p><strong>Tu predicción:</strong> {{ answer.response }}</p>
        <p>
          <strong>Resultado real:</strong>
          <code>{{ answer.observedOutput || "(sin salida)" }}</code>
          <span class="status-badge" :class="observationMatches(answer) ? 'st-supported' : 'st-insufficient'">
            {{ observationMatches(answer) ? "coincide" : "no coincide" }}
          </span>
        </p>
        <ul>
          <li v-for="evaluation in answer.evaluations" :key="`${evaluation.microtestId}-${evaluation.hypothesisId}`">
            <span class="status-badge" :class="`state-${evaluation.state}`">{{ evidenceStateLabel(evaluation.state) }}</span>
            {{ feedbackFor(evaluation) }}
          </li>
        </ul>
      </article>
    </div>

    <details class="technical">
      <summary>Vista técnica (docentes y evaluadores)</summary>
      <p><strong>Razón de la selección:</strong> {{ selection.reason }}</p>
      <ul>
        <li v-for="hypothesis in hypotheses" :key="hypothesis.id">
          <strong>{{ hypothesis.id }}</strong> — {{ hypothesis.expectedBehavior }}
          <span class="muted">Limitación: {{ hypothesis.limitations.join(" ") }}</span>
        </li>
      </ul>
      <ul>
        <li v-for="answer in contrast.answers" :key="`tech-${answer.microtestId}`">
          <strong>{{ answer.microtestId }}</strong>: {{ answer.response }}
          <ul>
            <li v-for="evaluation in answer.evaluations" :key="`tech-${answer.microtestId}-${evaluation.hypothesisId}`">
              {{ evaluation.hypothesisId }} → {{ evaluation.state }}. {{ evaluation.reason }}
            </li>
          </ul>
        </li>
      </ul>
    </details>

    <div class="actions">
      <button
        type="button"
        class="btn btn-primary"
        :disabled="!canComplete"
        :data-testid="`${testIdPrefix}-complete`"
        @click="emit('complete')"
      >
        Continuar a transferencia
      </button>
      <span v-if="!canComplete" class="muted">Responde la microprueba pendiente para continuar.</span>
    </div>
  </section>
</template>

<style scoped>
.contrast { display: grid; gap: 1rem; }
.stage-purpose { margin: 0; color: var(--muted); }
.hypotheses ul { margin: 0.35rem 0 0; padding-left: 1.25rem; }
.hypotheses li { margin-bottom: 0.35rem; }
.status-badge { display: inline-block; font-size: 0.78rem; font-weight: 700; padding: 0.1rem 0.45rem; border-radius: 999px; margin-left: 0.35rem; }
.st-supported, .st-supports { background: #e3f3e8; color: var(--ok); }
.st-contradicted, .st-contradicts { background: var(--danger-bg); color: var(--danger); }
.st-insufficient, .st-insufficient { background: #f1eee6; color: var(--muted); }
.microtest { border: 1px solid var(--line); background: var(--surface); border-radius: 4px; padding: 1rem; }
.microtest-head { display: flex; justify-content: space-between; align-items: baseline; gap: 0.75rem; flex-wrap: wrap; }
.microtest-head h3 { margin: 0; font-family: var(--serif); }
.counter { font-size: 0.85rem; color: var(--muted); }
.question { font-size: 1.12rem; font-weight: 600; margin: 0.5rem 0; }
.options { border: 0; padding: 0; margin: 0.75rem 0; display: grid; gap: 0.45rem; }
.options legend { font-weight: 600; margin-bottom: 0.35rem; }
.option { display: flex; align-items: center; gap: 0.6rem; border: 1px solid var(--line); border-radius: 4px; padding: 0.5rem 0.7rem; cursor: pointer; background: var(--bg); }
.option:has(input:checked) { border-color: var(--accent); background: #eef4fb; }
.option-text { font-family: var(--mono); }
.actions { display: flex; gap: 0.75rem; flex-wrap: wrap; align-items: center; }
.evidence { display: grid; gap: 0.75rem; }
.evidence-item { border-left: 4px solid var(--line); padding: 0.5rem 0 0.5rem 0.9rem; }
.evidence-item h4 { margin: 0 0 0.35rem; font-family: var(--mono); }
.evidence-item p { margin: 0.25rem 0; }
.evidence-item code { font-family: var(--mono); background: #f4f1ea; padding: 0.1rem 0.35rem; }
.evidence-item ul { margin: 0.35rem 0 0; padding-left: 1.15rem; }
.technical { border-top: 1px dashed var(--line); padding-top: 0.75rem; }
.technical summary { cursor: pointer; font-weight: 600; }
.btn-small { margin-left: 0.5rem; padding: 0.25rem 0.6rem; min-height: 32px; font-size: 0.9rem; }
</style>
