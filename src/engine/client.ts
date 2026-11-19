import type { ExerciseId } from "../domain/exercises";
import { TRACE_LIMITS } from "../domain/limits";
import type { EngineStatus, ExecutionResult } from "../domain/types";
import type { WorkerRequest, WorkerResponse } from "./messages";

/** Abstracción mínima de un Worker (permite probar sin navegador). */
export interface WorkerLike {
  post(message: WorkerRequest): void;
  listen(onMessage: (response: WorkerResponse) => void, onFailure: (reason: string) => void): void;
  terminate(): void;
}

export class EngineError extends Error {
  readonly kind: "init" | "run" | "timeout" | "worker";
  constructor(kind: EngineError["kind"], message: string) {
    super(message);
    this.name = "EngineError";
    this.kind = kind;
  }
}

export interface ClientOptions {
  runTimeoutMs?: number;
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
    worker.listen(
      (response) => this.handle(response),
      (reason) => this.fail(new EngineError("worker", reason)),
    );
    worker.post({ type: "init" });
    this.options.onStatus?.("loading");
    this.initPromise.catch(() => undefined); // evita "unhandled rejection"; el llamador la recibe igualmente
    return this.initPromise;
  }

  async run(exerciseId: ExerciseId): Promise<ExecutionResult> {
    await this.init();
    const worker = this.worker;
    if (!worker) throw new EngineError("worker", "El motor no está disponible.");
    const requestId = this.nextId++;
    const timeoutMs = this.options.runTimeoutMs ?? TRACE_LIMITS.runTimeoutMs;
    return new Promise<ExecutionResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.fail(new EngineError("timeout", "El programa tardó demasiado y se detuvo."));
      }, timeoutMs);
      this.pending.set(requestId, { resolve, reject, timer });
      worker.post({ type: "run", requestId, exerciseId });
    });
  }

  terminate(): void {
    this.fail(new EngineError("worker", "El motor se cerró."), false);
  }

  private handle(response: WorkerResponse): void {
    switch (response.type) {
      case "status":
        if (response.status === "ready") this.initWaiter?.resolve();
        if (response.status === "ready") this.initWaiter = null;
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
          const waiter = this.pending.get(response.requestId);
          if (!waiter) return;
          clearTimeout(waiter.timer);
          this.pending.delete(response.requestId);
          waiter.reject(new EngineError("run", response.message));
        }
        return;
    }
  }

  /** Rechaza todo lo pendiente, destruye el Worker y deja el cliente listo para re-inicializar. */
  private fail(error: EngineError, notify = true): void {
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
