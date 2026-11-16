# Validación de fase 4

Fecha: 16 de noviembre de 2026. **Producción: https://flotacion-pi-methodsx.vercel.app.** Página abierta y probada realmente, acceso anónimo HTTP 200. GitHub: https://github.com/etc031099/Flotacion-PI-Articulo-MethodsX. Es documentación técnica; no constituye el informe académico Word de fase 5.

## Resultado y conteo

**260 comprobaciones PASS, 0 FAIL pendientes y 4 ámbitos NOT TESTED.** Se cuentan los casos finales una sola vez; las repeticiones no aumentan el total. Las comprobaciones de navegador son aserciones dentro de recorridos, no tests unitarios independientes.

| Grupo final | PASS | Alcance |
|---|---:|---|
| Python unittest | 34 | Núcleo, esquema, CLI, paridad JS/Python, API HTTP real, límites, CORS y configuración de entrega |
| JavaScript node:test | 48 | Núcleo, sesión, DOM, intercambio, cliente y build |
| dist aislado en Chrome | 25 | Sólo `dist/` servido por HTTP en 8000; reproducción, modelos, curvas, edición, importación/exportación y móvil |
| Interfaz pública Chrome + Edge | 50 | 25 por navegador sobre HTTPS Vercel |
| API desde HTTPS Chrome + Edge | 46 | 23 por navegador; incluye permiso específico, salud y cuatro POST reales por recorrido |
| Auditoría pública Chrome + Edge | 42 | 21 por navegador; HTTP, nueve recursos, ausencia de archivos del backend, consola y descarga real del ZIP |
| JSON Python importado en web pública | 3 | CLI real, importación, gráficas y procedencia declarada |
| Caída real del proceso API | 3 | Heartbeat, conservación de procedencia y elección explícita de JS |
| Paquete independiente | 6 | Entorno nuevo, versiones, resolución interna, BAT/API y CLI equivalentes |
| Primer inicio real del BAT | 3 | Copia independiente sin venv: creación, instalación y servidor |
| **Total** | **260** | **0 fallos finales** |

Los cuatro ámbitos NOT TESTED son: Firefox; Safari; otra computadora física (incluidos móviles reales); y aceptación manual del diálogo de permiso del navegador. La vista móvil fue emulada. No se extiende la compatibilidad a versiones o políticas no ensayadas.

## Entorno y comandos

Windows, Python 3.12.10, Node 24.20.0, Vercel CLI 65.16.0. Chrome 157.0.8103.51 y Edge 157.0.4341.60, automatizados con Playwright CLI en perfiles aislados, sin flags que desactiven seguridad. Viewports 1440×1100 y 390×844 emulado.

```powershell
npm.cmd test
npm.cmd run build
.venv-api/Scripts/python.exe -m unittest discover -s tests -v
python -m http.server 8000 --bind 127.0.0.1 --directory dist
.venv-api/Scripts/python.exe servidor.py
npx.cmd --no-install playwright-cli open https://flotacion-pi-methodsx.vercel.app --browser chrome
npx.cmd --no-install playwright-cli run-code --filename tests/browser-flow.js
npx.cmd --no-install playwright-cli run-code --filename tests/browser-python-flow.js
npx.cmd --no-install playwright-cli run-code --filename tests/browser-public-audit.js
npx.cmd --no-install playwright-cli -s=edge open https://flotacion-pi-methodsx.vercel.app --browser msedge
npx.cmd --no-install playwright-cli -s=edge run-code --filename tests/browser-flow.js
npx.cmd --no-install playwright-cli -s=edge run-code --filename tests/browser-python-flow.js
npx.cmd --no-install playwright-cli -s=edge run-code --filename tests/browser-public-audit.js
```

El recorrido de dist se ejecutó abriendo `http://127.0.0.1:8000` antes de `tests/browser-flow.js`; no se confunde con las ejecuciones públicas. Todos los assets necesarios están en el manifiesto de 22 archivos; búsqueda de `C:`/`D:` en dist sin coincidencias. La auditoría pública confirma 404 para `flotation/core.py`, `servidor.py`, `.env` y `configuracion_servidor.json`. No existe un servidor Python alojado en Vercel.

## Permisos, CORS y conexión real

Origen autorizado de producción: **https://flotacion-pi-methodsx.vercel.app**, sin barra final ni wildcard. El servicio sigue en **127.0.0.1:8765**. Conserva Host/Origin estrictos, límites y ausencia de credenciales de fase 3. Permanecen autorizados `http://127.0.0.1:8000` y `http://localhost:8000` para desarrollo.

La nueva prueba `test_production_preflight_exact_origin_and_preview_rejected` envía OPTIONS real al servidor: 200 para el origen definitivo y POST/Content-Type; un preview distinto obtiene 403 en /health sin Allow-Origin. El resto de pruebas mantiene preflight inválido, origen null/ajeno, límites y paridad exacta.

Primero Chrome headless denegó el permiso: error real de acceso al espacio loopback y estado `denied`. La interfaz mostró el rechazo y mantuvo el origen de los datos, sin sustituir Python. No era un fallo del cálculo ni se resolvió ampliando CORS.

Para el recorrido positivo se concedió **únicamente `loopback-network` al origen exacto en el contexto aislado**, usando el protocolo oficial `Browser.setPermission` de CDP, ya que la versión instalada de Playwright no reconoce ese nombre en `grantPermissions`. No se interceptó fetch, no se cambiaron respuestas ni se desactivaron CORS, contenido mixto o seguridad web. El permiso se comprobó como `granted`; la sesión se conserva hasta cerrar el navegador de prueba. Esto ensaya comunicación real bajo permiso concedido; no prueba el clic humano en el diálogo. El docente debe permitirlo en su navegador.

Se comprobó soporte real de `Request.prototype.targetAddressSpace` en Chrome. El cliente usa la opción `targetAddressSpace: "loopback"` sólo cuando está soportada. Consulta el permiso granular y evita el alias antiguo. La primera petición sigue siendo consecuencia del botón Conectar Python; no se intenta acceso local al abrir la página.

Cada navegador recibió /health HTTP 200 y cuatro /simulate HTTP 200 (dos estrategias de referencia y dos con alimentación 50 L/min y consigna inicial C1=31 cm). Las cabeceras confirman engine=python, API/modelo 1.0.0 y UUID, con Allow-Origin exacto. Los tres niveles visualizados a t=0,60,420,900 y los IAE coinciden con las respuestas HTTP; los seis Canvas se renderizaron a t=900. El cliente muestra los objetos Python recibidos; la repetición JS sólo verifica consistencia.

Ejemplos de solicitudes Chrome: `564e2be2-6e4b-4eb8-a005-bf4849e85223`, `1e83c862-4b1b-48c5-9d65-e63a5ff35814`. Edge: `4802490b-da9d-4b3c-a8d0-d9914769a4d9`, `46bb94ca-24fd-495e-bd7e-c58d412bc202`. Las evidencias locales contienen las listas completas.

Se detuvo el proceso API propio, Edge detectó la caída por heartbeat y conservó la procedencia Python. Al elegir JS explícitamente volvió a calcular. Se reinició la API y se repitió con éxito el recorrido público de 23 comprobaciones en Edge: recuperación real. Los errores `ERR_CONNECTION_REFUSED` del ensayo de caída son esperados y manejados. En la carga pública válida Chrome/Edge: **0 errores de consola/JavaScript y 0 fallos de recursos**.

## Equivalencia numérica

```powershell
.venv-api/Scripts/python.exe simulacion_flotacion.py output/fase4/escenario-web-real.json --output output/fase4/resultados-cli-reales.json --strategy compare
node scripts/check_result.mjs output/fase4/resultados-web-python-api.json
node scripts/check_result.mjs output/fase4/resultados-cli-reales.json
npx.cmd --no-install playwright-cli -s=edge run-code --filename tests/browser-python-files.js
```

Los sobres exportados tras API y CLI fueron comparados completos: **iguales, diferencia máxima 0.0**. El escenario modificado produce PI `[106.0299972924395,83.22688861270186,98.31325317406592]` y PI+FF `[106.02735330085692,83.22890720534302,100.21859744267627]` cm·s, T=900 s. La importación pública del archivo CLI pasó 3 comprobaciones y muestra Python · archivo (declarado).

No se alteraron los motores: SHA-256 `web/core.js` = `e5b898d69efe1060dfb22a35f6adb035a4eb1425b42572f73479a2c7f55b03fa`; `flotation/core.py` = `c83e7493e028b65273757e9fed8f7f200e783caccb0561c185daec5eb165297b`. Se conservan los supuestos y advertencias científicas. Todos estos datos son simulados, no experimentales ni reproducción de Figura 14.

## Paquete y evidencias

```powershell
.venv-api/Scripts/python.exe scripts/build_python_package.py prepare
.venv-api/Scripts/python.exe scripts/validate_python_package.py --package entrega/Python_Flotacion --evidence output/fase4/paquete-autonomo.json
.venv-api/Scripts/python.exe scripts/build_python_package.py zip --evidence output/fase4/paquete-autonomo.json
```

Nueva copia independiente: `FlotaLab-validacion-da3e69bed9` bajo TEMP, con PYTHONPATH/PYTHONHOME eliminados y entorno nuevo. Pasaron las 6 verificaciones del validador. Otra copia `FlotaLab-primer-inicio-371a28f976`, sin venv, inició mediante BAT real, creó el entorno, instaló versiones y respondió /health: 3 PASS. Se detuvieron los árboles de procesos propios. Ambas pruebas ocurrieron en esta misma computadora, no en otra física.

ZIP definitivo: `entrega/Python_Flotacion.zip`, 19 187 bytes, 16 archivos. SHA-256 `c68a64c529d9fb9f92afb5abf036da091efdff3d2b25553e25806cb83a1447aa`. El LEEME incluye la URL definitiva y Python 3.11+. Descargado por el enlace de la web desde GitHub Releases: el hash coincide exactamente con el archivo validado. El ZIP no contiene entorno virtual, capturas, secretos ni dependencia de rutas del proyecto.

Evidencias locales conservadas en `output/fase4/`: `chrome-publico.json`, `edge-publico.json`, `auditoria-publica-chrome.json`, `auditoria-publica-edge.json`, `dist-local.json`, `interfaz-publica-edge.json`, `paquete-autonomo.json`, `primer-inicio-bat.json`, escenario y resultados reales. Los archivos de output están fuera del bundle y de Git para evitar publicar capturas y temporales innecesarios.

Capturas reales de producción en `output/playwright/`: `fase4-dashboard-desktop.png`, `fase4-graficas-desktop.png`, `fase4-banco-movil.png`, `fase4-python-api-graficas-chrome.png`, `fase4-python-api-graficas-edge.png`, `fase4-python-conexion-real-chrome.png`, `fase4-python-conexion-real-edge.png`, `fase4-python-archivo-real.png`, `fase4-guia-publica-chrome.png` y `fase4-guia-publica-edge.png`. La captura de caída es `python-desconectado.png`. Los JSON de auditoría registran la URL HTTPS; las capturas de dist tienen prefijo distinto.

## Fallos resueltos y límites

Se corrigió la allowlist de subida tras un build remoto fallido. La autorización inicial de GitHub requirió refresh tras un error transitorio; el usuario completó ambos accesos oficiales. El primer intento positivo de permiso perdía su efecto al separar la sesión CDP; se mantiene durante el recorrido aislado. El auditor de recursos distingue la navegación cancelada intencionalmente por una descarga de un fallo de JS/CSS. No hay fallos finales ocultos.

No se promete conexión si el usuario deniega permiso, no inicia Python o su institución lo bloquea. Los archivos y el motor Navegador son alternativas comprobadas. Permanecen las limitaciones científicas de fases 1–3. Próximo trabajo académico: informe Word de fase 5, con esta URL y capturas verificadas.

Fuentes actuales: [Chrome LNA](https://developer.chrome.com/docs/modern-web-guidance/guides/security/local-network-access), [MDN targetAddressSpace](https://developer.mozilla.org/en-US/docs/Web/API/Request/targetAddressSpace), [CDP Browser.setPermission](https://chromedevtools.github.io/devtools-protocol/tot/Browser/#method-setPermission), [Vercel allowlist](https://vercel.com/docs/deployments/vercel-ignore). Consultadas el 16 de noviembre de 2026.
