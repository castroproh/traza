/**
 * Banco de micropruebas diagnósticas de TRAZA (misión 0.6.0).
 *
 * Objetivo inicial: 6 micropruebas para el patrón RANGE() y 6 para el patrón
 * ACUMULADORES. Cada microprueba evalúa un objetivo identificable y está diseñada
 * para separar hipótesis rivales mediante respuestas predichas.
 *
 * Reglas de authoring que se respetan en este banco:
 *  - No se repite el mismo ejercicio con otros valores: cada microprueba cambia
 *    el valor inicial, el límite final, el punto de partida o la forma de la
 *    pregunta, sin cambiar el concepto evaluado.
 *  - Las respuestas ambiguas producen evidencia insuficiente (no se asigna
 *    apoyo ni contradicción).
 */

import { isHypothesisId } from "./hypotheses";

export type MicrotestDifficulty = "beginner" | "intermediate";
export type MicrotestAnswerFormat = "numbers" | "text";

/** Infiere el formato de respuesta a partir de la salida esperada. */
export function inferAnswerFormat(expectedOutcome: string): MicrotestAnswerFormat {
  return /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(expectedOutcome) ? "text" : "numbers";
}

export interface DiagnosticMicrotest {
  /** Identificador estable, p. ej. "range-iteracion-01". */
  id: string;
  /** Versión del contenido de la microprueba (para trazabilidad editorial). */
  version: number;
  patternId: string;
  /** Hipótesis que esta microprueba pretende distinguir. */
  targetHypotheses: readonly string[];
  objective: string;
  code: string;
  /** Pregunta de predicción que se le hace al estudiante. */
  predictionQuestion: string;
  /** Respuestas previstas por hipótesis: microtestId -> hipótesis -> respuesta predicha. */
  responseSignatures: Record<string, readonly string[]>;
  /** Respuesta correcta de la ejecución / predicción esperada. */
  expectedOutcome: string;
  /** Cómo comparar y presentar la respuesta (números o texto). */
  answerFormat: MicrotestAnswerFormat;
  interpretationRule: string;
  explanation: string;
  difficulty: MicrotestDifficulty;
  ambiguityCases: readonly string[];
  prerequisites: readonly string[];
}

const RANGE_CODE = [
  "for numero in range(1, 4):",
  "    print(numero)",
].join("\n");

const ACC_FINAL_CODE = [
  "total = 0",
  "for numero in range(1, 4):",
  "    total = total + numero",
  "print(total)",
].join("\n");

const ACC_SEQUENCE_CODE = [
  "total = 0",
  "for numero in range(1, 4):",
  "    total = total + numero",
  "    print(total)",
].join("\n");

const ACC_INICIAL_CODE = [
  "total = 10",
  "for numero in range(1, 4):",
  "    total = total + numero",
  "print(total)",
].join("\n");

const ACC_IMPRIME_CODE = [
  "total = 0",
  "for numero in range(2, 5):",
  "    total = total + numero",
  "    print(total)",
].join("\n");

const ACC_GENERAL_CODE = [
  "total = 0",
  "for numero in range(1, 6):",
  "    total = total + numero",
  "    print(total)",
].join("\n");

const ACC_PARCIAL_CODE = [
  "total = 100",
  "for numero in range(2, 5):",
  "    total = total + numero",
  "    print(total)",
].join("\n");

function microtest(input: {
  id: string;
  version?: number;
  patternId: string;
  targetHypotheses: readonly string[];
  objective: string;
  code: string;
  predictionQuestion: string;
  responses: Record<string, readonly string[]>;
  expectedOutcome: string;
  answerFormat?: MicrotestAnswerFormat;
  interpretationRule: string;
  explanation: string;
  difficulty?: MicrotestDifficulty;
  ambiguityCases?: readonly string[];
  prerequisites?: readonly string[];
}): DiagnosticMicrotest {
  const target = input.targetHypotheses.filter((h) => isHypothesisId(h));
  const signatures: Record<string, readonly string[]> = {};
  for (const h of target) {
    const predicted = input.responses[h] ?? [];
    if (predicted.length === 0) {
      throw new Error(`Microprueba ${input.id}: la hipótesis ${h} no tiene respuestas previstas.`);
    }
    signatures[h] = predicted;
  }
  return {
    id: input.id,
    version: input.version ?? 1,
    patternId: input.patternId,
    targetHypotheses: [...target],
    objective: input.objective,
    code: input.code,
    predictionQuestion: input.predictionQuestion,
    responseSignatures: signatures,
    expectedOutcome: input.expectedOutcome,
    answerFormat: input.answerFormat ?? inferAnswerFormat(input.expectedOutcome),
    interpretationRule: input.interpretationRule,
    explanation: input.explanation,
    difficulty: input.difficulty ?? "beginner",
    ambiguityCases: input.ambiguityCases ?? [],
    prerequisites: input.prerequisites ?? [],
  };
}

export const MICROTESTS: readonly DiagnosticMicrotest[] = [
  // ---------------------------------------------------------------- RANGE ---
  microtest({
    id: "range-iteracion-01",
    patternId: "RANGE",
    targetHypotheses: ["H-RANGE-01", "H-RANGE-02"],
    objective: "Predecir qué valores genera range(1, 4) y en qué posición de la secuencia aparecen.",
    code: RANGE_CODE,
    predictionQuestion: "¿Cuántos números itera range(1, 4) y cuáles son?",
    responses: {
      "H-RANGE-01": ["1, 2, 3, 4"],
      "H-RANGE-02": ["1, 2, 3"],
    },
    expectedOutcome: "1, 2, 3",
    interpretationRule:
      "Si la respuesta coincide con la predicción de una hipótesis, esa hipótesis queda en 'apoya'. Si coincide con el resultado correcto y la hipótesis predice otra cosa, la hipótesis queda en 'contradice'.",
    explanation:
      "Con range(1, 4) la secuencia correcta es 1, 2, 3: el límite final (4) se excluye. Una interpretación inclusive predice 1, 2, 3, 4.",
    difficulty: "beginner",
    ambiguityCases: ["del 1 al 3"],
    prerequisites: ["Conocer la sintaxis básica de range()."],
  }),
  microtest({
    id: "range-cero-01",
    patternId: "RANGE",
    targetHypotheses: ["H-RANGE-01", "H-RANGE-02"],
    objective: "Predecir la secuencia de un rango que comienza en cero.",
    code: [
      "for numero in range(0, 3):",
      "    print(numero)",
    ].join("\n"),
    predictionQuestion: "¿Qué números imprime range(0, 3)?",
    responses: {
      "H-RANGE-01": ["0, 1, 2, 3"],
      "H-RANGE-02": ["0, 1, 2"],
    },
    expectedOutcome: "0, 1, 2",
    interpretationRule:
      "Si la respuesta coincide con la predicción de una hipótesis, esa hipótesis queda en 'apoya'. Si coincide con el resultado correcto y la hipótesis predice otra cosa, la hipótesis queda en 'contradice'.",
    explanation:
      "El cero es un valor válido de inicio; la exclusión aplica al límite final, no al inicial. La secuencia correcta es 0, 1, 2.",
    difficulty: "beginner",
  }),
  microtest({
    id: "range-valor-inicial-01",
    patternId: "RANGE",
    targetHypotheses: ["H-RANGE-01", "H-RANGE-02"],
    objective: "Predecir la secuencia cuando el valor inicial y el límite final son distintos de los ejemplos anteriores.",
    code: [
      "for numero in range(2, 5):",
      "    print(numero)",
    ].join("\n"),
    predictionQuestion: "¿Qué números genera range(2, 5)?",
    responses: {
      "H-RANGE-01": ["2, 3, 4, 5"],
      "H-RANGE-02": ["2, 3, 4"],
    },
    expectedOutcome: "2, 3, 4",
    interpretationRule:
      "Si la respuesta coincide con la predicción de una hipótesis, esa hipótesis queda en 'apoya'. Si coincide con el resultado correcto y la hipótesis predice otra cosa, la hipótesis queda en 'contradice'.",
    explanation:
      "La variación de valores no debe cambiar el concepto: el límite final (5) se excluye aunque el inicio sea 2.",
    difficulty: "beginner",
  }),
  microtest({
    id: "range-pequeno-01",
    patternId: "RANGE",
    targetHypotheses: ["H-RANGE-01", "H-RANGE-02"],
    objective: "Predecir la secuencia de un rango de longitud pequeña.",
    code: [
      "for numero in range(0, 2):",
      "    print(numero)",
    ].join("\n"),
    predictionQuestion: "¿Qué números genera range(0, 2)?",
    responses: {
      "H-RANGE-01": ["0, 1, 2"],
      "H-RANGE-02": ["0, 1"],
    },
    expectedOutcome: "0, 1",
    interpretationRule:
      "Si la respuesta coincide con la predicción de una hipótesis, esa hipótesis queda en 'apoya'. Si coincide con el resultado correcto y la hipótesis predice otra cosa, la hipótesis queda en 'contradice'.",
    explanation:
      "Con rangos cortos la diferencia entre incluir o excluir el límite final es muy visible; aquí la secuencia correcta es 0, 1.",
    difficulty: "beginner",
  }),
  microtest({
    id: "range-tabla-01",
    patternId: "RANGE",
    targetHypotheses: ["H-RANGE-01", "H-RANGE-02"],
    objective: "Interpretar una tabla de iteraciones construida a partir de un rango.",
    code: [
      "for numero in range(1, 4):",
      "    print(numero)",
    ].join("\n"),
    predictionQuestion: "Completa la tabla de iteraciones: ¿qué números aparecen?",
    responses: {
      "H-RANGE-01": ["1, 2, 3, 4"],
      "H-RANGE-02": ["1, 2, 3"],
    },
    expectedOutcome: "1, 2, 3",
    interpretationRule:
      "Si la respuesta coincide con la predicción de una hipótesis, esa hipótesis queda en 'apoya'. Si coincide con el resultado correcto y la hipótesis predice otra cosa, la hipótesis queda en 'contradice'.",
    explanation:
      "La tabla debe reflejar que el límite final no se genera. Una fila extra con el valor final del rango delata una interpretación inclusive.",
    difficulty: "intermediate",
    ambiguityCases: ["del 1 al 3"],
    prerequisites: ["Comprender qué es una iteración de un bucle."],
  }),
  microtest({
    id: "range-negativo-01",
    patternId: "RANGE",
    targetHypotheses: ["H-RANGE-01", "H-RANGE-02"],
    objective: "Predecir la secuencia de un rango con valores negativos.",
    code: [
      "for numero in range(-3, 2):",
      "    print(numero)",
    ].join("\n"),
    predictionQuestion: "¿Qué números genera range(-3, 2)?",
    responses: {
      "H-RANGE-01": ["-3, -2, -1, 0, 1, 2"],
      "H-RANGE-02": ["-3, -2, -1, 0, 1"],
    },
    expectedOutcome: "-3, -2, -1, 0, 1",
    interpretationRule:
      "Si la respuesta coincide con la predicción de una hipótesis, esa hipótesis queda en 'apoya'. Si coincide con el resultado correcto y la hipótesis predice otra cosa, la hipótesis queda en 'contradice'.",
    explanation:
      "Los valores negativos no cambian la regla: el límite final (2) se excluye.",
    difficulty: "beginner",
  }),
  microtest({
    id: "range-un-argumento-01",
    patternId: "RANGE",
    targetHypotheses: ["H-RANGE-01", "H-RANGE-02"],
    objective: "Comprobar si el estudiante generaliza la exclusión del límite superior a range() llamado con un solo argumento.",
    code: [
      "for numero in range(5):",
      "    print(numero)",
    ].join("\n"),
    predictionQuestion: "¿Qué números genera range(5)?",
    responses: {
      "H-RANGE-01": ["0, 1, 2, 3, 4, 5"],
      "H-RANGE-02": ["0, 1, 2, 3, 4"],
    },
    expectedOutcome: "0, 1, 2, 3, 4",
    interpretationRule:
      "Si la respuesta coincide con la predicción de una hipótesis, esa hipótesis queda en 'apoya'. Si coincide con el resultado correcto y la hipótesis predice otra cosa, la hipótesis queda en 'contradice'.",
    explanation:
      "Con un solo argumento, range(5) empieza en cero y se detiene antes del límite (5): 0, 1, 2, 3, 4. Una interpretación inclusive añadiría el 5.",
    difficulty: "beginner",
    ambiguityCases: ["del 0 al 4"],
    prerequisites: ["Conocer range() con un solo argumento."],
  }),

  // --------------------------------------------------------- ACUMULADORES ---
  microtest({
    id: "acc-final-01",
    patternId: "ACUMULADORES",
    targetHypotheses: ["H-ACC-01", "H-ACC-02"],
    objective: "Predecir el valor final del acumulador tras varias iteraciones.",
    code: ACC_FINAL_CODE,
    predictionQuestion: "El acumulador suma 1, 2 y 3 (partiendo en 0). ¿Cuál es el valor final?",
    responses: {
      "H-ACC-01": ["6"],
      "H-ACC-02": ["3"],
    },
    expectedOutcome: "6",
    interpretationRule:
      "Si la respuesta coincide con la predicción de una hipótesis, esa hipótesis queda en 'apoya'. Si coincide con el resultado correcto y la hipótesis predice otra cosa, la hipótesis queda en 'contradice'.",
    explanation:
      "Acumular significa conservar el parcial: 0 + 1 = 1, 1 + 2 = 3, 3 + 3 = 6. Reemplazar produciría solo el último valor (3).",
    difficulty: "beginner",
    ambiguityCases: ["No estoy seguro", "No sé"],
  }),
  microtest({
    id: "acc-secuencia-01",
    patternId: "ACUMULADORES",
    targetHypotheses: ["H-ACC-01", "H-ACC-02"],
    objective: "Predecir la secuencia de valores del acumulador durante la iteración.",
    code: ACC_SEQUENCE_CODE,
    predictionQuestion: "¿Qué valores se imprimen mientras se acumula?",
    responses: {
      "H-ACC-01": ["1, 3, 6"],
      "H-ACC-02": ["1, 2, 3"],
    },
    expectedOutcome: "1, 3, 6",
    interpretationRule:
      "Si la respuesta coincide con la predicción de una hipótesis, esa hipótesis queda en 'apoya'. Si coincide con el resultado correcto y la hipótesis predice otra cosa, la hipótesis queda en 'contradice'.",
    explanation: "La secuencia correcta muestra acumulación: cada impresión incluye el parcial anterior.",
    difficulty: "beginner",
    ambiguityCases: ["No estoy seguro", "No sé"],
  }),
  microtest({
    id: "acc-inicial-01",
    patternId: "ACUMULADORES",
    targetHypotheses: ["H-ACC-01", "H-ACC-02", "H-ACC-03"],
    objective: "Identificar el papel del valor inicial del acumulador.",
    code: ACC_INICIAL_CODE,
    predictionQuestion: "El acumulador empieza en 10 y suma 1, 2 y 3. ¿Cuál es el valor final?",
    responses: {
      "H-ACC-01": ["16"],
      "H-ACC-02": ["3"],
      "H-ACC-03": ["6"],
    },
    expectedOutcome: "16",
    interpretationRule:
      "Si la respuesta coincide con la predicción de una hipótesis, esa hipótesis queda en 'apoya'. Si coincide con el resultado correcto y la hipótesis predice otra cosa, la hipótesis queda en 'contradice'.",
    explanation:
      "Con acumulador inicial 10 el valor final es 16 (10 + 1 + 2 + 3). Ignorar el inicial (6) o reemplazar (3) son errores distintos.",
    difficulty: "beginner",
    ambiguityCases: ["El estudiante puede confundir la sustitución con la dificultad de inicialización cuando el valor inicial es distinto de cero."],
  }),
  microtest({
    id: "acc-imprime-01",
    patternId: "ACUMULADORES",
    targetHypotheses: ["H-ACC-01", "H-ACC-02"],
    objective: "Interpretar los cambios de estado observados en el acumulador.",
    code: ACC_IMPRIME_CODE,
    predictionQuestion: "El acumulador empieza en 0 y suma números de un rango. ¿Qué secuencia se imprime?",
    responses: {
      "H-ACC-01": ["2, 5, 9"],
      "H-ACC-02": ["2, 3, 4"],
    },
    expectedOutcome: "2, 5, 9",
    interpretationRule:
      "Si la respuesta coincide con la predicción de una hipótesis, esa hipótesis queda en 'apoya'. Si coincide con el resultado correcto y la hipótesis predice otra cosa, la hipótesis queda en 'contradice'.",
    explanation: "Los valores impresos deben reflejar acumulación (partials crecientes), no un reemplazo simple.",
    difficulty: "intermediate",
  }),
  microtest({
    id: "acc-general-01",
    patternId: "ACUMULADORES",
    targetHypotheses: ["H-ACC-01", "H-ACC-02"],
    objective: "Generalizar la predicción de acumulación a más iteraciones.",
    code: ACC_GENERAL_CODE,
    predictionQuestion: "El acumulador suma todos los números del 1 al 5. ¿Cuál es el valor final y la secuencia?",
    responses: {
      "H-ACC-01": ["1, 3, 6, 10, 15"],
      "H-ACC-02": ["1, 2, 3, 4, 5"],
    },
    expectedOutcome: "1, 3, 6, 10, 15",
    interpretationRule:
      "Si la respuesta coincide con la predicción de una hipótesis, esa hipótesis queda en 'apoya'. Si coincide con el resultado correcto y la hipótesis predice otra cosa, la hipótesis queda en 'contradice'.",
    explanation: "Con más iteraciones la diferencia entre reemplazar y acumular se vuelve más pronunciada.",
    difficulty: "intermediate",
  }),
  microtest({
    id: "acc-parcial-01",
    patternId: "ACUMULADORES",
    targetHypotheses: ["H-ACC-01", "H-ACC-02"],
    objective: "Predecir el valor del acumulador tras algunas iteraciones concretas.",
    code: ACC_PARCIAL_CODE,
    predictionQuestion: "El acumulador empieza en 100 y suma números del rango 2..4. ¿Qué secuencia se imprime?",
    responses: {
      "H-ACC-01": ["102, 105, 109"],
      "H-ACC-02": ["2, 3, 4"],
    },
    expectedOutcome: "102, 105, 109",
    interpretationRule:
      "Si la respuesta coincide con la predicción de una hipótesis, esa hipótesis queda en 'apoya'. Si coincide con el resultado correcto y la hipótesis predice otra cosa, la hipótesis queda en 'contradice'.",
    explanation: "Predecir un parcial (102, 105, 109) exige mantener el acumulado entre iteraciones.",
    difficulty: "intermediate",
  }),
  microtest({
    id: "acc-inicial-cero-02",
    patternId: "ACUMULADORES",
    targetHypotheses: ["H-ACC-02", "H-ACC-03"],
    objective: "Separar la sustitución del acumulador de la inicialización ignorada cuando el acumulador arranca en cero.",
    code: [
      "total = 0",
      "for numero in range(2, 5):",
      "    total = total + numero",
      "    print(total)",
    ].join("\n"),
    predictionQuestion: "El acumulador empieza en 0 y suma 2, 3 y 4 imprimiendo tras cada suma. ¿Qué secuencia se imprime?",
    responses: {
      "H-ACC-02": ["2, 3, 4"],
      "H-ACC-03": ["2, 5, 9"],
    },
    expectedOutcome: "2, 5, 9",
    interpretationRule:
      "Si la respuesta coincide con la predicción de una hipótesis, esa hipótesis queda en 'apoya'. Si la respuesta es el resultado correcto y la hipótesis predicía otra cosa, queda en 'contradice'. Si la hipótesis predicía el resultado correcto, la respuesta correcta no la apoya por sí sola (es compatible con una acumulación correcta).",
    explanation:
      "Con inicio en cero, ignorar el inicial y acumular correctamente dan la misma secuencia (2, 5, 9); solo la sustitución produce 2, 3, 4. Por eso esta prueba no distingue comprensión correcta de inicialización ignorada con inicio cero; se necesita un inicio distinto de cero (acc-inicial-01) para separarlas.",
    difficulty: "beginner",
    ambiguityCases: ["No estoy seguro", "No sé"],
    prerequisites: ["Distinguir sustitución de acumulación."],
  }),

  // ------------------------------------------------------- CONDICIONALES ---
  microtest({
    id: "cond-and-01",
    patternId: "CONDICIONALES",
    targetHypotheses: ["H-COND-01", "H-COND-02"],
    objective: "Decidir una rama con una condición and en la que solo una parte es verdadera.",
    code: [
      "edad = 20",
      "if edad >= 14 and edad <= 18:",
      '    print("adolescente")',
      "else:",
      '    print("otra etapa")',
    ].join("\n"),
    predictionQuestion: "¿Qué mensaje se imprime?",
    responses: {
      "H-COND-01": ["adolescente"],
      // Esta hipótesis solo confunde or con and; en una condición and predice
      // el resultado correcto, por lo que la respuesta correcta no la apoya.
      "H-COND-02": ["otra etapa"],
    },
    expectedOutcome: "otra etapa",
    interpretationRule:
      "Si la respuesta ejecuta la rama del if con una sola parte verdadera, apoya la confusión and/or. Si respeta que and exige ambas partes, contradice esa confusión. La respuesta correcta no apoya a la hipótesis rival que predice el mismo resultado.",
    explanation:
      "20 >= 14 es verdadero, pero 20 <= 18 es falso. Con and la condición completa es falsa y se ejecuta el else: «otra etapa».",
    difficulty: "beginner",
    ambiguityCases: ["No estoy seguro", "No sé"],
    prerequisites: ["Leer comparaciones con >= y <=.", "Conocer if/else."],
  }),
  microtest({
    id: "cond-and-02",
    patternId: "CONDICIONALES",
    targetHypotheses: ["H-COND-01", "H-COND-02"],
    objective: "Decidir una rama con dos condiciones and donde la segunda es falsa.",
    code: [
      "temperatura = 30",
      "lluvia = True",
      "if temperatura > 35 and lluvia:",
      '    print("cancelar")',
      "else:",
      '    print("realizar")',
    ].join("\n"),
    predictionQuestion: "¿Qué mensaje se imprime?",
    responses: {
      "H-COND-01": ["cancelar"],
      "H-COND-02": ["realizar"],
    },
    expectedOutcome: "realizar",
    interpretationRule:
      "La rama del if exige que ambas partes sean verdaderas. Una predicción que la ejecuta con solo lluvia verdadera apoya la confusión and/or.",
    explanation:
      "Llueve, pero la temperatura no supera 35. Como and exige las dos partes, la condición es falsa: «realizar».",
    difficulty: "beginner",
    ambiguityCases: ["No estoy seguro", "No sé"],
    prerequisites: ["Interpretar valores booleanos.", "Conocer and."],
  }),
  microtest({
    id: "cond-or-01",
    patternId: "CONDICIONALES",
    targetHypotheses: ["H-COND-02", "H-COND-01"],
    objective: "Decidir una rama con una condición or en la que solo una parte es verdadera.",
    code: [
      'dia = "sabado"',
      'if dia == "sabado" or dia == "domingo":',
      '    print("fin de semana")',
      "else:",
      '    print("dia laborable")',
    ].join("\n"),
    predictionQuestion: "¿Qué mensaje se imprime?",
    responses: {
      "H-COND-02": ["dia laborable"],
      "H-COND-01": ["fin de semana"],
    },
    expectedOutcome: "fin de semana",
    interpretationRule:
      "Si la respuesta no ejecuta la rama cuando solo una parte del or es verdadera, apoya la confusión or/and. Si reconoce que basta una parte, la contradice.",
    explanation:
      "«sabado» coincide con la primera comparación; con or no hace falta que coincida también con la segunda. Se imprime «fin de semana».",
    difficulty: "beginner",
    ambiguityCases: ["No estoy seguro", "No sé"],
    prerequisites: ["Comparar cadenas con ==.", "Conocer or."],
  }),
  microtest({
    id: "cond-or-02",
    patternId: "CONDICIONALES",
    targetHypotheses: ["H-COND-02", "H-COND-01"],
    objective: "Decidir una rama con or cuando la primera parte es verdadera y la segunda falsa.",
    code: [
      "tiene_entrada = True",
      "esta_en_lista = False",
      "if tiene_entrada or esta_en_lista:",
      '    print("puede entrar")',
      "else:",
      '    print("no puede entrar")',
    ].join("\n"),
    predictionQuestion: "¿Qué mensaje se imprime?",
    responses: {
      "H-COND-02": ["no puede entrar"],
      "H-COND-01": ["puede entrar"],
    },
    expectedOutcome: "puede entrar",
    interpretationRule:
      "Exigir ambas partes para un or es la firma de la confusión or/and. Basta una parte verdadera para ejecutar la rama.",
    explanation:
      "Tiene entrada, aunque no esté en la lista. Con or la condición es verdadera: «puede entrar».",
    difficulty: "beginner",
    ambiguityCases: ["No estoy seguro", "No sé"],
    prerequisites: ["Interpretar variables booleanas.", "Conocer or."],
  }),
  microtest({
    id: "cond-not-01",
    patternId: "CONDICIONALES",
    targetHypotheses: ["H-COND-03", "H-COND-01"],
    objective: "Decidir una rama que depende de una negación simple.",
    code: [
      "aprobado = False",
      "if not aprobado:",
      '    print("recuperar")',
      "else:",
      '    print("promocionar")',
    ].join("\n"),
    predictionQuestion: "¿Qué mensaje se imprime?",
    responses: {
      "H-COND-03": ["promocionar"],
      // Sin and/or, esta hipótesis predice el resultado correcto: no se apoya.
      "H-COND-01": ["recuperar"],
    },
    expectedOutcome: "recuperar",
    interpretationRule:
      "Si la respuesta ignora o invierte not, apoya la mala interpretación de not. Si invierte correctamente el valor, la contradice.",
    explanation:
      "aprobado es False; not False es True, así que se ejecuta la rama del if: «recuperar».",
    difficulty: "beginner",
    ambiguityCases: ["No estoy seguro", "No sé"],
    prerequisites: ["Conocer los valores True y False.", "Conocer not."],
  }),
  microtest({
    id: "cond-not-02",
    patternId: "CONDICIONALES",
    targetHypotheses: ["H-COND-03", "H-COND-02"],
    objective: "Decidir una rama con not aplicado a una comparación.",
    code: [
      "edad = 20",
      "if not (edad < 18):",
      '    print("mayor de edad")',
      "else:",
      '    print("menor de edad")',
    ].join("\n"),
    predictionQuestion: "¿Qué mensaje se imprime?",
    responses: {
      "H-COND-03": ["menor de edad"],
      "H-COND-02": ["mayor de edad"],
    },
    expectedOutcome: "mayor de edad",
    interpretationRule:
      "Ignorar not invierte la rama observada. La respuesta correcta contradice esa interpretación sin apoyar a la hipótesis neutral.",
    explanation:
      "edad < 18 es False; not False es True, de modo que se imprime «mayor de edad».",
    difficulty: "intermediate",
    ambiguityCases: ["No estoy seguro", "No sé"],
    prerequisites: ["Leer paréntesis en condiciones.", "Conocer not."],
  }),

  // ------------------------------------------------------------ FUNCIONES ---
  microtest({
    id: "func-print-01",
    patternId: "FUNCIONES",
    targetHypotheses: ["H-FUNC-01", "H-FUNC-02"],
    objective: "Distinguir lo que una función imprime de lo que devuelve.",
    code: [
      "def saludar(nombre):",
      '    print("Hola", nombre)',
      "",
      'resultado = saludar("Ana")',
      "print(resultado)",
    ].join("\n"),
    predictionQuestion: "¿Qué se imprime, en orden?",
    responses: {
      "H-FUNC-01": ["Hola Ana", "Hola Ana\nHola Ana"],
      "H-FUNC-02": ["Hola nombre\nNone"],
    },
    expectedOutcome: "Hola Ana\nNone",
    interpretationRule:
      "Si la respuesta espera que la salida de print sea también el valor devuelto, apoya la confusión return/print. Si espera None, la contradice.",
    explanation:
      "La función imprime «Hola Ana» y no tiene return, así que devuelve None. La segunda impresión muestra None.",
    difficulty: "beginner",
    ambiguityCases: ["No estoy seguro", "No sé"],
    prerequisites: ["Conocer print.", "Haber visto funciones sin return."],
  }),
  microtest({
    id: "func-param-01",
    patternId: "FUNCIONES",
    targetHypotheses: ["H-FUNC-02", "H-FUNC-01"],
    objective: "Asignar correctamente los argumentos a los parámetros por posición.",
    code: [
      "def restar(a, b):",
      "    return a - b",
      "",
      "print(restar(10, 3))",
    ].join("\n"),
    predictionQuestion: "¿Qué número se imprime?",
    responses: {
      "H-FUNC-02": ["-7"],
      "H-FUNC-01": ["None"],
    },
    expectedOutcome: "7",
    interpretationRule:
      "Si la respuesta invierte el orden de los argumentos, apoya la confusión parámetro/argumento. Si espera None, apoya la confusión return/print.",
    explanation:
      "a recibe 10 y b recibe 3; 10 - 3 = 7. Invertirlos produciría -7.",
    difficulty: "beginner",
    ambiguityCases: ["No estoy seguro", "No sé"],
    prerequisites: ["Leer la definición de una función.", "Conocer el orden de los argumentos."],
  }),
  microtest({
    id: "func-local-print-01",
    patternId: "FUNCIONES",
    targetHypotheses: ["H-FUNC-03", "H-FUNC-01"],
    objective: "Reconocer que una variable local no existe fuera de la función.",
    code: [
      "def crear():",
      "    valor = 3",
      "    print(valor)",
      "",
      "resultado = crear()",
      "print(resultado)",
      "print(valor)",
    ].join("\n"),
    predictionQuestion: "¿Qué se imprime, en orden, hasta que el programa se detiene?",
    responses: {
      "H-FUNC-03": ["3\nNone\n3"],
      "H-FUNC-01": ["3\n3"],
    },
    expectedOutcome: "3\nNone\nNameError",
    answerFormat: "text",
    interpretationRule:
      "Si la respuesta espera que valor siga existiendo, apoya la hipótesis de ámbito local no reconocido. Si espera un NameError, la contradice.",
    explanation:
      "valor es local a crear() y deja de existir al terminar. La función sin return devuelve None; el último print provoca NameError.",
    difficulty: "intermediate",
    ambiguityCases: ["No estoy seguro", "No sé"],
    prerequisites: ["Distinguir locales de globales.", "Conocer NameError."],
  }),
  microtest({
    id: "func-local-param-01",
    patternId: "FUNCIONES",
    targetHypotheses: ["H-FUNC-03", "H-FUNC-02"],
    objective: "Comprobar que reasignar un parámetro no modifica la variable del llamador.",
    code: [
      "def cambiar(valor):",
      '    valor = "local"',
      "    print(valor)",
      "",
      'mensaje = "global"',
      "cambiar(mensaje)",
      "print(mensaje)",
    ].join("\n"),
    predictionQuestion: "¿Qué se imprime, en orden?",
    responses: {
      "H-FUNC-03": ["local\nlocal"],
      "H-FUNC-02": ["mensaje\nglobal"],
    },
    expectedOutcome: "local\nglobal",
    interpretationRule:
      "Esperar que el cambio del parámetro altere la variable externa apoya la hipótesis de ámbito. Usar el nombre del parámetro como valor apoya la confusión parámetro/argumento.",
    explanation:
      "El parámetro valor es una variable local; asignarle «local» no cambia mensaje, que sigue siendo «global».",
    difficulty: "intermediate",
    ambiguityCases: ["No estoy seguro", "No sé"],
    prerequisites: ["Distinguir parámetro de argumento.", "Conocer el paso por asignación."],
  }),
  microtest({
    id: "func-return-02",
    patternId: "FUNCIONES",
    targetHypotheses: ["H-FUNC-02", "H-FUNC-01"],
    objective: "Reutilizar el valor devuelto por una función en una expresión.",
    code: [
      "def sumar_uno(numero):",
      "    numero = numero + 1",
      "    return numero",
      "",
      "valor = 10",
      "nuevo = sumar_uno(valor)",
      "print(valor)",
      "print(nuevo)",
    ].join("\n"),
    predictionQuestion: "¿Qué se imprime, en orden?",
    responses: {
      "H-FUNC-02": ["11\n11"],
      "H-FUNC-01": ["10\nNone"],
    },
    expectedOutcome: "10\n11",
    interpretationRule:
      "Esperar que el argumento original cambie apoya la confusión entre parámetro y variable externa. Esperar None apoya la confusión return/print.",
    explanation:
      "sumar_uno recibe el valor 10 y devuelve 11, pero la variable valor del llamador sigue siendo 10.",
    difficulty: "intermediate",
    ambiguityCases: ["No estoy seguro", "No sé"],
    prerequisites: ["Asignar el resultado de una llamada.", "Conocer return."],
  }),
  microtest({
    id: "func-scope-02",
    patternId: "FUNCIONES",
    targetHypotheses: ["H-FUNC-03", "H-FUNC-02"],
    objective: "Distinguir una variable global de una variable local con el mismo nombre.",
    code: [
      'mensaje = "global"',
      "",
      "def mostrar():",
      '    mensaje = "local"',
      "    print(mensaje)",
      "",
      "mostrar()",
      "print(mensaje)",
    ].join("\n"),
    predictionQuestion: "¿Qué se imprime, en orden?",
    responses: {
      "H-FUNC-03": ["local\nlocal"],
      "H-FUNC-02": ["global\nglobal"],
    },
    expectedOutcome: "local\nglobal",
    interpretationRule:
      "Esperar que la asignación local cambie la global apoya la hipótesis de ámbito. Ignorar la asignación local y usar la global dentro de la función apoya la confusión de nombres.",
    explanation:
      "Dentro de mostrar(), mensaje es una variable local distinta de la global. Se imprime «local» y después «global».",
    difficulty: "intermediate",
    ambiguityCases: ["No estoy seguro", "No sé"],
    prerequisites: ["Distinguir ámbito local y global.", "Conocer el orden de ejecución."],
  }),
];

const MICROTEST_MAP: ReadonlyMap<string, DiagnosticMicrotest> = new Map(
  MICROTESTS.map((m) => [m.id, m]),
);

export const MICROTEST_IDS: readonly string[] = MICROTESTS.map((m) => m.id);

export function isDiagnosticMicrotestId(value: unknown): value is string {
  return typeof value === "string" && MICROTEST_MAP.has(value);
}

export function getMicrotest(id: string): DiagnosticMicrotest | undefined {
  return MICROTEST_MAP.get(id);
}

export function microtestsByPattern(patternId: string): readonly DiagnosticMicrotest[] {
  return MICROTESTS.filter((m) => m.patternId === patternId);
}
