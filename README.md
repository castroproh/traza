# TRAZA

**Recorrido PACT para el razonamiento algorítmico: predicción, análisis con Python real, contraste adaptativo y transferencia.**

> «TRAZA no te dice que estás mal. Te muestra qué evidencia hay detrás de cada explicación.»

TRAZA 0.7.0 integra el motor diagnóstico de la versión 0.6.0 en un recorrido educativo conectado. El estudiante predice lo que hará un programa, lo ejecuta de verdad en Pyodide, contrasta explicaciones rivales con micropruebas y aplica el concepto en un ejercicio nuevo. La sesión se guarda solo en el navegador y puede exportarse como JSON.

> **Estado honesto:** el recorrido PACT funciona y está cubierto por pruebas unitarias, de integración con Pyodide real y de navegador con Playwright/Chromium. La revisión pedagógica externa sigue **pendiente** (ver [`docs/REVISION_DOCENTE.md`](docs/REVISION_DOCENTE.md)). TRAZA no es una validación psicométrica ni una prueba de efectividad educativa. El Worker **no es un sandbox de seguridad** y esta versión no admite código libre de estudiantes.

## Recorrido

| Etapa | Qué hace el estudiante | Qué aporta TRAZA |
|---|---|---|
| **Predicción** | Escribe la salida esperada, variables, iteraciones, razonamiento y confianza (0–100). | Conserva la predicción original y la bloquea antes de ejecutar. No muestra la respuesta correcta. |
| **Análisis** | Ejecuta el programa real y compara. | Muestra salida, iteraciones, variables, seguimiento real y el primer punto de divergencia cuando es determinable. |
| **Contraste** | Responde micropruebas y las comprueba con Python. | Evidencia `supports` / `insufficient` / `contradicts`; selección adaptativa determinista y explicable. |
| **Transferencia** | Predice y ejecuta un ejercicio nuevo, con otros valores y contexto. | Compara la predicción con la ejecución y recuerda que un acierto aislado no demuestra comprensión consolidada. |
| **Resumen** | Revisa observaciones, inferencias y limitaciones. | Exporta la sesión completa con versión de esquema y sin datos personales. |

Patrones disponibles: **RANGE** (límite superior exclusivo de `range()`) y **ACUMULADORES** (conservación del estado). No se añaden todavía condicionales ni funciones; el plan está en [`docs/PLAN_PATRONES_0_8.md`](docs/PLAN_PATRONES_0_8.md).

## Tecnologías

Vue 3 · TypeScript estricto · Vite · Pyodide (Python en WebAssembly) · Web Worker de tipo módulo · `sys.settrace()` · CSS propio · Vitest · Playwright/Chromium · Git.

Versiones fijadas en `package.json`.

## Requisitos

- Node.js **22.12 o superior** (Vitest 5 requiere Node 22.12+, 24 o 26+).
- npm.
- Conexión a internet **solo** para `npm install` y, la primera vez, para descargar Chromium de Playwright.
- El runtime de Pyodide se sirve localmente desde `public/pyodide/`; no se carga desde un CDN.

## Comandos

```bash
npm ci                    # instalación reproducible desde el lockfile
npm run dev               # copia Pyodide a public/pyodide y arranca Vite
npm run build             # copia Pyodide, comprueba tipos y compila a dist/
npm run typecheck         # solo tipos
npm test                  # Vitest: dominio + integración real con Pyodide en Node
npx playwright install chromium   # una vez: descarga el navegador de E2E
npm run test:e2e          # Playwright/Chromium contra la app real y Pyodide real
```

`npm run test:e2e` arranca Vite en `127.0.0.1:4173`. Si ya hay un servidor en ese puerto, lo reutiliza fuera de CI.

## Arquitectura (resumen)

```
Vue
  ├─ App.vue                    recorrido PACT, etapa actual, resumen y exportación
  ├─ components/
  │    ├─ PredictionForm.vue    predicción bloqueada, confianza y revisión previa
  │    ├─ AnalysisSummary.vue   comparación y divergencia
  │    ├─ DiagnosticPanel.vue   hipótesis, microprueba, evidencias y límite
  │    └─ TraceTable.vue        seguimiento real de la ejecución
  ├─ usePact()                  sesión, transiciones validadas y persistencia
  └─ useTraceEngine()           estado del Worker/Pyodide y reinicio
        └─ TraceEngineClient    mensajes tipados, timeout, terminación y reinicio
             └─ Worker (ESM)    Pyodide + src/python/tracer.py
                  ├─ src/domain/pact/*        estado, análisis, resumen, persistencia
                  └─ src/domain/diagnosis/*   hipótesis, micropruebas, evidencia, selección
```

El código Python se importa con `?raw` y se define en Pyodide al iniciar. La comunicación Python→TS es una cadena JSON validada por `parseEngineJson`.

Detalle en [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md). Revisión de seguridad en [`docs/SEGURIDAD.md`](docs/SEGURIDAD.md).

### Cómo funciona el Worker

`src/engine/pyodide.worker.ts` es un Worker de tipo módulo. Carga Pyodide una sola vez (promesa memoizada), define `run_traced()` y atiende mensajes tipados. El mensaje de ejecución lleva un **identificador de ejercicio de una lista blanca**, nunca código. La interfaz no ofrece editor ni ejecución libre.

### Cómo funciona el contraste

- `src/domain/diagnosis/hypotheses.ts`: patrones e hipótesis con comportamiento esperado, evidencias, alternativas y limitaciones.
- `src/domain/diagnosis/microtests.ts`: 12 micropruebas con firmas de respuesta por hipótesis.
- `src/domain/diagnosis/evidence.ts`: reglas deterministas que asignan `supports` / `insufficient` / `contradicts` con explicación auditable.
- `src/domain/diagnosis/selection.ts`: selección determinista y explicable de la siguiente microprueba, con límite configurable por sesión.
- `src/domain/pact/session.ts`: máquina de estados, validación del esquema y persistencia local.
- `src/domain/pact/summary.ts`: resumen con observaciones, inferencias y limitaciones, y exportación versionada.

### Persistencia

- Clave: `traza:pact-session`; versión de esquema: `1`; instrumento: `0.7.0`.
- Se guarda la etapa, la predicción congelada, el análisis, las micropruebas respondidas, las evidencias, las hipótesis sin resolver, la transferencia y el estado de finalización.
- Al recargar, la sesión se valida y se reanuda en la etapa correcta. Las evidencias se **recalculan** desde las respuestas; no se confía ciegamente en el JSON guardado.
- Una sesión corrupta o incompatible muestra un aviso comprensible y permite descartarla **sin borrar otras claves** del navegador.
- No se recogen nombres, correos, contraseñas ni otros datos personales. El identificador de sesión es local y no personal.

## Verificación

Resultados de esta entrega (detalle en [`docs/ESTADO_DEL_PROYECTO.md`](docs/ESTADO_DEL_PROYECTO.md)):

- `npm ci`, `npm run typecheck` y `npm run build`: correctos.
- `npm test`: **17 archivos, 144 pruebas aprobadas, 0 omitidas, 0 fallidas**.
- `npm run test:e2e`: **11 pruebas aprobadas en Chromium con Pyodide real**.
- `npm audit`: **0 vulnerabilidades** en la fecha de la entrega.

## Limitaciones conocidas

- Solo se ejecutan ejercicios controlados de la lista blanca. No hay editor ni código libre.
- Un Web Worker **no es un sandbox de seguridad**. Ver riesgos y controles en `docs/SEGURIDAD.md`.
- Solo se rastrea código de nivel superior con `print` y `range`; no hay funciones definidas por el estudiante, recursión ni bucles anidados probados.
- La numeración de iteraciones es por bucle; los bucles anidados no están diseñados.
- Límite de 2000 eventos de traza y 15 s de tiempo límite en el cliente (termina el Worker).
- La confianza declarada no es una calificación y no se usa para diagnosticar.
- La transferencia es una observación puntual, no una medida de dominio consolidado.
- La revisión pedagógica externa y cualquier estudio de efectividad educativa están pendientes.
- `npm audit` refleja la base de avisos en un momento dado; debe repetirse periódicamente.

## Funciones implementadas

Ver `docs/ESTADO_DEL_PROYECTO.md` (distingue verificado / no verificado).

## Pendiente

Revisión pedagógica externa real, patrones de condicionales y funciones (0.8.0), medición de duración y usabilidad con estudiantes, y cualquier forma de aislamiento más fuerte antes de plantear código libre.
