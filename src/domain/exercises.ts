/**
 * Ejercicios controlados que el Worker puede ejecutar.
 *
 * SEGURIDAD: la interfaz envía un identificador, nunca código. Este archivo es
 * la lista blanca. Las micropruebas diagnósticas se registran aquí para poder
 * ejecutarlas de verdad durante el contraste, sin abrir la ejecución a código
 * libre del estudiante.
 */

import { MICROTESTS } from "./diagnosis/microtests";

/** Ejercicios del recorrido PACT (principal y transferencia). */
export const PACT_EXERCISE_IDS = [
  "suma-1-3",
  "range-principal",
  "range-transferencia",
  "acumuladores-transferencia",
  "condicionales-principal",
  "condicionales-transferencia",
  "funciones-principal",
  "funciones-transferencia",
] as const;

export type PactExerciseId = (typeof PACT_EXERCISE_IDS)[number];

/**
 * Ejercicios del recorrido PACT anterior (0.5) que se conservan para no romper
 * las funciones ni las pruebas heredadas. No forman parte del recorrido 0.8.0,
 * pero siguen en la lista blanca controlada.
 */
export const LEGACY_EXERCISE_IDS = [
  "range-contrast-0-3",
  "range-contrast-2-6",
  "range-transfer-4-7",
  "accumulator-contrast-zero",
  "accumulator-contrast-seed",
  "accumulator-transfer-wallet",
] as const;

export type LegacyExerciseId = (typeof LEGACY_EXERCISE_IDS)[number];

/** Las micropruebas se ejecutan con un identificador derivado y estable. */
export type MicrotestExerciseId = `mt-${string}`;

export type ExerciseId = PactExerciseId | LegacyExerciseId | MicrotestExerciseId;

export interface Exercise {
  id: ExerciseId;
  title: string;
  description: string;
  code: string;
  expectedOutput: string;
}

const PACT_EXERCISES: Record<PactExerciseId, Exercise> = {
  "suma-1-3": {
    id: "suma-1-3",
    title: "Sumar los números del 1 al 3",
    description:
      "El programa suma los números 1, 2 y 3 dentro de un bucle y muestra el total.",
    code: [
      "total = 0",
      "for numero in range(1, 4):",
      "    total = total + numero",
      "print(total)",
    ].join("\n"),
    expectedOutput: "6",
  },
  "range-principal": {
    id: "range-principal",
    title: "Recorrer un rango que empieza en 2",
    description:
      "El programa imprime cada número que genera range(2, 6), uno por línea.",
    code: [
      "for numero in range(2, 6):",
      "    print(numero)",
    ].join("\n"),
    expectedOutput: ["2", "3", "4", "5"].join("\n"),
  },
  "range-transferencia": {
    id: "range-transferencia",
    title: "Numerar páginas de un informe",
    description:
      "El programa numera las páginas de un informe empezando en 5 y terminando antes de 9.",
    code: [
      "for pagina in range(5, 9):",
      '    print("Página", pagina)',
    ].join("\n"),
    expectedOutput: ["Página 5", "Página 6", "Página 7", "Página 8"].join("\n"),
  },
  "acumuladores-transferencia": {
    id: "acumuladores-transferencia",
    title: "Ahorrar una cantidad creciente cada mes",
    description:
      "El ahorro empieza en 50. Cada mes se suman 10, 20, 30 y 40, y se muestra el ahorro tras cada mes.",
    code: [
      "ahorro = 50",
      "for mes in range(1, 5):",
      "    ahorro = ahorro + mes * 10",
      "    print(ahorro)",
    ].join("\n"),
    expectedOutput: ["60", "80", "110", "150"].join("\n"),
  },
  "condicionales-principal": {
    id: "condicionales-principal",
    title: "Decidir con una condición and",
    description:
      "El programa comprueba si hay permiso y si la edad es suficiente. Deben cumplirse ambas condiciones para entrar.",
    code: [
      "permiso = True",
      "edad = 16",
      "if permiso and edad >= 18:",
      '    print("puede conducir")',
      "else:",
      '    print("no puede conducir")',
    ].join("\n"),
    expectedOutput: "no puede conducir",
  },
  "condicionales-transferencia": {
    id: "condicionales-transferencia",
    title: "Transferencia: decidir con una condición or",
    description:
      "El programa cancela una actividad si hace demasiado calor o si llueve. Basta una de las dos condiciones.",
    code: [
      "temperatura = 30",
      "lluvia = False",
      "if temperatura > 35 or lluvia:",
      '    print("cancelar")',
      "else:",
      '    print("realizar")',
    ].join("\n"),
    expectedOutput: "realizar",
  },
  "funciones-principal": {
    id: "funciones-principal",
    title: "Devolver un valor desde una función",
    description:
      "La función calcula un total y lo devuelve con return. El programa imprime el valor devuelto.",
    code: [
      "def calcular_total(precio, cantidad):",
      "    total = precio * cantidad",
      "    return total",
      "",
      "resultado = calcular_total(5, 4)",
      "print(resultado)",
    ].join("\n"),
    expectedOutput: "20",
  },
  "funciones-transferencia": {
    id: "funciones-transferencia",
    title: "Transferencia: devolver una cadena",
    description:
      "La función construye un saludo con su parámetro y lo devuelve. Otra variable conserva el resultado.",
    code: [
      "def crear_saludo(nombre):",
      '    saludo = "Hola, " + nombre',
      "    return saludo",
      "",
      'mensaje = crear_saludo("Ana")',
      "print(mensaje)",
    ].join("\n"),
    expectedOutput: "Hola, Ana",
  },
};

const LEGACY_EXERCISES: Record<LegacyExerciseId, Exercise> = {
  "range-contrast-0-3": {
    id: "range-contrast-0-3",
    title: "Microprueba heredada: range(0, 3)",
    description: "Muestra los valores de un rango pequeño que empieza en cero.",
    code: ["for numero in range(0, 3):", "    print(numero)"].join("\n"),
    expectedOutput: ["0", "1", "2"].join("\n"),
  },
  "range-contrast-2-6": {
    id: "range-contrast-2-6",
    title: "Microprueba heredada: range(2, 6)",
    description: "Repite el intervalo con un inicio y un límite distintos.",
    code: ["for numero in range(2, 6):", "    print(numero)"].join("\n"),
    expectedOutput: ["2", "3", "4", "5"].join("\n"),
  },
  "range-transfer-4-7": {
    id: "range-transfer-4-7",
    title: "Transferencia heredada: range(4, 7)",
    description: "Aplica el límite superior exclusivo en otro intervalo.",
    code: ["for numero in range(4, 7):", "    print(numero)"].join("\n"),
    expectedOutput: ["4", "5", "6"].join("\n"),
  },
  "accumulator-contrast-zero": {
    id: "accumulator-contrast-zero",
    title: "Microprueba heredada: acumulador desde cero",
    description: "Acumula precios 2, 3 y 4 en un subtotal que empieza en cero.",
    code: [
      "subtotal = 0",
      "for precio in range(2, 5):",
      "    subtotal = subtotal + precio",
      "print(subtotal)",
    ].join("\n"),
    expectedOutput: "9",
  },
  "accumulator-contrast-seed": {
    id: "accumulator-contrast-seed",
    title: "Microprueba heredada: valor inicial distinto de cero",
    description: "Comprueba si el valor inicial participa en el total.",
    code: [
      "saldo = 7",
      "for pago in range(2, 5):",
      "    saldo = saldo + pago",
      "print(saldo)",
    ].join("\n"),
    expectedOutput: "16",
  },
  "accumulator-transfer-wallet": {
    id: "accumulator-transfer-wallet",
    title: "Transferencia heredada: monedero",
    description: "Resta cada pago al saldo anterior.",
    code: [
      "saldo = 100",
      "for pago in range(20, 40, 10):",
      "    saldo = saldo - pago",
      "print(saldo)",
    ].join("\n"),
    expectedOutput: "50",
  },
};

/** Prefijo estable que relaciona una microprueba con su ejercicio ejecutable. */
export function microtestExerciseId(microtestId: string): MicrotestExerciseId {
  return `mt-${microtestId}`;
}

const MICROTEST_EXERCISES: Record<string, Exercise> = Object.fromEntries(
  MICROTESTS.map((microtest) => {
    const id = microtestExerciseId(microtest.id);
    return [
      id,
      {
        id,
        title: microtest.objective,
        description: microtest.predictionQuestion,
        code: microtest.code,
        expectedOutput: microtest.expectedOutcome,
      },
    ];
  }),
);

export const EXERCISES: Readonly<Record<string, Exercise>> = {
  ...PACT_EXERCISES,
  ...LEGACY_EXERCISES,
  ...MICROTEST_EXERCISES,
};

export function isExerciseId(value: unknown): value is ExerciseId {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(EXERCISES, value);
}

export function getExercise(id: string): Exercise | undefined {
  return Object.prototype.hasOwnProperty.call(EXERCISES, id) ? EXERCISES[id] : undefined;
}

/** Texto de una línea del código (1 = primera). Cadena vacía si no existe. */
export function sourceLine(code: string, line: number): string {
  if (!Number.isInteger(line) || line < 1) return "";
  return code.split("\n")[line - 1] ?? "";
}
