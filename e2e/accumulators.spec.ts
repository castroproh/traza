import { expect, test } from "@playwright/test";
import {
  chooseContrastOption,
  completeTransfer,
  startPattern,
  submitAccumulatorMainPrediction,
  waitForContrastEvidence,
  waitForEngine,
} from "./helpers";

test("ACUMULADORES: recorrido PACT completo y separación de hipótesis", async ({ page }) => {
  await startPattern(page, "ACUMULADORES");
  await submitAccumulatorMainPrediction(page);

  await waitForEngine(page);
  await page.getByTestId("run-main").click();
  await expect(page.getByTestId("main-output")).toBeVisible({ timeout: 120_000 });
  await expect(page.getByTestId("main-output")).toHaveText(/6/);
  await expect(page.getByText("La predicción coincide con la ejecución observada.")).toBeVisible();

  await page.getByTestId("go-contrast").click();
  await expect(page.getByTestId("contrast-stage")).toBeVisible();

  // Primera microprueba: valor final del acumulador.
  await chooseContrastOption(page, "6");
  await waitForContrastEvidence(page, 1);
  await expect(page.getByTestId("contrast-hypotheses")).toContainText("Acumulación correcta");
  await expect(page.getByTestId("contrast-hypotheses")).toContainText("apoyada");

  // La evidencia aún no separa H-ACC-02 de H-ACC-03: aparece otra microprueba.
  await expect(page.getByTestId("contrast-question")).toBeVisible();
  await chooseContrastOption(page, "16");
  await waitForContrastEvidence(page, 2);
  await expect(page.getByTestId("contrast-sufficient")).toBeVisible();
  await page.getByTestId("contrast-complete").click();

  await expect(page.getByTestId("transfer-stage")).toBeVisible();
  await completeTransfer(page, {
    output: "60, 80, 110, 150",
    explanation: "Cada mes se suma al ahorro anterior: 50+10, 60+20, 80+30, 110+40.",
    variables: { ahorro: "150", mes: "4" },
    iterations: "1, 2, 3, 4",
  });

  await expect(page.getByTestId("session-summary")).toBeVisible();
  await expect(page.getByTestId("summary-transfer-evidence")).toContainText("no demuestra");

  // El resumen separa apoyadas, contradichas y sin resolver.
  await expect(page.getByText(/Apoyadas:.*H-ACC-01/)).toBeVisible();
  await expect(page.getByText(/Contradichas:.*H-ACC-02/)).toBeVisible();
  await expect(page.getByText(/Contradichas:.*H-ACC-03/)).toBeVisible();
});
