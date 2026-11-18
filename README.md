# TRAZA

TRAZA 0.5.0 es una experiencia educativa en español para razonar sobre dos patrones introductorios de programación: los bucles con `range()` y los acumuladores. Usa un ciclo PACT de cuatro etapas —**Predicción, Análisis, Contraste y Transferencia**— para registrar las predicciones antes de ejecutar, compararlas con trazas reales de Pyodide y observar si una hipótesis se transfiere a un ejercicio nuevo.

La aplicación ejecuta un catálogo fijo de ejercicios en un Web Worker. No acepta ni ejecuta código escrito por el estudiante. Las hipótesis se tratan como evidencia provisional, no como una evaluación definitiva de comprensión.

## Ejecución local

```sh
npm ci
npm run dev
```

## Ciclo PACT

1. **Predicción:** se elige el patrón `range()` o acumulador y se registra la salida, el número de iteraciones, los valores por vuelta, la explicación y la confianza esperados.
2. **Análisis:** se inspecciona la traza real de Pyodide.
3. **Contraste:** se ejecutan micropruebas fijas para distinguir hipótesis competidoras; los resultados ambiguos se conservan como evidencia insuficiente.
4. **Transferencia:** se predice y ejecuta un ejercicio nuevo. El resultado se describe como evidencia consistente, inconsistente o inconclusa; no demuestra dominio por sí solo.

El avance solo se guarda en el `localStorage` del navegador actual. Se puede desactivar el guardado y reiniciar la sesión. No se utilizan cuentas ni identificadores de usuario.

## Comprobaciones

```sh
npm run typecheck
npm test
npm run test:e2e
```

Las pruebas cubren reglas del dominio, validación del almacenamiento y recorridos de navegador para ambos patrones, persistencia/reinicio, diseño móvil y ejecución con Pyodide. La suite de navegador incluye una comprobación del build de producción.

## Límites técnicos

- Pyodide ejecuta solo los ejercicios fijos de la aplicación; no es un ejecutor general de código.
- Ni el Worker ni el validador de ejercicios constituyen un sandbox de seguridad.
- Pyodide genera avisos de build por módulos `node:*` externalizados; los avisos no impiden compilar.
- La compatibilidad y el rendimiento en navegador dependen del dispositivo y del navegador.
