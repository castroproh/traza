import type { ExerciseId } from "../domain/exercises";
import type { EngineStatus, ExecutionResult } from "../domain/types";
import { ENGINE_TIMEOUTS } from "./config";
import type { WorkerRequest, WorkerResponse } from "./messages";

/** Abstracción mínima de un Worker (permite probar sin navegador). */
export interface WorkerLike {
  post(message: WorkerRequest): void;
  listen(onMessage: (response: WorkerResponse) => void, onFailure: (reason: string) => void): void;
  terminate(): void;
}

export class EngineError extends Error {
  readonly kind: "init" | "run" | "timeout" | "worker" | "cancelled";
  constructor(kind: EngineError["kind"], message: string) {
    super(message);
    this.name = "EngineError";
    this.kind = kind;
  }
}

export interface ClientOptions {
  runTimeoutMs?: number;
  /** Tiempo máximo para que Pyodide termine de cargar. */
  initTimeoutMs?: number;
  onStatus?: (status: EngineStatus) => void;
}

interface Waiter<T> {
  resolve: (value: T) => void;
  reject: (reason: EngineError) => void;
}

export class TraceEngineClient {
  private worker: WorkerLike | null = null;
  private initPromise: Promise<void> | null = null;
  private initWaiter: Waiter<void> | null = null;
  private initTimer: ReturnType<typeof setTimeout> | null = null;
  private nextId = 1;
  private readonly pending = new Map<number, Waiter<ExecutionResult> & { timer: ReturnType<typeof setTimeout> }>();

  constructor(
    private readonly factory: () => WorkerLike,
    private readonly options: ClientOptions = {},
  ) {}

  /** Inicializa Pyodide una sola vez por Worker. Llamadas repetidas comparten la promesa. */
  init(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    let worker: WorkerLike;
    try {
      worker = this.factory();
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : "No se pudo crear el Worker.";
      this.options.onStatus?.("error");
      return Promise.reject(new EngineError("init", reason));
    }
    this.worker = worker;
    this.initPromise = new Promise<void>((resolve, reject) => {
      this.initWaiter = { resolve, reject };
    });
    this.initTimer = setTimeout(
      () => this.fail(new EngineError("timeout", "La carga de Python tardó demasiado.")),
      this.options.initTimeoutMs ?? ENGINE_TIMEOUTS.initializationMs,
    );
    worker.listen(
      (response) => this.handle(response),
      (reason) => this.fail(new EngineError("worker", reason)),
    );
    try {
      worker.post({ type: "init" });
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : "No se pudo iniciar el Worker.";
      this.fail(new EngineError("worker", reason));
      this.initPromise.catch(() => undefined);
      return this.initPromise;
    }
    this.options.onStatus?.("loading");
    this.initPromise.catch(() => undefined); // evita "unhandled rejection"; el llamador la recibe igualmente
    return this.initPromise;
  }

  async run(exerciseId: ExerciseId): Promise<ExecutionResult> {
    await this.init();
    const worker = this.worker;
    if (!worker) throw new EngineError("worker", "El motor no está disponible.");
    const requestId = this.nextId++;
    const timeoutMs = this.options.runTimeoutMs ?? ENGINE_TIMEOUTS.runMs;
    return new Promise<ExecutionResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.fail(new EngineError("timeout", "El programa tardó demasiado y se detuvo."));
      }, timeoutMs);
      this.pending.set(requestId, { resolve, reject, timer });
      try {
        worker.post({ type: "run", requestId, exerciseId });
      } catch (cause) {
        const reason = cause instanceof Error ? cause.message : "No se pudo enviar la ejecución.";
        this.fail(new EngineError("worker", reason));
      }
    });
  }

  /** Cancela la ejecución en curso y termina el Worker (recuperación explícita). */
  cancel(): void {
    this.fail(new EngineError("cancelled", "La ejecución se canceló."));
  }

  terminate(): void {
    this.fail(new EngineError("worker", "El motor se cerró."), false);
  }

  private handle(response: WorkerResponse): void {
    switch (response.type) {
      case "status":
        if (response.status === "ready") {
          if (this.initTimer) {
            clearTimeout(this.initTimer);
            this.initTimer = null;
          }
          this.initWaiter?.resolve();
          this.initWaiter = null;
        }
        this.options.onStatus?.(response.status);
        return;
      case "result": {
        const waiter = this.pending.get(response.requestId);
        if (!waiter) return;
        clearTimeout(waiter.timer);
        this.pending.delete(response.requestId);
        waiter.resolve(response.result);
        return;
      }
      case "error":
        if (response.phase === "init") {
          this.fail(new EngineError("init", response.message));
          return;
        }
        if (response.requestId !== undefined) {
          // Un error de ejecución deja el Worker en un estado incierto: se
          // termina para que la siguiente ejecución use un Worker limpio.
          this.fail(new EngineError("run", response.message));
        }
        return;
    }
  }

  /** Rechaza todo lo pendiente, destruye el Worker y deja el cliente listo para re-inicializar. */
  private fail(error: EngineError, notify = true): void {
    if (this.initTimer) {
      clearTimeout(this.initTimer);
      this.initTimer = null;
    }
    this.worker?.terminate();
    this.worker = null;
    this.initPromise = null;
    this.initWaiter?.reject(error);
    this.initWaiter = null;
    for (const waiter of this.pending.values()) {
      clearTimeout(waiter.timer);
      waiter.reject(error);
    }
    this.pending.clear();
    if (notify) this.options.onStatus?.("error");
  }
}
