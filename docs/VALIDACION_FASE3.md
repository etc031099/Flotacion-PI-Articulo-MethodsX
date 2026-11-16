# Validación técnica de la fase 3

Fecha: 16 de noviembre de 2026. Proyecto: FlotaLab, control PI de tres celdas de flotación en serie. Esta es documentación de implementación y pruebas, no el informe académico final.

## Resultado

**API real, integración local y paquete autónomo: PASS.** El adaptador FastAPI llama a `flotation.core.simulate`. No se modificaron los núcleos matemáticos, configuraciones del artículo, ejemplos ni esquema numérico 1.0.0. La respuesta de simulación sigue siendo un resultado directo compatible; la procedencia Python viaja en cabeceras HTTP.

**Conexión pública Vercel HTTPS→Python: NOT TESTED.** No existe aún una URL pública del proyecto. Las pruebas locales no se presentan como evidencia de esa conexión.

## Entorno y dependencias verificadas

- Windows, Python 3.12.10, Node 24.20.0.
- FastAPI 0.163.1, Uvicorn 0.54.0, jsonschema 4.26.0. La API requiere Python ≥3.11; la versión de FastAPI instalada declara ese mínimo.
- Las versiones directas están en `requirements-api.txt`; las 19 distribuciones de la entrega están bloqueadas en `requirements-python.lock.txt` y se copian a `requirements.txt` dentro del paquete.
- Navegadores reales automatizados por Playwright CLI: **Chrome 157.0.8103.51** y **Edge 157.0.4341.60**, modo headless, viewport 1440×1100. La regresión incluye emulación móvil 390×844.
- Los servidores de pruebas se escuchan sólo en 127.0.0.1 y se detienen al terminar. No se instalaron dependencias en el intérprete global ni se abrieron túneles.

## Comandos ejecutados

Preparación y servicio real:

```powershell
python -m venv .venv-api
.venv-api\Scripts\python.exe -m pip --isolated install --index-url https://pypi.org/simple -r requirements-api.txt
.venv-api\Scripts\python.exe servidor.py
python -m http.server 8000 --bind 127.0.0.1
```

Pruebas automáticas y construcción:

```powershell
.venv-api\Scripts\python.exe -m unittest discover -s tests -v
npm.cmd test
npm.cmd run build
```

Resultado: **33 pruebas Python y 47 JavaScript aprobadas, 0 fallidas**. Se conservan todas las pruebas anteriores. La prueba de API inicia un subproceso Uvicorn con un puerto libre, usa HTTP real mediante urllib/http.client y lo termina en tearDown; no sustituye endpoints por mocks.

| Grupo | Pruebas | Resultado y alcance |
|---|---:|---|
| Python anteriores | 15 | PASS. Núcleo, 12 ejecuciones de paridad completas, esquema y CLI de intercambio. |
| `tests/test_api.py` | 14 | PASS. HTTP real: versiones/capacidades, resultado, esquema, procedencia, preflight, CORS autorizado, rechazo de origen/Host, parámetros, unidades, límites de duración/eventos/cuerpo, JSON inválido, equilibrio, retardo, perturbación, ambos modelos/modos FF, saturación, rebose, conservación y concurrencia. |
| `tests/test_api_settings.py` | 4 | PASS. Configuración explícita, sin comodines, HTTP público, rutas o credenciales; overrides acotados. Los dominios `.example`/`exact.vercel.app` de pruebas son fixtures, no un despliegue. |
| JavaScript anteriores | 40 | PASS. Núcleo, reproducción, escenarios, gráficos, DOM, importación/exportación y build. |
| `tests/network-access.test.js` | 7 | PASS. Detección de permisos, contexto, metadatos HTTP, ausencia de cookies, mensajes, heartbeat y receptor correcto de fetch. Son pruebas controladas de cliente; no se usan como evidencia de red real. |

La prueba de tamaño valida tanto la declaración Content-Length excesiva como el cuerpo real enviado por Transfer-Encoding: chunked sin Content-Length. La segunda petición recibe 413 con cabecera CORS correcta. El ensayo de concurrencia envía dos peticiones simultáneas de 7200 s: una obtiene 200 y 7200 muestras; la otra, 429. No se admite una cola ilimitada de cálculos.

## Endpoints y controles reales

**GET /health: HTTP 200**. Respuesta observada:

```json
{
  "status": "ok",
  "engine": "python",
  "schema_version": "1.0.0",
  "api_version": "1.0.0",
  "model_version": "1.0.0",
  "capabilities": {
    "strategies": ["feedback", "feedback_feedforward"],
    "models": ["physical", "identified"],
    "dt_s": 1,
    "max_duration_s": 7200,
    "max_samples": 7200,
    "max_events": 128,
    "max_request_bytes": 262144,
    "max_concurrent_simulations": 1
  }
}
```

**POST /simulate: HTTP 200**, resultado directo del núcleo. Cabeceras observadas: `X-FlotaLab-Engine=python`, API/modelo 1.0.0 y UUID de solicitud. `Cache-Control=no-store`, sin cookies. CORS expone los metadatos al cliente.

**Preflight OPTIONS autorizado: HTTP 200** con `Access-Control-Allow-Origin: http://127.0.0.1:8000`, GET/POST y Content-Type explícitos, sin Allow-Credentials. Un origen no autorizado recibe 400 en preflight y 403 en peticiones reales; no se devuelve Allow-Origin para él. El servicio no interpreta un Origin cualquiera como permiso de acceso.

La entrada de ejecución fija host 127.0.0.1, sin opción de ampliar el bind, proxy headers ni reload. Host ajeno se rechaza. No hay rutas de archivos, shell, ejecución de código, subida de archivos, shutdown remoto ni OpenAPI/Swagger habilitado. No se reciben rutas para cargar escenarios desde la API: sólo objetos JSON validados. No hay credenciales ni secretos requeridos.

Límites de servicio: 7200 s, 128 eventos, 256 KiB de entrada, 32 MiB de salida, un cálculo concurrente y rangos numéricos de ingeniería descritos en API_PYTHON.md. Estos límites no cambian la ley física ni los parámetros del artículo.

## Integración completa de navegador a Python

Se ejecutó sin `page.route`, sin interceptar respuestas y sin fabricar datos:

```powershell
npx.cmd --no-install playwright-cli open http://127.0.0.1:8000 --browser chrome
npx.cmd --no-install playwright-cli run-code --filename tests/browser-python-flow.js
npx.cmd --no-install playwright-cli -s=edge open http://127.0.0.1:8000 --browser msedge
npx.cmd --no-install playwright-cli -s=edge run-code --filename tests/browser-python-flow.js
```

**22 comprobaciones en Chrome + 22 en Edge: PASS.** En cada navegador:

1. La página abre sin declarar Python conectado.
2. El botón provoca GET /health real y valida versiones.
3. Se selecciona Python y se envían dos POST /simulate reales, uno por estrategia.
4. Se inspeccionan procedencia, request ID y CORS de las respuestas reales.
5. Se compara cada nivel de C1/C2/C3 mostrado en t=0/60/420/900 con el JSON capturado de la respuesta HTTP de la estrategia elegida.
6. Los IAE de la tabla coinciden con Python y los seis Canvas dibujan las series recibidas.
7. Se cambia alimentación a 50 L/min y consigna inicial C1 a 31 cm. Otras dos solicitudes contienen esos cambios y generan nuevas series Python.
8. Se exportan desde los botones reales escenario y resultado; la cabecera conserva **Python · API local**.

Ejemplos de request ID de Chrome: `2a11e730-e980-4a7f-bf69-8ad85e23a5c7`, `60e0e338-50a2-44a9-9cc2-e8b42a2e206b`. De Edge: `34d8072d-d6a9-495e-8022-bc8ab634557c`, `c5bd9ec1-0719-47a5-a6a7-ceb9208b52ca`. Identifican solicitudes de prueba, no usuarios ni credenciales.

Los objetos cargados por el cliente son los recibidos por fetch. La repetición JavaScript se usa sólo para verificación de consistencia; no sustituye la respuesta Python. Las pruebas DOM anteriores comprueban además identidad de objetos devueltos por el cliente y ausencia de fallback automático.

### Fallo encontrado y corregido

La primera prueba real detectó un error que los mocks no revelaban: `this.fetcher(...)` proporcionaba a fetch nativo un receptor incompatible en Chrome, por lo que fallaba antes de emitir /health. Se corrigió con invocación sobre `globalThis` y se añadió una prueba de regresión. Tras ello ambos navegadores completaron el flujo. El núcleo científico no se tocó.

Consola durante los flujos válidos Chrome/Edge: **0 errores y 0 advertencias**. En la prueba de caída real del proceso aparece el `ERR_CONNECTION_REFUSED` de red esperado, acompañado de un mensaje manejado en la interfaz; no se oculta como si hubiera un cálculo exitoso.

## Comparación matemática y respaldo por archivos

Los resultados HTTP se comparan en Python con la llamada directa `simulate` para ambos modelos, ambos modos FF y ambas estrategias: todos los campos coinciden exactamente. Se mantienen también las 12 ejecuciones originales Python–JavaScript con tolerancias abs=1e−9/rel=1e−11.

Recorrido probado con archivos descargados realmente de la web:

```powershell
.venv-api\Scripts\python.exe simulacion_flotacion.py output/fase3/escenario-web-real.json --output output/fase3/resultados-cli-reales.json --strategy compare
node scripts/check_result.mjs output/fase3/resultados-web-python-api.json
node scripts/check_result.mjs output/fase3/resultados-cli-reales.json
npx.cmd --no-install playwright-cli run-code --filename tests/browser-python-files.js
```

Los resultados exportados tras API y los generados por el CLI son **idénticos**, incluidas todas las muestras y metadatos del sobre: diferencia absoluta máxima observada **0.0**. El verificador JS también los acepta. La importación real del resultado CLI y sus gráficas pasan otras **3 comprobaciones** y se etiquetan **Python · archivo (declarado)**.

| Escenario simulado / IAE (cm·s), T=900 s | C1 | C2 | C3 |
|---|---:|---:|---:|
| Referencia, PI | 42.3452966573 | 52.2951095629 | 71.5272230088 |
| Referencia, PI+FF literal | 42.3401094180 | 52.4220752784 | 72.9021748977 |
| Modificado 50 L/min y r1 inicial=31 cm, PI | 106.0299972924 | 83.2268886127 | 98.3132531741 |
| Mismo modificado, PI+FF literal | 106.0273533009 | 83.2289072053 | 100.2185974427 |

Estos son datos **simulados**, no ensayos físicos ni valores reconstruidos de Figura 14. FF literal no mejora todas las celdas; no se modificaron conclusiones para favorecerlo.

## Pérdida real de conexión y regresión

Se detuvo el proceso real de la API de pruebas. El heartbeat detectó la pérdida, cambió el estado a desconectado y mantuvo el origen Python de los datos guardados. Al elegir Navegador de manera explícita y aplicar, JavaScript volvió a calcular normalmente. `tests/browser-python-disconnect.js`: **3 comprobaciones PASS**.

Después se repitió `tests/browser-flow.js`, con Python apagado: **25 comprobaciones PASS** de reproducción, modelos, parámetros, curvas, archivos y móvil. Total de comprobaciones de navegador registradas en esta fase: **75 PASS, 0 FAIL** (25 regresión + 44 API real + 3 archivos + 3 caída).

## Paquete independiente y ZIP

Se preparó `entrega/Python_Flotacion/` mediante lista explícita de 16 archivos, incluido MANIFIESTO.json. Los módulos `flotation/` se copian del proyecto verificado; no existe otra versión matemática reescrita.

```powershell
.venv-api\Scripts\python.exe scripts/build_python_package.py prepare
.venv-api\Scripts\python.exe scripts/validate_python_package.py --package entrega/Python_Flotacion --evidence output/fase3/paquete-autonomo.json
.venv-api\Scripts\python.exe scripts/build_python_package.py zip --evidence output/fase3/paquete-autonomo.json
```

La validación copió el paquete fuera del repositorio a una carpeta temporal independiente, eliminó PYTHONPATH/PYTHONHOME de su proceso, creó un entorno nuevo e instaló las 19 distribuciones bloqueadas desde PyPI. **6 verificaciones PASS**:

- Entorno e instalación independientes.
- Comprobador de dependencias listo sin reinstalación.
- Intérprete y `flotation.core` resueltos dentro de la copia independiente.
- BAT real inicia el servidor, no un proceso simulado.
- /health y /simulate reales calculan las dos estrategias.
- El CLI portátil devuelve exactamente los mismos resultados que HTTP.

Evidencia: `output/fase3/paquete-autonomo.json`. La prueba inicial del helper tuvo que utilizar una ruta explícita `.\INICIAR_PYTHON.bat` para no depender de la búsqueda de ejecutables del directorio actual de cmd; se corrigió el helper y se repitió desde otra carpeta limpia. No se ignoró el fallo.

Además, se copió el paquete a **otra carpeta sin .venv** y se ejecutó directamente el BAT. Creó el entorno, instaló dependencias y levantó /health: **3 verificaciones PASS**, registradas en `output/fase3/primer-inicio-bat.json`. Python utilizado: 3.12.10. Las dos pruebas detuvieron su árbol de procesos propio al finalizar. No es una computadora física diferente: es una prueba de aislamiento de carpeta y entorno nuevo dentro de esta computadora; no se afirma una reinstalación completa de Windows.

El ZIP sólo se genera cuando la evidencia PASS corresponde al SHA-256 del manifiesto actual y cada archivo sigue coincidiendo. Comprobado `ZipFile.testzip()` y ausencia de `.venv`, `__pycache__`, `node_modules` o secretos.

- Entrega: **`entrega/Python_Flotacion.zip`**.
- Archivos: **16**.
- Tamaño: **19121 bytes**.
- SHA-256: **`b8f758cd0cc8f6eefdc9195eae4418018993d6907a0260311fd7d2a0f0a21685`**.

No hay rutas absolutas de la computadora de desarrollo como dependencia del paquete. La API no recibe rutas; el CLI sólo lee y escribe los archivos que la persona indique en su terminal.

## Navegadores: investigación y prueba pública pendiente

Se consultaron las fuentes oficiales de [FastAPI CORS](https://fastapi.tiangolo.com/tutorial/cors/), [Chrome LNA](https://developer.chrome.com/docs/modern-web-guidance/guides/security/local-network-access), [MDN](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Local_network_access) y [Edge](https://learn.microsoft.com/en-us/deployedge/ms-edge-local-network-access). Los detalles y pasos para el docente están en GUIA_CONEXION_PYTHON.md.

La implementación detecta contexto y permisos compatibles, conecta desde gesto explícito y ofrece archivos si el navegador bloquea. No asume que consultar permisos implique conectividad ni que un HTTP local pruebe HTTPS público. No agrega PNA obsoleto, flags inseguros ni túneles. La prueba loopback→loopback no activó un permiso público LNA y no acredita esa parte del comportamiento.

| Criterio | Estado |
|---|---|
| API FastAPI real sobre núcleo único, /health y /simulate | PASS |
| Tipos/esquema/unidades, preflight, CORS, Host y límites | PASS |
| HTML local→Python→series/IAE/gráficas, Chrome | PASS |
| HTML local→Python→series/IAE/gráficas, Edge | PASS |
| Respaldo de archivos sin editar JSON | PASS |
| Pérdida del servicio sin fallback silencioso | PASS |
| Paquete independiente con venv nuevo y BAT primer inicio | PASS |
| ZIP íntegro y sin entornos/cachés | PASS |
| Vercel HTTPS→Python local, permisos y mixed content reales | **NOT TESTED: no existe URL pública** |
| Firefox | **NOT TESTED: no instalado** |
| Computadora Windows física diferente | NOT TESTED |
| Reproducción experimental exacta de Figura 14 | Fuera del alcance, sin datos originales |

Tras desplegar: copiar origen HTTPS real en `url_web`, reiniciar API, probar permisos reales y OPTIONS→/health→/simulate→gráficas desde Vercel, repetir en Chrome/Edge y Firefox si está disponible y regenerar ZIP validado con esa configuración. Luego preparar el informe académico final.

## Capturas disponibles

En `output/playwright/`:

- `python-conexion-real-chrome.png`: servicio conectado y motor Python seleccionado.
- `python-conexion-real-edge.png`: mismo flujo en Edge.
- `python-api-graficas-chrome.png` y `python-api-graficas-edge.png`: curvas calculadas por API Python.
- `python-archivo-real.png`: resultado de consola importado y graficado.
- `python-desconectado.png`: fallo detectado y alternativa explícita de motor.
- Capturas de regresión de escritorio y móvil de la fase 2, actualizadas durante esta fase.

## Archivos creados o modificados

Creados:

```text
flotation/api.py
flotation/api_settings.py
servidor.py
simulacion_flotacion.py
INICIAR_PYTHON.bat
comprobar_dependencias.py
configuracion_servidor.json
requirements-api.txt
requirements-python.lock.txt
LEEME_PYTHON.txt
scripts/build_python_package.py
scripts/validate_python_package.py
tests/test_api.py
tests/test_api_settings.py
tests/network-access.test.js
tests/browser-python-flow.js
tests/browser-python-files.js
tests/browser-python-disconnect.js
docs/GUIA_CONEXION_PYTHON.md
docs/VALIDACION_FASE3.md
```

Modificados:

```text
web/python-client.js
web/app.js
index.html
scripts/build-static.mjs
requirements-dev.txt
package.json
.gitignore
README.md
docs/API_PYTHON.md
docs/GUIA_INTERFAZ.md
docs/MODELO_MATEMATICO.md
```

Generados: `entrega/Python_Flotacion/`, `entrega/Python_Flotacion.zip`, `dist/` (22 archivos públicos), evidencias y capturas en `output/`. Auxiliares de instalación/pruebas en `.venv-api/` y `tmp/`, excluidos de entregables y Git.

No se hicieron commits ni staging y no se realizó informe final.
