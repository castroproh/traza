import { EngineProtocolError } from "../domain/parseTrace";
import { EngineError } from "./client";

/** Mensajes cortos y comprensibles para principiantes. */
export function describeError(cause: unknown): string {
  if (cause instanceof EngineError) {
    switch (cause.kind) {
      case "timeout":
        return "El programa tardó demasiado y se detuvo. Puedes intentarlo de nuevo.";
      case "init":
        return "No se pudo cargar Python. Recarga la página e inténtalo otra vez.";
      case "worker":
        return "El motor de Python se detuvo. Vuelve a ejecutar el programa.";
      case "run":
        return "No se pudo ejecutar el programa. Inténtalo otra vez.";
    }
  }
  if (cause instanceof EngineProtocolError) {
    return "El motor devolvió datos que no se entienden. Vuelve a ejecutar el programa.";
  }
  return "Ocurrió un problema inesperado. Recarga la página e inténtalo otra vez.";
}

/** Error producido por el propio programa Python (p. ej. ZeroDivisionError). */
export function describeProgramError(message: string): string {
  return `El programa se detuvo con un error: ${message}`;
}
