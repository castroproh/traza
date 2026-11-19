# Arquitectura de TRAZA (0.7.0)

## Capas

| Capa | Archivos | Responsabilidad |
|---|---|---|
| Interfaz | `src/App.vue`, `src/components/PredictionForm.vue`, `src/components/AnalysisSummary.vue`, `src/components/DiagnosticPanel.vue`, `src/components/TraceTable.vue` | Presenta el recorrido PACT y las vistas educativa/técnica. No inventa datos ni decide transiciones. |
| Composable PACT | `src/composables/usePact.ts` | Estado reactivo de la sesión y llamadas a transiciones validadas. |
| Composable motor | `src/composables/useTraceEngine.ts` | Estado reactivo del Worker/Pyodide, timeout y reinicio. |
| Cliente | `src/engine/client.ts`, `src/engine/browserWorker.ts` | Promesas, mensajes tipados, tiempo límite, terminación y reinicio del Worker. |
| Worker | `src/engine/pyodide.worker.ts` | Aloja Pyodide; valida el identificador de ejercicio; devuelve `ExecutionResult`. |
| Motor Python | `src/python/tracer.py` | `run_traced()`: ejecuta y rastrea con `sys.settrace()`. |
| Dominio PACT | `src/domain/pact/*` | Máquina de estados, análisis/divergencia, ejercicios, persistencia y resumen/exportación. |
| Diagnóstico | `src/domain/diagnosis/*` | Hipótesis, micropruebas, matrices, evidencia, selección, validación y exportación del banco. |

El código Python se importa con `?raw` y se define en Pyodide al iniciar. La comunicación Python→TS es **una cadena JSON** validada por `parseEngineJson` (evita problemas con proxies/`Map` de Pyodide).

## Máquina de estados PACT

`src/domain/pact/session.ts` es la única fuente de verdad de las transiciones. La interfaz solo
invoca funciones que devuelven una sesión nueva o lanzan `PactTransitionError`.

```
prediction ──submitPrediction()──▶ analysis
                                   │
                          recordAnalysis()
                                   │
                              enterContrast()
                                   ▼
                                contrast ──recordContrastAnswer()──▶ contrast (sigue)
                                   │
                          completeContrast()
                                   ▼
                                transfer ──submitTransferPrediction()──▶ transfer
                                   │
                          recordTransferAnalysis()
                                   │
                              completeSession()
                                   ▼
                                completed
```

Guardas principales:

- No se puede enviar dos veces la misma predicción.
- No se registra análisis sin predicción; no se entra en contraste sin análisis.
- Una microprueba respondida no se repite y debe pertenecer al patrón de la sesión.
- `completeContrast()` exige al menos una respuesta y que la selección ya no esté en `"selected"`.
- La transferencia exige contraste completado; la sesión se completa solo tras ejecutar y analizar la transferencia.
- La etapa y los datos guardados deben ser coherentes al cargar; si no, la sesión se considera corrupta.

## Flujo educativo

```
Predicción (sin ejecutar)
  └─ salida esperada + variables + iteraciones + explicación + confianza
Análisis (Pyodide real)
  └─ salida, iteraciones, estado de variables, tabla real y primera divergencia determinable
Contraste (diagnóstico 0.6.0)
  └─ selection.selectMicrotest (determinista)
       └─ DiagnosticPanel (hipótesis en juego, microprueba, respuesta, ejecución real)
            └─ evidence.evaluateMicrotest (reglas puras)
Transferencia (ejercicio nuevo)
  └─ nueva predicción + ejecución + comparación + nota de evidencia puntual
Resumen
  └─ observaciones, inferencias, hipótesis sin resolver, limitaciones y exportación
```

Reglas de diseño:

- Una hipótesis es una explicación alternativa sobre el razonamiento del estudiante.
- Una respuesta incorrecta no se convierte automáticamente en evidencia de una concepción
  errónea; una respuesta correcta no se interpreta como dominio consolidado.
- Los estados de evidencia son `supports` / `insufficient` / `contradicts`, con
  metadatos de decisión (`reason`) para auditoría.
- La confianza declarada se conserva como dato, nunca como calificación ni como diagnóstico.
- La transferencia produce una **observación puntual**, no una medida de comprensión consolidada.

## Comparación y divergencia

`src/domain/pact/analysis.ts` compara la predicción congelada con la ejecución real:

- `answerFormat: "numbers"` extrae enteros (`-?\d+`) y los compara en orden.
- `answerFormat: "text"` normaliza espacios y mayúsculas.
- Las variables se comparan una a una; las iteraciones se comparan como listas.
- La primera divergencia solo se declara cuando es determinable: iteraciones→línea del bucle,
  o variables/salida. Si no puede determinarse, se informa como `unknown` sin inventar una línea.

## Protocolo de mensajes (`src/engine/messages.ts`)

- Interfaz → Worker: `{type:"init"}` · `{type:"run", requestId, exerciseId}`
- Worker → Interfaz: `{type:"status", status:"loading"|"ready"}` · `{type:"result", requestId, result}` · `{type:"error", phase, requestId?, message}`

## Persistencia

- Clave: `traza:pact-session`. Esquema: `1`. Instrumento: `0.7.0`.
- Se guarda la etapa, la predicción congelada, el análisis, las respuestas de contraste, las
  evaluaciones, los estados de hipótesis y la transferencia.
- Al cargar se valida el esquema y la coherencia etapa/datos. Las evaluaciones de evidencia se
  **recalculan** desde las respuestas; no se confía ciegamente en el JSON guardado.
- Una sesión legacy (`traza:diagnostic-session`), incompatible o corrupta muestra un aviso y
  permite descartarla sin borrar otras claves del navegador.
- No se recogen datos personales; el identificador de sesión es local.

## Límites de ejecución actuales

- El Worker ejecuta solo ejercicios de la lista blanca `EXERCISES`; el mensaje no puede traer código.
- `__builtins__` del programa se reducen a `print` y `range`: los `import` fallan.
- Máximo 2000 eventos de traza (`TraceLimitError`), tiempo límite de 15 s en el cliente (termina el Worker).
- La salida se captura con `redirect_stdout`.
- La numeración de iteraciones es por bucle; los bucles anidados no están diseñados.

## Riesgos antes de permitir código de estudiantes

1. **Un Worker no es un sandbox.** Con builtins reducidos, el código sigue pudiendo escapar por introspección (`().__class__.__mro__…`). Hay que tratarlo como código hostil.
2. Bucles infinitos dentro de una sola instrucción no emiten eventos: el límite de 2000 no los detiene; solo el tiempo límite (terminar el Worker).
3. Consumo de memoria sin tope (listas enormes, cadenas).
4. `sys.settrace` penaliza el rendimiento; programas largos serán lentos.
5. Posible interferencia del código del estudiante con `sys.settrace`/`sys.gettrace`.
6. Trazado de funciones propias, recursión, generadores, `while` complejos y bucles anidados: sin diseñar ni probar.
7. Aislamiento recomendado antes de código libre: iframe con `sandbox` y CSP estricta, y/o Worker aislado por ejecución, además de límites de memoria.
8. Privacidad: esta versión no recopila datos de estudiantes ni personales.

Detalle y controles verificados en [`SEGURIDAD.md`](SEGURIDAD.md).

## Carga local de Pyodide

El runtime se copia de `node_modules/pyodide` a `public/pyodide/` (`scripts/copy-pyodide.mjs`) y se
carga con `indexURL`. `optimizeDeps.exclude: ["pyodide"]` evita el pre-empaquetado con esbuild y
`worker.format: "es"` fuerza un Worker ESM. La carga real en navegador está verificada por las
pruebas E2E de Playwright/Chromium.
