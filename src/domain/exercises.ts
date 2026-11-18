/**
 * Ejercicios de demostración. En esta versión el Worker SOLO ejecuta código
 * que vive aquí; el mensaje de la interfaz envía un identificador, nunca código.
 */

export type ExerciseId = "suma-1-3";

export interface Exercise {
  id: ExerciseId;
  title: string;
  description: string;
  code: string;
  expectedOutput: string;
}

export const EXERCISES: Record<ExerciseId, Exercise> = {
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
};

export function isExerciseId(value: unknown): value is ExerciseId {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(EXERCISES, value);
}

/** Texto de una línea del código (1 = primera). Cadena vacía si no existe. */
export function sourceLine(code: string, line: number): string {
  if (!Number.isInteger(line) || line < 1) return "";
  return code.split("\n")[line - 1] ?? "";
}
