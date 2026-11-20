# Revisión de seguridad — TRAZA 0.8.0

**Alcance:** esta revisión cubre el motor de ejecución (Pyodide en un Web Worker), la validación de
mensajes, los límites, la recuperación y la persistencia local. **No** es una auditoría de
seguridad externa ni una garantía para código arbitrario.

> **Conclusión principal:** el Worker con Pyodide **no es un sandbox de seguridad**. En 0.8.0 no se
> ejecuta código escrito por estudiantes: solo ejercicios de una lista blanca. Cualquier ampliación
> a código libre requiere aislamiento adicional y una revisión específica.

## 1. Superficie de ataque actual

| Componente | Entrada | Control |
|---|---|---|
| Interfaz → Worker | `{type:"run", requestId, exerciseId}` | `isWorkerRequest` valida la forma; `isExerciseId` comprueba que el ID exista en `EXERCISES`. |
| Worker → Python | `exercise.code` de la lista blanca | El mensaje **nunca** transporta código; el Worker resuelve el código desde `src/domain/exercises.ts`. |
| Python → TS | Cadena JSON | `parseEngineJson` valida la estructura antes de usarla. |
| localStorage | JSON de sesión | Validación de esquema, tipos y coherencia etapa/datos; evidencias recalculadas. |
| Exportación | JSON generado | Solo datos de la sesión; sin nombres, correos ni identificadores personales. |

## 2. Controles verificados

- **Sin editor ni ejecución libre.** La interfaz no ofrece un campo para escribir Python.
- **Lista blanca cerrada.** `EXERCISES` contiene los ejercicios PACT y 26 micropruebas para cuatro patrones;
  un identificador desconocido produce error antes de ejecutar.
- **Builtins reducidos.** El programa recibe solo `print` y `range`; los `import` fallan.
- **Límite de eventos.** Máximo 2000 eventos de traza (`TraceLimitError`).
- **Tiempo límite.** 15 s por ejecución en el cliente; al expirar se **termina el Worker** y se
  rechazan las promesas pendientes. El siguiente intento reinicializa el motor.
- **Terminación y reinicio.** `TraceEngineClient.terminate()`/`fail()` destruyen el Worker y dejan
  el cliente listo para volver a inicializar. La vista técnica permite reiniciar manualmente.
- **Errores controlados.** Fallo de carga de Pyodide, error de ejercicio, timeout y cierre del
  Worker se muestran como avisos; no se expone una traza interna al estudiante.
- **Persistencia defensiva.** Sesión corrupta, legacy o con esquema incompatible: aviso claro y
  descarte **solo** de `traza:pact-session`, sin borrar otras claves del navegador.
- **Sin datos personales.** No hay formularios de identidad, cuentas ni envío a un servidor.
- **Sin backend.** Todo ocurre en el navegador; no hay API ni base de datos remota.
- **Dependencias.** `npm audit` = 0 vulnerabilidades en la fecha de la entrega (ver más abajo).

## 3. Riesgos que permanecen

1. **Escape del Worker.** Aunque los builtins estén reducidos, el código podría intentar escapar por
   introspección (`().__class__.__mro__…`). En 0.8.0 el código es de la lista blanca y no del
   estudiante, por lo que el riesgo es de cadena de suministro, no de entrada libre.
2. **Bucles que no emiten eventos.** Un bucle infinito dentro de una sola instrucción no incrementa
   el contador de 2000 eventos; solo lo detiene el timeout de 15 s al terminar el Worker.
3. **Memoria sin tope.** No hay límite explícito de memoria para listas/cadenas grandes.
4. **Coste de `sys.settrace`.** Programas largos son lentos; el timeout es la última barrera.
5. **Interferencia con el trazador.** Código malicioso podría intentar manipular `sys.settrace`.
6. **CSP no configurada en la aplicación.** `index.html` no declara una CSP. Se recomienda añadir
   una política estricta al desplegar (incluyendo `wasm-unsafe-eval` para Pyodide) y probarla antes
   de producción.
7. **Iframe con `sandbox` no implementado.** No se usa un iframe aislado; el Worker es el único
   límite. No debe interpretarse como aislamiento fuerte.
8. **Dependencias.** La auditoría es una foto del momento; debe repetirse y revisarse antes de
   desplegar.

## 4. Qué haría falta antes de admitir código libre

- Aislamiento en iframe con `sandbox` y CSP estricta, además del Worker.
- Worker nuevo por ejecución (o un pool desechable) con límites de CPU y memoria.
- Revisión de la API de Pyodide y de los builtins expuestos.
- Detección/limitación de introspección y de acceso a recursos.
- Pruebas de abuso específicas (escape, memoria, bucles, exfiltración).
- Revisión de seguridad externa.

## 5. Auditoría de dependencias

Situación inicial (0.6.0): 11 vulnerabilidades (6 moderadas, 3 altas, 2 críticas), todas en la
cadena de herramientas de desarrollo (Vitest/Vite y transitivas).

Cambios aplicados en 0.7.0:

| Paquete | Antes | Después | Motivo |
|---|---|---|---|
| `vue` | 3.5.13 | 3.5.45 | Parche de seguridad, sin cambio de API. |
| `vite` | 6.0.7 | 6.4.6 | Corrección de avisos de la rama 6.x. |
| `vitest` | 2.1.8 | 5.1.1 | Elimina las advisories críticas/altas de la cadena 2.x. |
| `vue-tsc` | 2.1.10 | 3.3.14 | Compatible con TypeScript 5.6; typecheck limpio. |

Resultado: `npm audit` → **0 vulnerabilidades**. Requisito derivado: Node.js **>= 22.12** (Vitest 5).
El lockfile se regeneró con `npm install`.

> Nota: la ausencia de avisos no demuestra ausencia de vulnerabilidades; el resultado de la auditoría final de 0.8.0 se registra en `docs/ESTADO_DEL_PROYECTO.md`. Debe repetirse antes de desplegar.
