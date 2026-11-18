<script setup lang="ts">
import { reactive, ref, watch } from "vue";
import type { Exercise } from "../domain/exercises";
import type { StudentPrediction } from "../domain/types";

const props = defineProps<{
  exercise: Exercise;
  heading: string;
  instructions: string;
  actionLabel: string;
}>();
const emit = defineEmits<{ prediction: [value: StudentPrediction] }>();

const expectedOutput = ref("");
const iterationCount = ref("");
const confidence = ref(50);
const explanation = ref("");
const variableValues = reactive<Record<string, string>>({});
const validationError = ref<string | null>(null);

watch(
  () => props.exercise.id,
  () => {
    expectedOutput.value = "";
    iterationCount.value = "";
    confidence.value = 50;
    explanation.value = "";
    validationError.value = null;
    for (const key of Object.keys(variableValues)) delete variableValues[key];
    for (const name of props.exercise.predictionVariables) variableValues[name] = "";
  },
  { immediate: true },
);

function parseNumberList(text: string): number[] | null {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const parts = trimmed.split(/[\s,]+/);
  const values = parts.map(Number);
  return values.every(Number.isFinite) ? values : null;
}

function handleSubmit(): void {
  validationError.value = null;
  const countText = String(iterationCount.value);
  const count = Number(countText);
  if (countText.trim() === "" || !Number.isInteger(count) || count < 0 || count > 1000) {
    validationError.value = "Indica un número entero de iteraciones entre 0 y 1000.";
    return;
  }
  if (!expectedOutput.value.trim()) {
    validationError.value = "Escribe la salida que esperas, incluso si crees que estará vacía.";
    return;
  }
  if (!explanation.value.trim()) {
    validationError.value = "Explica brevemente cómo llegaste a tu predicción.";
    return;
  }

  const expectedVariableValues: Record<string, number[]> = {};
  const expectedVariables: Record<string, number> = {};
  for (const name of props.exercise.predictionVariables) {
    const values = parseNumberList(variableValues[name] ?? "");
    if (values === null || values.length !== count) {
      validationError.value =
        `Escribe ${count} valor(es) numérico(s) para ${name}, uno por iteración.`;
      return;
    }
    expectedVariableValues[name] = values;
    const finalValue = values.at(-1);
    if (finalValue !== undefined) expectedVariables[name] = finalValue;
  }

  emit("prediction", {
    expectedOutput: expectedOutput.value,
    expectedVariables,
    expectedVariableValues,
    expectedIterations: Array.from({ length: count }, (_, index) => index + 1),
    confidence: confidence.value,
    explanation: explanation.value.trim(),
  });
}
</script>

<template>
  <section class="prediction-card" :aria-labelledby="`form-${exercise.id}`">
    <h3 :id="`form-${exercise.id}`">{{ heading }}</h3>
    <p>{{ instructions }}</p>
    <p class="hint">{{ exercise.description }}</p>
    <pre class="code" aria-label="Código del ejercicio (solo lectura)"><code><span
      v-for="(text, i) in exercise.code.split('\n')" :key="i" class="code-line"><span class="ln">{{ i + 1 }}</span>{{ text }}
</span></code></pre>

    <form class="prediction-form" @submit.prevent="handleSubmit">
      <label>
        Salida final que esperas
        <textarea v-model="expectedOutput" rows="3" required aria-label="Salida final que esperas"></textarea>
      </label>
      <label>
        ¿Cuántas iteraciones esperas?
        <input
          v-model="iterationCount"
          type="number"
          min="0"
          max="1000"
          step="1"
          required
          aria-label="Número de iteraciones que esperas"
        />
      </label>
      <fieldset>
        <legend>Valores que esperas después de cada iteración</legend>
        <label v-for="name in exercise.predictionVariables" :key="name">
          <code>{{ name }}</code> — uno por vuelta, separados por comas
          <input
            v-model="variableValues[name]"
            type="text"
            :aria-label="`Valores previstos para ${name}, uno por iteración`"
            :placeholder="name === 'total' || name === 'saldo' || name === 'subtotal' ? 'p. ej. 1, 3, 6' : 'p. ej. 1, 2, 3'"
          />
        </label>
      </fieldset>
      <label>
        Explica tu razonamiento
        <textarea
          v-model="explanation"
          rows="3"
          maxlength="2000"
          required
          aria-label="Explicación de la predicción"
        ></textarea>
      </label>
      <label class="confidence-label">
        Confianza: <strong>{{ confidence }}</strong>/100
        <input
          v-model.number="confidence"
          type="range"
          min="0"
          max="100"
          step="1"
          aria-label="Nivel de confianza entre 0 y 100"
        />
      </label>
      <p v-if="validationError" class="alert" role="alert">{{ validationError }}</p>
      <button type="submit" class="primary">{{ actionLabel }}</button>
    </form>
  </section>
</template>
