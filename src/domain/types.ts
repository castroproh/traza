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

export interface TraceSnapshot {
  /** Orden del evento: 0, 1, 2… sin huecos. */
  sequence: number;
  /** Línea del código original (1 = primera). 0 solo en el evento "call". */
  line: number;
  event: TraceEventKind;
  /** Iteración del bucle a la que pertenece la instrucción (desde 1). */
  iteration?: number;
  /** Estado observado ANTES de ejecutar la instrucción. */
  before: VariableState;
  /**
   * Estado observado DESPUÉS de la instrucción (al llegar el siguiente evento).
   * Ausente en "call" y "return". En "line" que terminó en excepción es el
   * estado en el momento del fallo.
   */
  after?: VariableState;
  detail?: string;
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
