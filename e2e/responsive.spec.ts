import { expect, test } from "@playwright/test";
import { fillPrediction } from "./helpers";

const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 800 },
  { name: "tablet", width: 820, height: 1180 },
  { name: "móvil", width: 390, height: 844 },
] as const;

for (const viewport of VIEWPORTS) {
  test(`diseño adaptable: ${viewport.name} (${viewport.width}×${viewport.height})`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Elige un patrón para comenzar" })).toBeVisible();
    await expect(page.getByTestId("start-range")).toBeVisible();

    const overflowStart = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflowStart).toBeLessThanOrEqual(1);

    await page.getByTestId("start-range").click();
    await expect(page.getByTestId("prediction-stage")).toBeVisible();
    await expect(page.getByTestId("stepper")).toBeVisible();
    await expect(page.getByTestId("stepper").locator("li")).toHaveCount(4);
    for (const label of ["Predicción", "Análisis", "Contraste", "Transferencia"]) {
      await expect(page.getByTestId("stepper")).toContainText(label);
    }

    const submitBox = await page.getByTestId("prediction-submit").boundingBox();
    expect(submitBox).not.toBeNull();
    expect(submitBox?.height ?? 0).toBeGreaterThanOrEqual(40);

    const overflowForm = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflowForm).toBeLessThanOrEqual(1);

    await fillPrediction(page, "prediction", {
      output: "2, 3, 4, 5",
      explanation: "range(2, 6) no incluye el 6.",
    });
    await page.getByTestId("prediction-submit").click();
    await expect(page.getByTestId("analysis-stage")).toBeVisible();
    await expect(page.getByTestId("run-main")).toBeVisible();

    const overflowAnalysis = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflowAnalysis).toBeLessThanOrEqual(1);
  });
}
