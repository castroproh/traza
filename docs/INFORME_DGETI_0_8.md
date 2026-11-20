# Matriz de requisitos DGETI — TRAZA 0.8.0

**Estado: parcial; requiere la rúbrica oficial completa antes de considerarse una matriz de cumplimiento.** El usuario proporcionó los títulos de los requisitos 2, 3, 7, 9, 10, 11, 12, 13 y 14. No se encontró en el archivo base una plantilla o fuente editable que confirme los títulos de los requisitos 1, 4, 5, 6, 8, 15, 16 y 17. Esos nombres no se inventan.

Esta matriz separa evidencia de implementación, resultados de simulación artificial y datos educativos reales. No se aportaron datos educativos reales, revisiones externas, cotizaciones ni costos.

| # | Requisito | Estado | Evidencia y límite |
|---:|---|---|---|
| 1 | **Bloqueado — título oficial requerido** | Bloqueado | La rúbrica/fuente con el título y criterios no está incluida en `traza_1.zip`. |
| 2 | Planteamiento del problema | Parcial | TRAZA aborda dificultades para predecir y explicar programas introductorios. La pertinencia y magnitud del problema para la población objetivo no se midieron con datos locales. |
| 3 | Justificación | Parcial | El recorrido PACT ofrece predicción, ejecución real, contraste y transferencia. La justificación es de diseño; no hay evidencia de efectividad educativa ni evaluación externa. |
| 4 | **Bloqueado — título oficial requerido** | Bloqueado | La rúbrica/fuente no está disponible. |
| 5 | **Bloqueado — título oficial requerido** | Bloqueado | La rúbrica/fuente no está disponible. |
| 6 | **Bloqueado — título oficial requerido** | Bloqueado | La rúbrica/fuente no está disponible. |
| 7 | Marco teórico | Pendiente | El título fue proporcionado, pero no se dispone de una bibliografía académica completa verificable para afirmar cumplimiento. Debe incorporarse y revisarse contra el formato DGETI oficial. |
| 8 | **Bloqueado — título oficial requerido** | Bloqueado | La rúbrica/fuente no está disponible. |
| 9 | Propuesta de valor cuantitativa y cualitativa | Parcial | Valor técnico demostrado: cuatro patrones, 11 hipótesis, 26 micropruebas y recorrido PACT ejecutable. Las tasas del simulador son artificiales y no cuantifican beneficios educativos; la propuesta cualitativa no cuenta con validación externa. |
| 10 | Estudio de viabilidad | Parcial | El prototipo se ejecuta localmente en navegador con Vue, TypeScript y Pyodide. No se evaluaron adopción institucional, soporte operativo, costos recurrentes o sostenibilidad. |
| 11 | Factibilidad técnica y financiera | Parcial | Factibilidad técnica respaldada por compilación y pruebas de software. Factibilidad financiera pendiente: no se proporcionaron ni estimaron costos; no se inventan. |
| 12 | Impacto | Pendiente | Solo pueden plantearse impactos potenciales. No hay piloto, población estudiantil, medición antes/después ni resultados de impacto. |
| 13 | Protección de propiedad intelectual | Pendiente | No se verificó registro, titularidad ni dictamen legal. Debe revisarse la licencia del repositorio y de dependencias/recursos con la institución; esta matriz no afirma protección legal. |
| 14 | Análisis de resultados | Parcial | Hay pruebas técnicas y simulación artificial reproducible. El informe del simulador explica su generador sintético, métricas y ablación. No existen resultados de estudiantes reales ni evidencia de aprendizaje. |
| 15 | **Bloqueado — título oficial requerido** | Bloqueado | La rúbrica/fuente no está disponible. |
| 16 | **Bloqueado — título oficial requerido** | Bloqueado | La rúbrica/fuente no está disponible. |
| 17 | **Bloqueado — título oficial requerido** | Bloqueado | La rúbrica/fuente no está disponible. |

## Evidencia técnica y simulada disponible

- **Implementación:** cuatro patrones (RANGE, ACUMULADORES, CONDICIONALES, FUNCIONES), 11 hipótesis, 26 micropruebas y ocho ejercicios PACT controlados.
- **Simulación:** resultados exclusivamente de perfiles sintéticos; consultar `analysis/simulator/outputs/RESULTS.md` y `analysis/simulator/outputs/ABLATION.md`. No interpretar como resultados ni prevalencias de estudiantes.
- **Prototipo Bayesiano:** experimental, fuera del motor de producción; usa prior uniforme y verosimilitudes supuestas, no calibradas empíricamente.
- **Evaluación educativa real:** no realizada. Revisión docente externa, usabilidad y efectividad permanecen pendientes.

## Material gráfico

En el archivo base no se encontró un informe gráfico DGETI ni una fuente editable que permita producir una versión nueva sin sobrescribir el original. No se generó una pieza gráfica sustitutiva; queda pendiente recibir la fuente editable y el formato oficial.

## Pendientes para cerrar la matriz

1. Obtener la rúbrica DGETI oficial vigente con los 17 títulos, criterios y ponderaciones.
2. Completar los ocho títulos faltantes y revisar cada evidencia contra los criterios oficiales.
3. Incorporar bibliografía verificable, revisión institucional de propiedad intelectual y datos reales únicamente si se recaban con las autorizaciones correspondientes.
4. No presentar simulaciones como medición de aprendizaje ni incluir costos, revisiones o resultados no documentados.
