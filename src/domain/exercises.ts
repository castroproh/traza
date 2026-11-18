/**
 * Ejercicios de demostración. En esta versión el Worker SOLO ejecuta código
 * que vive aquí; el mensaje de la interfaz envía un identificador, nunca código.
 */

export type ExerciseId =
  | "suma-1-3"
  | "range-contrast-0-3"
  | "range-contrast-2-6"
  | "range-transfer-4-7"
  | "accumulator-contrast-zero"
  | "accumulator-contrast-seed"
  | "accumulator-transfer-wallet";

export interface Exercise {
  id: ExerciseId;
  title: string;
  description: string;
  code: string;
  expectedOutput: string;
  predictionVariables: readonly string[];
}

export const EXERCISES: Record<ExerciseId, Exercise> = {
  "suma-1-3": {
    id: "suma-1-3",
    title: "Un acumulador dentro de un bucle",
    description: "Lee el código y registra tu predicción antes de ver la ejecución.",
    code: [
      "total = 0",
      "for numero in range(1, 4):",
      "    total = total + numero",
      "print(total)",
    ].join("\n"),
    expectedOutput: "6",
    predictionVariables: ["numero", "total"],
  },
  "range-contrast-0-3": {
    id: "range-contrast-0-3",
    title: "Prueba de contraste: recorrer una secuencia",
    description: "Predice la salida y el estado de las variables antes de ejecutar.",
    code: [
      "for numero in range(0, 3):",
      "    print(numero)",
    ].join("\n"),
    expectedOutput: "0\n1\n2\n",
    predictionVariables: ["numero"],
  },
  "range-contrast-2-6": {
    id: "range-contrast-2-6",
    title: "Prueba de contraste: cambiar el intervalo",
    description: "Predice la salida y el estado de las variables antes de ejecutar.",
    code: [
      "for numero in range(2, 6):",
      "    print(numero)",
    ].join("\n"),
    expectedOutput: "2\n3\n4\n5\n",
    predictionVariables: ["numero"],
  },
  "range-transfer-4-7": {
    id: "range-transfer-4-7",
    title: "Transferencia: procesar paquetes",
    description: "Es una situación nueva. Predice primero; la ejecución aún no se muestra.",
    code: [
      "procesados = 0",
      "for paquete in range(4, 7):",
      "    procesados = procesados + 1",
      "print(procesados)",
    ].join("\n"),
    expectedOutput: "3",
    predictionVariables: ["paquete", "procesados"],
  },
  "accumulator-contrast-zero": {
    id: "accumulator-contrast-zero",
    title: "Prueba de contraste: conservar o reemplazar",
    description: "Predice la salida y los valores que toma cada variable.",
    code: [
      "subtotal = 0",
      "for precio in range(2, 5):",
      "    subtotal = subtotal + precio",
      "print(subtotal)",
    ].join("\n"),
    expectedOutput: "9",
    predictionVariables: ["precio", "subtotal"],
  },
  "accumulator-contrast-seed": {
    id: "accumulator-contrast-seed",
    title: "Prueba de contraste: atender al valor inicial",
    description: "Predice la salida y los valores que toma cada variable.",
    code: [
      "saldo = 7",
      "for pago in range(2, 5):",
      "    saldo = saldo + pago",
      "print(saldo)",
    ].join("\n"),
    expectedOutput: "16",
    predictionVariables: ["pago", "saldo"],
  },
  "accumulator-transfer-wallet": {
    id: "accumulator-transfer-wallet",
    title: "Transferencia: saldo de una tarjeta",
    description: "Es una situación nueva. Predice primero; la ejecución aún no se muestra.",
    code: [
      "saldo = 5",
      "for recarga in range(2, 5):",
      "    saldo = saldo + recarga",
      "print(saldo)",
    ].join("\n"),
    expectedOutput: "14",
    predictionVariables: ["recarga", "saldo"],
  },
};

export function isExerciseId(value: unknown): value is ExerciseId {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(EXERCISES, value);
}

/** Texto de una línea del código (1 = primera). Cadena vacía si no existe. */
export function sourceLine(code: string, line: number): string {
  if (!Number.isInteger(line) || line < 1) return "";
  return code.split("\n")[line - 1] ?? "";
}
