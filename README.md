# TRAZA

**Laboratorio de diagnóstico contrastivo adaptativo del razonamiento algorítmico.**

> «TRAZA no te dice que estás mal. Te dice POR QUÉ estás mal, y te lo demuestra».

Herramienta educativa para estudiantes principiantes de programación de bachillerato tecnológico. El ciclo completo (PACT: Predicción, Análisis, Contraste, Transferencia) **todavía no existe**. Esta versión (motor 0.1) solo demuestra que se puede ejecutar y seguir un programa Python real.

> **Estado honesto:** el código y las pruebas existen. En esta sesión se instalaron dependencias, se ejecutaron `typecheck`, Vitest real (47 pruebas, incluida integración con Pyodide en Node) y `build` con éxito. **Aún no se ha verificado** la ejecución en navegador (`npm run dev`), el Worker con Pyodide en la UI ni pruebas E2E/offline. Detalle en [`docs/ESTADO_DEL_PROYECTO.md`](docs/ESTADO_DEL_PROYECTO.md).

## Tecnologías

Vue 3 · TypeScript estricto · Vite · Pyodide (Python en WebAssembly) · Web Worker de tipo módulo · `sys.settrace()` · CSS propio · Vitest · Git.

Versiones fijadas en `package.json` (elegidas por compatibilidad conocida; **no instaladas**): vue 3.5.13, vite 6.0.7, @vitejs/plugin-vue 5.2.1, vitest 2.1.8, vue-tsc 2.1.10, typescript 5.6.3, pyodide 0.27.2.

## Requisitos

- Node.js 20 o superior (probado el código de lógica con Node 22).
- npm.
- Conexión a internet **solo** para `npm install`.

## Comandos

```bash
npm install          # instala dependencias (necesita red)
npm run dev          # copia Pyodide a public/pyodide y arranca Vite
npm run build        # copia Pyodide, comprueba tipos (vue-tsc) y compila a dist/
npm run typecheck    # solo tipos
npm test             # Vitest (incluye la prueba real con Pyodide)
```

## Arquitectura (resumen)

```
Vue (App.vue, TraceTable.vue)
  └─ useTraceEngine()            estado: idle/loading/ready/running/success/error
       └─ TraceEngineClient      mensajes tipados, timeout, reinicio del Worker
            └─ Worker (módulo)   Pyodide + src/python/tracer.py
```

Detalle en [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md).

### Cómo funciona el Worker

`src/engine/pyodide.worker.ts` es un Worker de tipo módulo (`new Worker(url, { type: "module" })`, sin `importScripts`). Carga Pyodide **una sola vez** (promesa memoizada), define `run_traced()` y atiende mensajes tipados. El mensaje de ejecución lleva un **identificador de ejercicio**, nunca código.

### Cómo funciona el seguimiento

`sys.settrace()` emite el evento `line` **antes** de ejecutar la línea. Por eso cada `line` abre una instrucción pendiente con su estado `before`; el estado observado al llegar el siguiente evento (otra línea, `return` o `exception`) es su `after`. No se calcula ni se inventa nada. El evento `call` marca el inicio y `return` el estado de finalización (sin `after`).

### Carga de recursos de Pyodide

Pensada **local**: `scripts/copy-pyodide.mjs` copia el runtime de `node_modules/pyodide` a `public/pyodide/` y el Worker lo pide con `indexURL`. No hay CDN en el código. **El funcionamiento sin conexión no se ha probado**, así que no se afirma.

## Limitaciones conocidas

- Solo se ejecuta el ejercicio de demostración (suma 1..3). No hay editor ni código libre.
- Un Web Worker **no es un sandbox de seguridad**. Ver riesgos pendientes en `docs/ARQUITECTURA.md`.
- Bucles anidados: la numeración de iteraciones es por bucle más interno y no se ha probado.
- Solo se rastrea el código de nivel superior; el rastreo dentro de funciones definidas por el estudiante no se ha diseñado.
- Límite de 2000 eventos por ejecución.

## Funciones implementadas

Ver `docs/ESTADO_DEL_PROYECTO.md` (distingue verificado / no verificado).

## Pendiente

Ciclo PACT, patrones diagnósticos, editor, endurecimiento de seguridad para código de estudiantes, pruebas en navegador, funcionamiento offline.
