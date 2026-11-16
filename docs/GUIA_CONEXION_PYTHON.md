# Conectar FlotaLab con Python local

## Para el docente: tres pasos

1. **Descomprime `Python_Flotacion_v1.0.1.zip`.** Copia la carpeta a Documentos o a otra ubicación donde puedas guardar archivos. No ejecutes el programa desde dentro del ZIP.
2. **Abre `INICIAR_PYTHON.bat`.** La primera vez prepara un entorno local e instala dependencias desde PyPI; necesita internet durante esa instalación. Después comprueba las versiones y no reinstala si están completas. Deja la ventana abierta.
3. **Abre la web y pulsa “Conectar Python”.** Selecciona “Python local” y pulsa “Aplicar y calcular”. Después del cálculo, la cabecera debe mostrar **Python · API local**. No basta con ver el estado conectado.

Abre **https://flotacion-pi-methodsx.vercel.app**. Descarga el [ZIP definitivo](https://github.com/etc031099/Flotacion-PI-Articulo-MethodsX/releases/download/v1.0.1/Python_Flotacion_v1.0.1.zip). Su origen HTTPS exacto ya está autorizado y la conexión pública está verificada en Chrome y Edge con permiso de loopback. No necesitas el repositorio ni editar JSON para conectar.

Requisitos del paquete: Windows 10/11, Python **3.11 o posterior** (probado con 3.12), permisos de escritura y acceso a PyPI la primera vez. No necesita Node, Docker, credenciales ni el repositorio original. El núcleo matemático de consola no depende de FastAPI; el servidor sí usa las dependencias incluidas en `requirements.txt`.

## Comprobar el estado y cerrar

En una terminal, `py -3 --version` o `python --version` permite comprobar Python. Si falta, instálalo desde [python.org](https://www.python.org/downloads/windows/) activando **Add Python to PATH**.

Cuando Uvicorn muestre el servidor iniciado, <http://127.0.0.1:8765/health> debe devolver `status=ok`, `engine=python`, versiones 1.0.0 y capacidades. El servidor sólo escucha en **127.0.0.1**, no en internet ni en la red del aula. Detén el servicio con **Ctrl+C** en su ventana.

Si el puerto está ocupado, cierra otra ventana de FlotaLab. Como alternativa, desde la carpeta del paquete:

```powershell
.venv\Scripts\python.exe servidor.py --port 8766
```

En la web cambia entonces la dirección a `http://127.0.0.1:8766`. Cambiar el puerto del servicio no cambia el origen de la página web que debe autorizarse.

## Si no conecta

- **Servicio no iniciado:** deja la ventana abierta y comprueba /health. La web no marca conectado sólo porque exista una dirección escrita.
- **Permiso de red local denegado:** revisa el permiso de acceso local/loopback del sitio en el navegador. Si deseas conectar la web con este programa, puedes concederlo; también puedes optar por archivos. No desactives protecciones ni cambies flags.
- **Origen no autorizado / CORS:** usa https://flotacion-pi-methodsx.vercel.app. El ZIP definitivo ya autoriza ese origen exacto además de los dos orígenes de desarrollo locales. No necesitas editar archivos. Un dominio de preview diferente es otro origen y se rechaza.
- **HTTP 422:** revisa parámetros. La API admite hasta 7200 segundos, 128 eventos y los rangos de ingeniería documentados. No interpreta comandos ni rutas recibidas desde la página.
- **HTTP 429:** hay un cálculo activo. Espera a que termine y repite.
- **Pérdida de conexión:** se muestra un error al calcular o en el chequeo periódico de salud, cada 10 s mientras está conectado. Los resultados guardados conservan su origen. Elige **Navegador** expresamente para nuevos cálculos JavaScript.

## Alternativa completa mediante archivos

No hay que editar su contenido:

1. Configura un experimento en la web, aplica y pulsa **↓ Escenario**.
2. Copia el archivo descargado a la carpeta `Python_Flotacion`.
3. Abre una terminal en esa carpeta y ejecuta:

```powershell
.venv\Scripts\python.exe simulacion_flotacion.py flotalab_escenario.json --output resultados_python.json --strategy compare
```

4. En la web usa **Importar escenario o resultados** para seleccionar `resultados_python.json`. Aparecerá **Python · archivo (declarado)**; se verificarán sus muestras y se graficarán ambas estrategias.

Para ejecutar un ejemplo sin activar la API, incluso sin sus dependencias:

```powershell
py -3 simulacion_flotacion.py configs/paper_identified.json --output resultado.json --strategy compare
```

Los JSON son auxiliares de comunicación entre la web y Python; no constituyen un cuarto entregable académico.

## Instalación alternativa por terminal

Dentro del paquete:

```powershell
py -3 -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
.venv\Scripts\python.exe servidor.py
```

El iniciador BAT realiza estos pasos sólo cuando corresponde. No se distribuye el entorno virtual de la computadora de desarrollo.

## Configuración para el responsable del proyecto

`configuracion_servidor.json` contiene `puerto`, `origenes_permitidos` y `url_web`. No contiene secretos. Se admite una lista explícita alternativa mediante `FLOTALAB_ALLOWED_ORIGINS` (arreglo JSON) y un puerto con `FLOTALAB_PORT`. No hay parámetro para escuchar en `0.0.0.0`.

La respuesta de /simulate conserva el esquema numérico 1.0.0. La procedencia Python, versiones y un identificador de solicitud viajan en cabeceras HTTP expuestas por CORS; no se añaden campos arbitrarios al esquema científico. El navegador valida esas cabeceras en la API versionada y verifica la consistencia de las series antes de visualizarlas.

## Prueba local y prueba pública son distintas

La prueba **A: HTML local→Python local** verifica el servicio y CORS entre puertos. La prueba **B: HTTPS de Vercel→Python local** añade permisos y políticas del navegador; A no demuestra B. B pasó realmente en Chrome 157 y Edge 157 desde https://flotacion-pi-methodsx.vercel.app, con permiso de loopback explícito en el perfil automatizado. Consulta `VALIDACION_FASE4.md` en el repositorio para el alcance y las evidencias. El docente concede ese permiso en su navegador; políticas institucionales pueden impedirlo y el intercambio de archivos permanece disponible.

Fuentes oficiales consultadas el 16 de noviembre de 2026:

- [FastAPI: CORS](https://fastapi.tiangolo.com/tutorial/cors/): orígenes exactos, métodos, cabeceras y preflight OPTIONS. CORS no autentica programas locales; el servicio añade comprobación de Origin y Host y límites de carga.
- [Chrome: Local Network Access](https://developer.chrome.com/docs/modern-web-guidance/guides/security/local-network-access): permisos diferenciados de red local y loopback; las páginas loopback de desarrollo no demuestran el acceso desde un origen público. La conexión inicial parte de un botón, no de la carga de página.
- [MDN: Local network access](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Local_network_access): permisos, contexto seguro y restricciones de contenido mixto. El cliente detecta los permisos compatibles y conserva el flujo por archivos cuando no se puede conectar.
- [Microsoft Edge: adaptación a LNA](https://learn.microsoft.com/en-us/deployedge/ms-edge-local-network-access): permisos para destinos locales y necesidad de contemplar políticas y versiones. No se promete compatibilidad universal.

El cliente utiliza `targetAddressSpace: "loopback"` cuando `Request.prototype` soporta esa propiedad. Sólo consulta el permiso granular `loopback-network`; evita el alias antiguo. No se añaden cabeceras PNA obsoletas, no se crean túneles públicos ni se desactiva la seguridad.
