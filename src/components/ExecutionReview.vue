<script setup lang="ts">
import type { PredictionComparison } from "../domain/compare";
import { EXERCISES } from "../domain/exercises";
import { formatValue } from "../domain/rows";
import type { ExecutionResult, StudentPrediction } from "../domain/types";
import TraceTable from "./TraceTable.vue";

defineProps<{
  exerciseId: keyof typeof EXERCISES;
  result: ExecutionResult;
  prediction: StudentPrediction;
  comparison: PredictionComparison;
  insight?: string;
}>();

const exerciseFor = (id: keyof typeof EXERCISES) => EXERCISES[id];

const displayValues = (values: readonly (number | undefined)[]) =>
  values.map((value) => (value === undefined ? "—" : formatValue(value))).join(", ");

function divergenceLabel(divergence: PredictionComparison["firstDivergence"]): string {
  if (!divergence) return "No se encontró una diferencia en los datos comparados.";
  if (divergence.kind === "iteration") {
    return `La primera diferencia aparece en la iteración ${divergence.iteration ?? "siguiente"}: esperabas ${
      divergence.expected ?? "ninguna"
    } y se observó ${divergence.actual ?? "ninguna"}.`;
  }
  if (divergence.kind === "variable") {
    return `En la iteración ${divergence.iteration ?? "—"}, ${divergence.variable ?? "la variable"}: esperabas ${
      divergence.expected ?? "un valor"
    } y se observó ${divergence.actual ?? "ningún valor"}.`;
  }
  return `La salida esperada era «${divergence.expected ?? ""}» y la observada fue «${divergence.actual ?? ""}».`;
}
</script>

<template>
  <section class="execution-review" aria-label="Comparación entre predicción y ejecución">
    <h3>Tu predicción registrada</h3>
    <dl class="prediction-recap">
      <div><dt>Salida que esperabas</dt><dd><pre>{{ prediction.expectedOutput }}</pre></dd></div>
      <div><dt>Iteraciones que esperabas</dt><dd>{{ prediction.expectedIterations.length }}</dd></div>
      <div v-for="sequence in comparison.variableSequences" :key="sequence.name">
        <dt>Valores previstos de <code>{{ sequence.name }}</code></dt>
        <dd>{{ displayValues(sequence.expected) }}</dd>
      </div>
      <div><dt>Confianza</dt><dd>{{ prediction.confidence }}/100</dd></div>
      <div><dt>Tu razonamiento</dt><dd>{{ prediction.explanation }}</dd></div>
    </dl>

    <h3>Ejecución real</h3>
    <div v-if="result.success" class="actual-output">
      <p>Salida observada:</p>
      <pre class="output" aria-label="Salida del programa"><code>{{ result.output || "(sin salida)" }}</code></pre>
    </div>
    <p v-else class="alert" role="alert">{{ result.error ?? "El programa no terminó." }}</p>
    <p class="hint">Iteraciones observadas: {{ comparison.observedIterations.length }}</p>

    <div v-if="comparison.variableSequences.length" class="comparison-table-wrap">
      <table class="comparison-table">
        <caption>Valores que predijiste y valores observados por iteración</caption>
        <thead><tr><th>Variable</th><th>Predicción</th><th>Realidad</th><th>Coincide</th></tr></thead>
        <tbody>
          <tr v-for="sequence in comparison.variableSequences" :key="sequence.name">
            <th scope="row"><code>{{ sequence.name }}</code></th>
            <td>{{ displayValues(sequence.expected) }}</td>
            <td>{{ displayValues(sequence.actual) }}</td>
            <td>{{ sequence.matches ? "Sí" : "No" }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <p class="divergence" role="status">
      <strong>Primer punto de divergencia:</strong>
      {{ divergenceLabel(comparison.firstDivergence) }}
      <span v-if="comparison.firstDivergence?.line">
        (línea {{ comparison.firstDivergence.line }}).
      </span>
    </p>
    <p v-if="insight" class="learning-insight">{{ insight }}</p>
    <TraceTable
      v-if="result.snapshots.length"
      :snapshots="result.snapshots"
      :code="exerciseFor(exerciseId).code"
    />
  </section>
</template>
