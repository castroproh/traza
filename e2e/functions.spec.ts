import { expect, test } from "@playwright/test";
import {
  chooseContrastText,
  completeTransfer,
  startPattern,
  submitFunctionMainPrediction,
  waitForContrastEvidence,
  waitForEngine,
} from "./helpers";

test("FUNCIONES: recorrido PACT completo con return, parámetros y ámbito local", async ({ page }) => {
  await startPattern(page, "FUNCIONES");
  await submitFunctionMainPrediction(page);

  await expect(page.getByTestId("prediction-locked")).toBeVisible();
  await expect(page.getByTestId("prediction-saved-output")).toHaveText("20");

  await waitForEngine(page);
  await page.getByTestId("run-main").click();
  await expect(page.getByTestId("main-output")).toBeVisible({ timeout: 120_000 });
  await expect(page.getByTestId("main-output")).toHaveText(/20/);
  await expect(page.getByText("La predicción coincide con la ejecución observada.")).toBeVisible();

  // Entrada a la función con sus parámetros reales.
  const functionEntry = page.getByTestId("trace-row-3");
  await expect(functionEntry).toContainText("Entrada a calcular_total()");
  await expect(functionEntry).toContainText("5");
  await expect(functionEntry).toContainText("4");

  // Locales (precio, cantidad, total) y global (resultado) se muestran por separado.
  const table = page.locator("table.trace");
  await expect(table).toContainText("precio");
  await expect(table).toContainText("cantidad");
  await expect(table).toContainText("total");
  await expect(table).toContainText("resultado");

  // Salida de la función con el valor devuelto y regreso al punto de llamada.
  const functionReturn = page.getByTestId("trace-row-6");
  await expect(functionReturn).toContainText("Fin de calcular_total()");
  await expect(page.getByTestId("trace-return")).toContainText("return → 20");
  await expect(page.getByTestId("trace-globals").first()).toContainText("globales");

  // Reproducción secuencial sobre los marcos.
  await page.getByTestId("trace-reset").click();
  await page.getByTestId("trace-next").click();
  await page.getByTestId("trace-next").click();
  await page.getByTestId("trace-next").click();
  await expect(page.getByTestId("trace-current")).toContainText("calcular_total");
  await expect(page.getByTestId("trace-current")).toContainText("llamada #");
  await page.getByTestId("trace-select").selectOption("6");

  await page.getByTestId("go-contrast").click();
  await expect(page.getByTestId("contrast-stage")).toBeVisible();

  // 1) Ámbito local: el parámetro no modifica la variable del llamador.
  await chooseContrastText(page, "local global");
  await waitForContrastEvidence(page, 1);

  // 2) print frente a return y supervivencia de una variable local.
  // La microprueba termina con NameError: es un resultado real, no un fallo del motor.
  await chooseContrastText(page, "3 None NameError");
  await waitForContrastEvidence(page, 2);
  await expect(page.getByTestId("contrast-evidence")).toContainText("NameError");
  await expect(page.getByTestId("contrast-evidence")).toContainText("coincide");

  // 3) Orden de los argumentos.
  await chooseContrastText(page, "7");
  await waitForContrastEvidence(page, 3);

  await expect(page.getByTestId("contrast-sufficient")).toBeVisible();
  await expect(page.getByTestId("contrast-hypotheses")).toContainText("Confusión entre return y print");
  await page.getByTestId("contrast-complete").click();

  await expect(page.getByTestId("transfer-stage")).toBeVisible();
  await completeTransfer(page, {
    output: "Hola, Ana",
    explanation: "El parámetro nombre recibe «Ana» y la función devuelve el saludo construido.",
    variables: {},
  });

  await expect(page.getByTestId("session-summary")).toBeVisible();
  await expect(page.getByTestId("summary-transfer-evidence")).toContainText("no demuestra");
  await expect(page.getByText(/Contradichas:.*H-FUNC-01/)).toBeVisible();
  await expect(page.getByText(/Contradichas:.*H-FUNC-03/)).toBeVisible();
});

test("FUNCIONES: respuestas ambiguas terminan en evidencia insuficiente", async ({ page }) => {
  await startPattern(page, "FUNCIONES");
  await submitFunctionMainPrediction(page);
  await waitForEngine(page);
  await page.getByTestId("run-main").click();
  await expect(page.getByTestId("main-output")).toBeVisible({ timeout: 120_000 });
  await page.getByTestId("go-contrast").click();

  for (let index = 1; index <= 6; index += 1) {
    await chooseContrastText(page, "No estoy seguro");
    await waitForContrastEvidence(page, index);
  }

  await expect(page.getByTestId("contrast-insufficient")).toBeVisible();
  await expect(page.getByTestId("contrast-complete")).toBeEnabled();
  await page.getByTestId("contrast-complete").click();

  await completeTransfer(page, {
    output: "Hola, Ana",
    explanation: "No estoy seguro, pero el parámetro recibe el texto.",
    variables: {},
  });

  await expect(page.getByTestId("session-summary")).toBeVisible();
  await expect(page.getByText(/Sin resolver:.*H-FUNC-01/)).toBeVisible();
  await expect(page.getByText(/Sin resolver:.*H-FUNC-03/)).toBeVisible();
});

test("FUNCIONES: la sesión y el análisis se recuperan al recargar", async ({ page }) => {
  await startPattern(page, "FUNCIONES");
  await submitFunctionMainPrediction(page);
  await waitForEngine(page);
  await page.getByTestId("run-main").click();
  await expect(page.getByTestId("main-output")).toBeVisible({ timeout: 120_000 });

  await page.reload();
  await expect(page.getByTestId("resume-banner")).toBeVisible();
  await expect(page.getByTestId("main-output")).toHaveText(/20/);
  await expect(page.getByTestId("go-contrast")).toBeVisible();
});
