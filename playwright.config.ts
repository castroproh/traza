import { defineConfig, devices } from "@playwright/test";

/**
 * Pruebas de extremo a extremo con Chromium real y Pyodide real.
 *
 * No se mockea el motor: el Worker carga el runtime local de `public/pyodide/`
 * y ejecuta los mismos ejercicios de la lista blanca que usa el estudiante.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 180_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev -- --port 4173 --strictPort --host 127.0.0.1",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env["CI"],
    timeout: 180_000,
  },
});
