import { expect, type Page } from "@playwright/test";

export const STORAGE_KEY = "traza:pact-session";
export const LEGACY_KEY = "traza:diagnostic-session";

const START_BUTTONS = {
  RANGE: "start-range",
  ACUMULADORES: "start-accumulators",
  CONDICIONALES: "start-condicionales",
  FUNCIONES: "start-funciones",
} as const;

export type E2EPattern = keyof typeof START_BUTTONS;

export async function startPattern(page: Page, pattern: E2EPattern): Promise<void> {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Elige un patrón para comenzar" })).toBeVisible();
  await page.getByTestId(START_BUTTONS[pattern]).click();
  await expect(page.getByTestId("prediction-stage")).toBeVisible();
}

export async function submitConditionalMainPrediction(page: Page): Promise<void> {
  await fillPrediction(page, "prediction", {
    output: "no puede conducir",
    explanation: "Tiene permiso, pero 16 no llega a 18; con and hacen falta las dos condiciones.",
  });
  await page.getByTestId("prediction-submit").click();
  await expect(page.getByTestId("analysis-stage")).toBeVisible();
}

export async function submitFunctionMainPrediction(page: Page): Promise<void> {
  await fillPrediction(page, "prediction", {
    output: "20",
    explanation: "La función devuelve precio * cantidad: 5 * 4 = 20.",
    variables: { resultado: "20" },
  });
  await page.getByTestId("prediction-submit").click();
  await expect(page.getByTestId("analysis-stage")).toBeVisible();
}

/**
 * Elige una opción de contraste por su texto visible. Playwright normaliza los
 * espacios del nombre accesible, así que las respuestas multilínea se pueden
 * indicar con espacios (por ejemplo: "local global").
 */
export async function chooseContrastText(page: Page, name: string): Promise<void> {
  const options = page.getByTestId("contrast-options");
  await expect(options).toBeVisible();
  await options.getByRole("radio", { name, exact: true }).check();
  await page.getByTestId("contrast-check").click();
}

export async function waitForEngine(page: Page): Promise<void> {
  const runMain = page.getByTestId("run-main");
  await expect(runMain).toBeVisible();
  await expect(runMain).toBeEnabled({ timeout: 120_000 });
}

export async function fillPrediction(
  page: Page,
  prefix: string,
  input: {
    output: string;
    explanation: string;
    variables?: Record<string, string>;
    iterations?: string;
  },
): Promise<void> {
  await page.getByTestId(`${prefix}-output`).fill(input.output);
  await page.getByTestId(`${prefix}-explanation`).fill(input.explanation);
  for (const [name, value] of Object.entries(input.variables ?? {})) {
    await page.getByTestId(`${prefix}-variable-${name}`).fill(value);
  }
  if (input.iterations !== undefined) {
    await page.getByTestId(`${prefix}-iterations`).fill(input.iterations);
  }
  await expect(page.getByTestId(`${prefix}-submit`)).toBeEnabled();
}

export async function submitRangeMainPrediction(page: Page): Promise<void> {
  await fillPrediction(page, "prediction", {
    output: "2, 3, 4, 5",
    explanation: "range(2, 6) empieza en 2 y termina antes de 6.",
    variables: { numero: "5" },
    iterations: "1, 2, 3, 4",
  });
  await page.getByTestId("prediction-submit").click();
  await expect(page.getByTestId("analysis-stage")).toBeVisible();
}

export async function submitAccumulatorMainPrediction(page: Page): Promise<void> {
  await fillPrediction(page, "prediction", {
    output: "6",
    explanation: "Se conserva el total: 0+1=1, 1+2=3, 3+3=6.",
    variables: { total: "6", numero: "3" },
    iterations: "1, 2, 3",
  });
  await page.getByTestId("prediction-submit").click();
  await expect(page.getByTestId("analysis-stage")).toBeVisible();
}

export async function chooseContrastOption(page: Page, name: string): Promise<void> {
  const options = page.getByTestId("contrast-options");
  await expect(options).toBeVisible();
  await options.getByRole("radio", { name, exact: true }).check();
  await page.getByTestId("contrast-check").click();
}

export async function waitForContrastEvidence(page: Page, count: number): Promise<void> {
  await expect(page.getByTestId("contrast-evidence").locator("article")).toHaveCount(count, {
    timeout: 120_000,
  });
}

export async function completeTransfer(
  page: Page,
  input: {
    output: string;
    explanation: string;
    variables: Record<string, string>;
    iterations?: string;
  },
): Promise<void> {
  await fillPrediction(page, "transfer", input);
  await page.getByTestId("transfer-submit").click();
  await expect(page.getByTestId("run-transfer")).toBeVisible();
  await expect(page.getByTestId("run-transfer")).toBeEnabled({ timeout: 120_000 });
  await page.getByTestId("run-transfer").click();
  await expect(page.getByTestId("transfer-output")).toBeVisible({ timeout: 120_000 });
  await page.getByTestId("complete-session").click();
  await expect(page.getByTestId("session-summary")).toBeVisible();
}

export async function storedSession(page: Page): Promise<Record<string, unknown> | null> {
  return page.evaluate((key) => {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
  }, STORAGE_KEY);
}
