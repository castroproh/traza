/**
 * Modelo de hipótesis diagnósticas de TRAZA (misión 0.6.0).
 *
 * Una hipótesis diagnóstica NO es una opinión del sistema: es una explicación
 * alternativa sobre el razonamiento del estudiante, que la evidencia de las
 * micropruebas puede apoyar, contradecir o dejar insuficiente.
 *
 * Reglas de diseño que este modelo debe respetar:
 *  - Una respuesta incorrecta NO se convierte automáticamente en evidencia de una
 *    concepción erróña (puede ser un error de cálculo, un fallo de lectura, etc.).
 *  - Una respuesta correcta NO se interpreta como demostración definitiva de
 *    comprensión (es evidencia a favor, nunca una sentencia de dominio consolidado).
 */

/** Estado de la evidencia frente a una hipótesis concreta. */
export type EvidenceState = "supports" | "insufficient" | "contradicts";

/** Estado resultante de un patrón tras evaluar todas sus evidencias. */
export type EvidenceStatus = "supported" | "contradicted" | "insufficient";

export interface MisconceptionPattern {
  id: string;
  name: string;
  concept: string;
  description: string;
}

export interface MisconceptionHypothesis {
  /** Identificador estable, p. ej. "H-RANGE-01". */
  id: string;
  patternId: string;
  title: string;
  description: string;
  /** Comportamiento esperado del estudiante si la hipótesis fuera cierta. */
  expectedBehavior: string;
  /** Respuestas (predicciones) que la hipótesis atribuye al estudiante. */
  expectedResponses: readonly string[];
  supportingEvidence: readonly string[];
  contradictingEvidence: readonly string[];
  /** Explicaciones alternativas del mismo fenómeno. */
  alternatives: readonly string[];
  limitations: readonly string[];
  /**
   * `true` cuando la hipótesis describe la concepción normativa (correcta).
   * Una respuesta correcta puede apoyarla. Las hipótesis no normativas solo
   * reciben apoyo cuando su predicción específica es incorrecta y coincide con
   * la respuesta; si predicen el resultado correcto, la evidencia queda
   * insuficiente (la respuesta es compatible pero no distintiva).
   */
  normative?: boolean;
}

/** Evaluación de una respuesta observada contra una hipótesis concreta. */
export interface EvidenceEvaluation {
  hypothesisId: string;
  patternId: string;
  microtestId: string;
  state: EvidenceState;
  observedResponse: string;
  predictedResponses: readonly string[];
  /** Por qué se asignó el estado (auditable, sin ambigüedad narrativa). */
  reason: string;
}

/** Par de hipótesis rivales dentro de un patrón. */
export interface DiscriminationPair {
  patternId: string;
  hypothesisAId: string;
  hypothesisBId: string;
  /** Micropruebas que discriminan a la pareja. */
  discriminatingMicrotests: readonly string[];
  /** microtestId -> hipótesis -> respuestas predichas por la hipótesis. */
  predictions: Record<string, Record<string, readonly string[]>>;
  /** microtestId -> respuestas que deben interpretarse como ambiguas. */
  ambiguousResponses: Record<string, readonly string[]>;
  /** Condición a partir de la cual se considera que la evidencia es suficiente. */
  insufficientWhen: string;
}

export interface DiscriminationMatrix {
  patternId: string;
  pairs: readonly DiscriminationPair[];
}

export const PATTERNS: readonly MisconceptionPattern[] = [
  {
    id: "RANGE",
    name: "Límite superior de range()",
    concept: "range(inicio, fin) excluye el límite superior.",
    description: "El estudiante distingue la semántica de exclusión del límite superior de range().",
  },
  {
    id: "ACUMULADORES",
    name: "Acumulación de estado",
    concept: "El valor anterior del acumulador se conserva y se actualiza mediante una operación acumulativa.",
    description: "El estudiante distingue la acumulación real de la sustitución del valor anterior.",
  },
  {
    id: "CONDICIONALES",
    name: "Evaluación de condiciones",
    concept: "and exige que ambas partes sean verdaderas; or exige que al menos una lo sea; not invierte el valor.",
    description: "El estudiante distingue la semántica de and, or y not al elegir una rama.",
  },
  {
    id: "FUNCIONES",
    name: "Funciones, parámetros y ámbito",
    concept: "Una función devuelve un valor con return, recibe argumentos en sus parámetros y sus locales no persisten fuera.",
    description: "El estudiante distingue return de print, el paso de argumentos y el ámbito local.",
  },
];

export const PATTERN_IDS = ["RANGE", "ACUMULADORES", "CONDICIONALES", "FUNCIONES"] as const;
export type DiagnosisPatternId = (typeof PATTERN_IDS)[number];

export function isDiagnosisPatternId(value: unknown): value is DiagnosisPatternId {
  return typeof value === "string" && (PATTERN_IDS as readonly string[]).includes(value);
}

export const HYPOTHESES: readonly MisconceptionHypothesis[] = [
  {
    id: "H-RANGE-01",
    patternId: "RANGE",
    title: "Límite superior inclusive",
    description: "El estudiante espera que el segundo argumento de range() también se incluya.",
    expectedBehavior: "Cree que la secuencia incluye el valor final del rango.",
    expectedResponses: ["1, 2, 3, 4"],
    supportingEvidence: ["Predicciones consistentes con secuencias que incluyen el límite final."],
    contradictingEvidence: [
      "Cuando el estudiante predice correctamente el resultado de un rango, la hipótesis queda en contradicción.",
    ],
    alternatives: ["Confusión entre índice y valor (range(i, j) genera valores, no índices)."],
    limitations: ["No distingue todavía la causa exacta del desajuste (conceptual vs. de lectura)."],
  },
  {
    id: "H-RANGE-02",
    patternId: "RANGE",
    title: "Límite superior exclusivo",
    description: "El estudiante reconoce que el límite superior de range() se excluye.",
    expectedBehavior: "Reconoce que la secuencia termina en el valor anterior al límite final.",
    expectedResponses: ["1, 2, 3"],
    supportingEvidence: ["Predicciones consistentes con rangos de distintos valores iniciales y finales."],
    contradictingEvidence: ["Cuando el estudiante incluye el límite final, la hipótesis queda en contradicción."],
    alternatives: ["No se identificó una alternativa explicativa en esta versión."],
    limitations: ["Todavía no se evalúa si el estudiante generaliza el concepto a otros métodos."],
    normative: true,
  },
  {
    id: "H-ACC-01",
    patternId: "ACUMULADORES",
    title: "Acumulación correcta",
    description: "El estudiante comprende que el valor anterior se conserva y se actualiza acumulativamente.",
    expectedBehavior: "Mantiene el estado acumulado y lo suma sucesivamente.",
    expectedResponses: ["6", "1, 3, 6"],
    supportingEvidence: ["Predicciones con estados intermedios correctos."],
    contradictingEvidence: ["Predicciones que reemplazan el acumulador en lugar de conservarlo."],
    alternatives: ["Error de cálculo independiente de la acumulación."],
    limitations: ["No evalúa operaciones acumulativas distintas a la suma."],
    normative: true,
  },
  {
    id: "H-ACC-02",
    patternId: "ACUMULADORES",
    title: "Sustitución del acumulador",
    description: "El estudiante confunde la acumulación con reemplazar el valor anterior por el valor actual.",
    expectedBehavior: "Cada iteración sobrescribe el acumulador con el valor actual de la iteración.",
    expectedResponses: ["3", "1, 2, 3"],
    supportingEvidence: ["Predicciones de totales finales o secuencias que reflejan reemplazo."],
    contradictingEvidence: ["Predicciones que muestran conservación del valor previo."],
    alternatives: ["Desconocida: podría deberse a una confusión de semántica de asignación."],
    limitations: ["Requiere micropruebas que muestren estados intermedios."],
  },
  {
    id: "H-ACC-03",
    patternId: "ACUMULADORES",
    title: "Inicialización no incorporada",
    description: "El estudiante no incorpora el valor inicial del acumulador y cuenta como si empezara en cero.",
    expectedBehavior: "Ignora el valor inicial o lo trata como si fuera cero antes de acumular.",
    expectedResponses: ["6"],
    supportingEvidence: ["Predicciones que ignoran o malinterpretan el valor inicial."],
    contradictingEvidence: ["Predicciones que respetan el valor inicial y acumulan correctamente."],
    alternatives: ["Puede confundirse con la sustitución cuando el valor inicial es distinto de cero."],
    limitations: ["No distingue todavía si el error viene del valor inicial o de la operación."],
  },
  {
    id: "H-COND-01",
    patternId: "CONDICIONALES",
    title: "Confusión entre and y or",
    description: "El estudiante evalúa `and` como si fuera `or`: basta que una parte sea verdadera.",
    expectedBehavior: "Ejecuta la rama cuando al menos una de las dos condiciones es verdadera, aunque la otra sea falsa.",
    expectedResponses: ["Se ejecuta la rama del if", "Se imprime el mensaje del if"],
    supportingEvidence: ["Predicciones que ejecutan una rama con una sola parte verdadera en una condición con and."],
    contradictingEvidence: ["Predicciones que respetan que and exige ambas partes verdaderas."],
    alternatives: ["Lectura parcial de la condición o error de cálculo en los valores comparados."],
    limitations: ["No distingue si la confusión es conceptual o un desliz de lectura en una prueba concreta."],
  },
  {
    id: "H-COND-02",
    patternId: "CONDICIONALES",
    title: "Confusión entre or y and",
    description: "El estudiante evalúa `or` como si fuera `and`: exige que ambas partes sean verdaderas.",
    expectedBehavior: "No ejecuta la rama de un `or` cuando solo una parte es verdadera.",
    expectedResponses: ["No se ejecuta la rama del if", "Se imprime el mensaje del else"],
    supportingEvidence: ["Predicciones que exigen ambas partes verdaderas en una condición con or."],
    contradictingEvidence: ["Predicciones que respetan que or se satisface con una sola parte verdadera."],
    alternatives: ["Confusión con la exigencia de que ambas condiciones sean ciertas por seguridad."],
    limitations: ["No evalúa el orden de evaluación ni los cortocircuitos con efectos secundarios."],
  },
  {
    id: "H-COND-03",
    patternId: "CONDICIONALES",
    title: "Interpretación de not",
    description: "El estudiante invierte o ignora el efecto de `not` al decidir la rama.",
    expectedBehavior: "Elige la rama contraria a la que produce la negación real.",
    expectedResponses: ["Se ejecuta la rama contraria", "Se imprime el mensaje opuesto"],
    supportingEvidence: ["Predicciones que tratan `not` como si no estuviera o como una doble negación."],
    contradictingEvidence: ["Predicciones que invierten correctamente el valor de la condición."],
    alternatives: ["Confusión entre `not` y `!=` en una comparación concreta."],
    limitations: ["No distingue entre ignorar `not` e invertirlo dos veces; ambas producen el mismo resultado en una prueba binaria."],
  },
  {
    id: "H-FUNC-01",
    patternId: "FUNCIONES",
    title: "Confusión entre return y print",
    description: "El estudiante cree que imprimir dentro de una función equivale a devolver un valor, o que return no produce un valor utilizable.",
    expectedBehavior: "Espera que el valor impreso por la función sea también su valor devuelto, o que print(funcion()) no muestre nada.",
    expectedResponses: ["El valor impreso se reutiliza como resultado", "None", "No se imprime nada"],
    supportingEvidence: ["Predicciones que igualan la salida de print con el valor de return."],
    contradictingEvidence: ["Predicciones que separan la salida impresa del valor devuelto."],
    alternatives: ["Confusión entre el efecto observable (salida) y el valor que la función entrega."],
    limitations: ["No mide si el estudiante comprende return en funciones sin print."],
  },
  {
    id: "H-FUNC-02",
    patternId: "FUNCIONES",
    title: "Confusión entre parámetros y argumentos",
    description: "El estudiante confunde el nombre del parámetro con el valor del argumento, o invierte el orden de los argumentos.",
    expectedBehavior: "Usa el nombre del parámetro como valor, intercambia argumentos o espera que el nombre de la variable llamadora se use dentro.",
    expectedResponses: ["Se usa el nombre del parámetro como texto", "El resultado se calcula con los argumentos invertidos"],
    supportingEvidence: ["Predicciones que sustituyen el valor del argumento por el nombre del parámetro o cambian su orden."],
    contradictingEvidence: ["Predicciones que asignan cada argumento a su parámetro en el orden correcto."],
    alternatives: ["Confusión entre el nombre de la variable y el valor que contiene."],
    limitations: ["No evalúa argumentos por nombre ni valores por defecto en esta versión."],
  },
  {
    id: "H-FUNC-03",
    patternId: "FUNCIONES",
    title: "Alcance local no reconocido",
    description: "El estudiante espera que las variables locales de una función sigan existiendo fuera de ella o que modifiquen variables globales.",
    expectedBehavior: "Usa una variable local después de la llamada o espera que reasignar un parámetro cambie la variable del llamador.",
    expectedResponses: ["La variable local conserva su valor fuera de la función", "La variable global cambia"],
    supportingEvidence: ["Predicciones que consultan locales fuera del marco o que esperan mutación del llamador."],
    contradictingEvidence: ["Predicciones que reconocen que los locales dejan de existir al terminar la función."],
    alternatives: ["Confusión entre el ámbito de una función y el orden de ejecución del programa."],
    limitations: ["No evalúa closures, variables globales declaradas con global ni objetos mutables compartidos."],
  },
];

const HYPOTHESIS_MAP: ReadonlyMap<string, MisconceptionHypothesis> = new Map(
  HYPOTHESES.map((h) => [h.id, h]),
);

export const HYPOTHESIS_IDS: readonly string[] = HYPOTHESES.map((h) => h.id);

export function isHypothesisId(value: unknown): value is string {
  return typeof value === "string" && HYPOTHESIS_MAP.has(value);
}

export function hypothesisById(id: string): MisconceptionHypothesis | undefined {
  return HYPOTHESIS_MAP.get(id);
}

export function patternHypotheses(patternId: string): MisconceptionHypothesis[] {
  return HYPOTHESES.filter((h) => h.patternId === patternId);
}

export function isPatternId(value: unknown): value is string {
  return typeof value === "string" && PATTERNS.some((p) => p.id === value);
}
