# FlotaLab · Simulación de control PI de un banco de flotación

Aplicación estática en español con tres celdas conectadas en serie, bombas peristálticas, retardos, PI, SIMC y comparación feedback/feedforward mediante IAE. Núcleos equivalentes en Python y JavaScript. **Web pública: https://flotacion-pi-methodsx.vercel.app.** Conexión HTTPS a Python local validada en Chrome y Edge con permiso de loopback. El informe académico corresponde a la fase 5.

Descarga el [paquete Python para el docente](https://github.com/etc031099/Flotacion-PI-Articulo-MethodsX/releases/download/v1.0.0/Python_Flotacion.zip), descomprímelo y ejecuta `INICIAR_PYTHON.bat` (Windows, Python 3.11+). La URL pública exacta ya está autorizada en CORS. Consulta [la guía de entrega](docs/GUIA_ENTREGA_DOCENTE.md) y [la validación de fase 4](docs/VALIDACION_FASE4.md).

Basada en Quintanilla et al., MethodsX (2023), DOI [10.1016/j.mex.2023.102081](https://doi.org/10.1016/j.mex.2023.102081). Todas las curvas propias son simuladas. No se afirma reproducir Figura 14 ni realizar ensayos físicos.

## Abrir la web localmente

En una terminal del proyecto:

```powershell
python -m http.server 8000 --bind 127.0.0.1
```

Abre **<http://127.0.0.1:8000>**. Ctrl+C detiene el servidor. No uses `file://`: los módulos, el Worker y fetch requieren HTTP. No necesitas instalar Node ni Python de cálculo para usar una web ya servida; cualquier servidor estático compatible puede reemplazar este comando.

## Uso del simulador

1. Elige escenario, modelo y estrategia. Los valores iniciales proceden de las configuraciones verificadas de fase 1.
2. Pulsa **Aplicar y calcular** después de editar parámetros o eventos. Se pausa la reproducción y se mantienen los datos previos hasta aplicar.
3. Usa **Iniciar, Pausar, Continuar, Reiniciar, Avanzar** o la barra de tiempo. Velocidades ×1/×5/×10/×20 conservan Δt=1 s.
4. **Comparación de controladores** calcula ambas estrategias con el mismo escenario externo. **Visualizar** elige la estrategia del banco y los botones C1/C2/C3 eligen las gráficas.
5. **Ver resultado final** muestra el IAE completo; antes de T la tabla y las gráficas muestran el IAE integrado hasta el instante reproducido.

El dashboard incluye niveles, porcentaje, consignas, errores, alimentación/descarga reales, órdenes y estados de bombas. Seis gráficas Canvas muestran nivel, caudales, órdenes, errores, IAE y banco completo, con tooltips y consulta por teclado. Las secciones educativas explican balances, signos, discretización, SIMC, escala y resultados experimentales por separado.

Escenarios: referencia con consignas escalonadas, balance físico con SIMC propio, perturbación de alimentación y equilibrio. El generador de perturbaciones permite instante, incremento de caudal y retorno. Los eventos se editan con controles, sin escribir JSON. El modo avanzado habilita condiciones iniciales, Kff y ganancias explícitas Kc/τi; SIMC las calcula automáticamente cuando está seleccionado.

Consulta [docs/GUIA_INTERFAZ.md](docs/GUIA_INTERFAZ.md) para todas las funciones y un guion de demostración al docente.

## Dos plantas y dos interpretaciones FF

| Configuración | Planta | Sintonía predeterminada |
|---|---|---|
| `configs/paper_identified.json` | Integrador k′=−0.001018 del artículo; almacenamiento equivalente | PI final experimental de Tabla 2 |
| `configs/physical_simc.json` | Balance geométrico; área 900 cm² | SIMC recalculado para la ganancia física |

La ganancia física difiere aproximadamente por un factor de 18.19 de la identificada. No se superponen las dos dinámicas ni se llaman litros geométricos al inventario equivalente. Cambiar de planta desde la interfaz selecciona la sintonía recomendada correspondiente. Las ganancias explícitas sobre planta física permanecen posibles en avanzado, con advertencia de escala y sin garantía de estabilidad.

FF literal: Ecs. (7)-(8), diferencia entre muestras. FF acumulado: **Variante experimental de implementación propia**. La comparación no fuerza que gane feedforward: el ejemplo identificado literal empeora algo el IAE en C2 y C3. Los resultados simulados no se ajustaron para coincidir con el artículo.

## Ejecutar Python e intercambiar con HTML

El núcleo de consola funciona con Python 3.10+ y no requiere dependencias externas; la API y el paquete entregable requieren **Python 3.11+**, por la versión verificada de FastAPI. Todo se probó con Python 3.12.10.

```powershell
python -m flotation configs/paper_identified.json --output tmp/resultados_python.json --strategy compare
```

Importa ese archivo en la sección **Escenarios y resultados portátiles** de la web. Se muestran las dos estrategias y su origen declarado Python. El recorrido inverso es **↓ Escenario** en la web, ejecutar Python con el archivo descargado e importar el resultado. No se edita manualmente el contenido JSON.

Para una estrategia:

```powershell
python -m flotation configs/paper_identified.json --output tmp/resultado_python.json --strategy feedback_feedforward --exchange
node scripts/simulate.mjs configs/paper_identified.json tmp/resultado_js.json feedback_feedforward
```

La salida Python individual sin `--exchange` conserva el formato de fase 1. La web admite escenarios, resultados individuales y sobres con ambas estrategias. Valida versión, esquema, unidades y consistencia de series. Un resultado importado se etiqueta **archivo (declarado)**; no se certifica autoría sólo por metadatos.

**API Python local real:** FastAPI/Uvicorn llama directamente al mismo núcleo, sin duplicar ecuaciones. GET /health informa versiones y capacidades; POST /simulate devuelve el contrato 1.0.0 y metadatos Python en cabeceras HTTP. Nunca se muestra conectado sin respuesta real compatible ni se sustituyen silenciosamente sus resultados por JS. La conexión local está probada en Chrome y Edge; HTTPS de Vercel→Python sigue NOT TESTED hasta disponer de URL pública. La alternativa por archivos sigue funcionando. Ver [docs/API_PYTHON.md](docs/API_PYTHON.md).

## Paquete autónomo para el docente

Entrega: **[entrega/Python_Flotacion.zip](entrega/Python_Flotacion.zip)**. Incluye 16 archivos, escenarios, esquema y una copia exacta del núcleo Python verificado. No contiene `.venv`, cachés, Node, secretos ni rutas específicas de esta computadora.

1. Descomprimir el ZIP.
2. Abrir `INICIAR_PYTHON.bat` dentro de la carpeta descomprimida y mantener su ventana abierta.
3. En la web, pulsar **Conectar Python**, seleccionar **Python local** y **Aplicar y calcular**.

El BAT localiza su carpeta, busca Python compatible, crea un entorno local e instala versiones bloqueadas sólo si faltan. Fue probado también en primer inicio sin `.venv`. La API escucha exclusivamente en `127.0.0.1`, puerto 8765 por defecto. Ctrl+C detiene el servicio. Para un puerto alternativo: `.venv\Scripts\python.exe servidor.py --port 8766`, cambiando la dirección del cliente web a ese puerto.

El paquete se copió fuera del proyecto a dos carpetas temporales independientes. Se comprobaron entorno nuevo, dependencias, BAT, /health, /simulate y consola; API y CLI coinciden en todas las muestras. La guía del docente está en `LEEME.txt` dentro del ZIP y en [docs/GUIA_CONEXION_PYTHON.md](docs/GUIA_CONEXION_PYTHON.md).

Configuración de orígenes: `configuracion_servidor.json`. Inicialmente sólo se permiten `http://127.0.0.1:8000` y `http://localhost:8000`. `url_web` queda en null hasta obtener el origen HTTPS exacto de Vercel. No hay comodines ni cookies. No se expone la API mediante túneles.

Para desarrollo desde el proyecto:

```powershell
python -m venv .venv-api
.venv-api\Scripts\python.exe -m pip install -r requirements-api.txt
.venv-api\Scripts\python.exe servidor.py
```

En otra terminal sirve el HTML por el puerto 8000 con el comando de inicio. Conecta la web a `http://127.0.0.1:8765`. Mientras hay conexión se verifica salud cada 10 s; si falla, se conserva la procedencia de los datos y debes elegir Navegador expresamente para calcular sin Python.

## Arquitectura

```text
index.html + web/style.css
  web/main.js → web/app.js             Formularios, eventos, procedencia y acciones
    web/browser-engine.js → worker.js → core.js    Cálculo JS fuera del hilo visual
    web/python-client.js              Protocolo HTTP local; sin fallback automático
    web/validation.js                 Esquemas y validación de intercambios
    web/session.js                    Reproducción y prefijos de IAE
    web/charts.js                     Canvas, muestras y decimación visual
    web/scenarios.js + education.js    Escenarios y explicaciones
flotation/core.py                     Motor numérico Python equivalente
flotation/__main__.py                 CLI, comparación y sobre de intercambio
flotation/api.py + api_settings.py    Adaptador FastAPI, validación y configuración local
servidor.py                           Uvicorn, escucha fija 127.0.0.1
scripts/build_python_package.py       Preparación y ZIP con evidencia independiente
```

El Worker calcula la trayectoria al aplicar el escenario. El reloj revela muestras calculadas con el núcleo, no curvas prefabricadas. La reducción de puntos de Canvas no modifica series ni IAE. La interfaz limita experimentos a 7200 s e importaciones a 40 MB; el núcleo mantiene el límite original de 86400 s.

El contrato de configuración/resultado sigue en `schemas/simulation-v1.schema.json`, versión 1.0.0. El sobre auxiliar de transporte se documenta en API_PYTHON.md. Los JSON son comunicación entre los tres entregables académicos, no un entregable independiente.

## Pruebas y construcción

Node 24+ para las herramientas de desarrollo. Dependencias npm **sólo de desarrollo**: happy-dom para interacciones y Playwright CLI para navegador. La web publicada no descarga estas bibliotecas.

```powershell
python -m venv .venv-api
.venv-api\Scripts\python.exe -m pip install -r requirements-dev.txt
npm.cmd ci
.venv-api\Scripts\python.exe -m unittest discover -s tests -v
npm.cmd test
npm.cmd run build
```

`requirements-dev.txt` incluye la API y su validador JSON. El núcleo matemático sigue sin dependencias de ejecución. En PowerShell usa `npm.cmd` si la política bloquea `npm.ps1`.

Resultado final: **33 pruebas Python + 47 JavaScript aprobadas**, incluidas todas las anteriores y las 12 ejecuciones de paridad completas. Las nuevas pruebas Python usan Uvicorn real y sockets HTTP, no mocks. Además: 25 comprobaciones anteriores en Chrome, 22 de API real en Chrome, 22 en Edge, 3 del respaldo por archivos y 3 de desconexión real: **75 comprobaciones de navegador aprobadas**. Detalles en [docs/VALIDACION_FASE3.md](docs/VALIDACION_FASE3.md).

Para repetir el flujo de navegador con el servidor local activo:

```powershell
npx.cmd --no-install playwright-cli open http://127.0.0.1:8000 --browser chrome
npm.cmd run test:browser
npx.cmd --no-install playwright-cli close
```

Genera capturas en `output/playwright/`. Se debe tener Chrome disponible. Ese flujo conserva las pruebas de interfaz de fase 2. Para el flujo nuevo, con la API real iniciada en otra terminal, usa `npm.cmd run test:browser:python`. No intercepta respuestas ni usa rutas simuladas. La prueba de desconexión requiere detener el proceso de pruebas propio; no hay endpoint remoto para apagar la API.

## Preparado para Vercel

`vercel.json` define `framework: null`, construcción `node scripts/build-static.mjs` y salida `dist`. El script copia 22 archivos públicos mediante lista explícita; no publica `tmp`, dependencias, tests ni el núcleo Python como backend. La auditoría pública conserva evidencia y hash, omitiendo la ruta específica del PDF en esta computadora. El ZIP Python es un entregable separado, no un backend desplegado en Vercel.

1. Ejecuta las pruebas y `npm.cmd run build`.
2. Importa el proyecto en Vercel, con la raíz actual y configuración **Other**; conserva las opciones de `vercel.json`.
3. Obtén la URL HTTPS real, añádela como origen exacto en la configuración del paquete, reinicia el servidor y ejecuta la prueba pública de /health, /simulate y gráficas. Después actualiza el paquete entregable y el informe de validación.

No hay claves, Docker, base de datos ni backend remoto obligatorio. Vercel admite sitios estáticos; la configuración de construcción/salida se documenta en su [guía oficial](https://vercel.com/docs/builds/configure-a-build). La implementación es HTML/CSS/JS sin framework de producción. **No hay todavía una URL pública.**

## Documentación y límites

- [Auditoría](docs/AUDITORIA_ARTICULO.md): PDF completo, ecuaciones, figuras, parámetros, IAE e inconsistencias.
- [Modelo matemático](docs/MODELO_MATEMATICO.md): balances, signos, retardos, SIMC, límites y unidades.
- [Validación original](docs/VALIDACION.md), [fase 2](docs/VALIDACION_FASE2.md) y [fase 3](docs/VALIDACION_FASE3.md).
- [Guía de interfaz](docs/GUIA_INTERFAZ.md), [guía de conexión](docs/GUIA_CONEXION_PYTHON.md) y [contrato Python](docs/API_PYTHON.md).

No se modelan espuma detallada, recuperación mineral, sólidos, sensores filtrados, cuantización PLC ni tanque T-1 finito. Faltan datos originales para resolver la escala de k′, los iniciales SIMC de C3 y la implementación exacta FF del experimento. La prueba visual móvil usa emulación Chrome; Safari/Firefox y dispositivos físicos siguen NOT TESTED. API Python local real: PASS. HTTPS de Vercel→loopback: NOT TESTED. No se desactivan protecciones del navegador ni se usan túneles públicos.

El trabajo está guardado localmente sin commits ni staging. Próxima tarea: publicar en Vercel y validar el acceso HTTPS al servicio local; después preparar el informe final con resultados, capturas y URL comprobados.
