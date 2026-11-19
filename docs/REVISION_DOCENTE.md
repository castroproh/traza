# Revisión docente — TRAZA 0.7.0

**Estado: pendiente de revisión externa.** Este documento prepara el material para que docentes o
especialistas en educación en tecnología revisen el instrumento. **No constituye una aprobación
externa, ni una validación psicométrica, ni una evaluación de efectividad educativa.** No se han
realizado revisiones reales ni se atribuyen resultados que no existan.

## 1. Qué se solicita revisar

1. Claridad del contenido para estudiantes principiantes de bachillerato tecnológico.
2. Pertinencia de las hipótesis diagnósticas.
3. Calidad y ausencia de pistas involuntarias en los ejercicios.
4. Capacidad real de las micropruebas para discriminar entre hipótesis rivales.
5. Adecuación del lenguaje (sin etiquetar al estudiante, sin lenguaje que presuponga incapacidad).
6. Posibles interpretaciones alternativas de una misma respuesta.
7. Justicia del recorrido PACT y del uso de la confianza declarada.
8. Mejoras necesarias antes de usar el instrumento con estudiantes.

## 2. Instrumento revisado

- Versión del instrumento: `0.7.0`; esquema de sesión: `1`.
- Patrones: `RANGE` (límite superior exclusivo de `range()`) y `ACUMULADORES` (conservación del estado).
- Hipótesis: `H-RANGE-01`, `H-RANGE-02`, `H-ACC-01`, `H-ACC-02`, `H-ACC-03`.
- Micropruebas: 12 (6 por patrón).
- Matrices de discriminación: 1 par para `RANGE`; 3 pares para `ACUMULADORES`.

### Ejercicios principales

| Patrón | Ejercicio | Qué se pide | Salida real |
|---|---|---|---|
| RANGE | `range-principal` | Predecir `range(2, 6)`, la variable `numero` y las iteraciones. | `2, 3, 4, 5` |
| ACUMULADORES | `suma-1-3` | Predecir el total y las variables `total`/`numero`. | `6` |

### Transferencia

| Patrón | Ejercicio | Contexto | Salida real |
|---|---|---|---|
| RANGE | `range-transferencia` | Numerar páginas con `range(5, 9)`. | `5, 6, 7, 8` |
| ACUMULADORES | `acumuladores-transferencia` | Ahorro inicial 50 con sumas 10/20/30/40. | `60, 80, 110, 150` |

### Micropruebas

| Patrón | ID | Objetivo | Dificultad prevista |
|---|---|---|---|
| RANGE | `range-iteracion-01` | Predecir `range(1, 4)` y la posición de cada valor. | inicial |
| RANGE | `range-cero-01` | Predecir una secuencia que comienza en cero. | inicial |
| RANGE | `range-valor-inicial-01` | Predecir con inicio y límite distintos de los ejemplos. | inicial |
| RANGE | `range-pequeno-01` | Predecir un rango de longitud pequeña. | inicial |
| RANGE | `range-tabla-01` | Interpretar una tabla de iteraciones. | intermedia |
| RANGE | `range-negativo-01` | Predecir un rango con valores negativos. | inicial |
| ACUMULADORES | `acc-final-01` | Predecir el valor final del acumulador. | inicial |
| ACUMULADORES | `acc-secuencia-01` | Predecir la secuencia de valores intermedios. | inicial |
| ACUMULADORES | `acc-inicial-01` | Identificar el papel del valor inicial. | inicial |
| ACUMULADORES | `acc-imprime-01` | Interpretar cambios de estado observados. | intermedia |
| ACUMULADORES | `acc-general-01` | Generalizar a más iteraciones. | intermedia |
| ACUMULADORES | `acc-parcial-01` | Predecir valores en iteraciones concretas. | intermedia |

## 3. Matriz de revisión (a completar por revisores reales)

Cada fila debe ser completada por una persona revisora. **No marcar como revisado hasta que exista
una revisión real y firmada.** Las columnas de resultado se dejan vacías a propósito.

| # | Criterio | Evidencia a revisar | Resultado | Observaciones | Revisor | Fecha |
|---|---|---|---|---|---|---|
| 1 | Claridad de instrucciones | Pantallas de Predicción y Transferencia | Pendiente | — | — | — |
| 2 | Pertinencia de hipótesis | `hypotheses.ts`, matrices | Pendiente | — | — | — |
| 3 | Calidad de ejercicios principales | `exercises.ts`, `pact/exercises.ts` | Pendiente | — | — | — |
| 4 | Calidad de transferencia | Dos ejercicios de transferencia | Pendiente | — | — | — |
| 5 | Discriminación entre hipótesis | `discrimination.ts`, micropruebas | Pendiente | — | — | — |
| 6 | Ausencia de pistas involuntarias | Textos y opciones de respuesta | Pendiente | — | — | — |
| 7 | Lenguaje respetuoso | Toda la interfaz y el resumen | Pendiente | — | — | — |
| 8 | Uso de la confianza (no calificación) | `PredictionForm.vue`, resumen | Pendiente | — | — | — |
| 9 | Evidencia insuficiente | Flujo de ambigüedad | Pendiente | — | — | — |
| 10 | Transferencia no sobreinterpretada | Nota de evidencia y limitaciones | Pendiente | — | — | — |
| 11 | Adecuación al nivel educativo | Recorrido completo | Pendiente | — | — | — |
| 12 | Interpretaciones alternativas | Respuestas y explicaciones | Pendiente | — | — | — |

## 4. Cómo realizar la revisión

1. Abrir la aplicación con `npm run dev` y recorrer los dos patrones completos.
2. Anotar cualquier instrucción ambigua, pista o lenguaje que pueda interpretarse como juicio
   sobre la capacidad del estudiante.
3. Revisar cada microprueba y su matriz de discriminación.
4. Comprobar que una respuesta correcta no se presenta como dominio consolidado y que una
   incorrecta no se convierte automáticamente en una etiqueta.
5. Registrar los resultados en la matriz anterior, con nombre/fecha solo si el revisor acepta
   figurar. Este documento no debe publicarse con revisiones inventadas.

## 5. Limitaciones conocidas del instrumento

- No hay validación psicométrica ni datos de efectividad educativa.
- Las reglas diagnósticas son deterministas y acotadas; no convierten respuestas en certezas.
- La selección adaptativa es simple y explicable; no es un modelo estadístico.
- La transferencia es una observación puntual, no una medida de comprensión consolidada.
- El Worker no es un sandbox de seguridad; esta versión no admite código libre.
- No se han medido tiempos de uso, carga cognitiva ni usabilidad con estudiantes reales.

## 6. Próximas mejoras recomendadas (sujetas a revisión)

- Validar el banco con docentes antes de ampliar patrones.
- Diseñar condicionales y funciones (0.8.0) solo después de esta revisión.
- Estudiar formatos de respuesta más naturales sin perder determinismo.
- Medir usabilidad y duración en un piloto controlado, con consentimiento y sin datos personales.

**No marcar este documento como revisado hasta que existan revisiones reales.**
