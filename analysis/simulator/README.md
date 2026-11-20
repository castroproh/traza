# Simulador de estudiantes sintéticos

Herramienta de análisis **fuera del bundle** de TRAZA. Genera sesiones
sintéticas contra el banco diagnóstico real de la versión 0.8.0 y produce
métricas reproducibles en JSON, CSV y Markdown.

> **No son estudiantes reales.** Los perfiles son reglas artificiales. Los
> resultados no estiman prevalencias, no miden aprendizaje y no sustituyen
> validación psicométrica ni pedagógica. El instrumento sigue pendiente de
> revisión docente y de validación con personas.

## Qué hace

1. Carga `bank.json`, exportado desde el código TypeScript de producción
   (`npm run export:bank`). El simulador **no redefine** hipótesis, firmas ni
   micropruebas: usa las del instrumento real.
2. Genera respuestas con perfiles declarativos (correcto, una hipótesis,
   mixto, ambiguo, inconsistente, aleatorio, error ocasional, solo conocidas).
3. Ejecuta el mismo ciclo que la aplicación: evaluar evidencias, seleccionar la
   siguiente microprueba y decidir cuándo parar.
4. Agrega métricas: matriz de confusión, resolución, abstención, uso de
   micropruebas, ambigüedad y resistencia al ruido.
5. Ejecuta comparaciones de selectores y una ablación emparejada de bancos de 24,
   25 y 26 ítems, incluyendo una decisión Bayesiana experimental.

## Qué no hace

- No ejecuta Python del estudiante ni usa Pyodide.
- No modifica el bundle ni se importa desde `src/`.
- No usa IA generativa ni asigna probabilidades a estudiantes reales.
- No ajusta parámetros después de ver los resultados.
- No sustituye el selector de producción por el prototipo experimental.

## Estructura

```
analysis/simulator/
├── bank.json          # exportado del banco real (no editar a mano)
├── bank.py            # carga y validación de integridad
├── evidence.py        # reglas deterministas de interpretación
├── selection.py       # adaptive, fixed e information_gain (experimental)
├── profiles.py        # perfiles sintéticos
├── responses.py       # generación de respuestas
├── simulation.py      # sesiones y experimentos
├── metrics.py         # matriz de confusión y métricas agregadas
├── experiments.py     # suite canónica, ruido y selectores
├── reporting.py       # JSON, CSV, Markdown y gráficos opcionales
├── models.py          # modelos de datos
├── __main__.py        # CLI
└── tests/             # pruebas con unittest
```

## Uso

Desde la raíz del repositorio:

```bash
# 1. Exportar el banco real (requiere Node y dependencias ya instaladas)
npm run export:bank

# 2. Ejecutar la suite estándar (semilla 2026, 20 sesiones por perfil)
python3 -m analysis.simulator

# 3. Personalizar
python3 -m analysis.simulator --sessions 50 --seed 42 --output analysis/simulator/outputs

# Ejecutar brazos A–F de ablación (semilla, perfiles, ruido y límite reproducibles)
python3 -m analysis.simulator --ablation
```

Salidas en `analysis/simulator/outputs/`:

- `results.json`: configuración, métricas agregadas y notas.
- `sessions.csv`: una fila por sesión sintética.
- `metrics.csv`: métricas por patrón y selector.
- `RESULTS.md`: informe legible con tablas y advertencias.
- `ablation.json`, `ablation.csv`, `ABLATION.md`: comparación de bancos/selección.
- `charts/*.png`: solo si `matplotlib` está instalado.

### Resultados reproducidos de esta entrega

La suite canónica generó 740 sesiones (semilla 2026): resolución 91.62%,
abstención 4.32%, falsos positivos 0% y 3.19 micropruebas por sesión. La
resolución por patrón fue RANGE 100%, ACUMULADORES 85%, CONDICIONALES 90.5% y
FUNCIONES 92%. En RANGE, la exactitud histórica de 66.7% (40/60) contaba 20
perfiles `solo-conocidas`, que no tienen hipótesis estable. Al excluirlos del
denominador de exactitud/FP, el resultado entre perfiles con hipótesis estable
es 100% (40/40); resolución y banco no cambiaron.

En la ablación emparejada, A (24/adaptive) obtuvo 85.81% de resolución, 90.67%
de exactitud, 3.82% de abstención, 2.02% de falsos positivos y 3.09 pruebas.
B (26/adaptive) obtuvo 92.50%, 92.02%, 3.89%, 1.83% y 3.24, respectivamente.
La diferencia B−A es +6.69 puntos de resolución y +1.35 de exactitud. E (solo
`range-un-argumento-01`) dio +0.24 puntos de resolución frente a A, sin cambio
de exactitud; F (solo `acc-inicial-cero-02`) dio +6.45 puntos de resolución y
+1.35 de exactitud. En B la prueba RANGE se usó en 10/2960 sesiones (0.34%) y
la prueba ACUMULADORES en 446/2960 (15.07%). Es evidencia sobre este simulador,
no una estimación del efecto en estudiantes.

C (ganancia de información) obtuvo 91.96% de resolución, 87.79% de exactitud,
5.54% de abstención, 0.96% de falsos positivos y 5.40 pruebas; D (decisión
Bayesiana) obtuvo 87.26%, 94.90%, 12.74%, 3.85% y 3.24, respectivamente.
Ningún selector recibe la hipótesis generadora. D conserva las preguntas y
respuestas de B y cambia solo la decisión final.

## Perfiles

| Perfil | Regla | Uso esperado |
| --- | --- | --- |
| `correcto` | Siempre el resultado correcto | Comprobar que no se inventan concepciones |
| `hipotesis::H-*` | Firma de una hipótesis cuando la prueba la evalúa; acierta en las demás | Medir identificación |
| `mixto` | Mezcla firmas del patrón | Comprobar inestabilidad |
| `ambiguo` | Responde «No estoy seguro» con probabilidad dada | Medir abstención |
| `inconsistente` | Alterna firmas rivales | Comprobar que no se fuerza un diagnóstico |
| `aleatorio` | Opción visible al azar | Línea base negativa |
| `error-ocasional` | Firma fija con errores aleatorios | Medir tolerancia al ruido |
| `solo-conocidas` | Acierta pruebas iniciales y falla las intermedias | Comprobar no generalización |

Los perfiles `aleatorio`, `ambiguo`, `inconsistente`, `mixto` y
`solo-conocidas` no tienen una hipótesis generadora única: se excluyen de la
exactitud de identificación y de los falsos positivos, pero sí cuentan para
resolución, abstención y uso de micropruebas.

## Reglas y métricas

Las reglas de evidencia replican `src/domain/diagnosis/evidence.ts`:

- respuesta ambigua o de incertidumbre → `insufficient`;
- respuesta que coincide con la firma → `supports`;
- respuesta correcta cuando la hipótesis predecía otra cosa → `contradicts`;
- respuesta correcta que también predice una hipótesis no normativa →
  `insufficient` (no se confunde compatibilidad con apoyo);
- cualquier otro caso → `insufficient`.

Métricas principales:

- **Resolución**: sesiones donde ninguna hipótesis del patrón quedó
  `insufficient`.
- **Abstención**: sesión sin diagnóstico e sin resolución por insuficiencia.
- **Exactitud de identificación**: proporción de perfiles con hipótesis cuya
  hipótesis generadora fue el diagnóstico emitido.
- **Falsos positivos**: diagnóstico incorrecto distinto de abstención o
  diagnóstico múltiple.
- **Uso de micropruebas**: media, mediana y máximo por sesión.
- **Ambigüedad**: respuestas ambiguas o de incertidumbre por sesión.
- **Resistencia al ruido**: exactitud con y sin ruido, y su caída.

## Selectores

- `adaptive`: réplica determinista del selector de producción. Prioriza cubrir
  hipótesis sin decidir y luego separar parejas rivales.
- `fixed`: línea base que recorre el banco en orden, sin adaptación.
- `information_gain`: **experimental**. Prior uniforme sobre hipótesis abiertas,
  verosimilitudes declaradas en `selection.py` y entropía esperada. No se usa en
  producción ni se recomienda sin evidencia externa.

La hipótesis que generó las respuestas se usa solo para medir. El selector
recibe únicamente el patrón, las respuestas observadas y las firmas públicas.

## Prototipo Bayesiano: supuestos, límites y circularidad

`bayesian.py` conserva las 11 hipótesis como alternativas explícitas. Por defecto
usa un prior uniforme normalizado y actualiza con una regla determinista:
verosimilitud asumida `0.90` si la respuesta coincide con la firma, `0.50` si es
compatible/neutra y `0.05` si la contradice. Estos números son **decisiones
experimentales**, no probabilidades calibradas con respuestas de personas. El
umbral de decisión `0.70` se puede configurar en la función y en CLI
(`--bayesian-threshold`); determina cuándo emitir un candidato, no la
probabilidad real de que alguien tenga esa concepción.

Las respuestas ambiguas o de incertidumbre no cambian el posterior. Los pesos se
normalizan después de cada actualización y las pruebas verifican normalización,
prior y reproducibilidad. El posterior solo expresa plausibilidad matemática
condicionada al modelo de firmas, prior y verosimilitudes.

Hay circularidad estructural: el generador sintético y el evaluador consumen las
firmas del mismo `bank.json`. Las pruebas independientes de firmas usan casos de
referencia escritos aparte y no llaman al generador ni al evaluador, pero solo
comprueban ejemplos seleccionados; **no** eliminan la circularidad del
experimento completo ni sustituyen observaciones independientes de estudiantes.
El modelo Bayesiano permanece fuera del motor diagnóstico de producción.

## Ablación A–F

- **A:** banco original de 24 ítems, selector adaptativo.
- **B:** banco de 26 ítems, selector adaptativo.
- **C:** banco de 26 ítems, ganancia de información.
- **D:** mismas preguntas y respuestas que B; cambia únicamente la decisión final
  al prototipo Bayesiano y su umbral.
- **E/F:** bancos de 25 ítems que aíslan, respectivamente, `range-un-argumento-01`
  y `acc-inicial-cero-02`.

Los brazos emparejan perfiles, semilla y niveles de ruido y no usan la hipótesis
generadora para seleccionar. La cifra histórica RANGE de 66.7% mezclaba perfiles
`solo-conocidas` (sin hipótesis estable) en el denominador de exactitud. La
métrica corregida excluye esos perfiles de exactitud y falsos positivos; siguen
contando para resolución, abstención y uso. El reporte canónico/ablación conserva
la configuración y explica la diferencia. No se ajustan preguntas ni parámetros
para alcanzar porcentajes objetivo.

## Pruebas

```bash
python3 -m unittest discover -s analysis/simulator/tests -v
```

Las pruebas cubren integridad del banco, paridad básica de reglas, determinismo
de selectores, reproducibilidad por semilla, métricas y escritura de salidas.

## Limitaciones

- Las firmas del banco son el principal supuesto: si una firma es incorrecta,
  la simulación hereda el error.
- Los perfiles no modelan fatiga, lectura, motivación ni contexto educativo.
- La selección y las reglas son deterministas; no hay estimación de
  incertidumbre estadística.
- La exactitud sobre perfiles artificiales no se generaliza a estudiantes.
- Los gráficos requieren `matplotlib`; sin él se generan igualmente los datos.

Cualquier conclusión educativa requiere revisión docente y un estudio con
estudiantes reales, consentimiento y análisis psicométrico adecuado.
