<script setup lang="ts">
import type { PactAnalysis, PactPrediction } from "../domain/pact/types";

withDefaults(
  defineProps<{
    prediction: PactPrediction | null;
    analysis: PactAnalysis | null;
    heading?: string;
    testIdPrefix?: string;
  }>(),
  {
    heading: "Comparación con la ejecución",
    testIdPrefix: "analysis",
  },
);
</script>

<template>
  <section v-if="analysis" class="analysis-card" :data-testid="`${testIdPrefix}-analysis`">
    <h3>{{ heading }}</h3>
    <p class="verdict" :class="analysis.allMatch ? 'ok' : 'warn'">
      {{ analysis.allMatch ? "La predicción coincide con la ejecución observada." : "Hay diferencias entre tu predicción y la ejecución." }}
    </p>

    <dl class="comparison" :data-testid="`${testIdPrefix}-comparison`">
      <div>
        <dt>Salida esperada por ti</dt>
        <dd><code>{{ analysis.expectedOutput }}</code></dd>
      </div>
      <div>
        <dt>Salida real</dt>
        <dd><code>{{ analysis.observedOutput || "(sin salida)" }}</code></dd>
      </div>
      <div>
        <dt>Iteraciones</dt>
        <dd>
          <template v-if="analysis.iterationsPredicted">
            esperabas {{ analysis.expectedIterations.join(", ") }} · observadas {{ analysis.observedIterations.join(", ") }}
          </template>
          <template v-else>no registraste iteraciones · observadas {{ analysis.observedIterations.join(", ") }}</template>
        </dd>
      </div>
      <div v-if="analysis.variableDiffs.length">
        <dt>Variables al terminar</dt>
        <dd>
          <span v-for="diff in analysis.variableDiffs" :key="diff.name" class="var-diff" :class="{ bad: !diff.matches }">
            {{ diff.name }}: esperabas {{ diff.expected }} · real {{ diff.actual ?? "sin valor" }}
          </span>
        </dd>
      </div>
    </dl>

    <p class="divergence" :data-testid="`${testIdPrefix}-divergence`">{{ analysis.divergence.description }}</p>
    <p v-if="prediction" class="muted confidence-note">
      Confianza registrada: {{ prediction.confidence }}/100 (no es una calificación).
    </p>
  </section>
</template>

<style scoped>
.analysis-card { border: 1px solid var(--line); background: var(--surface); border-radius: 4px; padding: 1rem; margin-top: 1rem; }
.analysis-card h3 { margin-top: 0; font-family: var(--serif); }
.verdict { font-weight: 700; padding: 0.5rem 0.75rem; border-radius: 2px; }
.verdict.ok { background: #eef7f1; color: var(--ok); border-left: 4px solid var(--ok); }
.verdict.warn { background: #fdf3e3; color: #7a4a00; border-left: 4px solid #b26a00; }
.comparison { display: grid; grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr)); gap: 0.75rem 1.25rem; margin: 1rem 0; }
.comparison dt { font-size: 0.85rem; color: var(--muted); }
.comparison dd { margin: 0.2rem 0 0; }
.comparison code { font-family: var(--mono); background: #f4f1ea; padding: 0.1rem 0.35rem; border-radius: 2px; white-space: pre-wrap; }
.var-diff { display: block; font-family: var(--mono); font-size: 0.95rem; }
.var-diff.bad { color: var(--danger); font-weight: 700; }
.divergence { border-left: 4px solid var(--accent); background: #eef4fb; padding: 0.6rem 0.8rem; margin: 0.5rem 0; }
.confidence-note { margin-bottom: 0; }
</style>
