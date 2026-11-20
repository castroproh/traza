import { expect, test } from "@playwright/test";
import {
  chooseContrastText,
  completeTransfer,
  startPattern,
  submitConditionalMainPrediction,
  waitForContrastEvidence,
  waitForEngine,
} from "./helpers";

test("CONDICIONALES: recorrido PACT completo con condición and", async ({ page }) => {
  await startPattern(page, "CONDICIONALES");
  await submitConditionalMainPrediction(page);

  // La predicción queda bloqueada y no se puede editar.
  await expect(page.getByTestId("prediction-locked")).toBeVisible();
  await expect(page.getByTestId("prediction-saved-output")).toHaveText("no puede conducir");

  await waitForEngine(page);
  await page.getByTestId("run-main").click();
  await expect(page.getByTestId("main-output")).toBeVisible({ timeout: 120_000 });
  await expect(page.getByTestId("main-output")).toHaveText(/no puede conducir/);
  await expect(page.getByText("La predicción coincide con la ejecución observada.")).toBeVisible();

  // La condición real, su resultado booleano y la rama ejecutada son visibles.
  const condition = page.getByTestId("trace-condition").first();
  await expect(condition).toBeVisible();
  await expect(condition).toContainText("permiso and edad >= 18");
  await expect(condition).toContainText("False");
  await expect(condition).toContainText("rama else");
  await expect(condition).toContainText("no se ejecutó el if");

  // Reproducción paso a paso: se puede retroceder y avanzar sin perder la tabla.
  await expect(page.getByTestId("trace-position")).toContainText(/Paso \d+ de \d+/);
  await page.getByTestId("trace-reset").click();
  await expect(page.getByTestId("trace-current")).toContainText("Inicio del programa");
  await page.getByTestId("trace-next").click();
  await expect(page.getByTestId("trace-position")).toContainText("Paso 2 de");
  await page.getByTestId("trace-show-all").click();

  await page.getByTestId("go-contrast").click();
  await expect(page.getByTestId("contrast-stage")).toBeVisible();

  // Selección adaptativa determinista con respuestas correctas.
  await chooseContrastText(page, "otra etapa");
  await waitForContrastEvidence(page, 1);
  await chooseContrastText(page, "recuperar");
  await waitForContrastEvidence(page, 2);
  await chooseContrastText(page, "fin de semana");
  await waitForContrastEvidence(page, 3);
  await chooseContrastText(page, "mayor de edad");
  await waitForContrastEvidence(page, 4);

  await expect(page.getByTestId("contrast-sufficient")).toBeVisible();
  await expect(page.getByTestId("contrast-hypotheses")).toContainText("Confusión entre and y or");
  await expect(page.getByTestId("contrast-hypotheses")).toContainText("contradicha");
  await page.getByTestId("contrast-complete").click();

  await expect(page.getByTestId("transfer-stage")).toBeVisible();
  await completeTransfer(page, {
    output: "realizar",
    explanation: "30 no supera 35 y no llueve; con or ninguna parte se cumple.",
    variables: {},
  });

  await expect(page.getByTestId("session-summary")).toBeVisible();
  await expect(page.getByTestId("summary-transfer-evidence")).toContainText("no demuestra");
  await expect(page.getByText(/Contradichas:.*H-COND-01/)).toBeVisible();
  await expect(page.getByText(/Contradichas:.*H-COND-03/)).toBeVisible();
});

test("CONDICIONALES: respuestas ambiguas terminan en evidencia insuficiente", async ({ page }) => {
  await startPattern(page, "CONDICIONALES");
  await submitConditionalMainPrediction(page);
  await waitForEngine(page);
  await page.getByTestId("run-main").click();
  await expect(page.getByTestId("main-output")).toBeVisible({ timeout: 120_000 });
  await page.getByTestId("go-contrast").click();

  for (let index = 1; index <= 6; index += 1) {
    await chooseContrastText(page, "No estoy seguro");
    await waitForContrastEvidence(page, index);
  }

  await expect(page.getByTestId("contrast-insufficient")).toBeVisible();
  await expect(page.getByTestId("contrast-hypotheses")).toContainText("sin resolver");
  await expect(page.getByTestId("contrast-complete")).toBeEnabled();
  await page.getByTestId("contrast-complete").click();

  await completeTransfer(page, {
    output: "realizar",
    explanation: "No se cumple ninguna parte del or.",
    variables: {},
  });

  await expect(page.getByTestId("session-summary")).toBeVisible();
  await expect(page.getByText(/Sin resolver:.*H-COND-01/)).toBeVisible();
  await expect(page.getByText(/Sin resolver:.*H-COND-03/)).toBeVisible();
});

test("CONDICIONALES: la sesión y el análisis se recuperan al recargar", async ({ page }) => {
  await startPattern(page, "CONDICIONALES");
  await submitConditionalMainPrediction(page);
  await waitForEngine(page);
  await page.getByTestId("run-main").click();
  await expect(page.getByTestId("main-output")).toBeVisible({ timeout: 120_000 });

  await page.reload();
  await expect(page.getByTestId("resume-banner")).toBeVisible();
  await expect(page.getByTestId("main-output")).toHaveText(/no puede conducir/);
  await expect(page.getByTestId("go-contrast")).toBeVisible();
});
