import { expect, test } from "@playwright/test";
import {
  chooseContrastOption,
  completeTransfer,
  startPattern,
  submitRangeMainPrediction,
  waitForContrastEvidence,
  waitForEngine,
} from "./helpers";

test("evidencia insuficiente: se reconoce sin forzar una conclusión", async ({ page }) => {
  await startPattern(page, "RANGE");
  await submitRangeMainPrediction(page);
  await waitForEngine(page);
  await page.getByTestId("run-main").click();
  await expect(page.getByTestId("main-output")).toBeVisible({ timeout: 120_000 });
  await page.getByTestId("go-contrast").click();

  // Se responden todas las micropruebas disponibles con incertidumbre explícita.
  for (let index = 1; index <= 6; index += 1) {
    await chooseContrastOption(page, "No estoy seguro");
    await waitForContrastEvidence(page, index);
  }

  await expect(page.getByTestId("contrast-insufficient")).toBeVisible();
  await expect(page.getByTestId("contrast-complete")).toBeEnabled();
  await page.getByTestId("contrast-complete").click();

  await completeTransfer(page, {
    output: "5, 6, 7, 8",
    explanation: "Aplico el mismo límite superior exclusivo.",
    variables: { pagina: "8" },
    iterations: "1, 2, 3, 4",
  });

  await expect(page.getByTestId("session-summary")).toBeVisible();
  await expect(page.getByText(/Sin resolver:.*H-RANGE-01/)).toBeVisible();
  await expect(page.getByText(/Sin resolver:.*H-RANGE-02/)).toBeVisible();
  await expect(page.getByText(/no permite decidir sobre H-RANGE-01/).first()).toBeVisible();
});
