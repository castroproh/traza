/**
 * Metadatos pedagógicos de los ejercicios del recorrido PACT.
 *
 * El código ejecutable vive en `src/domain/exercises.ts` (lista blanca del
 * Worker). Aquí se declara qué pregunta se hace antes de ejecutar y cómo se
 * compara la predicción con la salida real. No se muestran respuestas antes de
 * que el estudiante envíe su predicción.
 */

import type { DiagnosisPatternId } from "../diagnosis/hypotheses";
import type { PactExerciseId } from "../exercises";

export type AnswerFormat = "numbers" | "text";

export interface PactExerciseDefinition {
  exerciseId: PactExerciseId;
  patternId: DiagnosisPatternId;
  kind: "main" | "transfer";
  title: string;
  purpose: string;
  predictionQuestion: string;
  /** "numbers": se extraen los números y se comparan en orden. */
  answerFormat: AnswerFormat;
  /** Respuesta canónica que se usa en pruebas y validación (no se muestra antes). */
  expectedPrediction: string;
  /** Variables cuyo valor final se le pide al estudiante (opcional). */
  variablesToPredict: readonly string[];
  /** Valores finales reales, para validación interna y pruebas. */
  expectedVariables: Readonly<Record<string, number>>;
  expectedIterations: readonly number[];
  explanationPrompt: string;
}

export const PACT_EXERCISES: readonly PactExerciseDefinition[] = [
  {
    exerciseId: "range-principal",
    patternId: "RANGE",
    kind: "main",
    title: "El límite de range()",
    purpose:
      "Observa qué números genera un rango y compáralos con tu predicción antes de ejecutar.",
    predictionQuestion: "¿Qué números se imprimen, en orden?",
    answerFormat: "numbers",
    expectedPrediction: "2, 3, 4, 5",
    variablesToPredict: ["numero"],
    expectedVariables: { numero: 5 },
    expectedIterations: [1, 2, 3, 4],
    explanationPrompt: "¿Por qué crees que se imprimen esos números y no otros?",
  },
  {
    exerciseId: "suma-1-3",
    patternId: "ACUMULADORES",
    kind: "main",
    title: "Acumular dentro de un bucle",
    purpose:
      "Predice el total que produce el acumulador y compáralo con la ejecución real.",
    predictionQuestion: "¿Qué valor se imprime al final?",
    answerFormat: "numbers",
    expectedPrediction: "6",
    variablesToPredict: ["total", "numero"],
    expectedVariables: { total: 6, numero: 3 },
    expectedIterations: [1, 2, 3],
    explanationPrompt: "¿Cómo cambia el valor de total en cada iteración?",
  },
  {
    exerciseId: "range-transferencia",
    patternId: "RANGE",
    kind: "transfer",
    title: "Transferencia: numerar páginas",
    purpose:
      "Aplica lo que aprendiste sobre el límite superior de range() en un ejercicio con otro contexto y otros valores.",
    predictionQuestion:
      "El programa numera páginas desde 5 y usa range(5, 9). ¿Qué números de página se imprimen?",
    answerFormat: "numbers",
    expectedPrediction: "5, 6, 7, 8",
    variablesToPredict: ["pagina"],
    expectedVariables: { pagina: 8 },
    expectedIterations: [1, 2, 3, 4],
    explanationPrompt: "Explica cómo decidiste el último número de página.",
  },
  {
    exerciseId: "acumuladores-transferencia",
    patternId: "ACUMULADORES",
    kind: "transfer",
    title: "Transferencia: ahorro mensual",
    purpose:
      "Aplica la conservación del acumulador en un contexto distinto, con un valor inicial y una operación diferente.",
    predictionQuestion:
      "El ahorro empieza en 50 y cada mes suma 10, 20, 30 y 40. ¿Qué valores se imprimen, en orden?",
    answerFormat: "numbers",
    expectedPrediction: "60, 80, 110, 150",
    variablesToPredict: ["ahorro", "mes"],
    expectedVariables: { ahorro: 150, mes: 4 },
    expectedIterations: [1, 2, 3, 4],
    explanationPrompt: "¿Cómo se conserva el ahorro anterior al sumar el nuevo importe?",
  },
  {
    exerciseId: "condicionales-principal",
    patternId: "CONDICIONALES",
    kind: "main",
    title: "El operador and en una decisión",
    purpose:
      "Predice qué rama se ejecuta cuando una condición exige que dos partes sean verdaderas.",
    predictionQuestion: "¿Qué mensaje se imprime?",
    answerFormat: "text",
    expectedPrediction: "no puede conducir",
    variablesToPredict: [],
    expectedVariables: {},
    expectedIterations: [],
    explanationPrompt: "¿Qué parte de la condición decidió la rama que se ejecutó?",
  },
  {
    exerciseId: "condicionales-transferencia",
    patternId: "CONDICIONALES",
    kind: "transfer",
    title: "Transferencia: el operador or en una decisión",
    purpose:
      "Aplica la semántica de or en otro contexto, con valores distintos y una condición compuesta.",
    predictionQuestion:
      "La actividad se cancela si la temperatura supera 35 o si llueve. ¿Qué mensaje se imprime?",
    answerFormat: "text",
    expectedPrediction: "realizar",
    variablesToPredict: [],
    expectedVariables: {},
    expectedIterations: [],
    explanationPrompt: "¿Bastaba una de las dos condiciones para cancelar? Explica por qué.",
  },
  {
    exerciseId: "funciones-principal",
    patternId: "FUNCIONES",
    kind: "main",
    title: "Return frente a print",
    purpose:
      "Predice qué valor devuelve una función y cómo se usa después de la llamada.",
    predictionQuestion: "¿Qué número se imprime al final?",
    answerFormat: "numbers",
    expectedPrediction: "20",
    variablesToPredict: ["resultado"],
    expectedVariables: { resultado: 20 },
    expectedIterations: [],
    explanationPrompt: "¿Qué diferencia hay entre lo que la función devuelve y lo que se imprime?",
  },
  {
    exerciseId: "funciones-transferencia",
    patternId: "FUNCIONES",
    kind: "transfer",
    title: "Transferencia: parámetros y ámbito local",
    purpose:
      "Aplica el paso de argumentos y el ámbito local en una función que devuelve una cadena.",
    predictionQuestion:
      "La función recibe «Ana» y construye un saludo. ¿Qué mensaje se imprime?",
    answerFormat: "text",
    expectedPrediction: "Hola, Ana",
    variablesToPredict: [],
    expectedVariables: {},
    expectedIterations: [],
    explanationPrompt: "¿Qué valor recibe el parámetro y qué ocurre con las variables locales?",
  },
];

const BY_ID = new Map(PACT_EXERCISES.map((exercise) => [exercise.exerciseId, exercise]));

export function pactExerciseById(id: string): PactExerciseDefinition | undefined {
  return BY_ID.get(id as PactExerciseId);
}

export function mainExerciseFor(patternId: DiagnosisPatternId): PactExerciseDefinition {
  const found = PACT_EXERCISES.find(
    (exercise) => exercise.patternId === patternId && exercise.kind === "main",
  );
  if (!found) throw new Error(`No hay ejercicio principal para el patrón ${patternId}.`);
  return found;
}

export function transferExerciseFor(patternId: DiagnosisPatternId): PactExerciseDefinition {
  const found = PACT_EXERCISES.find(
    (exercise) => exercise.patternId === patternId && exercise.kind === "transfer",
  );
  if (!found) throw new Error(`No hay ejercicio de transferencia para el patrón ${patternId}.`);
  return found;
}
