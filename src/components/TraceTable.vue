<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { sourceLine } from "../domain/exercises";
import { buildRows, conditionBranchLabel, variableColumns } from "../domain/rows";
import type { TraceRow } from "../domain/rows";
import type { TraceSnapshot } from "../domain/types";

const props = defineProps<{ snapshots: readonly TraceSnapshot[]; code: string }>();

const columns = computed(() => variableColumns(props.snapshots));
const rows = computed(() => buildRows(props.snapshots, columns.value));

const selected = ref(0);
const progressive = ref(false);

watch(
  () => props.snapshots,
  (snapshots) => {
    selected.value = Math.max(0, snapshots.length - 1);
  },
  { immediate: true },
);

const lastSequence = computed(() => Math.max(0, rows.value.length - 1));
const currentSequence = computed(() => Math.min(Math.max(selected.value, 0), lastSequence.value));
const currentRow = computed(() => rows.value[currentSequence.value] ?? null);
const visibleRows = computed(() =>
  progressive.value ? rows.value.filter((row) => row.sequence <= currentSequence.value) : rows.value,
);

function instruction(line: number): string {
  return line === 0 ? "" : sourceLine(props.code, line).trim();
}

function selectRow(sequence: number): void {
  selected.value = sequence;
}

function previous(): void {
  selected.value = Math.max(0, currentSequence.value - 1);
}

function next(): void {
  selected.value = Math.min(lastSequence.value, currentSequence.value + 1);
}

function reset(): void {
  selected.value = 0;
}

function showAll(): void {
  selected.value = lastSequence.value;
}

function conditionSummary(row: TraceRow): string {
  const condition = row.condition;
  if (!condition) return "";
  const result = condition.result ? "True" : "False";
  const parts = [`${condition.expression} → ${result}`, conditionBranchLabel(condition)];
  if (condition.notExecuted) {
    parts.push(`no se ejecutó la rama ${condition.notExecuted === "then" ? "del if" : "else"}`);
  }
  return parts.join(" · ");
}

function globalsSummary(row: TraceRow): string {
  if (!row.globals) return "";
  return Object.entries(row.globals)
    .map(([name, value]) => `${name} = ${value}`)
    .join(", ");
}
</script>

<template>
  <div class="trace-replay">
    <div class="replay-controls" role="group" aria-label="Reproducción paso a paso">
      <button type="button" class="btn btn-small" data-testid="trace-reset" @click="reset">Reiniciar</button>
      <button
        type="button"
        class="btn btn-small"
        data-testid="trace-prev"
        :disabled="currentSequence === 0"
        @click="previous"
      >
        Anterior
      </button>
      <span class="replay-position" data-testid="trace-position">
        Paso {{ currentSequence + 1 }} de {{ rows.length }}
      </span>
      <button
        type="button"
        class="btn btn-small"
        data-testid="trace-next"
        :disabled="currentSequence >= lastSequence"
        @click="next"
      >
        Siguiente
      </button>
      <button type="button" class="btn btn-small" data-testid="trace-show-all" @click="showAll">
        Ver toda la ejecución
      </button>
      <label class="replay-toggle">
        <input v-model="progressive" type="checkbox" data-testid="trace-progressive" />
        Mostrar solo hasta el paso actual
      </label>
      <label class="replay-select">
        Ir al paso
        <select
          :value="currentSequence"
          data-testid="trace-select"
          @change="selectRow(Number(($event.target as HTMLSelectElement).value))"
        >
          <option v-for="row in rows" :key="row.sequence" :value="row.sequence">
            {{ row.sequence + 1 }} · {{ row.frameLabel }} · línea {{ row.line === 0 ? "—" : row.line }}
          </option>
        </select>
      </label>
    </div>

    <div v-if="currentRow" class="current-step" data-testid="trace-current">
      <strong>Paso {{ currentRow.sequence + 1 }}:</strong>
      {{ currentRow.frameLabel }}
      <span v-if="currentRow.callId"> · llamada #{{ currentRow.callId }}</span>
      <span v-if="currentRow.depth !== undefined"> · profundidad {{ currentRow.depth }}</span>
      <template v-if="currentRow.condition">
        · condición <code>{{ conditionSummary(currentRow) }}</code>
      </template>
      <template v-if="currentRow.returnValue !== undefined">
        · valor devuelto <code>{{ currentRow.returnValue }}</code>
      </template>
      <template v-if="currentRow.globals">
        · globales <code>{{ globalsSummary(currentRow) || "—" }}</code>
      </template>
    </div>

    <div class="table-wrap" role="region" aria-label="Tabla de seguimiento" tabindex="0">
      <table class="trace">
        <caption class="sr-only">
          Seguimiento de la ejecución: cada fila es un paso real que registró Python.
        </caption>
        <thead>
          <tr>
            <th rowspan="2" scope="col">Paso</th>
            <th rowspan="2" scope="col">Marco</th>
            <th rowspan="2" scope="col">Evento</th>
            <th rowspan="2" scope="col">Línea</th>
            <th rowspan="2" scope="col">Instrucción</th>
            <th rowspan="2" scope="col">Iteración</th>
            <th v-for="name in columns" :key="name" colspan="2" scope="colgroup" class="var-head">
              <code>{{ name }}</code>
            </th>
          </tr>
          <tr>
            <template v-for="name in columns" :key="name">
              <th scope="col" class="sub">antes</th>
              <th scope="col" class="sub">después</th>
            </template>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in visibleRows"
            :key="row.sequence"
            :class="[`ev-${row.event}`, { current: row.sequence === currentSequence }]"
            :data-testid="`trace-row-${row.sequence}`"
            @click="selectRow(row.sequence)"
          >
            <td class="num">{{ row.sequence + 1 }}</td>
            <td class="frame">
              <code>{{ row.frame }}</code>
              <span v-if="row.depth !== undefined" class="frame-depth">d{{ row.depth }}</span>
              <span v-if="row.callId" class="frame-depth">#{{ row.callId }}</span>
            </td>
            <td class="event">{{ row.frameLabel }}</td>
            <td class="num">{{ row.line === 0 ? "—" : row.line }}</td>
            <td class="code-cell">
              <code v-if="row.line > 0">{{ instruction(row.line) }}</code>
              <span v-if="row.condition" class="condition" data-testid="trace-condition">
                <code>{{ row.condition.expression }}</code>
                → <strong>{{ row.condition.result ? "True" : "False" }}</strong>
                · {{ conditionBranchLabel(row.condition) }}
                <span v-if="row.condition.notExecuted" class="muted">
                  · no se ejecutó {{ row.condition.notExecuted === "then" ? "el if" : "el else" }}
                </span>
              </span>
              <span v-if="row.returnValue !== undefined" class="return-value" data-testid="trace-return">
                return → <code>{{ row.returnValue }}</code>
              </span>
              <span v-if="row.globals" class="globals" data-testid="trace-globals">
                globales: {{ globalsSummary(row) || "—" }}
              </span>
              <span v-if="row.detail" class="detail">{{ row.detail }}</span>
            </td>
            <td class="num">{{ row.iteration ?? "—" }}</td>
            <template v-for="name in columns" :key="name">
              <td class="val">{{ row.cells[name]?.before }}</td>
              <td class="val" :class="{ changed: row.cells[name]?.changed }">
                {{ row.cells[name]?.after || "—" }}
              </td>
            </template>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.replay-controls { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; margin-bottom: 0.6rem; }
.replay-position { font-weight: 700; font-variant-numeric: tabular-nums; }
.replay-toggle, .replay-select { display: flex; align-items: center; gap: 0.35rem; font-size: 0.9rem; color: var(--muted); }
.replay-select select { font: inherit; padding: 0.2rem 0.35rem; }
.current-step { border-left: 4px solid var(--accent); background: #eef4fb; padding: 0.5rem 0.75rem; margin-bottom: 0.6rem; }
.current-step code { font-family: var(--mono); }
.trace tr { cursor: pointer; }
.trace tr.current { outline: 2px solid var(--accent); outline-offset: -2px; background: #eef4fb; }
.frame code { font-family: var(--mono); }
.frame-depth { margin-left: 0.3rem; font-size: 0.75rem; color: var(--muted); }
.event { white-space: nowrap; font-size: 0.85rem; }
.condition, .return-value, .globals { display: block; margin-top: 0.2rem; font-size: 0.82rem; }
.condition code, .return-value code { font-family: var(--mono); }
.globals { color: var(--muted); }
</style>
