/**
 * Límites centralizados del motor de ejecución (misión 0.8.0).
 *
 * Los mismos valores existen en `src/python/tracer.py` (el motor Python no puede
 * importar TypeScript). Si se cambia uno, hay que cambiar el otro y actualizar
 * las pruebas de límites. El Worker no es un sandbox de seguridad: estos límites
 * acotan el coste, no garantizan aislamiento.
 */
export const TRACE_LIMITS = {
  /** Máximo de eventos (snapshots) que se devuelven al navegador. */
  maxSnapshots: 2000,
  /** Tiempo máximo de una ejecución antes de terminar el Worker. */
  runTimeoutMs: 15_000,
  /** Profundidad máxima de llamadas propias (el módulo cuenta como 0). */
  maxCallDepth: 8,
  /** Máximo de llamadas a funciones propias por ejecución. */
  maxCalls: 200,
  /** Profundidad máxima al normalizar listas/diccionarios anidados. */
  maxValueDepth: 3,
  /** Máximo de elementos de una lista/diccionario que se serializan. */
  maxItems: 50,
  /** Longitud máxima de una cadena serializada. */
  maxStringLength: 200,
} as const;
