import type { Page } from "@playwright/test";

export interface PredictionInputs {
  output: string;
  iterations: number;
  variables: Record<string, string>;
  explanation?: string;
  confidence?: number;
  submitLabel?: string;
  submit?: boolean;
}

export async function choosePattern(page: Page, pattern: "range" | "accumulator"): Promise<void> {
  const name = pattern === "range" ? /Límites de range/ : /Acumuladores/;
  await page.getByRole("button", { name }).click();
}

export async function registerPrediction(page: Page, input: PredictionInputs): Promise<void> {
  await page.getByLabel("Salida final que esperas").fill(input.output);
  await page.getByLabel("Número de iteraciones que esperas").fill(String(input.iterations));
  for (const [name, values] of Object.entries(input.variables)) {
    await page.getByLabel(`Valores previstos para ${name}, uno por iteración`).fill(values);
  }
  await page
    .getByLabel("Explicación de la predicción")
    .fill(input.explanation ?? "Seguí el valor de cada variable en el código.");
  if (input.confidence !== undefined) {
    await page.getByLabel("Nivel de confianza entre 0 y 100").fill(String(input.confidence));
  }
  if (input.submit !== false) {
    await page.getByRole("button", { name: input.submitLabel ?? "Registrar predicción y continuar" }).click();
  }
}
