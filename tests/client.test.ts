import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EngineError, TraceEngineClient, type WorkerLike } from "../src/engine/client";
import { describeError, describeProgramError } from "../src/engine/errors";
import { isWorkerRequest, type WorkerRequest, type WorkerResponse } from "../src/engine/messages";
import type { ExecutionResult } from "../src/domain/types";

class FakeWorker implements WorkerLike {
  posted: WorkerRequest[] = [];
  terminated = false;
  postError: Error | null = null;
  private onMessage: (r: WorkerResponse) => void = () => undefined;
  private onFailure: (reason: string) => void = () => undefined;
  post(message: WorkerRequest): void {
    if (this.postError) throw this.postError;
    this.posted.push(message);
  }
  listen(onMessage: (r: WorkerResponse) => void, onFailure: (reason: string) => void): void {
    this.onMessage = onMessage;
    this.onFailure = onFailure;
  }
  terminate(): void {
    this.terminated = true;
  }
  reply(response: WorkerResponse): void {
    this.onMessage(response);
  }
  crash(reason: string): void {
    this.onFailure(reason);
  }
}

const okResult: ExecutionResult = { success: true, output: "6\n", snapshots: [], durationMs: 1 };

describe("mensajes tipados", () => {
  it("reconoce solicitudes válidas y rechaza el resto", () => {
    expect(isWorkerRequest({ type: "init" })).toBe(true);
    expect(isWorkerRequest({ type: "run", requestId: 1, exerciseId: "suma-1-3" })).toBe(true);
    expect(isWorkerRequest({ type: "run", requestId: 0, exerciseId: "suma-1-3" })).toBe(false);
    expect(isWorkerRequest({ type: "run", requestId: Number.MAX_SAFE_INTEGER + 1, exerciseId: "suma-1-3" })).toBe(false);
    expect(isWorkerRequest({ type: "run" })).toBe(false);
    expect(isWorkerRequest("hola")).toBe(false);
    expect(isWorkerRequest(null)).toBe(false);
  });
});

describe("TraceEngineClient", () => {
  let workers: FakeWorker[];
  const factory = () => {
    const w = new FakeWorker();
    workers.push(w);
    return w;
  };

  beforeEach(() => {
    workers = [];
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it("inicializa una sola vez aunque se llame varias veces", async () => {
    const statuses: string[] = [];
    const client = new TraceEngineClient(factory, { onStatus: (s) => statuses.push(s) });
    const a = client.init();
    const b = client.init();
    expect(workers).toHaveLength(1);
    expect(workers[0]?.posted).toEqual([{ type: "init" }]);
    workers[0]?.reply({ type: "status", status: "loading" });
    workers[0]?.reply({ type: "status", status: "ready" });
    await Promise.all([a, b]);
    expect(statuses).toEqual(["loading", "loading", "ready"]);
  });

  it("envía el id del ejercicio (no código) y resuelve con el resultado", async () => {
    const client = new TraceEngineClient(factory);
    const pending = client.run("suma-1-3");
    workers[0]?.reply({ type: "status", status: "ready" });
    await vi.advanceTimersByTimeAsync(0);
    const request = workers[0]?.posted.find((m) => m.type === "run");
    expect(request).toEqual({ type: "run", requestId: 1, exerciseId: "suma-1-3" });
    workers[0]?.reply({ type: "result", requestId: 1, result: okResult });
    await expect(pending).resolves.toEqual(okResult);
  });

  it("rechaza si falla la inicialización y permite reintentar con un Worker nuevo", async () => {
    const client = new TraceEngineClient(factory);
    const first = client.init();
    workers[0]?.reply({ type: "error", phase: "init", message: "wasm no encontrado" });
    await expect(first).rejects.toMatchObject({ kind: "init" });
    expect(workers[0]?.terminated).toBe(true);
    void client.init();
    expect(workers).toHaveLength(2);
  });

  it("rechaza una inicialización bloqueada y permite crear otro Worker", async () => {
    const client = new TraceEngineClient(factory, { initTimeoutMs: 1000 });
    const first = client.init();
    const assertion = expect(first).rejects.toMatchObject({ kind: "timeout" });
    await vi.advanceTimersByTimeAsync(1001);
    await assertion;
    expect(workers[0]?.terminated).toBe(true);
    void client.init();
    expect(workers).toHaveLength(2);
  });

  it("rechaza si la ejecución devuelve un error", async () => {
    const client = new TraceEngineClient(factory);
    const pending = client.run("suma-1-3");
    workers[0]?.reply({ type: "status", status: "ready" });
    await vi.advanceTimersByTimeAsync(0);
    workers[0]?.reply({ type: "error", phase: "run", requestId: 1, message: "falló" });
    await expect(pending).rejects.toMatchObject({ kind: "run", message: "falló" });
    expect(workers[0]?.terminated).toBe(true);
  });

  it("detiene el Worker si se pasa el tiempo límite", async () => {
    const client = new TraceEngineClient(factory, { runTimeoutMs: 1000 });
    const pending = client.run("suma-1-3");
    const assertion = expect(pending).rejects.toMatchObject({ kind: "timeout" });
    workers[0]?.reply({ type: "status", status: "ready" });
    await vi.advanceTimersByTimeAsync(1001);
    await assertion;
    expect(workers[0]?.terminated).toBe(true);
  });

  it("recrea el Worker tras un timeout y correlaciona solicitudes concurrentes", async () => {
    const client = new TraceEngineClient(factory, { runTimeoutMs: 1000 });
    const timedOut = client.run("suma-1-3");
    const timeoutAssertion = expect(timedOut).rejects.toMatchObject({ kind: "timeout" });
    workers[0]?.reply({ type: "status", status: "ready" });
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(1001);
    await timeoutAssertion;
    expect(workers[0]?.terminated).toBe(true);

    const first = client.run("suma-1-3");
    const second = client.run("suma-1-3");
    workers[1]?.reply({ type: "status", status: "ready" });
    await vi.advanceTimersByTimeAsync(0);
    const requests = workers[1]?.posted.filter((message) => message.type === "run");
    expect(requests?.map((message) => (message.type === "run" ? message.requestId : 0))).toEqual([2, 3]);
    workers[1]?.reply({ type: "result", requestId: 3, result: { ...okResult, output: "second" } });
    workers[1]?.reply({ type: "result", requestId: 2, result: { ...okResult, output: "first" } });
    await expect(first).resolves.toMatchObject({ output: "first" });
    await expect(second).resolves.toMatchObject({ output: "second" });
  });

  it("cierra el Worker y rechaza solicitudes canceladas", async () => {
    const client = new TraceEngineClient(factory);
    const pending = client.run("suma-1-3");
    const assertion = expect(pending).rejects.toMatchObject({ kind: "cancelled" });
    workers[0]?.reply({ type: "status", status: "ready" });
    await vi.advanceTimersByTimeAsync(0);
    client.cancel();
    await assertion;
    expect(workers[0]?.terminated).toBe(true);
  });

  it("limpia la solicitud si postMessage falla", async () => {
    const client = new TraceEngineClient(factory);
    const pending = client.run("suma-1-3");
    const assertion = expect(pending).rejects.toMatchObject({ kind: "worker" });
    workers[0]!.postError = new Error("postMessage failed");
    workers[0]?.reply({ type: "status", status: "ready" });
    await vi.advanceTimersByTimeAsync(0);
    await assertion;
    expect(workers[0]?.terminated).toBe(true);
  });

  it("convierte un fallo del Worker en un error y deja de esperar", async () => {
    const client = new TraceEngineClient(factory);
    const pending = client.init();
    workers[0]?.crash("se cayó");
    await expect(pending).rejects.toBeInstanceOf(EngineError);
  });

  it("si no se puede crear el Worker, rechaza con error de inicialización", async () => {
    const client = new TraceEngineClient(() => {
      throw new Error("sin soporte");
    });
    await expect(client.init()).rejects.toMatchObject({ kind: "init" });
  });
});

describe("describeError", () => {
  it("da mensajes cortos en español", () => {
    expect(describeError(new EngineError("timeout", "x"))).toMatch(/tardó demasiado/);
    expect(describeError(new EngineError("init", "x"))).toMatch(/cargar Python/);
    expect(describeError(new EngineError("cancelled", "x"))).toMatch(/canceló/);
    expect(describeError(new Error("raro"))).toMatch(/inesperado/);
    expect(describeProgramError("No se puede dividir entre cero.", "runtime", 2)).toBe(
      "No se puede dividir entre cero (línea 2).",
    );
    expect(describeProgramError("", "resource", 3)).toMatch(/límite.*línea 3/);
  });
});
