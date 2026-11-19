import { expect, test } from "@playwright/test";
import { choosePattern, registerPrediction } from "./pact-helpers";

test("carga Pyodide local y muestra los pasos reales del ejercicio", async ({ page }) => {
  const runtimeRequests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.includes("/pyodide/")) runtimeRequests.push(request.url());
  });

  await page.goto("/");
  await expect(page.getByRole("status")).toHaveText("Python listo", { timeout: 60_000 });
  await choosePattern(page, "range");
  await registerPrediction(page, {
    output: "6",
    iterations: 3,
    variables: { numero: "1, 2, 3", total: "1, 3, 6" },
  });
  await page.getByRole("button", { name: "Ejecutar programa" }).click();
  await expect(page.getByRole("heading", { name: "Ejecución real" })).toBeVisible();
  await expect(page.getByLabel("Salida del programa")).toHaveText("6");

  const bodyRows = page.locator("tbody tr").filter({ hasText: "total = total + numero" });
  const values = await bodyRows.evaluateAll((rows) =>
    rows.map((row) => Array.from(row.querySelectorAll("td"), (cell) => cell.textContent?.trim() ?? "")),
  );
  expect(values.map((row) => row[3])).toEqual(["1", "2", "3"]);
  expect(values.map((row) => row[5])).toEqual(["1", "3", "6"]);
  await expect(page.getByRole("region", { name: "Tabla de seguimiento" })).toBeVisible();

  expect(runtimeRequests.length).toBeGreaterThan(0);
  for (const request of runtimeRequests) {
    expect(new URL(request).origin).toBe(new URL(page.url()).origin);
  }
  expect(runtimeRequests.some((request) => request.includes("pyodide.asm.wasm"))).toBe(true);
});

test("muestra un error de carga y recupera el Worker al reintentar", async ({ page }) => {
  let allowRetry = false;
  let workerRequests = 0;
  await page.context().route("**/src/engine/pyodide.worker.ts*", async (route) => {
    workerRequests += 1;
    if (!allowRetry) {
      await route.fulfill({
        status: 200,
        contentType: "text/javascript",
        body: "throw new Error('test-only Worker startup failure')",
      });
      return;
    }
    await route.continue();
  });

  await page.goto("/");
  await expect(page.getByText("El motor de Python se detuvo. Vuelve a ejecutar el programa."))
    .toBeVisible({ timeout: 60_000 });
  expect(workerRequests).toBeGreaterThan(0);
  allowRetry = true;
  await page.getByRole("button", { name: "Reintentar motor" }).click();
  await expect(page.getByRole("status")).toHaveText("Python listo", { timeout: 60_000 });
  await choosePattern(page, "range");
  await registerPrediction(page, {
    output: "6",
    iterations: 3,
    variables: { numero: "1, 2, 3", total: "1, 3, 6" },
  });
  await page.getByRole("button", { name: "Ejecutar programa" }).click();
  await expect(page.locator(".python-status")).toHaveText("Ejecución terminada", { timeout: 60_000 });
  await expect(page.getByLabel("Salida del programa")).toHaveText("6");
});

test("interrumpe un Worker ocupado y reutiliza Pyodide después del timeout y un error de programa", async ({ page }) => {
  await page.goto("/tests/e2e/timeout-harness.html");
  await page.getByRole("button", { name: "Probar timeout y recuperación" }).click();

  await expect(page.getByTestId("timeout-error")).toHaveText(
    "La operación tardó demasiado y se detuvo. Puedes intentarlo de nuevo.",
    { timeout: 30_000 },
  );
  await expect(page.getByTestId("first-recovery")).toHaveText("6", { timeout: 60_000 });
  await expect(page.getByTestId("program-error")).toHaveText(
    "No se puede dividir entre cero (línea 2).",
  );
  await expect(page.getByTestId("second-recovery")).toHaveText("6");
});
