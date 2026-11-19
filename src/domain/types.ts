/**
 * Contrato de datos de TRAZA.
 *
 * Cambios respecto al contrato propuesto en la misión 0.1 (documentados):
 *  - `TraceEventKind` añade "call" para marcar el inicio de la ejecución.
 *  - `TraceSnapshot.detail` guarda el mensaje de una excepción.
 *  - Los valores se tipan como `TraceValue` (JSON seguro) en lugar de `unknown`.
 */

/** Valor serializable. Los tipos no compatibles llegan como `{ unsupported }`. */
export type TraceValue =
  | null
  | boolean
  | number
  | string
  | TraceValue[]
  | { [key: string]: TraceValue };

export type VariableState = Record<string, TraceValue>;

export type TraceEventKind = "call" | "line" | "return" | "exception";

/** Rama observada de un `if`/`elif` (nunca se infiere solo por el número de línea). */
export type ConditionBranch = "then" | "elif" | "else" | "none";

/**
 * Resultado real de una condición `if`/`elif`, registrado al evaluarla.
 *
 * `branch` y `branchLine` se determinan comparando la siguiente línea observada
 * con los rangos reales del AST. Si no puede determinarse con seguridad, `branch`
 * vale "none" y no se inventa una rama.
 */
export interface TraceCondition {
  id: string;
  line: number;
  expression: string;
  result: boolean;
  hasElse: boolean;
  branch: ConditionBranch;
  branchLine?: number;
  /** Rama que con seguridad NO se ejecutó, si puede determinarse. */
  notExecuted?: "then" | "else";
}

export interface TraceSnapshot {
  /** Orden del evento: 0, 1, 2… sin huecos. */
  sequence: number;
  /** Línea del código original (1 = primera). 0 solo en el evento "call". */
  line: number;
  event: TraceEventKind;
  /** Iteración del bucle a la que pertenece la instrucción (desde 1). */
  iteration?: number;
  /** Estado observado ANTES de ejecutar la instrucción (locales del marco). */
  before: VariableState;
  /**
   * Estado observado DESPUÉS de la instrucción (al llegar el siguiente evento).
   * Ausente en "call" y "return". En "line" que terminó en excepción es el
   * estado en el momento del fallo.
   */
  after?: VariableState;
  detail?: string;

  // --- Marco de ejecución (0.8.0; opcionales para trazas antiguas) ---------
  /** "<module>" en el programa o el nombre de la función propia. */
  function?: string;
  /** "program" en el evento inicial; "function" al entrar a una función. */
  callType?: "program" | "function";
  /** Profundidad de llamada: 0 = módulo, 1 = primera función, etc. */
  depth?: number;
  /** Identificador estable de la llamada (1 = programa). */
  callId?: number;
  scope?: "module" | "function";
  /** Variables globales observadas en marcos de función. */
  globals?: VariableState;
  /** Valor devuelto por una función propia (evento "return"). */
  returnValue?: TraceValue;
  /** Condición evaluada por la instrucción, si la hay. */
  condition?: TraceCondition;
}

export interface ExecutionResult {
  success: boolean;
  output: string;
  snapshots: TraceSnapshot[];
  error?: string;
  errorKind?: ProgramErrorKind;
  errorLine?: number;
  /** Tiempo total medido en el Worker (incluye el seguimiento). */
  durationMs: number;
}

export type ProgramErrorKind = "syntax" | "unsupported" | "runtime" | "resource";

export interface StudentPrediction {
  expectedOutput: string;
  expectedVariables: Record<string, number>;
  /** Valores que se esperan para cada variable al terminar cada iteración. */
  expectedVariableValues: Record<string, number[]>;
  /** Números de iteración que el estudiante espera ver (p. ej. [1, 2, 3]). */
  expectedIterations: number[];
  /** 0–100. */
  confidence: number;
  explanation: string;
}

export type Prediction = StudentPrediction;

export type EngineStatus = "idle" | "loading" | "ready" | "running" | "success" | "error";
