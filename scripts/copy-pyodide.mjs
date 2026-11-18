// Copia el runtime de Pyodide desde node_modules a public/pyodide/ para servirlo
// LOCALMENTE (sin CDN). Vite sirve public/ en desarrollo y lo copia a dist/ al compilar.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "node_modules", "pyodide");
const target = join(root, "public", "pyodide");

if (!existsSync(source)) {
  console.error("No se encontró node_modules/pyodide. Ejecuta `npm install` primero.");
  process.exit(1);
}

const required = ["pyodide.asm.js", "pyodide.asm.wasm", "python_stdlib.zip", "pyodide-lock.json"];
const optional = ["pyodide.js", "pyodide.mjs"];

mkdirSync(target, { recursive: true });
for (const name of required) {
  const from = join(source, name);
  if (!existsSync(from)) {
    console.error(`Falta ${name} en node_modules/pyodide. ¿Cambió la versión de Pyodide?`);
    process.exit(1);
  }
  copyFileSync(from, join(target, name));
}
for (const name of optional) {
  const from = join(source, name);
  if (existsSync(from)) copyFileSync(from, join(target, name));
}
console.log(`Runtime de Pyodide copiado a ${target}`);
