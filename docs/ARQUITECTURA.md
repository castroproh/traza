# Arquitectura de TRAZA (motor 0.1)

## Capas

| Capa | Archivos | Responsabilidad |
|---|---|---|
| Interfaz | `src/App.vue`, `src/components/TraceTable.vue` | Muestra código, botón, estado, tabla y salida. No inventa datos. |
| Composable | `src/composables/useTraceEngine.ts` | Estado reactivo y ciclo de vida del motor. |
| Cliente | `src/engine/client.ts`, `browserWorker.ts` | Promesas, mensajes tipados, tiempo límite, reinicio del Worker. |
| Worker | `src/engine/pyodide.worker.ts` | Aloja Pyodide; valida el ejercicio; devuelve `ExecutionResult`. |
| Motor Python | `src/python/tracer.py` | `run_traced()`: ejecuta y rastrea con `sys.settrace()`. |
| Dominio | `src/domain/*` | Tipos, normalización, validación del JSON, filas de tabla, comparación. |

El código Python se importa con `?raw` y se define en Pyodide al iniciar. La comunicación Python→TS es **una cadena JSON** validada por `parseEngineJson` (evita problemas de proxies/`Map` de Pyodide).

## Protocolo de mensajes (`src/engine/messages.ts`)

- Interfaz → Worker: `{type:"init"}` · `{type:"run", requestId, exerciseId}`
- Worker → Interfaz: `{type:"status", status:"loading"|"ready"}` · `{type:"result", requestId, result}` · `{type:"error", phase, requestId?, message}`

## Modelo de captura de estados

Evento `line` = **antes** de ejecutar la línea.

1. `line` N llega → se cierra la pendiente anterior con `after = estado actual` y se abre una nueva con `before = estado actual`.
2. `return`/`exception` cierran la pendiente. `return` añade un evento de finalización con `before = estado final` y **sin** `after`.
3. Iteración: cuenta ejecuciones del encabezado del bucle (detectado con `ast`). El encabezado cuya siguiente línea queda fuera del cuerpo es la comprobación de salida y **no** recibe número de iteración.

Estados observados con CPython 3.13.18 (ver `ESTADO_DEL_PROYECTO.md`):

| Paso | Línea | `numero` antes→después | `total` antes→después |
|---|---|---|---|
| 1 | 1 | — → — | — → 0 |
| 2 (it. 1) | 2 | — → 1 | 0 → 0 |
| 3 (it. 1) | 3 | 1 → 1 | 0 → 1 |
| 4 (it. 2) | 2 | 1 → 2 | 1 → 1 |
| 5 (it. 2) | 3 | 2 → 2 | 1 → 3 |
| 6 (it. 3) | 2 | 2 → 3 | 3 → 3 |
| 7 (it. 3) | 3 | 3 → 3 | 3 → 6 |
| 8 (salida) | 2 | 3 → 3 | 6 → 6 |
| 9 | 4 | 3 → 3 | 6 → 6 |

## Cambios al contrato de datos propuesto

- `TraceSnapshot.event` añade `"call"` (inicio).
- `TraceSnapshot.detail?: string` para el mensaje de una excepción.
- `before`/`after` usan `VariableState` (`Record<string, TraceValue>`), no `unknown`.
- Los valores no compatibles llegan como `{ "unsupported": "<motivo>" }`.
- `EngineStatus` se define en `types.ts`.

## Carga local de Pyodide

El runtime se copia de `node_modules/pyodide` a `public/pyodide/` (`scripts/copy-pyodide.mjs`) y se carga con `indexURL`. `optimizeDeps.exclude: ["pyodide"]` evita el pre-empaquetado con esbuild y `worker.format: "es"` fuerza un Worker ESM. **Sin verificar** en navegador ni sin conexión.

## Límites de ejecución actuales

- El Worker ejecuta solo ejercicios de `EXERCISES`; el mensaje no puede traer código.
- `__builtins__` del programa se reduce a `print` y `range`: los `import` fallan.
- Máximo 2000 eventos de traza (`TraceLimitError`), tiempo límite de 15 s en el cliente (termina el Worker).
- La salida se captura con `redirect_stdout`.

## Riesgos antes de permitir código de estudiantes

1. **Un Worker no es un sandbox.** Con builtins reducidos, el código sigue pudiendo escapar por introspección (`().__class__.__mro__…`). Hay que tratarlo como código hostil.
2. Bucles infinitos dentro de una sola instrucción no emiten eventos: el límite de 2000 no los detiene; solo el tiempo límite (terminar el Worker).
3. Consumo de memoria sin tope (listas enormes, cadenas).
4. `sys.settrace` penaliza el rendimiento; programas largos serán lentos.
5. Posible interferencia del código del estudiante con `sys.settrace`/`sys.gettrace`.
6. Trazado de funciones propias, recursión, generadores, `while` complejos y bucles anidados: sin diseñar ni probar.
7. Aislamiento recomendado: iframe con `sandbox` y CSP estricta, y/o Worker aislado por ejecución.
8. Privacidad: esta versión no recopila datos de estudiantes ni personales.
