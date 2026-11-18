<script setup lang="ts">
import { computed } from "vue";
import TraceTable from "./components/TraceTable.vue";
import { useTraceEngine } from "./composables/useTraceEngine";
import { EXERCISES } from "./domain/exercises";

const exercise = EXERCISES["suma-1-3"];
const { status, result, errorMessage, run } = useTraceEngine();

const statusText = computed(() => {
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
      return "Hubo un problema";
  }
  return "";
});

const canRun = computed(() => status.value === "ready" || status.value === "success" || status.value === "error");
const codeLines = exercise.code.split("\n");

const matchesExpected = computed(() =>
  result.value ? result.value.output.trim() === exercise.expectedOutput : false,
);
</script>

<template>
  <main class="page">
    <header class="masthead">
      <h1>TRAZA</h1>
      <p class="tagline">Laboratorio de diagnóstico del razonamiento algorítmico</p>
    </header>

    <section class="block" aria-labelledby="ej">
      <h2 id="ej">{{ exercise.title }}</h2>
      <p>{{ exercise.description }}</p>
      <pre class="code" aria-label="Código del ejercicio (solo lectura)"><code><span
        v-for="(text, i) in codeLines" :key="i" class="code-line"><span class="ln">{{ i + 1 }}</span>{{ text }}
</span></code></pre>

      <div class="actions">
        <button type="button" class="primary" :disabled="!canRun" @click="run(exercise.id)">
          Ejecutar programa
        </button>
        <p class="status" :class="`s-${status}`" role="status" aria-live="polite">
          <span class="dot" aria-hidden="true"></span>{{ statusText }}
        </p>
      </div>
      <p v-if="errorMessage" class="alert" role="alert">{{ errorMessage }}</p>
    </section>

    <section v-if="result && result.snapshots.length" class="block" aria-labelledby="seg">
      <h2 id="seg">Seguimiento</h2>
      <p class="hint">
        Cada fila es un paso que Python registró de verdad. «Antes» es el valor antes de ejecutar la
        línea y «después» es el valor al terminar.
      </p>
      <TraceTable :snapshots="result.snapshots" :code="exercise.code" />
    </section>

    <section v-if="result" class="block" aria-labelledby="sal">
      <h2 id="sal">Salida</h2>
      <pre class="output" aria-label="Salida del programa"><code>{{ result.output || "(el programa no mostró nada)" }}</code></pre>
      <p v-if="result.success" class="hint">
        Resultado esperado del ejercicio: <strong>{{ exercise.expectedOutput }}</strong> —
        {{ matchesExpected ? "coincide." : "no coincide." }}
        <span class="muted">({{ result.durationMs }} ms)</span>
      </p>
    </section>
  </main>
</template>
