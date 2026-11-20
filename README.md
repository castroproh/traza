# TRAZA

**Recorrido PACT para el razonamiento algorítmico: predicción, análisis con Python real, contraste adaptativo y transferencia.**

> «TRAZA no te dice que estás mal. Te muestra qué evidencia hay detrás de cada explicación.»

TRAZA 0.8.0 integra cuatro patrones en un recorrido educativo conectado. El estudiante predice lo que hará un programa, lo ejecuta de verdad en Pyodide, contrasta explicaciones rivales con micropruebas y aplica el concepto en un ejercicio nuevo. La sesión se guarda solo en el navegador y puede exportarse como JSON.

> **Estado honesto:** el recorrido PACT funciona y está cubierto por pruebas unitarias, de integración con Pyodide real y de navegador con Playwright/Chromium. La revisión pedagógica externa sigue **pendiente** (ver [`docs/REVISION_DOCENTE.md`](docs/REVISION_DOCENTE.md)). TRAZA no es una validación psicométrica ni una prueba de efectividad educativa. El Worker **no es un sandbox de seguridad** y esta versión no admite código libre de estudiantes.

## Recorrido

| Etapa | Qué hace el estudiante | Qué aporta TRAZA |
|---|---|---|
| **Predicción** | Escribe la salida esperada, variables, iteraciones, razonamiento y confianza (0–100). | Conserva la predicción original y la bloquea antes de ejecutar. No muestra la respuesta correcta. |
| **Análisis** | Ejecuta el programa real y compara. | Muestra salida, iteraciones, variables, seguimiento real y el primer punto de divergencia cuando es determinable. |
| **Contraste** | Responde micropruebas y las comprueba con Python. | Evidencia `supports` / `insufficient` / `contradicts`; selección adaptativa determinista y explicable. |
| **Transferencia** | Predice y ejecuta un ejercicio nuevo, con otros valores y contexto. | Compara la predicción con la ejecución y recuerda que un acierto aislado no demuestra comprensión consolidada. |
| **Resumen** | Revisa observaciones, inferencias y limitaciones. | Exporta la sesión completa con versión de esquema y sin datos personales. |

Patrones implementados: **RANGE**, **ACUMULADORES**, **CONDICIONALES** (`and`, `or`, `not`) y **FUNCIONES** (`return`, parámetros y ámbito local). El instrumento tiene 11 hipótesis y 26 micropruebas (7, 7, 6 y 6 por patrón), además de cuatro ejercicios principales y cuatro de transferencia.

| Patrón | Hipótesis | Pruebas |
|---|---:|---:|
| RANGE | 2 | 7 |
| ACUMULADORES | 3 | 7 |
| CONDICIONALES | 3 | 6 |
| FUNCIONES | 3 | 6 |

El detalle pedagógico y las 26 preguntas están en [`docs/REVISION_DOCENTE.md`](docs/REVISION_DOCENTE.md); la arquitectura y límites están en [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md).

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
- `src/domain/diagnosis/microtests.ts`: 26 micropruebas con firmas de respuesta por hipótesis.
- `src/domain/diagnosis/evidence.ts`: reglas deterministas que asignan `supports` / `insufficient` / `contradicts` con explicación auditable.
- `src/domain/diagnosis/selection.ts`: selección determinista y explicable de la siguiente microprueba, con límite configurable por sesión.
- `src/domain/pact/session.ts`: máquina de estados, validación del esquema y persistencia local.
- `src/domain/pact/summary.ts`: resumen con observaciones, inferencias y limitaciones, y exportación versionada.

### Persistencia

- Clave: `traza:pact-session`; versión de esquema: `1`; instrumento: `0.8.0`.
- Se guarda la etapa, la predicción congelada, el análisis, las micropruebas respondidas, las evidencias, las hipótesis sin resolver, la transferencia y el estado de finalización.
- Al recargar, la sesión se valida y se reanuda en la etapa correcta. Las evidencias se **recalculan** desde las respuestas; no se confía ciegamente en el JSON guardado.
- Una sesión corrupta o incompatible muestra un aviso comprensible y permite descartarla **sin borrar otras claves** del navegador.
- No se recogen nombres, correos, contraseñas ni otros datos personales. El identificador de sesión es local y no personal.

## Simulador y prototipo bayesiano

`analysis/simulator/` compara el banco y los selectores con perfiles artificiales; no representa estudiantes reales. La suite canónica (semilla 2026, 20 sesiones por perfil) produjo 740 sesiones: resolución 91.62%, abstención 4.32%, falsos positivos 0% y 3.19 micropruebas por sesión. La resolución por patrón fue RANGE 100%, ACUMULADORES 85%, CONDICIONALES 90.5% y FUNCIONES 92%.

La exactitud RANGE de 66.7% del artefacto original incluía 20 perfiles `solo-conocidas` entre 60 observaciones, aunque esos perfiles están diseñados para no generalizar. Se corrigió el denominador para incluir solo perfiles con hipótesis estable; con esa definición el rerun da RANGE 100% (40/40). No cambiaron preguntas ni parámetros. Detalle: [`analysis/simulator/outputs/RESULTS.md`](analysis/simulator/outputs/RESULTS.md).

La ablación A–D, más los brazos que aíslan cada microprueba nueva, está en [`analysis/simulator/outputs/ABLATION.md`](analysis/simulator/outputs/ABLATION.md). El prototipo de `analysis/simulator/bayesian.py` es experimental, está fuera del motor de producción y usa verosimilitudes supuestas, no calibradas empíricamente.

## Verificación

Resultados de esta entrega (detalle en [`docs/ESTADO_DEL_PROYECTO.md`](docs/ESTADO_DEL_PROYECTO.md)):

- `npm ci`, `npm run typecheck` y `npm run build`: correctos.
- `npm test`: **20 archivos, 198 pruebas aprobadas**.
- `npm run test:e2e`: **17 pruebas aprobadas en Chromium con Pyodide real**, incluidos los cuatro patrones.
- `python3 -m unittest discover -s analysis/simulator -v`: **43 pruebas aprobadas**.
- `npm audit`: **0 vulnerabilidades**.

## Limitaciones conocidas

- Solo se ejecutan ejercicios controlados de la lista blanca. No hay editor ni código libre.
- Un Web Worker **no es un sandbox de seguridad**. Ver riesgos y controles en `docs/SEGURIDAD.md`.
- Los patrones de funciones y condicionales se verifican solo en los ejercicios de la lista blanca; no se acepta código libre del estudiante.
- La recursión, generadores, `while` complejos y bucles anidados no forman parte del contrato de esta versión.
- La numeración de iteraciones es por bucle; los bucles anidados no están diseñados.
- Límite de 2000 eventos de traza y 15 s de tiempo límite en el cliente (termina el Worker).
- La confianza declarada no es una calificación y no se usa para diagnosticar.
- La transferencia es una observación puntual, no una medida de dominio consolidado.
- La revisión pedagógica externa y cualquier estudio de efectividad educativa están pendientes.
- `npm audit` refleja la base de avisos en un momento dado; debe repetirse periódicamente.

## Funciones implementadas

Ver `docs/ESTADO_DEL_PROYECTO.md` (distingue verificado / no verificado).

## Pendiente

Revisión pedagógica externa real, medición de duración y usabilidad con estudiantes, fuentes oficiales para completar la matriz DGETI y cualquier forma de aislamiento más fuerte antes de plantear código libre. No hay datos educativos reales ni costos o impacto financiero verificados.
