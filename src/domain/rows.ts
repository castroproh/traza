import { isUnsupported } from "./normalize";
import type {
  TraceCondition,
  TraceEventKind,
  TraceSnapshot,
  TraceValue,
  VariableState,
} from "./types";

/** Representación legible (estilo Python) de un valor. `undefined` → "—". */
export function formatValue(value: TraceValue | undefined): string {
  if (value === undefined) return "—";
  if (value === null) return "None";
  if (typeof value === "boolean") return value ? "True" : "False";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return `'${value}'`;
  if (Array.isArray(value)) return `[${value.map(formatValue).join(", ")}]`;
  if (isUnsupported(value)) return `‹valor no compatible›`;
  const items = Object.entries(value).map(([k, v]) => `'${k}': ${formatValue(v)}`);
  return `{${items.join(", ")}}`;
}

/** Nombres de variables locales en orden de primera aparición. */
export function variableColumns(snapshots: readonly TraceSnapshot[]): string[] {
  const seen = new Set<string>();
  for (const snap of snapshots) {
    for (const name of Object.keys(snap.before)) seen.add(name);
    if (snap.after) for (const name of Object.keys(snap.after)) seen.add(name);
  }
  return [...seen];
}

/** Nombres de variables globales observadas en marcos de función. */
export function globalColumns(snapshots: readonly TraceSnapshot[]): string[] {
  const seen = new Set<string>();
  for (const snap of snapshots) {
    if (!snap.globals) continue;
    for (const name of Object.keys(snap.globals)) seen.add(name);
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

/** Etiqueta del evento teniendo en cuenta el marco (programa o función). */
export function frameEventLabel(snapshot: TraceSnapshot): string {
  const isFunction = snapshot.scope === "function" || snapshot.callType === "function";
  if (snapshot.event === "call") {
    return isFunction ? `Entrada a ${snapshot.function ?? "función"}()` : "Inicio del programa";
  }
  if (snapshot.event === "return") {
    return isFunction ? `Fin de ${snapshot.function ?? "función"}()` : "Fin del programa";
  }
  if (snapshot.event === "exception") return "Excepción";
  return "Línea";
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
  frameLabel: string;
  frame: string;
  depth: number | undefined;
  callId: number | undefined;
  scope: "module" | "function" | undefined;
  iteration: number | undefined;
  detail: string | undefined;
  globals: Record<string, string> | undefined;
  returnValue: string | undefined;
  condition: TraceCondition | undefined;
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
    frameLabel: frameEventLabel(snap),
    frame: snap.function ?? "<module>",
    depth: snap.depth,
    callId: snap.callId,
    scope: snap.scope,
    iteration: snap.iteration,
    detail: snap.detail,
    globals: snap.globals
      ? Object.fromEntries(Object.entries(snap.globals).map(([name, value]) => [name, formatValue(value)]))
      : undefined,
    returnValue: snap.returnValue === undefined ? undefined : formatValue(snap.returnValue),
    condition: snap.condition,
    cells: Object.fromEntries(columns.map((name) => [name, cell(name, snap.before, snap.after)])),
  }));
}

/** Descripción legible de la rama observada de una condición. */
export function conditionBranchLabel(condition: TraceCondition): string {
  switch (condition.branch) {
    case "then":
      return "rama del if";
    case "elif":
      return "rama elif";
    case "else":
      return "rama else";
    case "none":
      return "rama no determinada";
  }
}
