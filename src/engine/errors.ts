import { EngineProtocolError } from "../domain/parseTrace";
import type { ProgramErrorKind } from "../domain/types";
import { EngineError } from "./client";

/** Mensajes cortos y comprensibles para principiantes. */
export function describeError(cause: unknown): string {
  if (cause instanceof EngineError) {
    switch (cause.kind) {
      case "timeout":
        return "La operación tardó demasiado y se detuvo. Puedes intentarlo de nuevo.";
      case "init":
        return "No se pudo cargar Python. Recarga la página e inténtalo otra vez.";
      case "worker":
        return "El motor de Python se detuvo. Vuelve a ejecutar el programa.";
      case "run":
        return "No se pudo ejecutar el programa. Inténtalo otra vez.";
      case "cancelled":
        return "La ejecución se canceló. Puedes volver a intentarlo.";
    }
  }
  if (cause instanceof EngineProtocolError) {
    return "El motor devolvió datos que no se entienden. Vuelve a ejecutar el programa.";
  }
  return "Ocurrió un problema inesperado. Recarga la página e inténtalo otra vez.";
}

/** Error producido por el propio programa Python (p. ej. ZeroDivisionError). */
export function describeProgramError(
  message: string,
  kind?: ProgramErrorKind,
  line?: number,
): string {
  const lineText = line === undefined ? "" : ` (línea ${line})`;
  if (message) return `${message.replace(/[.!?]+$/, "")}${lineText}.`;
  switch (kind) {
    case "syntax":
      return `Hay un error de sintaxis${lineText}.`;
    case "unsupported":
      return `Todavía no admitimos esta construcción${lineText}.`;
    case "resource":
      return `El programa superó un límite de tamaño o ejecución${lineText}.`;
    case "runtime":
      return `Ocurrió un error al ejecutar el programa${lineText}.`;
    default:
      return `Ocurrió un error en el programa${lineText}.`;
  }
}
