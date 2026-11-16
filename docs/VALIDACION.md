# Validación de la fase 1

Ejecución local: 16 de noviembre de 2026. Python 3.12.10, Node 24.20.0, Windows/PowerShell. Resultados de simulación, sin validación experimental. No se hicieron commits; el directorio inicial estaba vacío y no contiene repositorio Git inicializado.

## Comandos y resultado

```powershell
python -m unittest discover -s tests -v
node --test --test-isolation=none tests/core.test.js
```

**13 pruebas Python y 6 pruebas JavaScript aprobadas, 0 fallos** en la ejecución final. El parámetro `--test-isolation=none` evita la creación de subprocesos del runner Node, restringida en este entorno; no omite pruebas. La prueba Python de interoperabilidad sí ejecuta los CLI Node contra archivos JSON reales.

| Comprobación | Alcance |
|---|---|
| Equilibrio | Ambas plantas y estrategias, alimentación=descargas=45 L/min y consignas iniciales. IAE≈0. |
| Acción PI | Signo positivo/negativo de cambios de consigna, para cada una de las tres celdas. |
| Retardos | Sin cambio de descarga antes de θ; primera orden aplicada exactamente a θ=[7,6,3]. |
| Modelo | Pendiente del nivel por escalón unitario de alimentación antes de responder la bomba: 0.01851852 física y 0.001018 identificada. |
| Conexión | En cada muestra qin,2=qout,1 y qin,3=qout,2. |
| Conservación | Balance por celda y acumulado del banco en ambas plantas/estrategias, con tolerancia 1e−8 L. |
| Fronteras | Ensayos de celda vacía y alimentación excesiva con rebose explícito. Orden y descarga permanecen acotadas; nivel entre 0 y 45 cm salvo redondeo. |
| SIMC | Reproduce el cálculo analítico y deja visible la discrepancia con iniciales de celda 3 en Tabla 2. |
| Estabilidad numérica | Escalón pequeño, sin saturación, horizonte 1800 s: error de las últimas 100 muestras <1e−5 cm para las dos plantas y estrategias. No es garantía para cualquier parámetro. |
| Anti-windup | Saturación de orden, retorno de consigna y recuperación del control. |
| IAE | Misma suma rectangular, unidades y horizonte para ambas estrategias; estado terminal coincide con la última actualización. |
| FF | Modo literal: pulso de una muestra; acumulado: compensación sostenida. |
| Entradas | Rechazo de versión, unidades, paso, geometría, ganancias, tiempos y estrategia inválidos. |
| JSON Schema | Valida las dos configuraciones y los dos resultados completos de ejemplo. |
| Interoperabilidad | Comparación de todos los campos y muestras de 12 ejecuciones: dos plantas × dos modos FF × dos estrategias, más rebose/vaciado físicos × dos estrategias. |
| Repetición importada | JavaScript lee el resultado Python desde disco, lo repite y contrasta todas sus series y metadatos. Python lee el resultado JS y repite su configuración. Tolerancia cruzada abs=1e−9, rel=1e−11; verificador de importación abs=1e−8, rel=1e−11. |
| Integridad | JavaScript rechaza resultados con caudal alterado u origen falsificado como experimental. Las funciones no modifican el escenario de entrada. |

No se hace refinamiento de Δt: esta versión fija el paso de 1 s por contrato. La exactitud del integrador con entradas retenidas se comprueba contra el balance analítico de un paso; la convergencia ensayada es temporal del lazo, no una prueba de convergencia de malla.

## Resultados propios de ejemplo

Horizonte de 900 s; consignas iniciales [30,33,33] cm; cambios a 29/32/32 cm a los 60/180/300 s, respectivamente. Alimentación 45→55→45 L/min a los 420/600 s. Estos eventos son didácticos y **no se extrajeron de Figura 14**.

| Planta / estrategia / FF | IAE C1 | IAE C2 | IAE C3 |
|---|---:|---:|---:|
| Identificada, feedback | 42.345 | 52.295 | 71.527 |
| Identificada, feedback+FF literal | 42.340 | 52.422 | 72.902 |
| Identificada, feedback+FF acumulado (variante) | 28.082 | 34.306 | 29.514 |
| Física SIMC, feedback | 314.394 | 276.508 | 295.190 |
| Física SIMC, feedback+FF literal | 314.294 | 275.993 | 293.671 |
| Física SIMC, feedback+FF acumulado (variante) | 86.087 | 98.252 | 69.827 |

Unidades de todas las columnas: cm·s. No comparar directamente los IAE de plantas distintas como si midieran el mismo experimento: sus capacidades de almacenamiento y ganancias de control son distintas. La comparación pertinente es entre estrategias con la misma planta y los mismos eventos.

El FF literal **no mejora universalmente** el desempeño: aumenta algo el IAE de C2 y C3 en el ejemplo identificado. Esto es compatible con que el término de diferencia no compense de manera sostenida una perturbación. El acumulado mejora estos ejemplos, pero se identifica como variante propia y no se usa para afirmar reproducción del paper. No se añadieron tests que exijan una mejora FF para todo escenario.

En el escenario físico de 900 s, el máximo residual acumulado de las dos estrategias literales fue aproximadamente **3.32e−12 L**, muy por debajo de 1e−8 L.

Los IAE experimentales [198,325,260] y [164,187,221] se transcriben por separado en AUDITORIA_ARTICULO.md; no son objetivos de ajuste de estos escenarios.

## Interfaz HTML y límites de verificación

Se entrega un banco de prueba que carga escenarios, compara estrategias, exporta JSON e importa resultados verificándolos mediante repetición completa en JS. El módulo usado para esa verificación se ejercita automáticamente con resultados Python reales.

La comprobación visual y de interacción en navegador quedó pendiente: la herramienta de navegador devolvió `The browser access host is unavailable`. No se afirma haber probado visualmente la página ni el selector de archivos. Se verifican por HTTP los recursos locales y por Node la sintaxis de sus módulos. El siguiente control manual recomendado es abrir `http://localhost:8000`, importar `examples/identified_feedback_feedforward.json`, recorrer el tiempo y exportar el escenario para repetirlo en Python.

## Pendientes reales

- Resolver con datos/código originales la escala de k′ frente a geometría, los iniciales de celda 3, la implementación FF y el horizonte de IAE experimental.
- La planta no incluye T-1 finito, dinámica del aire/espuma, caudal de concentrado ordinario, sensores filtrados, cuantización PLC ni mineral sólido. Esas limitaciones están declaradas, no calibradas con datos ficticios.
- Completar gráficos, interacción visual final y comprobación en navegador, después despliegue Vercel e informe académico. No hay todavía URL desplegada ni informe final.
