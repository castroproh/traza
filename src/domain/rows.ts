import { isUnsupported } from "./normalize";
import type { TraceEventKind, TraceSnapshot, TraceValue, VariableState } from "./types";

/** Representación legible (estilo Python) de un valor. `undefined` → "—". */
export function formatValue(value: TraceValue | undefined): string {
  if (value === undefined) return "—";
  if (value === null) return "None";
  if (typeof value === "boolean") return value ? "True" : "False";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return `'${value}'`;
  if (Array.isArray(value)) return `[${value.map(formatValue).join(", ")}]`;
  if (isUnsupported(value)) return "‹valor no compatible›";
  const items = Object.entries(value).map(([k, v]) => `'${k}': ${formatValue(v)}`);
  return `{${items.join(", ")}}`;
}

/** Nombres de variables en orden de primera aparición. */
export function variableColumns(snapshots: readonly TraceSnapshot[]): string[] {
  const seen = new Set<string>();
  for (const snap of snapshots) {
    for (const name of Object.keys(snap.before)) seen.add(name);
    if (snap.after) for (const name of Object.keys(snap.after)) seen.add(name);
  }
  return [...seen];
}

export function eventLabel(event: TraceEventKind): string {
  switch (event) {
    case "call":
      return "Inicio";
    case "line":
      return "Línea";
    case "return":
      return "Fin";
    case "exception":
      return "Error";
  }
}

export interface VariableCell {
  before: string;
  after: string;
  changed: boolean;
}

export interface TraceRow {
  sequence: number;
  line: number;
  event: TraceEventKind;
  label: string;
  iteration: number | undefined;
  detail: string | undefined;
  cells: Record<string, VariableCell>;
}

function cell(name: string, before: VariableState, after: VariableState | undefined): VariableCell {
  const b = formatValue(before[name]);
  // Sin estado posterior (inicio, fin) no se inventa ninguno.
  const a = after === undefined ? "" : formatValue(after[name]);
  return { before: b, after: a, changed: after !== undefined && a !== b };
}

export function buildRows(snapshots: readonly TraceSnapshot[], columns: readonly string[]): TraceRow[] {
  return snapshots.map((snap) => ({
    sequence: snap.sequence,
    line: snap.line,
    event: snap.event,
    label: eventLabel(snap.event),
    iteration: snap.iteration,
    detail: snap.detail,
    cells: Object.fromEntries(columns.map((name) => [name, cell(name, snap.before, snap.after)])),
  }));
}
