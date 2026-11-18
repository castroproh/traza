import type { PACTPattern, PACTPatternId } from "./pact";

const rangeHypotheses = [
  {
    id: "range-inclusive",
    title: "H1 — El límite superior se incluye",
    description: "El segundo número de range() también forma parte de la secuencia.",
  },
  {
    id: "range-exclusive",
    title: "H2 — El límite superior queda fuera",
    description: "La secuencia llega hasta el número anterior al segundo argumento.",
  },
] as const;

const accumulatorHypotheses = [
  {
    id: "accumulate",
    title: "H1 — Acumula el valor nuevo",
    description: "Cada vuelta suma el valor nuevo al total anterior.",
  },
  {
    id: "replace",
    title: "H2 — Reemplaza el valor anterior",
    description: "Cada vuelta sustituye el total por el valor actual del bucle.",
  },
  {
    id: "ignore-seed",
    title: "H3 — Ignora el valor inicial",
    description: "La suma empieza efectivamente desde cero y no incorpora el valor inicial.",
  },
] as const;

export const PACT_PATTERNS: Record<PACTPatternId, PACTPattern> = {
  "range-exclusive": {
    id: "range-exclusive",
    title: "Límites de range()",
    description: "Predice qué valores recorre el bucle y cómo cambia cada variable.",
    concept: "range(inicio, fin) incluye inicio y no incluye fin.",
    analysisInsight:
      "En range(inicio, fin), Python incluye el inicio y excluye el límite superior. La última iteración observada permite localizar la diferencia.",
    mainExerciseId: "suma-1-3",
    hypotheses: rangeHypotheses,
    microtests: [
      {
        id: "range-zero-three",
        title: "Microprueba 1 — Un límite pequeño",
        situation: "Un programa muestra el valor de numero en cada vuelta.",
        modification: "El inicio y el límite superior cambian a 0 y 3.",
        exerciseId: "range-contrast-0-3",
        hypothesisResponses: {
          "range-inclusive": {
            output: "0\n1\n2\n3",
            iterations: 4,
            variableValues: { numero: [0, 1, 2, 3] },
          },
          "range-exclusive": {
            output: "0\n1\n2",
            iterations: 3,
            variableValues: { numero: [0, 1, 2] },
          },
        },
        interpretationRule:
          "La respuesta inclusiva predice cuatro vueltas (0–3); la exclusiva predice tres (0–2). La ejecución real distingue esas dos predicciones.",
      },
      {
        id: "range-two-six",
        title: "Microprueba 2 — Otro intervalo",
        situation: "Se repite la pregunta con un inicio y un límite distintos.",
        modification: "El intervalo ahora empieza en 2 y tiene límite superior 6.",
        exerciseId: "range-contrast-2-6",
        hypothesisResponses: {
          "range-inclusive": {
            output: "2\n3\n4\n5\n6",
            iterations: 5,
            variableValues: { numero: [2, 3, 4, 5, 6] },
          },
          "range-exclusive": {
            output: "2\n3\n4\n5",
            iterations: 4,
            variableValues: { numero: [2, 3, 4, 5] },
          },
        },
        interpretationRule:
          "Esta segunda respuesta comprueba si la explicación se mantiene con otros valores; una respuesta aislada no se guarda como etiqueta del estudiante.",
      },
    ],
    transferExerciseId: "range-transfer-4-7",
  },
  accumulator: {
    id: "accumulator",
    title: "Acumuladores",
    description: "Observa cómo interactúan el valor inicial y las actualizaciones del total.",
    concept: "Un acumulador conserva el valor anterior y le añade el nuevo valor en cada vuelta.",
    analysisInsight:
      "Cada actualización lee el total anterior y guarda la suma. El valor inicial también cuenta; cambiarlo modifica el resultado final.",
    mainExerciseId: "suma-1-3",
    hypotheses: accumulatorHypotheses,
    microtests: [
      {
        id: "accumulator-zero-seed",
        title: "Microprueba 1 — Seguir el valor anterior",
        situation: "Observa si el subtotal conserva lo reunido en vueltas previas.",
        modification: "Cambian el nombre de la variable y los valores del intervalo; el inicio permanece en cero.",
        exerciseId: "accumulator-contrast-zero",
        hypothesisResponses: {
          accumulate: {
            output: "9",
            iterations: 3,
            variableValues: { precio: [2, 3, 4], subtotal: [2, 5, 9] },
          },
          replace: {
            output: "4",
            iterations: 3,
            variableValues: { precio: [2, 3, 4], subtotal: [2, 3, 4] },
          },
          "ignore-seed": {
            output: "9",
            iterations: 3,
            variableValues: { precio: [2, 3, 4], subtotal: [2, 5, 9] },
          },
        },
        interpretationRule:
          "Un total final de 4 distingue la sustitución. Un total de 9 no distingue por sí solo acumulación correcta de ignorar el inicio cero; esa diferencia se contrasta en la siguiente prueba.",
      },
      {
        id: "accumulator-nonzero-seed",
        title: "Microprueba 2 — Cambiar el valor inicial",
        situation: "Ahora el acumulador comienza con una cantidad distinta de cero.",
        modification: "Se cambia el valor inicial a 7 para saber si participa en el total.",
        exerciseId: "accumulator-contrast-seed",
        hypothesisResponses: {
          accumulate: {
            output: "16",
            iterations: 3,
            variableValues: { pago: [2, 3, 4], saldo: [9, 12, 16] },
          },
          replace: {
            output: "4",
            iterations: 3,
            variableValues: { pago: [2, 3, 4], saldo: [2, 3, 4] },
          },
          "ignore-seed": {
            output: "9",
            iterations: 3,
            variableValues: { pago: [2, 3, 4], saldo: [2, 5, 9] },
          },
        },
        interpretationRule:
          "Los resultados 16, 4 y 9 corresponden, respectivamente, a conservar y sumar el inicio, reemplazar el total y no incorporar el valor inicial. Si la respuesta no coincide con ninguno, la evidencia es insuficiente.",
      },
    ],
    transferExerciseId: "accumulator-transfer-wallet",
  },
};
