import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import {
  chooseContrastOption,
  completeTransfer,
  fillPrediction,
  startPattern,
  storedSession,
  waitForContrastEvidence,
  waitForEngine,
} from "./helpers";

test("RANGE: recorrido PACT completo con ejecución real y transferencia", async ({ page }) => {
  await startPattern(page, "RANGE");

  // Predicción deliberadamente incompleta: permite comprobar la divergencia.
  await fillPrediction(page, "prediction", {
    output: "2, 3, 4",
    explanation: "Creo que range(2, 6) termina en 4.",
    variables: { numero: "4" },
    iterations: "1, 2, 3",
  });
  await page.getByTestId("prediction-submit").click();
  await expect(page.getByTestId("analysis-stage")).toBeVisible();
  await expect(page.getByTestId("prediction-saved-output")).toHaveText("2, 3, 4");

  await waitForEngine(page);
  await page.getByTestId("run-main").click();
  await expect(page.getByTestId("main-output")).toBeVisible({ timeout: 120_000 });
  await expect(page.getByTestId("main-output")).toContainText("2");
  await expect(page.getByTestId("main-output")).toContainText("5");
  await expect(page.getByTestId("main-analysis")).toBeVisible();
  await expect(page.getByTestId("main-divergence")).toContainText(/iteraciones|línea 1/i);
  await expect(page.getByText("Hay diferencias entre tu predicción y la ejecución.")).toBeVisible();

  await page.getByTestId("go-contrast").click();
  await expect(page.getByTestId("contrast-stage")).toBeVisible();
  await expect(page.getByTestId("contrast-question")).toBeVisible();

  await chooseContrastOption(page, "0, 1, 2");
  await waitForContrastEvidence(page, 1);
  await expect(page.getByTestId("contrast-evidence")).toContainText("0, 1, 2");
  await expect(page.getByTestId("contrast-sufficient")).toBeVisible();
  await expect(page.getByTestId("contrast-complete")).toBeEnabled();
  await page.getByTestId("contrast-complete").click();

  await expect(page.getByTestId("transfer-stage")).toBeVisible();
  await completeTransfer(page, {
    output: "5, 6, 7, 8",
    explanation: "range(5, 9) empieza en 5 y se detiene antes de 9.",
    variables: { pagina: "8" },
    iterations: "1, 2, 3, 4",
  });

  await expect(page.getByTestId("session-summary")).toBeVisible();
  await expect(page.getByTestId("summary-transfer-evidence")).toContainText("no demuestra");
  await expect(page.getByText(/Apoyadas: H-RANGE-02/)).toBeVisible();
  await expect(page.getByText(/no es una validación psicométrica/i).first()).toBeVisible();

  const session = await storedSession(page);
  expect(session?.["stage"]).toBe("completed");

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByTestId("export-session").click(),
  ]);
  const path = await download.path();
  if (!path) throw new Error("La descarga no generó un archivo local.");
  const exported = JSON.parse(await readFile(path, "utf8")) as {
    schemaVersion: number;
    instrumentVersion: string;
    session: { stage: string; patternId: string };
    summary: { supported: string[]; contradicted: string[] };
  };
  expect(exported.schemaVersion).toBe(1);
  expect(exported.instrumentVersion).toBe("0.8.0");
  expect(exported.session.patternId).toBe("RANGE");
  expect(exported.session.stage).toBe("completed");
  expect(exported.summary.supported).toContain("H-RANGE-02");
  expect(exported.summary.contradicted).toContain("H-RANGE-01");
});
