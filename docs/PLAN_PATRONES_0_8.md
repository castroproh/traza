# Plan histórico de patrones 0.8.0 — condicionales y funciones

**Estado: propuesta histórica implementada en TRAZA 0.8.0.** Este documento conserva el diseño
original previo a la implementación. Las propuestas, cantidades de hipótesis y ejemplos de este
plan no son la especificación vigente; para el estado y banco actuales consultar
`docs/REVISION_DOCENTE.md` y `src/domain/diagnosis/`.

## 1. Objetivo

Ampliar el instrumento a dos patrones frecuentes en cursos iniciales:

1. **CONDICIONALES**: evaluación de condiciones, ramas y flujo de control.
2. **FUNCIONES**: paso de argumentos, retorno y ámbito local.

Cada patrón debe recorrer el mismo PACT: predicción → análisis real → contraste adaptativo →
transferencia → resumen. La ampliación no debe relajar las guardas ni introducir código libre.

## 2. Patrón CONDICIONALES

### Concepto

Comprensión de cómo se evalúa una condición y qué rama se ejecuta, incluyendo comparaciones,
`elif`, y el caso en que ninguna rama se ejecuta.

### Ejercicio principal propuesto

```python
edad = 15
if edad >= 18:
    print("mayor")
elif edad >= 13:
    print("adolescente")
else:
    print("menor")
```

Salida esperada: `adolescente`.

Preguntas de predicción: salida, valor final de `edad`, rama ejecutada, explicación y confianza.

### Hipótesis candidatas

| ID | Explicación alternativa |
|---|---|
| `H-COND-01` | Evalúa correctamente la primera condición y elige la rama adecuada. |
| `H-COND-02` | Confunde `elif` con una ejecución acumulativa de todas las ramas. |
| `H-COND-03` | Invierte el sentido de la comparación (`>=` como `>` o al revés). |
| `H-COND-04` | Ignora la rama `else` cuando ninguna condición se cumple. |

### Micropruebas candidatas (6)

1. Condición verdadera simple (`if`).
2. Condición falsa sin `else`.
3. Cadena `if`/`elif` con dos condiciones verdaderas: comprobar que solo una rama se ejecuta.
4. Comparación en el límite (`>=` con igualdad).
5. Condición con dos operadores booleanos (`and`).
6. Tabla de verdad de una condición compuesta.

Cada microprueba debe declarar respuestas esperadas por hipótesis, casos ambiguos y explicación,
igual que el banco actual.

### Transferencia propuesta

Clasificar una nota con umbrales distintos y otro contexto (por ejemplo, aprobado/notable), con
valores que no repitan la secuencia del ejercicio principal.

## 3. Patrón FUNCIONES

### Concepto

Comprensión de que una función recibe argumentos, usa un ámbito local y devuelve un valor; el
retorno no es una impresión automática.

### Ejercicio principal propuesto

```python
def doble(numero):
    return numero * 2

resultado = doble(4)
print(resultado)
```

Salida esperada: `8`.

Preguntas de predicción: salida, valor de `resultado`, iteraciones (si no hay bucle, indicar "sin
iteraciones"), explicación y confianza.

### Hipótesis candidatas

| ID | Explicación alternativa |
|---|---|
| `H-FUNC-01` | Comprende parámetros, retorno y asignación del resultado. |
| `H-FUNC-02` | Confunde `return` con `print` (espera salida dentro de la función). |
| `H-FUNC-03` | Ignora el valor de retorno y usa el de la llamada como si fuera `None`. |
| `H-FUNC-04` | Confunde ámbito local con global y espera que `numero` exista fuera. |

### Micropruebas candidatas (6)

1. Función sin retorno explícito (devuelve `None`).
2. Función con dos parámetros y una operación.
3. `return` frente a `print` dentro de la función.
4. Uso del valor devuelto en una expresión.
5. Ámbito: variable local no disponible fuera.
6. Llamada repetida con argumentos distintos.

### Transferencia propuesta

Una función que convierte minutos en horas y minutos, con otro nombre, otros valores y una
representación distinta (por ejemplo, tuplas o mensajes formateados).

## 4. Requisitos técnicos previos a implementar

La versión 0.7.0 no rastrea funciones definidas por el estudiante, recursión, generadores ni
bucles anidados. Antes de 0.8.0 hay que resolver:

| Requisito | Por qué |
|---|---|
| Trazado de llamadas a funciones | `sys.settrace` ya emite eventos `call`/`return`, pero la tabla y la numeración de iteraciones no están diseñadas para funciones. |
| Numeración por función y por bucle | Evitar confundir iteraciones de funciones distintas. |
| Límite de profundidad de llamadas | Prevenir recursión no controlada. |
| Eventos y timeout con funciones | El límite de 2000 eventos y 15 s debe revisarse con llamadas. |
| Definición del contrato `ExecutionResult` | Añadir información de función/ámbito sin romper el esquema actual. |
| Validación del banco | Extender `validation.ts` a funciones y condicionales. |
| Nuevas matrices de discriminación | Pares de hipótesis y respuestas esperadas. |
| Mensajes educativos | No etiquetar al estudiante; explicar la evidencia. |

También hay que decidir si las funciones se permiten en el código de los ejercicios de la lista
blanca (sí) sin abrir un editor (no).

## 5. Plan de implementación sugerido

1. **Diseño pedagógico y revisión docente** de ejercicios, hipótesis y micropruebas (bloqueante).
2. Extender el trazador y sus pruebas sin cambiar el comportamiento de RANGE/ACUMULADORES.
3. Añadir el patrón y sus ejercicios a la lista blanca.
4. Crear hipótesis, matrices y micropruebas; validar el banco.
5. Integrar en la máquina de estados PACT sin transiciones nuevas.
6. Añadir pruebas unitarias, de integración con Pyodide y E2E para ambos patrones.
7. Actualizar resumen, exportación y documentación.
8. Revisar seguridad y dependencias.

## 6. Criterios de aceptación propuestos

- Los dos patrones nuevos completan PACT con datos reales.
- Las guardas de etapa y la persistencia se mantienen.
- Cada patrón tiene al menos un ejercicio principal y una transferencia con valores distintos.
- La evidencia admite `supports` / `insufficient` / `contradicts`.
- No se introduce código libre ni se debilita el aislamiento.
- Las pruebas existentes siguen pasando.
- La revisión docente de los nuevos ejercicios está hecha **antes** de afirmar validez educativa.

## 7. Riesgos y preguntas abiertas

- ¿Cómo representar iteraciones cuando no hay bucles? Propuesta: lista vacía y texto "sin
  iteraciones", sin inventar una iteración.
- ¿Cómo mostrar el ámbito local sin abrumar? Propuesta: una sección plegable en la vista técnica.
- ¿La recursión entra en 0.8.0? Propuesta: no; dejar para una versión posterior tras revisar
  profundidad y timeout.
- ¿Se permite `input()`? No: rompe el determinismo y la ejecución sin interacción.
- ¿Cómo evitar pistas en las opciones de respuesta? Revisión docente y pruebas de ambigüedad.

## 8. Fuera de alcance

- Código libre del estudiante.
- Backend, cuentas o sincronización.
- IA generativa o diagnóstico probabilístico.
- Nuevos patrones más allá de condicionales y funciones.
