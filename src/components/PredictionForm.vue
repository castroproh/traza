<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { parseIterations, validatePrediction } from "../domain/pact/analysis";
import type { PactExerciseDefinition } from "../domain/pact/exercises";
import type { PactPrediction, PredictionInput } from "../domain/pact/types";

const props = withDefaults(
  defineProps<{
    exercise: PactExerciseDefinition;
    prediction?: PactPrediction | null;
    submitLabel?: string;
    testIdPrefix?: string;
  }>(),
  {
    prediction: null,
    submitLabel: "Guardar predicción",
    testIdPrefix: "prediction",
  },
);

const emit = defineEmits<{ submit: [input: PredictionInput] }>();

const expectedOutput = ref("");
const explanation = ref("");
const confidence = ref(50);
const iterationsText = ref("");
const variableInputs = reactive<Record<string, string>>({});
const localError = ref<string | null>(null);

function reset(): void {
  expectedOutput.value = "";
  explanation.value = "";
  confidence.value = 50;
  iterationsText.value = "";
  localError.value = null;
  for (const key of Object.keys(variableInputs)) delete variableInputs[key];
  for (const name of props.exercise.variablesToPredict) variableInputs[name] = "";
}

watch(
  () => props.exercise.exerciseId,
  () => reset(),
  { immediate: true },
);

const parsedVariables = computed<Record<string, number>>(() => {
  const values: Record<string, number> = {};
  for (const name of props.exercise.variablesToPredict) {
    const raw = variableInputs[name]?.trim() ?? "";
    if (raw.length === 0) continue;
    const value = Number(raw);
    if (Number.isFinite(value)) values[name] = value;
  }
  return values;
});

const parsedIterations = computed<number[] | null>(() => parseIterations(iterationsText.value));

const input = computed<PredictionInput>(() => ({
  expectedOutput: expectedOutput.value,
  expectedVariables: parsedVariables.value,
  expectedIterations: parsedIterations.value ?? [],
  explanation: explanation.value,
  confidence: Number(confidence.value),
}));

const errors = computed(() => {
  const found = validatePrediction(input.value);
  if (parsedIterations.value === null) found.push("Las iteraciones deben ser números enteros positivos separados por comas.");
  return found;
});

const canSubmit = computed(() => errors.value.length === 0 && props.prediction === null);

function variableId(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, "-");
}

function onSubmit(): void {
  localError.value = null;
  if (errors.value.length > 0) {
    localError.value = errors.value.join(" ");
    return;
  }
  emit("submit", input.value);
}
</script>

<template>
  <div v-if="prediction" class="prediction-locked" :data-testid="`${testIdPrefix}-locked`">
    <p class="locked-note">
      Predicción guardada. Se conserva tal como la enviaste y no puede modificarse.
    </p>
    <dl class="prediction-readout">
      <div>
        <dt>Resultado esperado</dt>
        <dd :data-testid="`${testIdPrefix}-saved-output`">{{ prediction.expectedOutput }}</dd>
      </div>
      <div>
        <dt>Iteraciones previstas</dt>
        <dd>{{ prediction.expectedIterations.length ? prediction.expectedIterations.join(", ") : "No registradas" }}</dd>
      </div>
      <div>
        <dt>Valores de variables</dt>
        <dd>
          <template v-if="Object.keys(prediction.expectedVariables).length">
            {{ Object.entries(prediction.expectedVariables).map(([name, value]) => `${name} = ${value}`).join(", ") }}
          </template>
          <template v-else>No registrados</template>
        </dd>
      </div>
      <div>
        <dt>Confianza</dt>
        <dd>{{ prediction.confidence }}/100 <span class="muted">(no es una calificación)</span></dd>
      </div>
      <div class="wide">
        <dt>Tu explicación</dt>
        <dd>{{ prediction.explanation }}</dd>
      </div>
    </dl>
  </div>

  <form v-else class="prediction-form" @submit.prevent="onSubmit">
    <p class="prediction-question">{{ exercise.predictionQuestion }}</p>

    <label class="field">
      <span>Resultado esperado</span>
      <textarea
        v-model="expectedOutput"
        rows="2"
        :data-testid="`${testIdPrefix}-output`"
        placeholder="Escribe la salida que esperas"
      ></textarea>
    </label>

    <fieldset v-if="exercise.variablesToPredict.length" class="field-group">
      <legend>Valores finales de las variables <span class="muted">(opcional)</span></legend>
      <label v-for="name in exercise.variablesToPredict" :key="name" class="inline-field">
        <span>{{ name }}</span>
        <input
          v-model="variableInputs[name]"
          type="number"
          inputmode="numeric"
          :data-testid="`${testIdPrefix}-variable-${variableId(name)}`"
          placeholder="—"
        />
      </label>
    </fieldset>

    <label class="field">
      <span>Iteraciones previstas <span class="muted">(opcional, sepáralas con comas)</span></span>
      <input
        v-model="iterationsText"
        type="text"
        :data-testid="`${testIdPrefix}-iterations`"
        placeholder="1, 2, 3"
      />
    </label>

    <label class="field">
      <span>Explica tu razonamiento</span>
      <textarea
        v-model="explanation"
        rows="3"
        :data-testid="`${testIdPrefix}-explanation`"
        :placeholder="exercise.explanationPrompt"
      ></textarea>
    </label>

    <label class="field field-confidence">
      <span>Confianza en tu predicción: <strong>{{ confidence }}/100</strong></span>
      <input
        v-model.number="confidence"
        type="range"
        min="0"
        max="100"
        step="1"
        :data-testid="`${testIdPrefix}-confidence`"
      />
      <span class="muted">La confianza no se convierte en calificación.</span>
    </label>

    <div class="prediction-review" :data-testid="`${testIdPrefix}-review`">
      <strong>Revisa antes de enviar</strong>
      <p>Resultado esperado: {{ expectedOutput.trim() || "(sin escribir)" }}</p>
      <p>
        Variables:
        {{ Object.keys(parsedVariables).length ? Object.entries(parsedVariables).map(([n, v]) => `${n} = ${v}`).join(", ") : "no registradas" }}
      </p>
      <p>Iteraciones: {{ parsedIterations === null ? "valor no válido" : parsedIterations.length ? parsedIterations.join(", ") : "no registradas" }}</p>
    </div>

    <p v-if="localError" class="form-error" role="alert">{{ localError }}</p>

    <button type="submit" class="btn btn-primary" :disabled="!canSubmit" :data-testid="`${testIdPrefix}-submit`">
      {{ submitLabel }}
    </button>
  </form>
</template>

<style scoped>
.prediction-form { display: grid; gap: 1rem; margin-top: 1rem; }
.prediction-question { font-size: 1.15rem; font-weight: 600; margin: 0; }
.field { display: grid; gap: 0.35rem; }
.field > span { font-weight: 600; }
.field textarea, .field input[type="text"], .field input[type="number"] {
  font: inherit; padding: 0.6rem 0.75rem; border: 1px solid var(--line);
  border-radius: 4px; background: var(--surface); color: var(--ink); width: 100%;
}
.field textarea:focus-visible, .field input:focus-visible { outline: 3px solid #f0a500; outline-offset: 1px; }
.field-group { border: 1px solid var(--line); border-radius: 4px; padding: 0.75rem 1rem; display: flex; flex-wrap: wrap; gap: 0.75rem 1.25rem; }
.field-group legend { font-weight: 600; padding: 0 0.35rem; }
.inline-field { display: flex; align-items: center; gap: 0.5rem; }
.inline-field input { width: 9rem; }
.field-confidence input[type="range"] { width: 100%; }
.prediction-review { border-left: 4px solid var(--accent); background: #eef4fb; padding: 0.75rem 1rem; border-radius: 2px; }
.prediction-review p { margin: 0.25rem 0; }
.form-error { color: var(--danger); background: var(--danger-bg); border-left: 4px solid var(--danger); padding: 0.6rem 0.8rem; margin: 0; }
.prediction-locked { border: 1px solid var(--line); background: var(--surface); border-radius: 4px; padding: 1rem; }
.locked-note { margin-top: 0; color: var(--muted); }
.prediction-readout { display: grid; grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr)); gap: 0.75rem 1.25rem; margin: 0; }
.prediction-readout dt { font-size: 0.85rem; color: var(--muted); }
.prediction-readout dd { margin: 0.15rem 0 0; font-weight: 600; }
.prediction-readout .wide { grid-column: 1 / -1; }
@media (max-width: 600px) {
  .inline-field { width: 100%; justify-content: space-between; }
  .inline-field input { width: 8rem; }
}
</style>
