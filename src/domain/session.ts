/**
 * Sesión diagnóstica de TRAZA (misión 0.6.0).
 *
 * No almacena identificación personal ni perfiles psicológicos: solo guarda el
 * estado del instrumento para recuperar la sesión en el mismo navegador.
 */

import { patternHypotheses, type DiagnosisPatternId } from "./diagnosis/hypotheses";
import { MAX_MICROTESTS_PER_SESSION } from "./diagnosis/selection";
import { evaluatePattern, type EvidenceOutcome } from "./diagnosis/evidence";
import type { EvidenceEvaluation } from "./diagnosis/hypotheses";

export interface SessionAnswer {
  microtestId: string;
  response: string;
  evaluations: EvidenceEvaluation[];
  state: "supports" | "insufficient" | "contradicts";
}

export interface DiagnosticSession {
  patternId: DiagnosisPatternId;
  answers: SessionAnswer[];
  createdAt: string;
  updatedAt: string;
}

export interface NewSessionInput {
  patternId: DiagnosisPatternId;
}

export interface AnswerSessionInput {
  microtestId: string;
  response: string;
}

export interface AnswerSessionResult {
  session: DiagnosticSession;
  outcome: EvidenceOutcome;
}

const STORAGE_KEY = "traza:diagnostic-session";

export function createSession(input: NewSessionInput): DiagnosticSession {
  const now = new Date().toISOString();
  return { patternId: input.patternId, answers: [], createdAt: now, updatedAt: now };
}

export function answerSession(session: DiagnosticSession, input: AnswerSessionInput): AnswerSessionResult {
  const patternAnswers = session.answers.map((a) => ({ microtestId: a.microtestId, response: a.response }));
  patternAnswers.push({ microtestId: input.microtestId, response: input.response });

  const outcome = evaluatePattern(session.patternId, patternAnswers);
  const answer: SessionAnswer = {
    microtestId: input.microtestId,
    response: input.response,
    evaluations: outcome.evaluations,
    state: outcome.evaluations[0]?.state ?? "insufficient",
  };
  const next: DiagnosticSession = {
    patternId: session.patternId,
    answers: [...session.answers, answer],
    createdAt: session.createdAt,
    updatedAt: new Date().toISOString(),
  };
  return { session: next, outcome };
}

export function serializeSession(session: DiagnosticSession): string {
  return JSON.stringify({
    patternId: session.patternId,
    answers: session.answers.map((a) => ({ microtestId: a.microtestId, response: a.response, state: a.state })),
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  });
}

export function deserializeSession(json: string): DiagnosticSession | null {
  try {
    const data: unknown = JSON.parse(json);
    if (typeof data !== "object" || data === null) return null;
    const d = data as Record<string, unknown>;
    if (typeof d["patternId"] !== "string") return null;
    if (!Array.isArray(d["answers"])) return null;
    const answers: SessionAnswer[] = [];
    for (const raw of d["answers"]) {
      const r = raw as Record<string, unknown>;
      if (typeof r["microtestId"] !== "string" || typeof r["response"] !== "string") continue;
      const state = r["state"];
      answers.push({
        microtestId: r["microtestId"],
        response: r["response"],
        evaluations: [],
        state: state === "supports" || state === "insufficient" || state === "contradicts" ? state : "insufficient",
      });
    }
    return {
      patternId: d["patternId"] as DiagnosisPatternId,
      answers,
      createdAt: typeof d["createdAt"] === "string" ? d["createdAt"] : new Date().toISOString(),
      updatedAt: typeof d["updatedAt"] === "string" ? d["updatedAt"] : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function loadSession(): DiagnosticSession | null {
  try {
    const storage = globalThis.localStorage;
    const raw = storage?.getItem(STORAGE_KEY);
    if (!raw) return null;
    return deserializeSession(raw);
  } catch {
    return null;
  }
}

export function saveSession(session: DiagnosticSession): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, serializeSession(session));
  } catch {
    // Sin almacenamiento disponible: la sesión vive en memoria.
  }
}

export function clearSession(): void {
  try {
    globalThis.localStorage?.removeItem(STORAGE_KEY);
  } catch {
    // noop
  }
}

export function sessionLimitFor(patternId: string): number {
  const hypotheses = patternHypotheses(patternId);
  return Math.min(MAX_MICROTESTS_PER_SESSION, Math.max(2, hypotheses.length));
}
