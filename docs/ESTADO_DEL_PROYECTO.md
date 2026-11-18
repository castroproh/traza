# Estado del proyecto — Misión 0.2 (continuación)

Registro de lo que existe y de **cómo se verificó**. Última actualización: 2026-11-18 (continuación en este entorno).

## Resultado de esta sesión

La red para paquetes estuvo disponible (`npm ping` OK) y se pudo instalar y verificar con el toolchain real. Se ejecutó el siguiente paso técnico: **desbloquear la verificación del motor 0.1** (`npm install`, copia del runtime de Pyodide, correcciones mínimas de tipos/configuración para las versiones instaladas, y ejecución de `typecheck`, `test` y `build`).

Cambios realizados (sin alterar la lógica funcional del motor ni la UI, y sin eliminar archivos):
- `package.json` / `package-lock.json`: añadida devDependency `@types/node@^22` (necesaria para tipos Node en `tests/pyodide.integration.test.ts` y `vite.config.ts` bajo `vue-tsc`).
- `tsconfig.json`: añadido `"node"` a `compilerOptions.types`.
- `vite.config.ts`: añadido `// @ts-expect-error` en `plugins` por conflicto de tipos entre `@vitejs/plugin-vue` (tipado contra Vite 6) y el Vite 5 interno de Vitest 2.
- `tests/pyodide.integration.test.ts`: se pasa `indexURL` apuntando a `node_modules/pyodide/` al cargar Pyodide en Node/Vitest (evita rutas incorrectas del runtime en el entorno de pruebas; no cambia las aserciones).

Artefactos generados (ignorados por Git según `.gitignore`): `node_modules/`, `public/pyodide/`, `dist/`.

Estado de Git: repositorio inicializado, **sin commits**; archivos del proyecto sin rastrear y cambios de esta sesión sin confirmar.

## Entorno comprobado

- macOS (darwin), Node v26.8.1, npm 11.19.0, Python 3.11.9.
- Dependencias instaladas y resueltas a las versiones fijadas: `vue@3.5.13`, `vite@6.0.7`, `@vitejs/plugin-vue@5.2.1`, `vitest@2.1.8`, `typescript@5.6.3`, `vue-tsc@2.1.10`, `pyodide@0.27.2` (verificado con `npm ls ... --depth=0`).

## Clasificación de funciones

### Implementada y verificada en navegador
Ninguna. No se ejecutó `npm run dev`/`preview` ni pruebas E2E en navegador en esta sesión.

### Implementada y verificada en Pyodide (Node, integración real)
| Función | Evidencia |
|---|---|
| Carga de Pyodide 0.27.2 y definición de `run_traced()` con `src/python/tracer.py` | `tests/pyodide.integration.test.ts` ejecutado con Vitest real (7 pruebas). |
| Ejercicio demo `suma-1-3`: salida `6`, sin error | Integración real. |
| 3 iteraciones con `numero` = 1,2,3 y `total` posterior = 1,3,6 | Integración real. |
| Orden de eventos, `call` inicial, `return` con estado final, estados antes/después (init) | Integración real. |
| `import` bloqueado (`ImportError`) y errores de programa (`ZeroDivisionError`, evento `exception`) sin romper el motor | Integración real. |

Nota: la integración se ejecutó en Node cargando el runtime desde `node_modules/pyodide/` (no en navegador/Worker). La ruta de carga en Worker/navegador (`indexURL` desde `public/pyodide/`) no se ha verificado en navegador.

### Implementada y verificada en CPython
| Función | Evidencia |
|---|---|
| Tracer demo con `sys.settrace()` | Ejecutado en **CPython 3.11.9** (esta sesión): `output`/`snapshots`/`error` coinciden con `tests/fixtures/demo-trace.cpython.json`. Salida `6`. |
| Estados antes/después, `call`/`return` sin estado posterior inventado | Misma ejecución y comparación con fixture. |
| Error de sintaxis, `ZeroDivisionError` (evento `exception`), `import` bloqueado, límite de 2000 eventos (`TraceLimitError`) | Ejecutado en CPython 3.11.9 en esta sesión. `python3 -m py_compile src/python/tracer.py` OK. |
| Registros previos | Misión 0.1: ejecución en CPython 3.11.18, 3.12.3 y 3.13.18 con salida JSON idéntica al fixture. |

### Implementada y verificada en Node/Vitest (sin navegador)
| Función | Evidencia |
|---|---|
| `scripts/copy-pyodide.mjs` copia runtime a `public/pyodide/` | Ejecutado: copió `pyodide.asm.js`, `pyodide.asm.wasm`, `python_stdlib.zip`, `pyodide-lock.json`, `pyodide.js`, `pyodide.mjs`. |
| Tipado del proyecto (`vue-tsc --noEmit`) | `npm run typecheck` OK. |
| Pruebas unitarias/lógicas reales: dominio (normalize, parse/trace/rows, compare) y cliente de motor con Worker simulado/mensajes/errores | `npm test` (Vitest 2.1.8): **5 archivos, 47 pruebas aprobadas**, 0 omitidas, 0 errores. |
| Compilación de producción | `npm run build` OK (copia Pyodide + `vue-tsc --noEmit` + `vite build`). Genera `dist/` con `index.html`, assets, chunk del Worker (`pyodide.worker-*.js`) y `dist/pyodide/` con el runtime. |

### Implementada pero no verificada
- Interfaz Vue (`App.vue`, `TraceTable.vue`, `useTraceEngine.ts`, `styles.css`) en navegador real.
- Worker de módulo en navegador (`pyodide.worker.ts`, `browserWorker.ts`) cargando Pyodide desde `/pyodide/` y mostrando traza/salida en la UI.
- Flujo completo `npm run dev` / interacción de usuario (botón ejecutar, estados, tabla, salida).
- Funcionamiento sin conexión: no probado; no se afirma.
- Terminación por tiempo límite y reinicio del Worker en navegador ante ejecuciones reales (probado solo con Worker simulado en cliente).
- Accesibilidad y diseño adaptable en uso real.
- Bucles anidados, `while` complejos, funciones propias/recursión/generadores y trazado dentro de funciones: sin diseñar ni probar (según arquitectura).

### Pendiente
- Pruebas de extremo a extremo en navegador.
- Ciclo PACT, patrones diagnósticos, editor/código libre de estudiantes.
- Endurecimiento de seguridad para código de estudiantes (ver `ARQUITECTURA.md`).
- Interfaz para `StudentPrediction` (solo existe el tipo y `comparePrediction`).

### Observaciones y riesgos

- `vite build` emite advertencias de compatibilidad de navegador por módulos `node:*` externalizados desde `pyodide.mjs` (dependencia). La compilación finaliza correctamente; la carga real en navegador/Worker no se ha verificado.
- `npm audit` reporta vulnerabilidades en dependencias (informativo, no abordado en esta sesión).
- Git sin commits; el estado del repositorio no está consolidado en historial.

## Comandos verificados en esta sesión

```bash
npm install
npm ls vue vite typescript vitest pyodide @vitejs/plugin-vue vue-tsc --depth=0
node scripts/copy-pyodide.mjs
npm run typecheck
npm test
npm run build
# además: ejecuciones directas de src/python/tracer.py con CPython 3.11.9 y py_compile
```
