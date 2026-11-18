# Arquitectura de TRAZA (PACT 0.5)

## Capas

| Capa | Archivos | Responsabilidad |
|---|---|---|
| Interfaz | `src/App.vue`, `src/components/PACTProgress.vue`, `PredictionForm.vue`, `ExecutionReview.vue`, `TraceTable.vue` | Presenta las etapas PACT, recoge predicciones antes de ejecutar y muestra resultados y trazas reales. |
| Composable | `src/composables/useTraceEngine.ts` | Estado reactivo y ciclo de vida del motor. |
| Cliente | `src/engine/client.ts`, `browserWorker.ts`, `config.ts` | Promesas, mensajes tipados, timeouts, cancelación y reinicio del Worker. |
| Worker | `src/engine/pyodide.worker.ts` | Aloja Pyodide, valida el identificador de ejercicio y devuelve `ExecutionResult`. |
| Motor Python | `src/python/tracer.py` | Valida un subconjunto de Python, limita recursos y rastrea con `sys.settrace()`. |
| Dominio | `src/domain/*` | Tipos, normalización, validación del JSON, comparación, contenido PACT, diagnóstico, transferencia y persistencia local. |

El código Python se importa con `?raw` y se define en Pyodide al iniciar. La comunicación Python→TS es **una cadena JSON** validada por `parseEngineJson` (evita problemas de proxies/`Map` de Pyodide).

## Flujo PACT

La aplicación presenta cuatro etapas: **Predicción, Análisis, Contraste y Transferencia**. `src/domain/pact.ts` contiene las reglas para abrir cada etapa, comparar una predicción con `ExecutionResult`, determinar la primera divergencia y describir la transferencia de forma prudente. `src/domain/pactContent.ts` define los patrones, hipótesis y ejercicios fijos; el Worker sigue recibiendo solo sus identificadores, nunca predicciones ni código del estudiante.

Las predicciones incluyen salida esperada, número de iteraciones, secuencias de valores por iteración, explicación y confianza. La etapa de Contraste usa micropruebas diseñadas para distinguir hipótesis competidoras. Si el mismo resultado es compatible con varias, la evidencia se conserva como insuficiente para distinguirlas; las hipótesis no se etiquetan como verdades ni se usan para inferir comprensión definitiva. Transferencia informa si la observación es consistente, inconsistente o inconclusa, sin convertir la confianza declarada por el estudiante en una puntuación.

`src/domain/pactStorage.ts` persiste el avance con esquema versionado en `localStorage` del navegador actual. La interfaz permite desactivar el guardado y reiniciar la sesión. No hay cuenta, identificador de usuario ni backend.

## Protocolo de mensajes (`src/engine/messages.ts`)

- Interfaz → Worker: `{type:"init"}` · `{type:"run", requestId, exerciseId}`. No se envía código fuente.
- Worker → Interfaz: `{type:"status", status:"loading"|"ready"}` · `{type:"result", requestId, result}` · `{type:"error", phase, requestId?, message}`.
- Los resultados incluyen `errorKind` (`syntax`, `unsupported`, `resource` o `runtime`) y `errorLine` cuando corresponde. El parser valida esos campos; el contrato de eventos y el protocolo de mensajes se mantienen tipados.
- Timeouts predeterminados: 30 s para inicialización y 15 s por ejecución. Un timeout o fallo de infraestructura termina el Worker, rechaza las solicitudes pendientes y deja al cliente listo para crear otro.

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

## Carga local de Pyodide y pruebas de navegador

El runtime se copia de `node_modules/pyodide` a `public/pyodide/` (`scripts/copy-pyodide.mjs`) y se carga con `indexURL`. `optimizeDeps.exclude: ["pyodide"]` evita el pre-empaquetado con esbuild y `worker.format: "es"` fuerza un Worker ESM. Playwright verifica el Worker, la carga local de los recursos WASM y la ejecución del demo tanto en desarrollo como en el build servido por `vite preview`. El funcionamiento sin conexión no se ha probado.

## Límites de ejecución actuales

- El Worker ejecuta solo ejercicios de `EXERCISES`; el mensaje no puede traer código. El validador del tracer rechaza sintaxis fuera del subconjunto permitido antes de ejecutar el programa.
- `__builtins__` del programa se limita a `print` y `range`; se rechazan `import`, funciones definidas por el programa, `while`, bucles anidados, atributos, subíndices, comprehensions y otras construcciones no admitidas.
- Límites principales del tracer: fuente 4096 caracteres; AST 512 nodos/profundidad 48; enteros de hasta 53 bits; flotantes de magnitud hasta `1e100`; cadenas de hasta 1024 caracteres; colecciones de hasta 100 elementos; 50 variables; `range()` de hasta 1000 iteraciones; salida de hasta 8192 caracteres; 20 argumentos por `print`; 2000 snapshots. La normalización limita cada snapshot a profundidad 3 y 50 elementos por colección.
- La aritmética se comprueba antes y después de operar para evitar valores o colecciones fuera de límite. La salida se captura con `redirect_stdout`.
- Timeout de inicialización de 30 s y de ejecución de 15 s en el cliente; el Worker se termina al vencer.
- La interfaz solo permite los patrones y programas fijos incluidos en el catálogo. Las predicciones y explicaciones del estudiante no se envían al motor.
- El avance opcional se guarda localmente en el navegador; desactivar la persistencia evita guardar nuevos cambios y el control de reinicio permite borrar el progreso guardado.

## Límites y riesgos

1. **Un Worker y el validador AST no son un sandbox.** El alcance funcional reducido no debe presentarse como una frontera de seguridad. Actualmente solo corren ejercicios fijos; no se acepta código del usuario.
2. El timeout cliente limita el tiempo de ejecución observable y termina el Worker si vence; no reemplaza límites de recursos del sistema ni aislamiento de código hostil.
3. `sys.settrace` añade costo por evento. El número de eventos, operaciones y tamaños de valores tiene límites; aun así, esto no constituye una garantía de rendimiento para código arbitrario.
4. Trazado de funciones propias, recursión, generadores, `while` y bucles anidados: fuera del subconjunto admitido; no son parte de la experiencia.
5. La carga local del runtime se verifica con pruebas de navegador en desarrollo y producción; el funcionamiento offline no está verificado.
6. El build puede mostrar avisos de Vite por módulos `node:*` externalizados desde `pyodide.mjs`; estos avisos no impiden la compilación.
7. El progreso PACT se guarda solo en `localStorage` cuando la opción está activa; no se recopilan cuentas ni identificadores personales.
