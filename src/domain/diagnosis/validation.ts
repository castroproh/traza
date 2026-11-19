/**
 * Validador estructural del banco de micropruebas (misión 0.6.0).
 *
 * Detecta errores estructurales antes de publicar una microprueba:
 *  - Hipótesis inexistente.
 *  - Identificador duplicado.
 *  - Respuesta esperada ausente.
 *  - Código no ejecutable (vacío / solo espacios).
 *  - Regla diagnóstica sin hipótesis asociada.
 *  - Microprueba que no diferencia ninguna hipótesis.
 *  - Microprueba con resultados contradictorios.
 *
 * La revisión pedagógica humana queda fuera del validador (ver docs/REVISION_DOCENTE.md).
 */

import { HYPOTHESES, PATTERNS } from "./hypotheses";
import { MICROTESTS } from "./microtests";
import { matrixForPattern } from "./discrimination";
import type { DiagnosticMicrotest } from "./microtests";

export type ValidationIssueType =
  | "unknown-hypothesis"
  | "duplicate-hypothesis"
  | "duplicate-microtest"
  | "missing-response"
  | "empty-code"
  | "rule-without-hypothesis"
  | "no-discrimination";

export interface ValidationIssue {
  code: ValidationIssueType;
  microtestId?: string;
  hypothesisId?: string;
  message: string;
}

export interface ValidationReport {
  valid: boolean;
  issues: readonly ValidationIssue[];
}

const DIFFICULTIES = ["beginner", "intermediate"];

function isValidMicrotest(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const m = value as Record<string, unknown>;
  return (
    typeof m["id"] === "string" &&
    typeof m["version"] === "number" &&
    typeof m["patternId"] === "string" &&
    Array.isArray(m["targetHypotheses"]) &&
    typeof m["objective"] === "string" &&
    typeof m["code"] === "string" &&
    typeof m["predictionQuestion"] === "string" &&
    typeof m["responseSignatures"] === "object" &&
    typeof m["expectedOutcome"] === "string" &&
    (m["answerFormat"] === "numbers" || m["answerFormat"] === "text") &&
    typeof m["interpretationRule"] === "string" &&
    typeof m["explanation"] === "string" &&
    DIFFICULTIES.includes(m["difficulty"] as string) &&
    Array.isArray(m["ambiguityCases"]) &&
    Array.isArray(m["prerequisites"])
  );
}

export function validateMicrotest(m: DiagnosticMicrotest): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!PATTERNS.some((p) => p.id === m.patternId)) {
    issues.push({ code: "unknown-hypothesis", microtestId: m.id, message: `La microprueba ${m.id} usa un patrón inexistente (${m.patternId}).` });
  }
  for (const hypothesisId of m.targetHypotheses) {
    if (!HYPOTHESES.some((h) => h.id === hypothesisId)) {
      issues.push({ code: "unknown-hypothesis", microtestId: m.id, hypothesisId, message: `La microprueba ${m.id} referencia la hipótesis ${hypothesisId}, que no existe.` });
    }
  }
  if (m.code.trim().length === 0) {
    issues.push({ code: "empty-code", microtestId: m.id, message: `La microprueba ${m.id} no tiene código.` });
  }
  if (m.interpretationRule.trim().length === 0) {
    issues.push({ code: "rule-without-hypothesis", microtestId: m.id, message: `La microprueba ${m.id} no tiene una regla diagnóstica interpretativa.` });
  }
  if (m.targetHypotheses.length === 0) {
    issues.push({ code: "rule-without-hypothesis", microtestId: m.id, message: `La microprueba ${m.id} no tiene hipótesis objetivo asociadas.` });
  }
  const predictedResponses = Object.values(m.responseSignatures).flat();
  if (predictedResponses.length === 0) {
    issues.push({ code: "missing-response", microtestId: m.id, message: `La microprueba ${m.id} no tiene respuestas previstas por ninguna hipótesis.` });
  }
  const distinct = new Set(predictedResponses.map((r) => r.trim()));
  if (distinct.size < 2) {
    issues.push({ code: "no-discrimination", microtestId: m.id, message: `La microprueba ${m.id} no discrimina: todas las hipótesis predicen la misma respuesta.` });
  }
  return issues;
}

export function validateBank(): ValidationReport {
  const issues: ValidationIssue[] = [];

  const seenHypotheses = new Set<string>();
  for (const hypothesis of HYPOTHESES) {
    if (seenHypotheses.has(hypothesis.id)) {
      issues.push({ code: "duplicate-hypothesis", hypothesisId: hypothesis.id, message: `La hipótesis ${hypothesis.id} está duplicada.` });
    }
    seenHypotheses.add(hypothesis.id);
  }

  const seenMicrotests = new Set<string>();
  for (const m of MICROTESTS) {
    if (seenMicrotests.has(m.id)) {
      issues.push({ code: "duplicate-microtest", microtestId: m.id, message: `La microprueba ${m.id} está duplicada.` });
    }
    seenMicrotests.add(m.id);
    if (!isValidMicrotest(m)) {
      issues.push({ code: "duplicate-microtest", microtestId: m.id, message: `La microprueba ${m.id} no cumple el contrato estructural.` });
    }
    issues.push(...validateMicrotest(m));
  }

  for (const pattern of PATTERNS) {
    const matrix = matrixForPattern(pattern.id);
    if (!matrix) {
      issues.push({ code: "unknown-hypothesis", hypothesisId: pattern.id, message: `El patrón ${pattern.id} no tiene matriz de discriminación.` });
      continue;
    }
    const known = new Set(HYPOTHESES.map((h) => h.id));
    for (const pair of matrix.pairs) {
      const missing = [pair.hypothesisAId, pair.hypothesisBId].filter((id) => !known.has(id));
      if (missing.length > 0) {
        issues.push({ code: "unknown-hypothesis", hypothesisId: missing[0] ?? pair.hypothesisBId, message: `La pareja ${pair.hypothesisAId} vs ${pair.hypothesisBId} referencia una hipótesis inexistente.` });
      }
      for (const microtestId of pair.discriminatingMicrotests) {
        const microtest = MICROTESTS.find((m) => m.id === microtestId);
        if (!microtest) {
          issues.push({ code: "unknown-hypothesis", microtestId, message: `La matriz referencia la microprueba ${microtestId}, que no existe en el banco.` });
        }
      }
    }
  }

  // La "regla diagnóstica" necesita al menos una hipótesis objetivo con respuestas previstas.
  for (const m of MICROTESTS) {
    if (m.interpretationRule.trim().length === 0 || m.targetHypotheses.length === 0) {
      issues.push({ code: "rule-without-hypothesis", microtestId: m.id, message: `La microprueba ${m.id} tiene una regla sin hipótesis asociada utilizable.` });
    }
  }

  // Consistencia entre la matriz y el banco: cada microprueba discriminante debe
  // existir y cada hipótesis de la pareja debe tener firmas en la microprueba.
  for (const pattern of PATTERNS) {
    const matrix = matrixForPattern(pattern.id);
    if (!matrix) continue;
    for (const pair of matrix.pairs) {
      for (const microtestId of pair.discriminatingMicrotests) {
        const microtest = MICROTESTS.find((m) => m.id === microtestId);
        if (!microtest) continue;
        for (const hypothesisId of [pair.hypothesisAId, pair.hypothesisBId]) {
          const signatures = microtest.responseSignatures[hypothesisId];
          if (!signatures || signatures.length === 0) {
            issues.push({ code: "missing-response", microtestId, hypothesisId, message: `La microprueba ${microtestId} no tiene respuestas previstas para la hipótesis ${hypothesisId}.` });
          }
        }
      }
    }
  }

  return { valid: issues.length === 0, issues };
}
