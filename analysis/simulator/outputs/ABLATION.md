# Ablación sintética del banco y los métodos

> **Advertencia:** estos resultados provienen de perfiles artificiales y firmas del propio banco. No son datos de estudiantes ni validación educativa.

- Semilla: `2026`; sesiones por perfil: `20`.
- Niveles configurados de ruido: `[0.0, 0.1, 0.2, 0.4]`; máximo: `8` micropruebas.
- Umbral bayesiano experimental: `0.70`.
- Los seis brazos usan las mismas hipótesis, perfiles, semillas y niveles de ruido; ninguna selección recibe la hipótesis generadora.
- D usa las mismas preguntas y respuestas que B: solo cambia la decisión final.

## Brazos

| Brazo | Banco | Sesiones | Resolución | Exactitud* | Abstención | Falsos positivos* | Micropruebas |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A_24_adaptive | 24 | 2960 | 85.81% | 90.67% | 3.82% | 2.02% | 3.09 |
| B_26_adaptive | 26 | 2960 | 92.50% | 92.02% | 3.89% | 1.83% | 3.24 |
| C_26_information_gain | 26 | 2960 | 91.96% | 87.79% | 5.54% | 0.96% | 5.40 |
| D_26_bayesian_threshold | 26 | 2960 | 87.26% | 94.90% | 12.74% | 3.85% | 3.24 |
| E_25_range_only | 25 | 2960 | 86.05% | 90.67% | 3.58% | 2.02% | 3.09 |
| F_25_accumulator_only | 25 | 2960 | 92.26% | 92.02% | 4.12% | 1.83% | 3.24 |

* Exactitud y falsos positivos usan solo sesiones de perfiles con una hipótesis generadora; los perfiles `solo-conocidas` carecen de hipótesis estable y quedan excluidos de ambos denominadores.

Los perfiles se puntúan solo contra una hipótesis generadora estable. El perfil `solo-conocidas` no generaliza por diseño y se excluye de exactitud y falsos positivos, aunque cuenta en resolución, abstención y micropruebas.

## Uso de las dos micropruebas nuevas

| Brazo | range-un-argumento-01 | acc-inicial-cero-02 |
| --- | --- | --- |
| A_24_adaptive | 2960 sesiones; 0 (0.00%) | 2960 sesiones; 0 (0.00%) |
| B_26_adaptive | 2960 sesiones; 10 (0.34%) | 2960 sesiones; 446 (15.07%) |
| C_26_information_gain | 2960 sesiones; 366 (12.36%) | 2960 sesiones; 574 (19.39%) |
| D_26_bayesian_threshold | 2960 sesiones; 10 (0.34%) | 2960 sesiones; 446 (15.07%) |
| E_25_range_only | 2960 sesiones; 10 (0.34%) | 2960 sesiones; 0 (0.00%) |
| F_25_accumulator_only | 2960 sesiones; 0 (0.00%) | 2960 sesiones; 446 (15.07%) |

## Resultados por patrón

| Patrón | Brazo | Sesiones | Resolución | Exactitud* | Abstención | Falsos positivos* | Micropruebas |
| --- | --- | --- | --- | --- | --- | --- | --- |
| RANGE | A_24_adaptive | 640 | 98.75% | 99.38% | 1.25% | 0.00% | 1.31 |
| RANGE | B_26_adaptive | 640 | 99.84% | 99.38% | 0.16% | 0.00% | 1.32 |
| RANGE | C_26_information_gain | 640 | 99.84% | 99.38% | 0.16% | 0.00% | 5.37 |
| RANGE | D_26_bayesian_threshold | 640 | 99.84% | 99.38% | 0.16% | 0.00% | 1.32 |
| RANGE | E_25_range_only | 640 | 99.84% | 99.38% | 0.16% | 0.00% | 1.32 |
| RANGE | F_25_accumulator_only | 640 | 98.75% | 99.38% | 1.25% | 0.00% | 1.31 |
| ACUMULADORES | A_24_adaptive | 720 | 59.72% | 81.25% | 6.39% | 1.67% | 2.17 |
| ACUMULADORES | B_26_adaptive | 720 | 86.25% | 87.08% | 7.64% | 0.83% | 2.78 |
| ACUMULADORES | C_26_information_gain | 720 | 84.17% | 91.25% | 12.64% | 0.00% | 5.94 |
| ACUMULADORES | D_26_bayesian_threshold | 720 | 91.11% | 92.08% | 8.89% | 3.33% | 2.78 |
| ACUMULADORES | E_25_range_only | 720 | 59.72% | 81.25% | 6.39% | 1.67% | 2.17 |
| ACUMULADORES | F_25_accumulator_only | 720 | 86.25% | 87.08% | 7.64% | 0.83% | 2.78 |
| CONDICIONALES | A_24_adaptive | 800 | 93.13% | 91.25% | 3.75% | 5.31% | 3.66 |
| CONDICIONALES | B_26_adaptive | 800 | 93.13% | 91.25% | 3.75% | 5.31% | 3.66 |
| CONDICIONALES | C_26_information_gain | 800 | 93.37% | 73.44% | 5.37% | 3.12% | 5.31 |
| CONDICIONALES | D_26_bayesian_threshold | 800 | 80.25% | 94.06% | 19.75% | 5.94% | 3.66 |
| CONDICIONALES | E_25_range_only | 800 | 93.13% | 91.25% | 3.75% | 5.31% | 3.66 |
| CONDICIONALES | F_25_accumulator_only | 800 | 93.13% | 91.25% | 3.75% | 5.31% | 3.66 |
| FUNCIONES | A_24_adaptive | 800 | 91.63% | 92.81% | 3.62% | 0.00% | 4.77 |
| FUNCIONES | B_26_adaptive | 800 | 91.63% | 92.81% | 3.62% | 0.00% | 4.77 |
| FUNCIONES | C_26_information_gain | 800 | 91.25% | 93.75% | 3.62% | 0.00% | 5.04 |
| FUNCIONES | D_26_bayesian_threshold | 800 | 80.75% | 95.63% | 19.25% | 4.06% | 4.77 |
| FUNCIONES | E_25_range_only | 800 | 91.63% | 92.81% | 3.62% | 0.00% | 4.77 |
| FUNCIONES | F_25_accumulator_only | 800 | 91.63% | 92.81% | 3.62% | 0.00% | 4.77 |

## Resultados por nivel de ruido

| Ruido | Brazo | Sesiones | Resolución | Exactitud* | Abstención | Falsos positivos* | Micropruebas |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0.0 | A_24_adaptive | 660 | 86.82% | 100.00% | 5.00% | 0.00% | 3.07 |
| 0.0 | B_26_adaptive | 660 | 90.61% | 100.00% | 4.85% | 0.00% | 3.20 |
| 0.0 | C_26_information_gain | 660 | 90.76% | 100.00% | 6.06% | 0.00% | 5.33 |
| 0.0 | D_26_bayesian_threshold | 660 | 77.73% | 100.00% | 22.27% | 0.00% | 3.20 |
| 0.0 | E_25_range_only | 660 | 86.82% | 100.00% | 5.00% | 0.00% | 3.07 |
| 0.0 | F_25_accumulator_only | 660 | 90.61% | 100.00% | 4.85% | 0.00% | 3.20 |
| 0.1 | A_24_adaptive | 980 | 84.90% | 94.80% | 2.86% | 0.60% | 3.03 |
| 0.1 | B_26_adaptive | 980 | 94.69% | 97.40% | 2.96% | 0.40% | 3.19 |
| 0.1 | C_26_information_gain | 980 | 93.98% | 93.00% | 4.39% | 0.00% | 5.63 |
| 0.1 | D_26_bayesian_threshold | 980 | 89.18% | 98.80% | 10.82% | 0.60% | 3.19 |
| 0.1 | E_25_range_only | 980 | 85.00% | 94.80% | 2.76% | 0.60% | 3.03 |
| 0.1 | F_25_accumulator_only | 980 | 94.59% | 97.40% | 3.06% | 0.40% | 3.19 |
| 0.2 | A_24_adaptive | 660 | 86.97% | 87.78% | 3.94% | 3.33% | 3.12 |
| 0.2 | B_26_adaptive | 660 | 91.82% | 88.33% | 3.94% | 2.78% | 3.27 |
| 0.2 | C_26_information_gain | 660 | 90.61% | 82.78% | 6.97% | 1.11% | 5.24 |
| 0.2 | D_26_bayesian_threshold | 660 | 88.64% | 93.89% | 11.36% | 3.33% | 3.27 |
| 0.2 | E_25_range_only | 660 | 87.27% | 87.78% | 3.64% | 3.33% | 3.13 |
| 0.2 | F_25_accumulator_only | 660 | 91.52% | 88.33% | 4.24% | 2.78% | 3.27 |
| 0.4 | A_24_adaptive | 660 | 85.00% | 72.78% | 3.94% | 6.67% | 3.16 |
| 0.4 | B_26_adaptive | 660 | 91.82% | 72.78% | 4.24% | 6.67% | 3.32 |
| 0.4 | C_26_information_gain | 660 | 91.52% | 66.11% | 5.30% | 4.44% | 5.30 |
| 0.4 | D_26_bayesian_threshold | 660 | 92.58% | 80.00% | 7.42% | 17.22% | 3.32 |
| 0.4 | E_25_range_only | 660 | 85.61% | 72.78% | 3.33% | 6.67% | 3.17 |
| 0.4 | F_25_accumulator_only | 660 | 91.21% | 72.78% | 4.85% | 6.67% | 3.31 |

## Interpretación y límites

- A vs B es la comparación marginal del efecto de añadir los dos ítems dentro de este simulador; no estima su efecto con estudiantes.
- E y F aíslan cada ítem nuevo respecto de A; sus efectos siguen condicionados por los mismos perfiles y reglas sintéticas.
- En el selector adaptativo B, `range-un-argumento-01` se usó en 10/2960 sesiones (0.34%) y `acc-inicial-cero-02` en 446/2960 (15.07%); la contribución marginal de RANGE fue pequeña en este experimento.
- C cambia el selector, por lo que B vs C no aísla el efecto del tamaño del banco.
- D mantiene el selector adaptativo de B; las plausibilidades dependen de supuestos experimentales y de firmas compartidas con el generador.
- En el perfil `error-ocasional`, el ruido es fijo en 0.1 aunque cambie el nivel del experimento; se reporta el valor efectivo en `ablation.csv`.
- No se cambian ítems ni parámetros a partir de los resultados.

El uso observado de cada microprueba nueva por brazo está en `ablation.json`; la tabla completa por método/patrón/ruido y las configuraciones también están en esos archivos.
