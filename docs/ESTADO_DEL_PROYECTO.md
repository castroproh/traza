# Estado del proyecto — TRAZA 0.7.0 (recorrido PACT completo)

Registro de lo que existe y de **cómo se verificó**. Última actualización: 2026-11-18.

## 1. Diagnóstico inicial de la entrega

Antes de implementar 0.7.0 se comprobó el estado real del repositorio:

| Ítem | Estado real encontrado |
|---|---|
| Dominio diagnóstico 0.6.0 | Presente en el árbol de trabajo (`src/domain/diagnosis/*`, `src/domain/session.ts`) con 101 pruebas aprobadas. |
| Ciclo PACT en interfaz | **Incompleto**: había predicción/análisis parciales y un panel diagnóstico aislado, sin flujo conectado. |
| Máquina de estados | **Ausente**. No existía `PACTStage` ni guardas de transición. |
| Persistencia PACT | **Ausente** para el recorrido completo; existía una sesión diagnóstica separada. |
| Transferencia | **Ausente**. |
| Resumen/exportación de sesión PACT | **Ausente**. |
| E2E en navegador | **Ausente**. |
| Dependencias | 11 vulnerabilidades conocidas (6 moderadas, 3 altas, 2 críticas), todas en la cadena de herramientas. |

El dominio 0.6.0 se conservó: no se reescribió la diagnosis ni se borraron sus pruebas.

## 2. Trabajo realizado en 0.7.0

### Dominio PACT nuevo (`src/domain/pact/`)

- `types.ts`: `PactStage`, tipos de sesión, versiones (`PACT_SCHEMA_VERSION = 1`,
  `PACT_INSTRUMENT_VERSION = "0.7.0"`) y `PactTransitionError`.
- `exercises.ts`: metadatos de los cuatro ejercicios PACT (principal y transferencia por patrón).
- `analysis.ts`: validación de predicción, comparación canónica, divergencia determinable y nota
  de evidencia de transferencia.
- `session.ts`: máquina de estados con guardas, selección de contraste, respuestas, transferencia,
  serialización, validación de esquema y persistencia en `localStorage`.
- `summary.ts`: resumen con observaciones, inferencias, limitaciones y exportación versionada.

### Interfaz

- `App.vue` reescrito como recorrido PACT con stepper, avisos de reanudación/error, vista educativa
  y vista técnica separadas, y exportación JSON.
- `PredictionForm.vue`: captura y revisión de predicción, confianza 0–100 y bloqueo antes de ejecutar.
- `AnalysisSummary.vue`: salida real, iteraciones, comparación y primera divergencia.
- `DiagnosticPanel.vue`: hipótesis en juego, microprueba adaptativa, ejecución real, evidencia,
  interpretación y límite de micropruebas.
- `usePact.ts`: estado reactivo; la interfaz nunca cambia de etapa sin una transición validada.
- `useTraceEngine.ts`: timeout, terminación y reinicio del Worker.

### Integración con el motor 0.6.0

- La selección adaptativa sigue siendo determinista y explicable, con límite de 8 micropruebas.
- Se conservan `supports` / `insufficient` / `contradicts`; el sistema no emite un diagnóstico
  definitivo automático.
- Las respuestas de incertidumbre («No estoy seguro», etc.) producen `insufficient` aunque no
  figuren en `ambiguityCases`.
- Se corrigió el trazador: la comprobación final de la cabecera de un `for` ya no cuenta como
  iteración (RANGE: 4 iteraciones; ACUMULADORES: 3).

### Ejercicios

| Patrón | Principal | Transferencia |
|---|---|---|
| RANGE | `range-principal`: `range(2, 6)` → `2, 3, 4, 5` | `range-transferencia`: `range(5, 9)` con contexto de páginas → `5, 6, 7, 8` |
| ACUMULADORES | `suma-1-3`: total `6` | `acumuladores-transferencia`: ahorro inicial 50, sumas 10/20/30/40 → `60, 80, 110, 150` |

La transferencia usa otros valores, otro contexto y otra representación; no reutiliza la secuencia
numérica exacta del ejercicio principal.

## 3. Verificación ejecutada

Resultados de esta entrega:

```bash
npm ci                 # OK (lockfile reproducible)
npm run typecheck      # OK
npm test               # 17 archivos, 144 pruebas aprobadas, 0 omitidas, 0 fallidas
npm run build          # OK
npm run test:e2e       # 11 pruebas aprobadas en Chromium con Pyodide real, 0 fallidas
npm audit              # 0 vulnerabilidades
```

Desglose de pruebas unitarias/de integración (17 archivos):

- Dominio base y trazador: `compare`, `normalize`, `trace`, `client`, `session`.
- Diagnóstico 0.6.0: `hypotheses`, `microtests`, `evidence`, `selection`, `profiles`, `pact-integration`.
- PACT 0.7.0: `state-machine`, `analysis`, `persistence`, `summary`, `exercises`.
- Integración real con Pyodide en Node: `pyodide.integration.test.ts`.

E2E (Playwright 1.65.1, Chromium, Pyodide real servido desde `public/pyodide/`):

1. RANGE: recorrido PACT completo con ejecución real y transferencia.
2. ACUMULADORES: recorrido completo y separación de hipótesis.
3. Persistencia: recarga y continúa en la etapa correcta sin repetir preguntas.
4. Evidencia insuficiente: se reconoce sin forzar una conclusión.
5. Recuperación si Pyodide no carga: aviso y reintento.
6. Sesión corrupta o incompatible: aviso y descarte sin tocar otras claves.
7. Motor real: error de ejercicio, timeout, terminación del Worker y recuperación.
8. Reinicio voluntario del motor desde la vista técnica.
9–11. Diseño adaptable: escritorio, tableta y móvil.

Las pruebas E2E **no mockean el motor**: cargan el runtime local y ejecutan los mismos ejercicios
de la lista blanca que usa el estudiante. La comprobación de error de ejercicio, timeout y
terminación se hace a nivel de navegador con importaciones dinámicas reales del Worker.

## 4. Criterios de aceptación (estado honesto)

| Criterio de la misión 0.7.0 | Estado | Evidencia |
|---|---|---|
| Un solo recorrido PACT conectado | Cumplido | Máquina de estados + E2E de ambos patrones. |
| Guardas explícitas entre etapas | Cumplido | `tests/pact/state-machine.test.ts`. |
| Predicción con salida, variables, iteraciones, explicación y confianza | Cumplido | `PredictionForm.vue`, validación y pruebas. |
| Revisión/bloqueo antes de enviar y nunca mostrar la respuesta correcta antes | Cumplido | UI de revisión; la solución canónica solo vive en el dominio. |
| La confianza no se convierte en calificación | Cumplido | Se guarda como dato; no participa en evidencia ni resumen como nota. |
| Análisis con Pyodide real, iteraciones, variables y comparación | Cumplido | `AnalysisSummary.vue`, `TraceTable.vue`, E2E real. |
| Primera divergencia determinable | Cumplido (con límite) | `analysis.ts`; si no es determinable se informa `unknown`. |
| Diagnóstico 0.6.0 integrado con evidencia y selección adaptativa | Cumplido | `DiagnosticPanel.vue`, pruebas de diagnóstico. |
| Sin diagnóstico definitivo automático; evidencia insuficiente posible | Cumplido | Estados `supports`/`insufficient`/`contradicts`; E2E de insuficiencia. |
| Límite configurable de micropruebas | Cumplido | `MAX_MICROTESTS_PER_SESSION = 8`; parámetro `maxPerSession`. |
| Transferencia independiente por patrón, sin pistas previas | Cumplido | Cuatro ejercicios con valores/contexto distintos. |
| Un acierto no se presenta como comprensión consolidada | Cumplido | Nota de evidencia puntual y limitaciones del resumen. |
| Persistencia local, versión, reanudación y borrado | Cumplido | `session.ts`, `tests/pact/persistence.test.ts`, E2E. |
| Mensaje de incompatibilidad/corrupción sin borrar otros datos | Cumplido | E2E de sesión corrupta; solo se elimina la clave PACT. |
| Sin datos personales | Cumplido | No hay formularios de identidad; exportación sin PII. |
| Interfaz educativa separada de la vista técnica | Cumplido | Pestañas/vistas en `App.vue`. |
| E2E obligatorio con navegador y Pyodide reales | Cumplido | 11 pruebas Playwright/Chromium. |
| Revisión de seguridad y límites del Worker | Cumplido como revisión | `docs/SEGURIDAD.md`; no se afirma que el Worker sea un sandbox. |
| Auditoría de dependencias | Cumplido | `npm audit` = 0 vulnerabilidades tras actualizar. |
| Documentación actualizada | Cumplido | README, arquitectura, estado, seguridad, revisión docente y plan 0.8. |
| Revisión pedagógica externa | **No cumplido** | Documento preparado; no hay revisiones reales. |
| Estudio de efectividad educativa | **No cumplido** | Fuera del alcance; no se inventan resultados. |
| Patrones de condicionales/funciones | **No implementados** | Plan en `docs/PLAN_PATRONES_0_8.md`. |

## 5. Limitaciones y pendientes

- Revisión pedagógica externa real: pendiente. No se han realizado revisiones ni estudios.
- Solo dos patrones y ejercicios controlados; no hay código libre ni editor.
- El Worker **no es un sandbox**; ver riesgos en `docs/SEGURIDAD.md`.
- No se rastrean funciones definidas por el estudiante, recursión, generadores ni bucles anidados.
- El timeout de la interfaz no se puede provocar con los ejercicios actuales (son cortos); el
  camino de timeout/terminación se verifica a nivel de motor en el navegador.
- No hay backend, cuentas ni sincronización entre dispositivos.
- No hay medición de usabilidad ni de duración con estudiantes reales.

## 6. Archivos principales modificados o añadidos

- Nuevos: `src/domain/pact/*`, `src/components/{PredictionForm,AnalysisSummary}.vue`,
  `src/composables/usePact.ts`, `tests/pact/*`, `e2e/*`, `playwright.config.ts`,
  `docs/{SEGURIDAD,PLAN_PATRONES_0_8,REVISION_DOCENTE}.md`.
- Modificados: `src/App.vue`, `src/components/DiagnosticPanel.vue`, `src/styles.css`,
  `src/domain/exercises.ts`, `src/domain/diagnosis/evidence.ts`,
  `src/domain/diagnosis/hypotheses.ts`, `src/engine/pyodide.worker.ts`,
  `src/python/tracer.py`, `tests/pyodide.integration.test.ts`, `tests/trace.test.ts`,
  `package.json`, `package-lock.json`, `vite.config.ts`, `README.md`,
  `docs/ARQUITECTURA.md`, `docs/ESTADO_DEL_PROYECTO.md`.

## 7. Registro histórico

- 0.6.0: instrumento diagnóstico (hipótesis, 12 micropruebas, evidencia, selección, exportación).
- 0.7.0: recorrido PACT completo con Pyodide real, persistencia, transferencia y E2E.
- Siguiente propuesto: 0.8.0, patrones de condicionales y funciones (ver plan).
