# Revisión docente — TRAZA 0.8.0

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

- Versión del instrumento: `0.8.0`; esquema de sesión: `1`.
- Patrones: `RANGE`, `ACUMULADORES`, `CONDICIONALES` y `FUNCIONES`.
- Hipótesis: 11 (2 RANGE, 3 ACUMULADORES, 3 CONDICIONALES, 3 FUNCIONES).
- Micropruebas: 26 (7, 7, 6 y 6 respectivamente).
- Ejercicios: cuatro principales y cuatro de transferencia, ejecutados desde una lista blanca.
- Las matrices de discriminación están en `src/domain/diagnosis/discrimination.ts`.

### Ejercicios principales y transferencia

| Patrón | Principal | Transferencia | Foco |
|---|---|---|---|
| RANGE | `range-principal` | `range-transferencia` | Límite exclusivo y generalización a otro rango/contexto |
| ACUMULADORES | `suma-1-3` | `acumuladores-transferencia` | Estado acumulado e inicio distinto |
| CONDICIONALES | `condicionales-principal` | `condicionales-transferencia` | Evaluación de condiciones y ramas |
| FUNCIONES | `funciones-principal` | `funciones-transferencia` | Parámetros, ámbito y retorno |

### Las 26 micropruebas

| Patrón | ID | Foco revisable |
|---|---|---|
| RANGE | `range-iteracion-01` | Secuencia y posiciones de `range(1, 4)` |
| RANGE | `range-cero-01` | Inicio en cero |
| RANGE | `range-valor-inicial-01` | Inicio y límite no usados en otros ejemplos |
| RANGE | `range-pequeno-01` | Rango corto |
| RANGE | `range-tabla-01` | Secuencia en tabla de iteraciones |
| RANGE | `range-negativo-01` | Límite con valores negativos |
| RANGE | `range-un-argumento-01` | Forma `range(n)` y límite exclusivo |
| ACUMULADORES | `acc-final-01` | Resultado acumulado frente a reemplazo |
| ACUMULADORES | `acc-secuencia-01` | Parciales observados |
| ACUMULADORES | `acc-inicial-01` | Efecto del valor inicial no nulo |
| ACUMULADORES | `acc-imprime-01` | Estado acumulado entre iteraciones |
| ACUMULADORES | `acc-general-01` | Generalización a más iteraciones |
| ACUMULADORES | `acc-parcial-01` | Parciales con inicio 100 |
| ACUMULADORES | `acc-inicial-cero-02` | Sustitución frente a acumulación desde cero |
| CONDICIONALES | `cond-and-01` | `and` cuando una comparación es falsa |
| CONDICIONALES | `cond-and-02` | `and` con condición booleana falsa |
| CONDICIONALES | `cond-or-01` | `or` con una sola parte verdadera |
| CONDICIONALES | `cond-or-02` | `or` con la primera parte verdadera |
| CONDICIONALES | `cond-not-01` | Negación booleana simple |
| CONDICIONALES | `cond-not-02` | Negación de una comparación |
| FUNCIONES | `func-print-01` | Diferencia entre imprimir y devolver |
| FUNCIONES | `func-param-01` | Asignación posicional de argumentos |
| FUNCIONES | `func-local-print-01` | Variable local fuera de su función |
| FUNCIONES | `func-local-param-01` | Reasignación local de un parámetro |
| FUNCIONES | `func-return-02` | Uso del valor retornado sin mutar el argumento |
| FUNCIONES | `func-scope-02` | Variable local/global con el mismo nombre |

**Límite discriminativo que debe revisarse:** en `acc-inicial-cero-02`, responder `2, 5, 9` contradice sustitución, pero esa respuesta también es compatible con el comportamiento normativo. No apoya por sí sola la hipótesis de que se ignora la inicialización; para separarla se requiere un inicio no nulo, como en `acc-inicial-01`. La matriz registra esta insuficiencia explícitamente.

## 3. Matriz de revisión (a completar por revisores reales)

Cada fila debe ser completada por una persona revisora. **No marcar como revisado hasta que exista
una revisión real y firmada.** Las columnas de resultado se dejan vacías a propósito.

| # | Criterio | Evidencia a revisar | Resultado | Observaciones | Revisor | Fecha |
|---|---|---|---|---|---|---|
| 1 | Claridad de instrucciones | Pantallas de Predicción y Transferencia | Pendiente | — | — | — |
| 2 | Pertinencia de hipótesis | `hypotheses.ts`, matrices | Pendiente | — | — | — |
| 3 | Calidad de ejercicios principales | `exercises.ts`, `pact/exercises.ts` | Pendiente | — | — | — |
| 4 | Calidad de transferencia | Cuatro ejercicios de transferencia | Pendiente | — | — | — |
| 5 | Discriminación entre hipótesis | `discrimination.ts`, micropruebas | Pendiente | — | — | — |
| 6 | Ausencia de pistas involuntarias | Textos y opciones de respuesta | Pendiente | — | — | — |
| 7 | Lenguaje respetuoso | Toda la interfaz y el resumen | Pendiente | — | — | — |
| 8 | Uso de la confianza (no calificación) | `PredictionForm.vue`, resumen | Pendiente | — | — | — |
| 9 | Evidencia insuficiente | Flujo de ambigüedad | Pendiente | — | — | — |
| 10 | Transferencia no sobreinterpretada | Nota de evidencia y limitaciones | Pendiente | — | — | — |
| 11 | Adecuación al nivel educativo | Recorrido completo | Pendiente | — | — | — |
| 12 | Interpretaciones alternativas | Respuestas y explicaciones | Pendiente | — | — | — |

## 4. Cómo realizar la revisión

1. Abrir la aplicación con `npm run dev` y recorrer los cuatro patrones completos.
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
- Revisar los patrones ya implementados de condicionales y funciones antes de usarlos en un estudio educativo.
- Estudiar formatos de respuesta más naturales sin perder determinismo.
- Medir usabilidad y duración en un piloto controlado, con consentimiento y sin datos personales.

**No marcar este documento como revisado hasta que existan revisiones reales.** Los porcentajes del simulador sintético no son datos de aprendizaje ni validación del instrumento.
