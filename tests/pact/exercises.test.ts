import { describe, expect, it } from "vitest";
import { MICROTESTS } from "../../src/domain/diagnosis/microtests";
import { getExercise, EXERCISES, PACT_EXERCISE_IDS, microtestExerciseId } from "../../src/domain/exercises";
import { canonicalizeAnswer } from "../../src/domain/pact/analysis";
import { PACT_EXERCISES, mainExerciseFor, transferExerciseFor } from "../../src/domain/pact/exercises";

describe("contrato de ejercicios PACT y micropruebas (misión 0.7.0)", () => {
  it("mantiene principal y transferencia para los cuatro patrones, con valores distintos", () => {
    for (const patternId of ["RANGE", "ACUMULADORES", "CONDICIONALES", "FUNCIONES"] as const) {
      const main = mainExerciseFor(patternId);
      const transfer = transferExerciseFor(patternId);
      expect(main.kind).toBe("main");
      expect(transfer.kind).toBe("transfer");
      expect(main.exerciseId).not.toBe(transfer.exerciseId);
      expect(canonicalizeAnswer(main.expectedPrediction, main.answerFormat)).not.toBe(
        canonicalizeAnswer(transfer.expectedPrediction, transfer.answerFormat),
      );
    }
  });

  it("cada ejercicio PACT está en la lista blanca del Worker y coincide con su salida real declarada", () => {
    for (const exerciseId of PACT_EXERCISE_IDS) {
      expect(EXERCISES[exerciseId]).toBeDefined();
    }
    for (const definition of PACT_EXERCISES) {
      const executable = getExercise(definition.exerciseId);
      expect(executable).toBeDefined();
      if (!executable) continue;
      expect(canonicalizeAnswer(executable.expectedOutput, definition.answerFormat)).toBe(
        canonicalizeAnswer(definition.expectedPrediction, definition.answerFormat),
      );
      for (const name of definition.variablesToPredict) {
        expect(Number.isFinite(definition.expectedVariables[name])).toBe(true);
      }
    }
  });

  it("cada microprueba tiene un ejercicio ejecutable con el mismo código y salida", () => {
    expect(MICROTESTS).toHaveLength(24);
    for (const microtest of MICROTESTS) {
      const executable = getExercise(microtestExerciseId(microtest.id));
      expect(executable).toBeDefined();
      if (!executable) continue;
      expect(executable.code).toBe(microtest.code);
      expect(executable.expectedOutput).toBe(microtest.expectedOutcome);
    }
  });

  it("el código controlado no incluye imports ni acceso a recursos", () => {
    const forbidden = /\b(import|open|eval|exec|compile|__\w+__|input)\b/;
    for (const exercise of PACT_EXERCISES) {
      const executable = getExercise(exercise.exerciseId);
      expect(executable).toBeDefined();
      if (!executable) continue;
      expect(executable.code).not.toMatch(forbidden);
    }
    for (const microtest of MICROTESTS) {
      expect(microtest.code).not.toMatch(forbidden);
    }
  });
});
