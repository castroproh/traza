import { expect, test } from "@playwright/test";
import {
  fillPrediction,
  startPattern,
  submitRangeMainPrediction,
  waitForEngine,
} from "./helpers";

test("recuperación: si Pyodide no carga, se informa y se puede reintentar", async ({ page }) => {
  let failPyodide = true;
  await page.route("**/pyodide-lock.json", (route) =>
    failPyodide ? route.abort() : route.continue(),
  );

  await startPattern(page, "RANGE");
  await fillPrediction(page, "prediction", {
    output: "2, 3, 4, 5",
    explanation: "range(2, 6) termina antes de 6.",
  });
  await page.getByTestId("prediction-submit").click();

  await expect(page.getByTestId("engine-error")).toBeVisible({ timeout: 120_000 });
  await expect(page.getByTestId("retry-engine")).toBeVisible();

  failPyodide = false;
  await page.getByTestId("retry-engine").click();
  await expect(page.getByTestId("run-main")).toBeEnabled({ timeout: 120_000 });
  await page.getByTestId("run-main").click();
  await expect(page.getByTestId("main-output")).toBeVisible({ timeout: 120_000 });
  await expect(page.getByTestId("main-output")).toContainText("5");
});

test("sesión corrupta o incompatible: aviso claro y descarte sin tocar otros datos", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    window.localStorage.setItem("traza:pact-session", "{no-es-json");
    window.localStorage.setItem("traza:otra-clave", "se-conserva");
  });
  await page.reload();
  await expect(page.getByTestId("session-warning")).toContainText(/no es un JSON válido/i);
  await page.getByTestId("discard-session").click();
  await expect(page.getByRole("heading", { name: "Elige un patrón para comenzar" })).toBeVisible();
  expect(await page.evaluate(() => window.localStorage.getItem("traza:otra-clave"))).toBe(
    "se-conserva",
  );

  await page.evaluate(() => {
    window.localStorage.setItem(
      "traza:pact-session",
      JSON.stringify({ schemaVersion: 999, patternId: "RANGE" }),
    );
  });
  await page.reload();
  await expect(page.getByTestId("session-warning")).toContainText(/otra versión del esquema/i);
  await page.getByTestId("discard-session").click();
  await expect(page.getByRole("heading", { name: "Elige un patrón para comenzar" })).toBeVisible();
  expect(await page.evaluate(() => window.localStorage.getItem("traza:otra-clave"))).toBe(
    "se-conserva",
  );
});

test("motor real: error de ejercicio, timeout, terminación del Worker y recuperación", async ({
  page,
}) => {
  await page.goto("/");

  const invalid = await page.evaluate(async () => {
    const { TraceEngineClient } = await import("/src/engine/client.ts");
    const { createBrowserWorker } = await import("/src/engine/browserWorker.ts");
    const client = new TraceEngineClient(createBrowserWorker);
    try {
      await client.run("no-existe" as never);
      return { kind: "resolved", message: "" };
    } catch (cause) {
      const error = cause as { kind?: string; message?: string };
      return { kind: error.kind ?? "unknown", message: error.message ?? "" };
    } finally {
      client.terminate();
    }
  });
  expect(invalid.kind).toBe("run");
  expect(invalid.message).toMatch(/desconocido/i);

  const timeout = await page.evaluate(async () => {
    const { TraceEngineClient } = await import("/src/engine/client.ts");
    const { createBrowserWorker } = await import("/src/engine/browserWorker.ts");
    const client = new TraceEngineClient(createBrowserWorker, { runTimeoutMs: 1 });
    try {
      await client.run("suma-1-3");
      return { kind: "resolved", message: "" };
    } catch (cause) {
      const error = cause as { kind?: string; message?: string };
      return { kind: error.kind ?? "unknown", message: error.message ?? "" };
    }
  });
  expect(timeout.kind).toBe("timeout");
  expect(timeout.message).toMatch(/tardó demasiado/i);

  const terminated = await page.evaluate(async () => {
    const { TraceEngineClient } = await import("/src/engine/client.ts");
    const { createBrowserWorker } = await import("/src/engine/browserWorker.ts");
    const client = new TraceEngineClient(createBrowserWorker);
    await client.init();
    const pending = client.run("suma-1-3");
    client.terminate();
    try {
      await pending;
      return { kind: "resolved", message: "" };
    } catch (cause) {
      const error = cause as { kind?: string; message?: string };
      return { kind: error.kind ?? "unknown", message: error.message ?? "" };
    }
  });
  expect(terminated.kind).toBe("worker");

  const recovered = await page.evaluate(async () => {
    const { TraceEngineClient } = await import("/src/engine/client.ts");
    const { createBrowserWorker } = await import("/src/engine/browserWorker.ts");
    const client = new TraceEngineClient(createBrowserWorker);
    try {
      const result = await client.run("suma-1-3");
      return { success: result.success, output: result.output };
    } finally {
      client.terminate();
    }
  });
  expect(recovered.success).toBe(true);
  expect(recovered.output.trim()).toBe("6");
});

test("reinicio voluntario del motor desde la vista técnica", async ({ page }) => {
  await startPattern(page, "RANGE");
  await submitRangeMainPrediction(page);

  await page.getByText("Vista técnica del motor").click();
  await expect(page.getByTestId("restart-engine")).toBeVisible();
  await page.getByTestId("restart-engine").click();

  await waitForEngine(page);
  await page.getByTestId("run-main").click();
  await expect(page.getByTestId("main-output")).toBeVisible({ timeout: 120_000 });
});
