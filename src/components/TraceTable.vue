<script setup lang="ts">
import { computed } from "vue";
import { sourceLine } from "../domain/exercises";
import { buildRows, variableColumns } from "../domain/rows";
import type { TraceSnapshot } from "../domain/types";

const props = defineProps<{ snapshots: readonly TraceSnapshot[]; code: string }>();

const columns = computed(() => variableColumns(props.snapshots));
const rows = computed(() => buildRows(props.snapshots, columns.value));

function instruction(line: number): string {
  return line === 0 ? "" : sourceLine(props.code, line).trim();
}
</script>

<template>
  <div class="table-wrap" role="region" aria-label="Tabla de seguimiento" tabindex="0">
    <table class="trace">
      <caption class="sr-only">
        Seguimiento de la ejecución: cada fila es un paso real que registró Python.
      </caption>
      <thead>
        <tr>
          <th rowspan="2" scope="col">Paso</th>
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
        <tr v-for="row in rows" :key="row.sequence" :class="`ev-${row.event}`">
          <td class="num">{{ row.sequence + 1 }}</td>
          <td class="num">{{ row.line === 0 ? "—" : row.line }}</td>
          <td class="code-cell">
            <span v-if="row.event === 'call'" class="tag">Inicio del programa</span>
            <span v-else-if="row.event === 'return'" class="tag">Fin del programa</span>
            <code v-else>{{ instruction(row.line) }}</code>
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
</template>
