import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { choosePattern, registerPrediction } from "./pact-helpers";

test("completa PACT de range(), recupera la sesión y permite reiniciarla", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  await expect(page.getByRole("status")).toHaveText("Python listo", { timeout: 60_000 });
  await choosePattern(page, "range");

  await expect(page.getByRole("button", { name: /Transferencia/ })).toBeDisabled();
  await expect(page.getByLabel("Salida del programa")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Ejecutar programa" })).toHaveCount(0);
  await mkdir("screenshots", { recursive: true });
  await registerPrediction(page, {
    output: "10",
    iterations: 4,
    variables: { numero: "1, 2, 3, 4", total: "1, 3, 6, 10" },
    submit: false,
  });
  await page.screenshot({ path: "screenshots\\traza-05-prediccion.png", fullPage: true });
  await page.getByRole("button", { name: "Registrar predicción y continuar" }).click();
  await expect(page.getByRole("heading", { name: "Análisis" })).toBeVisible();
  await expect(page.getByLabel("Salida del programa")).toHaveCount(0);
  await page.getByRole("button", { name: "Ejecutar programa" }).click();
  await expect(page.getByLabel("Salida del programa")).toHaveText("6", { timeout: 60_000 });
  await expect(page.getByText(/La primera diferencia aparece en la iteración 4/)).toBeVisible();
  await expect(page.getByRole("region", { name: "Tabla de seguimiento" })).toBeVisible();
  await page.screenshot({ path: "screenshots\\traza-05-analisis.png", fullPage: true });

  await page.getByRole("button", { name: "Continuar a Contraste" }).click();
  await expect(page.getByRole("heading", { name: /Explicaciones posibles/ })).toBeVisible();
  await registerPrediction(page, {
    output: "0\n1\n2\n3",
    iterations: 4,
    variables: { numero: "0, 1, 2, 3" },
    submitLabel: "Registrar predicción",
  });
  await page.getByRole("button", { name: "Ejecutar microprueba" }).click();
  await expect(page.getByText("Evidencia que apoya")).toBeVisible();
  await expect(page.getByText("La respuesta inclusiva predice cuatro vueltas")).toBeVisible();

  await registerPrediction(page, {
    output: "2\n3\n4\n5",
    iterations: 4,
    variables: { numero: "2, 3, 4, 5" },
    submitLabel: "Registrar predicción",
  });
  await page.getByRole("button", { name: "Ejecutar microprueba" }).last().click();
  await expect(page.locator(".evidence-panel").last().getByText("Evidencia que apoya")).toBeVisible();
  await page.getByRole("button", { name: "Continuar a Transferencia" }).click();

  await expect(page.getByRole("heading", { name: "Predice primero en esta situación nueva" })).toBeVisible();
  await registerPrediction(page, {
    output: "3",
    iterations: 3,
    variables: { paquete: "4, 5, 6", procesados: "1, 2, 3" },
    confidence: 0,
    submitLabel: "Registrar predicción",
  });
  await expect(page.getByLabel("Salida del programa")).toHaveCount(0);
  await page.getByRole("button", { name: "Ejecutar ejercicio nuevo" }).click();
  await expect(page.getByLabel("Salida del programa")).toHaveText("3", { timeout: 60_000 });
  await expect(page.getByRole("heading", { name: "Resultado de transferencia" })).toBeVisible();
  await expect(page.getByText(/Un acierto aislado no demuestra por sí solo/)).toBeVisible();

  await page.reload();
  await expect(page.getByRole("status").filter({ hasText: "Se recuperó el avance" })).toBeVisible();
  await expect(page.getByLabel("Salida del programa")).toHaveText("3", { timeout: 60_000 });
  await page.getByRole("button", { name: "Reiniciar sesión" }).click();
  await expect(page.getByRole("heading", { name: "Elige un patrón para investigar" })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("traza:pact-session:v1"))).toBeNull();
});

test("contrasta las tres hipótesis de acumuladores y prueba transferencia", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("status")).toHaveText("Python listo", { timeout: 60_000 });
  await choosePattern(page, "accumulator");
  await expect(page.getByLabel("Salida del programa")).toHaveCount(0);
  await registerPrediction(page, {
    output: "6",
    iterations: 3,
    variables: { numero: "1, 2, 3", total: "1, 3, 6" },
  });
  await page.getByRole("button", { name: "Ejecutar programa" }).click();
  await expect(page.getByLabel("Salida del programa")).toHaveText("6", { timeout: 60_000 });
  await expect(page.getByText("Evidencia de esta microprueba")).toHaveCount(0);
  await page.getByRole("button", { name: "Continuar a Contraste" }).click();

  await registerPrediction(page, {
    output: "9",
    iterations: 3,
    variables: { precio: "2, 3, 4", subtotal: "2, 5, 9" },
    submitLabel: "Registrar predicción",
  });
  await page.getByRole("button", { name: "Ejecutar microprueba" }).click();
  const firstEvidence = page.locator(".evidence-panel").first();
  await expect(firstEvidence.getByText("Evidencia insuficiente")).toHaveCount(2);
  await expect(firstEvidence.getByText("Evidencia que contradice")).toBeVisible();

  await registerPrediction(page, {
    output: "9",
    iterations: 3,
    variables: { pago: "2, 3, 4", saldo: "2, 5, 9" },
    submitLabel: "Registrar predicción",
  });
  await page.getByRole("button", { name: "Ejecutar microprueba" }).last().click();
  const secondEvidence = page.locator(".evidence-panel").last();
  await expect(secondEvidence.getByText("Evidencia que apoya")).toBeVisible();
  await expect(secondEvidence.getByText("H3 — Ignora el valor inicial", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Continuar a Transferencia" }).click();
  await registerPrediction(page, {
    output: "14",
    iterations: 3,
    variables: { recarga: "2, 3, 4", saldo: "7, 10, 14" },
    submitLabel: "Registrar predicción",
  });
  await page.getByRole("button", { name: "Ejecutar ejercicio nuevo" }).click();
  await expect(page.getByLabel("Salida del programa")).toHaveText("14", { timeout: 60_000 });
  await expect(page.getByText(/predicción y explicación son consistentes/)).toBeVisible();
});

test("mantiene la interfaz dentro del ancho de ventana y permite desactivar el guardado", async ({ page }) => {
  await page.goto("/");
  await page.setViewportSize({ width: 1440, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByLabel("Guardar avance en este navegador").uncheck();
  await choosePattern(page, "range");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(await page.evaluate(() => localStorage.getItem("traza:pact-session:v1"))).toBeNull();
  await expect(page.getByRole("button", { name: /Transferencia/ })).toBeDisabled();
});
