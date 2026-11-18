import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Vitest 2 incluye Vite 5 internamente; el plugin se tipa contra Vite 6.
  // @ts-expect-error conflicto de tipos entre versiones de Vite (plugin vs vitest)
  plugins: [vue()],
  // Pyodide requiere un Worker de tipo módulo: el bundle del Worker debe ser ESM.
  worker: { format: "es" },
  // El paquete `pyodide` carga su propio WASM; no debe pre-empaquetarse con esbuild.
  optimizeDeps: { exclude: ["pyodide"] },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
