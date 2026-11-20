/**
 * Exporta el banco diagnóstico real de TRAZA a JSON para el simulador Python.
 *
 * Uso: `npm run export:bank`
 * No forma parte del bundle: solo se ejecuta en desarrollo/análisis.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const target = join(root, "analysis", "simulator", "bank.json");

const server = await createServer({
  root,
  server: { middlewareMode: true },
  appType: "custom",
  optimizeDeps: { noDiscovery: true, include: [] },
  logLevel: "error",
});

try {
  const module = await server.ssrLoadModule("/src/domain/diagnosis/export.ts");
  const bank = module.buildBankExport();
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(bank, null, 2)}\n`, "utf-8");
  console.log(
    `Banco exportado: ${bank.hypotheses.length} hipótesis, ${bank.microtests.length} micropruebas → ${target}`,
  );
} finally {
  await server.close();
}
