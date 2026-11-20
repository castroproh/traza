/**
 * Matrices de discriminación de hipótesis para el instrumento TRAZA 0.8.0.
 *
 * Una matriz responde, para cada par de hipótesis rival:
 *  1. ¿Qué hipótesis estamos tratando de distinguir?
 *  2. ¿Qué comportamiento observable esperamos de cada una?
 *  3. ¿Qué respuesta produciría cada hipótesis ante la microprueba?
 *  4. ¿Qué respuestas serían ambiguas?
 *  5. ¿Qué resultados permiten distinguirlas?
 *  6. ¿Cuándo es necesario declarar evidencia insuficiente?
 */

import { patternHypotheses, type DiscriminationMatrix } from "./hypotheses";

export const DISCRIMINATION_MATRICES: readonly DiscriminationMatrix[] = [
  {
    patternId: "RANGE",
    pairs: [
      {
        patternId: "RANGE",
        hypothesisAId: "H-RANGE-01",
        hypothesisBId: "H-RANGE-02",
        discriminatingMicrotests: ["range-iteracion-01", "range-cero-01", "range-valor-inicial-01", "range-pequeno-01", "range-tabla-01", "range-negativo-01", "range-un-argumento-01"],
        predictions: {
          "range-iteracion-01": {
            "H-RANGE-01": ["1, 2, 3, 4"],
            "H-RANGE-02": ["1, 2, 3"],
          },
          "range-cero-01": {
            "H-RANGE-01": ["0, 1, 2, 3"],
            "H-RANGE-02": ["0, 1, 2"],
          },
          "range-valor-inicial-01": {
            "H-RANGE-01": ["2, 3, 4, 5"],
            "H-RANGE-02": ["2, 3, 4"],
          },
          "range-pequeno-01": {
            "H-RANGE-01": ["0, 1, 2"],
            "H-RANGE-02": ["0, 1"],
          },
          "range-tabla-01": {
            "H-RANGE-01": ["1, 2, 3, 4"],
            "H-RANGE-02": ["1, 2, 3"],
          },
          "range-negativo-01": {
            "H-RANGE-01": ["-3, -2, -1, 0, 1, 2"],
            "H-RANGE-02": ["-3, -2, -1, 0, 1"],
          },
          "range-un-argumento-01": {
            "H-RANGE-01": ["0, 1, 2, 3, 4, 5"],
            "H-RANGE-02": ["0, 1, 2, 3, 4"],
          },
        },
        ambiguousResponses: {
          "range-tabla-01": ["del 1 al 3"],
          "range-un-argumento-01": ["del 0 al 4"],
        },
        insufficientWhen:
          "Cuando la respuesta del estudiante no fija el límite superior (p. ej. describir el rango como intervalo) o cuando la respuesta coincide con la predicción de ambas hipótesis.",
      },
    ],
  },
  {
    patternId: "ACUMULADORES",
    pairs: [
      {
        patternId: "ACUMULADORES",
        hypothesisAId: "H-ACC-01",
        hypothesisBId: "H-ACC-02",
        discriminatingMicrotests: ["acc-final-01", "acc-secuencia-01", "acc-imprime-01", "acc-general-01", "acc-parcial-01"],
        predictions: {
          "acc-final-01": { "H-ACC-01": ["6"], "H-ACC-02": ["3"] },
          "acc-secuencia-01": { "H-ACC-01": ["1, 3, 6"], "H-ACC-02": ["1, 2, 3"] },
          "acc-imprime-01": { "H-ACC-01": ["2, 5, 9"], "H-ACC-02": ["2, 3, 4"] },
          "acc-general-01": { "H-ACC-01": ["1, 3, 6, 10, 15"], "H-ACC-02": ["1, 2, 3, 4, 5"] },
          "acc-parcial-01": { "H-ACC-01": ["102, 105, 109"], "H-ACC-02": ["2, 3, 4"] },
        },
        ambiguousResponses: {
          "acc-final-01": ["No estoy seguro"],
          "acc-secuencia-01": ["No estoy seguro"],
        },
        insufficientWhen:
          "Cuando la respuesta no distingue entre conservar el parcial o reemplazarlo (p. ej. respuesta ambigua o calculada sin paso intermedio).",
      },
      {
        patternId: "ACUMULADORES",
        hypothesisAId: "H-ACC-01",
        hypothesisBId: "H-ACC-03",
        discriminatingMicrotests: ["acc-inicial-01"],
        predictions: {
          "acc-inicial-01": { "H-ACC-01": ["16"], "H-ACC-03": ["6"] },
        },
        ambiguousResponses: {
          "acc-inicial-01": ["No estoy seguro"],
        },
        insufficientWhen:
          "Cuando el error no puede atribuirse al valor inicial o a la operación acumulativa.",
      },
      {
        patternId: "ACUMULADORES",
        hypothesisAId: "H-ACC-02",
        hypothesisBId: "H-ACC-03",
        discriminatingMicrotests: ["acc-inicial-01", "acc-inicial-cero-02"],
        predictions: {
          "acc-inicial-01": { "H-ACC-02": ["3"], "H-ACC-03": ["6"] },
          "acc-inicial-cero-02": { "H-ACC-02": ["2, 3, 4"], "H-ACC-03": ["2, 5, 9"] },
        },
        ambiguousResponses: {
          "acc-inicial-01": ["No estoy seguro"],
          "acc-inicial-cero-02": ["2, 5, 9", "No estoy seguro", "No sé"],
        },
        insufficientWhen:
          "La secuencia 2, 5, 9 contradice la sustitución, pero también es compatible con la hipótesis normativa: no basta para apoyar específicamente que se ignore la inicialización. Si la respuesta no separa el efecto de la inicialización de la sustitución, la evidencia es insuficiente.",
      },
    ],
  },
  {
    patternId: "CONDICIONALES",
    pairs: [
      {
        patternId: "CONDICIONALES",
        hypothesisAId: "H-COND-01",
        hypothesisBId: "H-COND-02",
        discriminatingMicrotests: ["cond-and-01", "cond-and-02", "cond-or-01", "cond-or-02"],
        predictions: {
          "cond-and-01": { "H-COND-01": ["adolescente"], "H-COND-02": ["otra etapa"] },
          "cond-and-02": { "H-COND-01": ["cancelar"], "H-COND-02": ["realizar"] },
          "cond-or-01": { "H-COND-01": ["fin de semana"], "H-COND-02": ["dia laborable"] },
          "cond-or-02": { "H-COND-01": ["puede entrar"], "H-COND-02": ["no puede entrar"] },
        },
        ambiguousResponses: {
          "cond-and-01": ["No estoy seguro", "No sé"],
          "cond-and-02": ["No estoy seguro", "No sé"],
          "cond-or-01": ["No estoy seguro", "No sé"],
          "cond-or-02": ["No estoy seguro", "No sé"],
        },
        insufficientWhen:
          "Cuando la respuesta no distingue una conjunción de una disyunción (por ejemplo, describe la condición sin fijar la rama).",
      },
      {
        patternId: "CONDICIONALES",
        hypothesisAId: "H-COND-01",
        hypothesisBId: "H-COND-03",
        discriminatingMicrotests: ["cond-not-01"],
        predictions: {
          "cond-not-01": { "H-COND-01": ["recuperar"], "H-COND-03": ["promocionar"] },
        },
        ambiguousResponses: {
          "cond-not-01": ["No estoy seguro", "No sé"],
        },
        insufficientWhen:
          "Cuando la respuesta es compatible tanto con una conjunción/disyunción bien leída como con una negación mal leída.",
      },
      {
        patternId: "CONDICIONALES",
        hypothesisAId: "H-COND-02",
        hypothesisBId: "H-COND-03",
        discriminatingMicrotests: ["cond-not-02"],
        predictions: {
          "cond-not-02": { "H-COND-02": ["mayor de edad"], "H-COND-03": ["menor de edad"] },
        },
        ambiguousResponses: {
          "cond-not-02": ["No estoy seguro", "No sé"],
        },
        insufficientWhen:
          "Cuando la respuesta no permite separar una disyunción mal leída de una negación mal leída.",
      },
    ],
  },
  {
    patternId: "FUNCIONES",
    pairs: [
      {
        patternId: "FUNCIONES",
        hypothesisAId: "H-FUNC-01",
        hypothesisBId: "H-FUNC-02",
        discriminatingMicrotests: ["func-print-01", "func-param-01", "func-return-02"],
        predictions: {
          "func-print-01": {
            "H-FUNC-01": ["Hola Ana", "Hola Ana\nHola Ana"],
            "H-FUNC-02": ["Hola nombre\nNone"],
          },
          "func-param-01": { "H-FUNC-01": ["None"], "H-FUNC-02": ["-7"] },
          "func-return-02": { "H-FUNC-01": ["10\nNone"], "H-FUNC-02": ["11\n11"] },
        },
        ambiguousResponses: {
          "func-print-01": ["No estoy seguro", "No sé"],
          "func-param-01": ["No estoy seguro", "No sé"],
          "func-return-02": ["No estoy seguro", "No sé"],
        },
        insufficientWhen:
          "Cuando la respuesta no permite saber si el estudiante confunde el valor devuelto con lo impreso o el nombre del parámetro con el argumento.",
      },
      {
        patternId: "FUNCIONES",
        hypothesisAId: "H-FUNC-01",
        hypothesisBId: "H-FUNC-03",
        discriminatingMicrotests: ["func-local-print-01"],
        predictions: {
          "func-local-print-01": {
            "H-FUNC-01": ["3\n3"],
            "H-FUNC-03": ["3\nNone\n3"],
          },
        },
        ambiguousResponses: {
          "func-local-print-01": ["No estoy seguro", "No sé"],
        },
        insufficientWhen:
          "Cuando la respuesta no separa el valor devuelto de la supervivencia de una variable local.",
      },
      {
        patternId: "FUNCIONES",
        hypothesisAId: "H-FUNC-02",
        hypothesisBId: "H-FUNC-03",
        discriminatingMicrotests: ["func-local-param-01", "func-scope-02"],
        predictions: {
          "func-local-param-01": {
            "H-FUNC-02": ["mensaje\nglobal"],
            "H-FUNC-03": ["local\nlocal"],
          },
          "func-scope-02": {
            "H-FUNC-02": ["global\nglobal"],
            "H-FUNC-03": ["local\nlocal"],
          },
        },
        ambiguousResponses: {
          "func-local-param-01": ["No estoy seguro", "No sé"],
          "func-scope-02": ["No estoy seguro", "No sé"],
        },
        insufficientWhen:
          "Cuando la respuesta no distingue el uso del nombre del parámetro de la creencia de que el ámbito local persiste.",
      },
    ],
  },
];

export function matrixForPattern(patternId: string): DiscriminationMatrix | undefined {
  return DISCRIMINATION_MATRICES.find((m) => m.patternId === patternId);
}

export function pairsForPattern(patternId: string): readonly (DiscriminationMatrix["pairs"][number])[] {
  const matrix = matrixForPattern(patternId);
  return matrix?.pairs ?? [];
}

/** Hipótesis de un patrón, en el orden declarado. */
export function hypothesesForPattern(patternId: string) {
  return patternHypotheses(patternId);
}
