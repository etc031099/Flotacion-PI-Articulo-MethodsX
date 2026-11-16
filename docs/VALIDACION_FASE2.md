# Validación del simulador interactivo · Fase 2

Fecha: 16 de noviembre de 2026. Entorno: Windows, Python 3.12.10 y Node 24.20.0. El trabajo continúa sobre la fase 1; no se reescribieron ni modificaron `flotation/core.py`, `web/core.js`, las configuraciones de referencia, los ejemplos ni su esquema numérico 1.0.0.

## Pruebas automáticas

```powershell
python -m unittest discover -s tests -v
npm.cmd test
npm.cmd run build
```

Resultado final comprobado: **15 pruebas Python + 40 pruebas JavaScript aprobadas, 0 fallidas**. Las 19 pruebas originales están incluidas, no reemplazadas. Node se ejecuta con `--test-isolation=none` por las restricciones de subprocesos de este entorno; las pruebas Python conservan su comparación real contra CLI Node.

| Archivo | Cantidad | Evidencia |
|---|---:|---|
| `tests/test_core.py` | 13 | Equilibrio, signos, retardos por celda, conservación, SIMC, saturación, vaciado/rebose, convergencia, IAE, esquema y 12 ejecuciones cruzadas Python–JavaScript. |
| `tests/test_cli.py` | 2 | CLI Python emite comparación y resultados individuales con/sin sobre; JavaScript importa y verifica los archivos reales. |
| `tests/core.test.js` | 6 | Pruebas originales del motor, sin relajar sus criterios. |
| `tests/session.test.js` | 10 | Reloj, pausa, continuación, paso, velocidades, tiempo terminal, IAE por prefijos, selección de muestras, comparación honesta, edición de escenarios y datos de gráficas. |
| `tests/connection.test.js` | 10 | Esquema, versiones/unidades, intercambio, /health compatible, fallo HTTP/red, timeout, cancelación, respuesta alterada y ausencia de fallback silencioso. Se usan respuestas controladas, no un servidor Python real. |
| `tests/ui.test.js` | 13 | Eventos reales de formulario y botones en DOM: niveles de tres celdas, reproducción, parámetros pendientes, escenario físico, ganancias avanzadas, eventos, comparación, archivos y estados Python. Motor numérico real; reloj, descarga, Canvas y red inyectados para control determinista. |
| `tests/build.test.js` | 1 | Construcción estática, lista pública, recursos locales y resolución de imports. Verifica ausencia de temporales, pruebas, dependencias y núcleo Python en el sitio construido. |

El DOM de pruebas usa happy-dom. Su validación de `step=0.1` presenta diferencias de redondeo; los campos de caudal se ajustaron a `step=any`, que además conserva los valores decimales permitidos por el esquema. Los límites y validadores del núcleo siguen aplicándose. La prueba porcentual de llenado usa tolerancia 1e−12 para diferencias de orden de operaciones de coma flotante. No se cambió la física para hacer pasar pruebas.

## Navegador real

Se utilizó Chrome mediante Playwright CLI. No se reutilizó la imposibilidad de probar el navegador de la fase 1 como una verificación positiva. En esta fase hubo acceso real y se inspeccionaron capturas.

```powershell
npx.cmd --no-install playwright-cli open http://127.0.0.1:8000 --browser chrome
npm.cmd run test:browser
```

`tests/browser-flow.js`: **25 comprobaciones aprobadas, 0 fallidas**. Verifican:

- Tres tarjetas con niveles de las muestras iniciales, paso exacto de 1 s, iniciar/pausar/continuar/reiniciar y llegada a T=900 s.
- Comparación IAE real y deterioro de FF literal donde ocurre, sin forzar ganador.
- Seis Canvas, píxeles de curvas del color esperado (no sólo ejes), tooltips numéricos y sincronización con el tiempo reproducido.
- Parámetros pendientes, modificación real de caudal, planta física con SIMC propio, FF acumulado rotulado y estrategia única/ambas.
- Descarga real del navegador de escenarios y resultados, e importación del resultado Python generado en fase 1.
- Selección Python sin conexión: error explícito y conservación de origen de datos guardados, sin fallback.
- Vista de 1440×1100 y emulación móvil 390×844, sin desbordamiento horizontal.

Las capturas se guardan en `output/playwright/dashboard-desktop.png`, `graficas-desktop.png` y `banco-movil.png`. Se revisaron visualmente tanques, conectores, cifras, comparación, curvas y lectura móvil. La prueba espera que cada Canvas haya dibujado el tiempo terminal antes de capturar; una captura inicial tomada antes del callback de visibilidad sólo contenía ejes y se corrigió la sincronización de la prueba. No se alteraron datos para dibujar curvas.

Consola de aplicación: **0 errores** durante el flujo válido. La ejecución final sobre el paquete `dist/` repitió las 25 comprobaciones con **0 errores y 0 advertencias** de consola. En una inspección anterior hubo una advertencia de rendimiento de Canvas por lecturas repetidas de `getImageData` del test; no fue un fallo del cálculo ni un recurso ausente.

## Paridad y recorrido completo

Se conservan las 12 ejecuciones de paridad de fase 1, comparando todos los campos y series, no sólo IAE. Tolerancias: abs=1e−9 y rel=1e−11. La validación de archivos del navegador usa abs=1e−8 y rel=1e−11.

Además, el escenario descargado realmente desde Chrome se ejecutó con Python:

```powershell
python -m flotation output/playwright/escenario-navegador.json --output tmp/python-desde-navegador.json --strategy compare
node scripts/check_result.mjs tmp/python-desde-navegador.json
```

La comparación de todas las muestras fue satisfactoria. Se verificaron también en Python las series de los resultados descargados del navegador: diferencia absoluta máxima observada **0.0** en niveles, consignas, errores, entradas, descargas, órdenes, reboses y estados siguientes. Los IAE son:

| Estrategia / escenario de referencia | C1 | C2 | C3 |
|---|---:|---:|---:|
| Feedback PI | 42.3452966573 | 52.2951095629 | 71.5272230088 |
| PI + FF literal | 42.3401094180 | 52.4220752784 | 72.9021748977 |

Unidades cm·s; T=900 s. No son los IAE experimentales de Figura 14. La web presenta esos valores publicados en otra sección.

## Paquete para Vercel

`npm.cmd run build` produce `dist/` con 21 archivos públicos explícitos. Incluye HTML, estilos, módulos, Worker, dos configuraciones, esquema y cuatro documentos de uso/modelo. Se omiten dependencias de desarrollo, temporales, capturas y código del motor Python. La copia pública de la auditoría omite la ruta del PDF específica de la computadora y conserva el hash de la fuente. Los archivos originales de auditoría permanecen intactos.

No hay despliegue ni URL pública en esta fase. `vercel.json` define construcción Node y salida estática `dist`; la instalación omite dependencias de desarrollo. No se necesita servicio remoto para simular.

## Matriz de verificación pendiente

| Aspecto | Estado |
|---|---|
| Cálculo y paridad Python–JS | PASS |
| Navegador Chrome, interfaz y archivos locales | PASS |
| Vista móvil por emulación | PASS |
| Conector HTTP con respuestas controladas | PASS |
| Servidor Python /health y /simulate real | NOT TESTED · servidor reservado a fase 3 |
| HTTPS Vercel → servicio loopback, CORS y permisos LNA | NOT TESTED · fase 3 |
| Safari/Firefox y teléfono físico | NOT TESTED |
| Ensayos de flotación físicos o reproducción exacta de Figura 14 | Fuera del alcance; no se afirman |

No se hicieron commits ni se preparó staging. El directorio inicial no tenía repositorio Git inicializado. No se produjo informe académico final.

## Inventario de cambios

Archivos creados:

```text
web/app.js
web/main.js
web/browser-engine.js
web/worker.js
web/session.js
web/scenarios.js
web/charts.js
web/education.js
web/validation.js
web/python-client.js
web/icon.svg
scripts/build-static.mjs
vercel.json
package-lock.json
tests/session.test.js
tests/connection.test.js
tests/ui.test.js
tests/build.test.js
tests/browser-flow.js
tests/test_cli.py
docs/API_PYTHON.md
docs/GUIA_INTERFAZ.md
docs/VALIDACION_FASE2.md
```

Archivos modificados:

```text
index.html
web/style.css
flotation/__main__.py
scripts/check_result.mjs
package.json
.gitignore
README.md
docs/MODELO_MATEMATICO.md
```

Generados de forma reproducible: `dist/` (21 archivos públicos); `output/playwright/` (capturas y archivos descargados durante QA). `node_modules/`, `.playwright-cli/` y `tmp/` son auxiliares locales ignorados. El núcleo, los tests originales y el esquema de fase 1 se conservaron.
