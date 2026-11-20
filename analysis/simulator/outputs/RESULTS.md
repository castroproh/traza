# Resultados del simulador de estudiantes sintéticos

> **Advertencia:** todas las sesiones provienen de perfiles artificiales definidos por reglas.
> No son estudiantes reales, no estiman prevalencias y no sustituyen validación psicométrica
> ni pedagógica.

Generado por `python -m analysis.simulator` a partir de `analysis/simulator/bank.json`.

## Experimento: canonico

- Semilla base: `2026`
- Sesiones: **740**
- Sesiones por perfil: `20`
- Niveles de ruido: `[0.0]`
- Selectores: `['adaptive']`

### Resumen global

| Métrica | Valor | IC 95% (simulación) |
| --- | --- | --- |
| Tasa de resolución | 91.62% | [89.40% – 93.41%] (n=740) |
| Abstención (evidencia insuficiente) | 4.32% | [3.08% – 6.04%] (n=740) |
| Sin concepción alternativa | 45.95% | — |
| De los cuales comprensión correcta (normativo) | 23.11% | — |
| Diagnóstico múltiple | 4.05% | [2.85% – 5.73%] (n=740) |
| Exactitud de identificación* | 100.00% | [98.54% – 100.00%] (n=260) |
| Falsos positivos* | 0.00% | [0.00% – 1.46%] (n=260) |
| Micropruebas por sesión (media) | 3.19 | — |
| Micropruebas por sesión (mediana) | 3.0 | — |
| Micropruebas máximas | 7 | — |
| Respuestas ambiguas por sesión | 0.35 | — |

*Calculado solo sobre perfiles con hipótesis generadora; una abstención no cuenta como falso positivo.*

### Por patrón y selector

| Patrón::selector | Sesiones | Resolución | Exactitud* | IC exactitud (sim.) | Falsos positivos* | Micropruebas |
| --- | --- | --- | --- | --- | --- | --- |
| ACUMULADORES::adaptive | 180 | 85.00% | 100.00% | [93.98% – 100.00%] (n=60) | 0.00% | 2.77 |
| CONDICIONALES::adaptive | 200 | 90.50% | 100.00% | [95.42% – 100.00%] (n=80) | 0.00% | 3.83 |
| FUNCIONES::adaptive | 200 | 92.00% | 100.00% | [95.42% – 100.00%] (n=80) | 0.00% | 4.53 |
| RANGE::adaptive | 160 | 100.00% | 100.00% | [91.24% – 100.00%] (n=40) | 0.00% | 1.18 |

### Matrices de confusión por patrón (hipótesis generadora → diagnóstico emitido)

Solo incluyen sesiones con hipótesis generadora conocida. Cada celda cuenta sesiones sintéticas; no son prevalencias estudiantiles.

#### ACUMULADORES

| Generadora \ Diagnóstico | H-ACC-02 | H-ACC-03 |
| --- | --- | --- |
| H-ACC-02 | 40 | 0 |
| H-ACC-03 | 0 | 20 |

#### CONDICIONALES

| Generadora \ Diagnóstico | H-COND-01 | H-COND-02 | H-COND-03 |
| --- | --- | --- | --- |
| H-COND-01 | 40 | 0 | 0 |
| H-COND-02 | 0 | 20 | 0 |
| H-COND-03 | 0 | 0 | 20 |

#### FUNCIONES

| Generadora \ Diagnóstico | H-FUNC-01 | H-FUNC-02 | H-FUNC-03 |
| --- | --- | --- | --- |
| H-FUNC-01 | 40 | 0 | 0 |
| H-FUNC-02 | 0 | 20 | 0 |
| H-FUNC-03 | 0 | 0 | 20 |

#### RANGE

| Generadora \ Diagnóstico | H-RANGE-01 |
| --- | --- |
| H-RANGE-01 | 40 |


*Calculado solo sobre perfiles con hipótesis generadora; una abstención no cuenta como falso positivo.*

**Denominadores:** resolución, abstención, diagnóstico múltiple y uso de micropruebas se calculan sobre todas las sesiones del grupo. La exactitud de identificación y los falsos positivos se calculan solo sobre sesiones cuya regla de perfil define una hipótesis generadora (perfiles `hipotesis::H-*` y `error-ocasional::H-*`; los perfiles `correcto`, `mixto`, `ambiguo`, `inconsistente`, `aleatorio` y `solo-conocidas` no tienen una generadora única y quedan fuera de exactitud).

**Corrección de denominador respecto del artefacto original:** la exactitud RANGE de 66.7% (40/60) incluía 20 perfiles `solo-conocidas`, que deliberadamente no generalizan y no tienen hipótesis estable. Al excluirlos, la exactitud entre perfiles con hipótesis estable es 100% (40/40). No se cambiaron preguntas, respuestas sintéticas ni parámetros; resolución RANGE sigue siendo una métrica distinta.

Los intervalos de incertidumbre (IC) son intervalos de Wilson al 95 % sobre el muestreo de las sesiones sintéticas. Describe variabilidad de simulación, nunca inferencia sobre una población de estudiantes reales.

### Por nivel de ruido

| Ruido | Sesiones | Resolución | Exactitud* | Abstención | Micropruebas |
| --- | --- | --- | --- | --- | --- |
| 0.0 | 660 | 90.61% | 100.00% | 4.85% | 3.20 |
| 0.1 | 80 | 100.00% | 100.00% | 0.00% | 3.04 |

### Por perfil sintético

| Perfil | Sesiones | Resolución | Exactitud* | Abstención | Micropruebas |
| --- | --- | --- | --- | --- | --- |
| aleatorio | 80 | 70.00% | 0.00% | 12.50% | 3.46 |
| ambiguo::50 | 80 | 63.75% | 0.00% | 22.50% | 3.62 |
| correcto | 80 | 100.00% | 0.00% | 0.00% | 2.50 |
| error-ocasional::H-ACC-02 | 20 | 100.00% | 100.00% | 0.00% | 3.00 |
| error-ocasional::H-COND-01 | 20 | 100.00% | 100.00% | 0.00% | 3.00 |
| error-ocasional::H-FUNC-01 | 20 | 100.00% | 100.00% | 0.00% | 5.10 |
| error-ocasional::H-RANGE-01 | 20 | 100.00% | 100.00% | 0.00% | 1.05 |
| hipotesis::H-ACC-02 | 20 | 100.00% | 100.00% | 0.00% | 3.00 |
| hipotesis::H-ACC-03 | 20 | 100.00% | 100.00% | 0.00% | 3.00 |
| hipotesis::H-COND-01 | 20 | 100.00% | 100.00% | 0.00% | 3.00 |
| hipotesis::H-COND-02 | 20 | 100.00% | 100.00% | 0.00% | 4.00 |
| hipotesis::H-COND-03 | 20 | 100.00% | 100.00% | 0.00% | 4.00 |
| hipotesis::H-FUNC-01 | 20 | 100.00% | 100.00% | 0.00% | 5.00 |
| hipotesis::H-FUNC-02 | 20 | 100.00% | 100.00% | 0.00% | 6.00 |
| hipotesis::H-FUNC-03 | 20 | 100.00% | 100.00% | 0.00% | 4.00 |
| hipotesis::H-RANGE-01 | 20 | 100.00% | 100.00% | 0.00% | 1.00 |
| inconsistente::50 | 80 | 98.75% | 0.00% | 1.25% | 2.75 |
| mixto | 80 | 90.00% | 0.00% | 3.75% | 3.34 |
| solo-conocidas::H-ACC-02 | 20 | 100.00% | 0.00% | 0.00% | 2.00 |
| solo-conocidas::H-COND-01 | 20 | 100.00% | 0.00% | 0.00% | 4.00 |
| solo-conocidas::H-FUNC-01 | 20 | 100.00% | 0.00% | 0.00% | 3.00 |
| solo-conocidas::H-RANGE-01 | 20 | 100.00% | 0.00% | 0.00% | 1.00 |

Los perfiles `aleatorio`, `ambiguo`, `inconsistente`, `mixto` y `solo-conocidas`
no tienen una hipótesis generadora única; su exactitud no se interpreta como acierto.
`solo-conocidas` está diseñado para no generalizar y queda fuera de exactitud/FP; sí cuenta para resolución, abstención y uso.

### Resistencia al ruido (perfiles con hipótesis)

- Exactitud sin ruido: **100.00%**
- Exactitud con ruido: **100.00%**
- Caída de exactitud: **0.00%**

### Matriz de confusión (hipótesis generadora → diagnóstico)

| Generadora \ Diagnóstico | H-ACC-02 | H-ACC-03 | H-COND-01 | H-COND-02 | H-COND-03 | H-FUNC-01 | H-FUNC-02 | H-FUNC-03 | H-RANGE-01 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| H-ACC-02 | 40 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| H-ACC-03 | 0 | 20 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| H-COND-01 | 0 | 0 | 40 | 0 | 0 | 0 | 0 | 0 | 0 |
| H-COND-02 | 0 | 0 | 0 | 20 | 0 | 0 | 0 | 0 | 0 |
| H-COND-03 | 0 | 0 | 0 | 0 | 20 | 0 | 0 | 0 | 0 |
| H-FUNC-01 | 0 | 0 | 0 | 0 | 0 | 40 | 0 | 0 | 0 |
| H-FUNC-02 | 0 | 0 | 0 | 0 | 0 | 0 | 20 | 0 | 0 |
| H-FUNC-03 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 20 | 0 |
| H-RANGE-01 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 40 |

### Limitaciones de esta simulación

- Métricas calculadas sobre perfiles artificiales, no sobre estudiantes reales.
- La exactitud de identificación no mide aprendizaje ni validez psicométrica.
- Los resultados dependen de las firmas del banco y de los supuestos del simulador.

---

## Experimento: ruido

- Semilla base: `2027`
- Sesiones: **2960**
- Sesiones por perfil: `20`
- Niveles de ruido: `[0.0, 0.1, 0.2, 0.4]`
- Selectores: `['adaptive']`

### Resumen global

| Métrica | Valor | IC 95% (simulación) |
| --- | --- | --- |
| Tasa de resolución | 92.60% | [91.60% – 93.49%] (n=2960) |
| Abstención (evidencia insuficiente) | 3.99% | [3.34% – 4.75%] (n=2960) |
| Sin concepción alternativa | 40.41% | — |
| De los cuales comprensión correcta (normativo) | 19.53% | — |
| Diagnóstico múltiple | 4.86% | [4.15% – 5.70%] (n=2960) |
| Exactitud de identificación* | 92.12% | [90.32% – 93.60%] (n=1040) |
| Falsos positivos* | 1.83% | [1.17% – 2.84%] (n=1040) |
| Micropruebas por sesión (media) | 3.23 | — |
| Micropruebas por sesión (mediana) | 3.0 | — |
| Micropruebas máximas | 7 | — |
| Respuestas ambiguas por sesión | 0.34 | — |

*Calculado solo sobre perfiles con hipótesis generadora; una abstención no cuenta como falso positivo.*

### Por patrón y selector

| Patrón::selector | Sesiones | Resolución | Exactitud* | IC exactitud (sim.) | Falsos positivos* | Micropruebas |
| --- | --- | --- | --- | --- | --- | --- |
| ACUMULADORES::adaptive | 720 | 85.83% | 87.08% | [82.25% – 90.75%] (n=240) | 0.83% | 2.78 |
| CONDICIONALES::adaptive | 800 | 93.50% | 91.25% | [87.64% – 93.88%] (n=320) | 5.31% | 3.65 |
| FUNCIONES::adaptive | 800 | 92.00% | 93.13% | [89.81% – 95.42%] (n=320) | 0.00% | 4.76 |
| RANGE::adaptive | 640 | 99.84% | 99.38% | [96.55% – 99.89%] (n=160) | 0.00% | 1.30 |

### Matrices de confusión por patrón (hipótesis generadora → diagnóstico emitido)

Solo incluyen sesiones con hipótesis generadora conocida. Cada celda cuenta sesiones sintéticas; no son prevalencias estudiantiles.

#### ACUMULADORES

| Generadora \ Diagnóstico | H-ACC-02 | H-ACC-03 | insufficient | none | normative |
| --- | --- | --- | --- | --- | --- |
| H-ACC-02 | 160 | 0 | 0 | 0 | 0 |
| H-ACC-03 | 2 | 49 | 9 | 16 | 4 |

#### CONDICIONALES

| Generadora \ Diagnóstico | H-COND-01 | H-COND-02 | H-COND-03 | none |
| --- | --- | --- | --- | --- |
| H-COND-01 | 150 | 0 | 4 | 6 |
| H-COND-02 | 12 | 62 | 1 | 5 |
| H-COND-03 | 0 | 0 | 80 | 0 |

#### FUNCIONES

| Generadora \ Diagnóstico | H-FUNC-01 | H-FUNC-02 | H-FUNC-03 | insufficient | multiple |
| --- | --- | --- | --- | --- | --- |
| H-FUNC-01 | 158 | 0 | 0 | 0 | 2 |
| H-FUNC-02 | 0 | 62 | 0 | 0 | 18 |
| H-FUNC-03 | 0 | 0 | 78 | 1 | 1 |

#### RANGE

| Generadora \ Diagnóstico | H-RANGE-01 | insufficient |
| --- | --- | --- |
| H-RANGE-01 | 159 | 1 |


*Calculado solo sobre perfiles con hipótesis generadora; una abstención no cuenta como falso positivo.*

**Denominadores:** resolución, abstención, diagnóstico múltiple y uso de micropruebas se calculan sobre todas las sesiones del grupo. La exactitud de identificación y los falsos positivos se calculan solo sobre sesiones cuya regla de perfil define una hipótesis generadora (perfiles `hipotesis::H-*` y `error-ocasional::H-*`; los perfiles `correcto`, `mixto`, `ambiguo`, `inconsistente`, `aleatorio` y `solo-conocidas` no tienen una generadora única y quedan fuera de exactitud).

**Corrección de denominador respecto del artefacto original:** la exactitud RANGE de 66.7% (40/60) incluía 20 perfiles `solo-conocidas`, que deliberadamente no generalizan y no tienen hipótesis estable. Al excluirlos, la exactitud entre perfiles con hipótesis estable es 100% (40/40). No se cambiaron preguntas, respuestas sintéticas ni parámetros; resolución RANGE sigue siendo una métrica distinta.

Los intervalos de incertidumbre (IC) son intervalos de Wilson al 95 % sobre el muestreo de las sesiones sintéticas. Describe variabilidad de simulación, nunca inferencia sobre una población de estudiantes reales.

### Por nivel de ruido

| Ruido | Sesiones | Resolución | Exactitud* | Abstención | Micropruebas |
| --- | --- | --- | --- | --- | --- |
| 0.0 | 660 | 90.91% | 100.00% | 4.55% | 3.20 |
| 0.1 | 980 | 94.69% | 97.40% | 3.06% | 3.19 |
| 0.2 | 660 | 91.97% | 88.33% | 4.09% | 3.26 |
| 0.4 | 660 | 91.82% | 73.33% | 4.70% | 3.31 |

### Por perfil sintético

| Perfil | Sesiones | Resolución | Exactitud* | Abstención | Micropruebas |
| --- | --- | --- | --- | --- | --- |
| aleatorio | 320 | 82.19% | 0.00% | 7.19% | 3.47 |
| ambiguo::50 | 320 | 75.94% | 0.00% | 15.31% | 3.61 |
| correcto | 320 | 96.56% | 0.00% | 3.12% | 2.70 |
| error-ocasional::H-ACC-02 | 80 | 100.00% | 100.00% | 0.00% | 3.00 |
| error-ocasional::H-COND-01 | 80 | 100.00% | 100.00% | 0.00% | 3.00 |
| error-ocasional::H-FUNC-01 | 80 | 100.00% | 100.00% | 0.00% | 5.10 |
| error-ocasional::H-RANGE-01 | 80 | 100.00% | 100.00% | 0.00% | 1.05 |
| hipotesis::H-ACC-02 | 80 | 100.00% | 100.00% | 0.00% | 3.00 |
| hipotesis::H-ACC-03 | 80 | 85.00% | 61.25% | 11.25% | 3.00 |
| hipotesis::H-COND-01 | 80 | 100.00% | 87.50% | 0.00% | 3.00 |
| hipotesis::H-COND-02 | 80 | 100.00% | 77.50% | 0.00% | 3.81 |
| hipotesis::H-COND-03 | 80 | 100.00% | 100.00% | 0.00% | 3.91 |
| hipotesis::H-FUNC-01 | 80 | 100.00% | 97.50% | 0.00% | 5.09 |
| hipotesis::H-FUNC-02 | 80 | 90.00% | 77.50% | 0.00% | 6.00 |
| hipotesis::H-FUNC-03 | 80 | 98.75% | 97.50% | 1.25% | 4.11 |
| hipotesis::H-RANGE-01 | 80 | 98.75% | 98.75% | 1.25% | 1.31 |
| inconsistente::50 | 320 | 94.37% | 0.00% | 4.69% | 2.87 |
| mixto | 320 | 91.87% | 0.00% | 2.19% | 3.33 |
| solo-conocidas::H-ACC-02 | 80 | 90.00% | 0.00% | 3.75% | 2.20 |
| solo-conocidas::H-COND-01 | 80 | 100.00% | 0.00% | 0.00% | 3.75 |
| solo-conocidas::H-FUNC-01 | 80 | 100.00% | 0.00% | 0.00% | 3.40 |
| solo-conocidas::H-RANGE-01 | 80 | 100.00% | 0.00% | 0.00% | 1.01 |

Los perfiles `aleatorio`, `ambiguo`, `inconsistente`, `mixto` y `solo-conocidas`
no tienen una hipótesis generadora única; su exactitud no se interpreta como acierto.
`solo-conocidas` está diseñado para no generalizar y queda fuera de exactitud/FP; sí cuenta para resolución, abstención y uso.

### Resistencia al ruido (perfiles con hipótesis)

- Exactitud sin ruido: **100.00%**
- Exactitud con ruido: **90.47%**
- Caída de exactitud: **9.53%**

### Matriz de confusión (hipótesis generadora → diagnóstico)

| Generadora \ Diagnóstico | H-ACC-02 | H-ACC-03 | H-COND-01 | H-COND-02 | H-COND-03 | H-FUNC-01 | H-FUNC-02 | H-FUNC-03 | H-RANGE-01 | insufficient | multiple | none | normative |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| H-ACC-02 | 160 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| H-ACC-03 | 2 | 49 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 9 | 0 | 16 | 4 |
| H-COND-01 | 0 | 0 | 150 | 0 | 4 | 0 | 0 | 0 | 0 | 0 | 0 | 6 | 0 |
| H-COND-02 | 0 | 0 | 12 | 62 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 5 | 0 |
| H-COND-03 | 0 | 0 | 0 | 0 | 80 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| H-FUNC-01 | 0 | 0 | 0 | 0 | 0 | 158 | 0 | 0 | 0 | 0 | 2 | 0 | 0 |
| H-FUNC-02 | 0 | 0 | 0 | 0 | 0 | 0 | 62 | 0 | 0 | 0 | 18 | 0 | 0 |
| H-FUNC-03 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 78 | 0 | 1 | 1 | 0 | 0 |
| H-RANGE-01 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 159 | 1 | 0 | 0 | 0 |

### Limitaciones de esta simulación

- Métricas calculadas sobre perfiles artificiales, no sobre estudiantes reales.
- La exactitud de identificación no mide aprendizaje ni validez psicométrica.
- Los resultados dependen de las firmas del banco y de los supuestos del simulador.

---

## Experimento: selectores

- Semilla base: `2028`
- Sesiones: **4440**
- Sesiones por perfil: `20`
- Niveles de ruido: `[0.0, 0.2]`
- Selectores: `['adaptive', 'fixed', 'information_gain']`

### Resumen global

| Métrica | Valor | IC 95% (simulación) |
| --- | --- | --- |
| Tasa de resolución | 91.96% | [91.12% – 92.72%] (n=4440) |
| Abstención (evidencia insuficiente) | 4.86% | [4.27% – 5.54%] (n=4440) |
| Sin concepción alternativa | 47.77% | — |
| De los cuales comprensión correcta (normativo) | 13.06% | — |
| Diagnóstico múltiple | 4.14% | [3.60% – 4.77%] (n=4440) |
| Exactitud de identificación* | 92.82% | [91.43% – 94.00%] (n=1560) |
| Falsos positivos* | 0.58% | [0.30% – 1.09%] (n=1560) |
| Micropruebas por sesión (media) | 5.02 | — |
| Micropruebas por sesión (mediana) | 6.0 | — |
| Micropruebas máximas | 7 | — |
| Respuestas ambiguas por sesión | 0.58 | — |

*Calculado solo sobre perfiles con hipótesis generadora; una abstención no cuenta como falso positivo.*

### Por patrón y selector

| Patrón::selector | Sesiones | Resolución | Exactitud* | IC exactitud (sim.) | Falsos positivos* | Micropruebas |
| --- | --- | --- | --- | --- | --- | --- |
| ACUMULADORES::adaptive | 360 | 85.56% | 91.67% | [85.34% – 95.41%] (n=120) | 0.00% | 2.77 |
| ACUMULADORES::fixed | 360 | 85.00% | 91.67% | [85.34% – 95.41%] (n=120) | 0.00% | 7.00 |
| ACUMULADORES::information_gain | 360 | 86.11% | 95.83% | [90.62% – 98.21%] (n=120) | 0.00% | 5.94 |
| CONDICIONALES::adaptive | 400 | 92.50% | 95.63% | [91.25% – 97.86%] (n=160) | 3.12% | 3.71 |
| CONDICIONALES::fixed | 400 | 92.50% | 81.25% | [74.50% – 86.54%] (n=160) | 1.25% | 6.00 |
| CONDICIONALES::information_gain | 400 | 91.00% | 79.37% | [72.45% – 84.92%] (n=160) | 1.25% | 5.34 |
| FUNCIONES::adaptive | 400 | 92.00% | 97.50% | [93.75% – 99.02%] (n=160) | 0.00% | 4.66 |
| FUNCIONES::fixed | 400 | 88.75% | 94.37% | [89.66% – 97.01%] (n=160) | 0.00% | 6.00 |
| FUNCIONES::information_gain | 400 | 93.25% | 97.50% | [93.75% – 99.02%] (n=160) | 0.00% | 4.89 |
| RANGE::adaptive | 320 | 100.00% | 100.00% | [95.42% – 100.00%] (n=80) | 0.00% | 1.23 |
| RANGE::fixed | 320 | 99.69% | 100.00% | [95.42% – 100.00%] (n=80) | 0.00% | 7.00 |
| RANGE::information_gain | 320 | 100.00% | 100.00% | [95.42% – 100.00%] (n=80) | 0.00% | 5.42 |

### Matrices de confusión por patrón (hipótesis generadora → diagnóstico emitido)

Solo incluyen sesiones con hipótesis generadora conocida. Cada celda cuenta sesiones sintéticas; no son prevalencias estudiantiles.

#### ACUMULADORES

| Generadora \ Diagnóstico | H-ACC-02 | H-ACC-03 | insufficient | none | normative |
| --- | --- | --- | --- | --- | --- |
| H-ACC-02 | 240 | 0 | 0 | 0 | 0 |
| H-ACC-03 | 0 | 95 | 8 | 14 | 3 |

#### CONDICIONALES

| Generadora \ Diagnóstico | H-COND-01 | H-COND-02 | H-COND-03 | none |
| --- | --- | --- | --- | --- |
| H-COND-01 | 192 | 0 | 1 | 47 |
| H-COND-02 | 4 | 98 | 4 | 14 |
| H-COND-03 | 0 | 0 | 120 | 0 |

#### FUNCIONES

| Generadora \ Diagnóstico | H-FUNC-01 | H-FUNC-02 | H-FUNC-03 | multiple |
| --- | --- | --- | --- | --- |
| H-FUNC-01 | 238 | 0 | 0 | 2 |
| H-FUNC-02 | 0 | 105 | 0 | 15 |
| H-FUNC-03 | 0 | 0 | 120 | 0 |

#### RANGE

| Generadora \ Diagnóstico | H-RANGE-01 |
| --- | --- |
| H-RANGE-01 | 240 |


*Calculado solo sobre perfiles con hipótesis generadora; una abstención no cuenta como falso positivo.*

**Denominadores:** resolución, abstención, diagnóstico múltiple y uso de micropruebas se calculan sobre todas las sesiones del grupo. La exactitud de identificación y los falsos positivos se calculan solo sobre sesiones cuya regla de perfil define una hipótesis generadora (perfiles `hipotesis::H-*` y `error-ocasional::H-*`; los perfiles `correcto`, `mixto`, `ambiguo`, `inconsistente`, `aleatorio` y `solo-conocidas` no tienen una generadora única y quedan fuera de exactitud).

**Corrección de denominador respecto del artefacto original:** la exactitud RANGE de 66.7% (40/60) incluía 20 perfiles `solo-conocidas`, que deliberadamente no generalizan y no tienen hipótesis estable. Al excluirlos, la exactitud entre perfiles con hipótesis estable es 100% (40/40). No se cambiaron preguntas, respuestas sintéticas ni parámetros; resolución RANGE sigue siendo una métrica distinta.

Los intervalos de incertidumbre (IC) son intervalos de Wilson al 95 % sobre el muestreo de las sesiones sintéticas. Describe variabilidad de simulación, nunca inferencia sobre una población de estudiantes reales.

### Por nivel de ruido

| Ruido | Sesiones | Resolución | Exactitud* | Abstención | Micropruebas |
| --- | --- | --- | --- | --- | --- |
| 0.0 | 1980 | 91.26% | 100.00% | 5.10% | 4.99 |
| 0.1 | 480 | 100.00% | 95.00% | 0.00% | 5.32 |
| 0.2 | 1980 | 90.71% | 83.70% | 5.81% | 4.97 |

### Por perfil sintético

| Perfil | Sesiones | Resolución | Exactitud* | Abstención | Micropruebas |
| --- | --- | --- | --- | --- | --- |
| aleatorio | 480 | 75.83% | 0.00% | 14.17% | 5.14 |
| ambiguo::50 | 480 | 72.92% | 0.00% | 18.33% | 5.21 |
| correcto | 480 | 97.92% | 0.00% | 1.67% | 4.71 |
| error-ocasional::H-ACC-02 | 120 | 100.00% | 100.00% | 0.00% | 5.67 |
| error-ocasional::H-COND-01 | 120 | 100.00% | 80.00% | 0.00% | 4.88 |
| error-ocasional::H-FUNC-01 | 120 | 100.00% | 100.00% | 0.00% | 5.70 |
| error-ocasional::H-RANGE-01 | 120 | 100.00% | 100.00% | 0.00% | 5.02 |
| hipotesis::H-ACC-02 | 120 | 100.00% | 100.00% | 0.00% | 5.67 |
| hipotesis::H-ACC-03 | 120 | 91.67% | 79.17% | 6.67% | 5.61 |
| hipotesis::H-COND-01 | 120 | 100.00% | 80.00% | 0.00% | 4.91 |
| hipotesis::H-COND-02 | 120 | 100.00% | 81.67% | 0.00% | 5.13 |
| hipotesis::H-COND-03 | 120 | 100.00% | 100.00% | 0.00% | 5.32 |
| hipotesis::H-FUNC-01 | 120 | 99.17% | 98.33% | 0.00% | 5.68 |
| hipotesis::H-FUNC-02 | 120 | 91.67% | 87.50% | 0.00% | 6.00 |
| hipotesis::H-FUNC-03 | 120 | 100.00% | 100.00% | 0.00% | 5.34 |
| hipotesis::H-RANGE-01 | 120 | 100.00% | 100.00% | 0.00% | 5.05 |
| inconsistente::50 | 480 | 95.42% | 0.00% | 4.37% | 4.59 |
| mixto | 480 | 90.21% | 0.00% | 3.12% | 4.87 |
| solo-conocidas::H-ACC-02 | 120 | 92.50% | 0.00% | 5.83% | 4.14 |
| solo-conocidas::H-COND-01 | 120 | 100.00% | 0.00% | 0.00% | 4.82 |
| solo-conocidas::H-FUNC-01 | 120 | 98.33% | 0.00% | 0.83% | 4.22 |
| solo-conocidas::H-RANGE-01 | 120 | 100.00% | 0.00% | 0.00% | 4.29 |

Los perfiles `aleatorio`, `ambiguo`, `inconsistente`, `mixto` y `solo-conocidas`
no tienen una hipótesis generadora única; su exactitud no se interpreta como acierto.
`solo-conocidas` está diseñado para no generalizar y queda fuera de exactitud/FP; sí cuenta para resolución, abstención y uso.

### Resistencia al ruido (perfiles con hipótesis)

- Exactitud sin ruido: **100.00%**
- Exactitud con ruido: **89.02%**
- Caída de exactitud: **10.98%**

### Matriz de confusión (hipótesis generadora → diagnóstico)

| Generadora \ Diagnóstico | H-ACC-02 | H-ACC-03 | H-COND-01 | H-COND-02 | H-COND-03 | H-FUNC-01 | H-FUNC-02 | H-FUNC-03 | H-RANGE-01 | insufficient | multiple | none | normative |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| H-ACC-02 | 240 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| H-ACC-03 | 0 | 95 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 8 | 0 | 14 | 3 |
| H-COND-01 | 0 | 0 | 192 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 47 | 0 |
| H-COND-02 | 0 | 0 | 4 | 98 | 4 | 0 | 0 | 0 | 0 | 0 | 0 | 14 | 0 |
| H-COND-03 | 0 | 0 | 0 | 0 | 120 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| H-FUNC-01 | 0 | 0 | 0 | 0 | 0 | 238 | 0 | 0 | 0 | 0 | 2 | 0 | 0 |
| H-FUNC-02 | 0 | 0 | 0 | 0 | 0 | 0 | 105 | 0 | 0 | 0 | 15 | 0 | 0 |
| H-FUNC-03 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 120 | 0 | 0 | 0 | 0 | 0 |
| H-RANGE-01 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 240 | 0 | 0 | 0 | 0 |

### Limitaciones de esta simulación

- Métricas calculadas sobre perfiles artificiales, no sobre estudiantes reales.
- La exactitud de identificación no mide aprendizaje ni validez psicométrica.
- Los resultados dependen de las firmas del banco y de los supuestos del simulador.

---
