import type { ExerciseId } from "../domain/exercises";
import type { ExecutionResult } from "../domain/types";

/** Interfaz → Worker. Solo identificadores: nunca se envía código. */
export type WorkerRequest =
  | { type: "init" }
  | { type: "run"; requestId: number; exerciseId: ExerciseId };

/** Worker → Interfaz. */
export type WorkerResponse =
  | { type: "status"; status: "loading" | "ready" }
  | { type: "result"; requestId: number; result: ExecutionResult }
  | { type: "error"; phase: "init" | "run"; requestId?: number; message: string };

export function isWorkerRequest(value: unknown): value is WorkerRequest {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  if (v["type"] === "init") return true;
  return v["type"] === "run" && typeof v["requestId"] === "number" && typeof v["exerciseId"] === "string";
}
