import { expect, test } from "@playwright/test";
import { choosePattern, registerPrediction } from "./pact-helpers";

test("el bundle de producción carga Pyodide local y ejecuta el ejercicio", async ({ page }) => {
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
  await expect(page.getByLabel("Salida del programa")).toHaveText("6");

  const bodyRows = page.locator("tbody tr").filter({ hasText: "total = total + numero" });
  const values = await bodyRows.evaluateAll((rows) =>
    rows.map((row) => Array.from(row.querySelectorAll("td"), (cell) => cell.textContent?.trim() ?? "")),
  );
  expect(values.map((row) => row[3])).toEqual(["1", "2", "3"]);
  expect(values.map((row) => row[5])).toEqual(["1", "3", "6"]);
  expect(runtimeRequests.some((request) => request.includes("pyodide.asm.wasm"))).toBe(true);
  for (const request of runtimeRequests) {
    expect(new URL(request).origin).toBe(new URL(page.url()).origin);
  }
});
