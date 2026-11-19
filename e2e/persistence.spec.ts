import { expect, test } from "@playwright/test";
import {
  chooseContrastOption,
  fillPrediction,
  startPattern,
  storedSession,
  submitRangeMainPrediction,
  waitForContrastEvidence,
  waitForEngine,
} from "./helpers";

test("persistencia: recarga y continúa en la etapa correcta sin repetir preguntas", async ({ page }) => {
  await startPattern(page, "RANGE");
  await submitRangeMainPrediction(page);
  await waitForEngine(page);
  await page.getByTestId("run-main").click();
  await expect(page.getByTestId("main-output")).toBeVisible({ timeout: 120_000 });

  // Recarga durante el análisis: la etapa y el resultado se recuperan.
  await page.reload();
  await expect(page.getByTestId("resume-banner")).toBeVisible();
  await expect(page.getByTestId("analysis-stage")).toBeVisible();
  await expect(page.getByTestId("main-output")).toContainText("2");

  await page.getByTestId("go-contrast").click();
  await chooseContrastOption(page, "0, 1, 2");
  await waitForContrastEvidence(page, 1);
  await expect(page.getByTestId("contrast-complete")).toBeEnabled();

  // Recarga tras responder: la evidencia se reconstruye y no se repite la microprueba.
  await page.reload();
  await expect(page.getByTestId("resume-banner")).toBeVisible();
  await expect(page.getByTestId("contrast-stage")).toBeVisible();
  await expect(page.getByTestId("contrast-evidence").locator("article")).toHaveCount(1);
  await expect(page.getByTestId("contrast-microtest")).toHaveCount(0);
  await expect(page.getByTestId("contrast-complete")).toBeEnabled();

  let session = await storedSession(page);
  expect(session?.["stage"]).toBe("contrast");
  const contrast = session?.["contrast"] as { answers?: unknown[] } | undefined;
  expect(contrast?.answers).toHaveLength(1);

  // Continúa a transferencia y recarga también allí.
  await page.getByTestId("contrast-complete").click();
  await expect(page.getByTestId("transfer-stage")).toBeVisible();
  await fillPrediction(page, "transfer", {
    output: "5, 6, 7, 8",
    explanation: "El límite 9 no se imprime.",
    variables: { pagina: "8" },
    iterations: "1, 2, 3, 4",
  });
  await page.getByTestId("transfer-submit").click();
  await expect(page.getByTestId("transfer-locked")).toBeVisible();

  await page.reload();
  await expect(page.getByTestId("resume-banner")).toBeVisible();
  await expect(page.getByTestId("transfer-stage")).toBeVisible();
  await expect(page.getByTestId("transfer-locked")).toBeVisible();
  await expect(page.getByTestId("run-transfer")).toBeEnabled({ timeout: 120_000 });

  session = await storedSession(page);
  expect(session?.["stage"]).toBe("transfer");
});
