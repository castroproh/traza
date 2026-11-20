import { TRACE_LIMITS } from "../domain/limits";

/**
 * Tiempos del motor. El límite de ejecución vive en `TRACE_LIMITS` para que
 * Python, TypeScript y las pruebas usen el mismo valor.
 */
export const ENGINE_TIMEOUTS = {
  initializationMs: 30_000,
  runMs: TRACE_LIMITS.runTimeoutMs,
} as const;
