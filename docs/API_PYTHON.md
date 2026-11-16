# API Python local real · Fase 3

Estado: **servidor FastAPI/Uvicorn implementado y conexión local real comprobada en Chrome y Edge**. El adaptador llama directamente a `flotation.core.simulate`, sin otra implementación de ecuaciones. El intercambio de archivos también está probado. La conexión desde Vercel HTTPS sigue **NOT TESTED**, porque no existe todavía URL pública.

Para iniciar desde el paquete entregado, ejecutar `INICIAR_PYTHON.bat`. Para preparar el entorno de desarrollo: `python -m venv .venv-api`, instalar `requirements-api.txt` con ese intérprete y ejecutar `.venv-api/Scripts/python.exe servidor.py`. Escucha fija en `127.0.0.1:8765`; no admite `--host` ni activa reload o proxies. Consulta [GUIA_CONEXION_PYTHON.md](GUIA_CONEXION_PYTHON.md).

## Uso disponible hoy: archivos, sin editar JSON

1. En la web, configura el experimento, pulsa **Aplicar y calcular** y después **↓ Escenario**.
2. En una terminal abierta en el proyecto, ejecuta (ajusta sólo la ubicación del archivo descargado):

```powershell
python -m flotation flotalab_escenario.json --output tmp/resultados_python.json --strategy compare
```

3. En la web, usa **Importar escenario o resultados** para seleccionar `tmp/resultados_python.json`. Se muestran ambas estrategias, todas las curvas y su origen declarado Python. El archivo se verifica antes de usarlo. No necesitas modificar su contenido.

También puedes calcular una sola estrategia:

```powershell
python -m flotation configs/paper_identified.json --output tmp/resultado_python.json --strategy feedback_feedforward --exchange
```

Sin `--exchange`, una sola estrategia conserva el resultado directo 1.0.0 de la fase 1. Al importarlo se pide declarar el motor de origen en el selector de archivos. El origen de un archivo es **declarado**, no una firma de autoría: verificar la consistencia numérica no prueba qué programa creó el archivo.

## Protocolo HTTP implementado

Base predeterminada: `http://127.0.0.1:8765`. El cliente admite exclusivamente orígenes loopback `localhost`, `127.0.0.1` y `[::1]`, HTTP o HTTPS, sin rutas adicionales, credenciales ni parámetros en la URL. No inicia conexiones automáticamente.

### GET /health

La aplicación sólo marca conectado si recibe HTTP 2xx y un JSON compatible:

```json
{"status":"ok","engine":"python","schema_version":"1.0.0","api_version":"1.0.0","model_version":"1.0.0","capabilities":{"strategies":["feedback","feedback_feedforward"],"models":["physical","identified"],"dt_s":1,"max_duration_s":7200,"max_samples":7200,"max_events":128,"max_request_bytes":262144,"max_concurrent_simulations":1}}
```

Un HTTP 200 que diga `engine=javascript`, omita los campos de compatibilidad o use otra versión **no conecta**. El servicio versionado declara también la versión de API y modelo. Mientras está conectado, la interfaz comprueba /health cada 10 s y detecta fallos; el siguiente cálculo comprueba además /simulate. Si hay desconexión durante una petición, su respuesta tardía no puede activar una conexión cancelada. La primera solicitud sólo parte del botón Conectar Python; no hay conexión local automática al abrir la página.

### POST /simulate

Cabecera `Content-Type: application/json`. Cuerpo:

```text
{
  "schema_version": "1.0.0",
  "config": <escenario completo según simulation-v1.schema.json>,
  "strategy": "feedback" | "feedback_feedforward"
}
```

Respuesta HTTP 2xx: **resultado directo** del contrato `schemas/simulation-v1.schema.json`, con `kind=result`, `data_origin=simulated`, configuración completa y estrategia solicitada. No devolver un resumen ni otro sobre JSON en este endpoint. Para comparar, el cliente envía dos solicitudes con configuraciones idénticas; no inventa series para la estrategia que falte.

La procedencia se transporta sin alterar el esquema numérico: cabeceras `X-FlotaLab-Engine: python`, `X-FlotaLab-API-Version: 1.0.0`, `X-FlotaLab-Model-Version: 1.0.0` y `X-FlotaLab-Request-ID` (UUID por solicitud). CORS las expone al navegador. El cliente exige esos metadatos cuando /health anuncia la API versionada. No se envían ni requieren cookies; fetch usa `credentials: omit`.

El cliente valida esquema, unidades, configuración, estrategia y consistencia numérica mediante repetición determinista. La repetición sirve de **verificación**: los objetos visualizados son los recibidos de Python, no una sustitución silenciosa por resultados JavaScript. Si la primera estrategia responde y la segunda falla, no se publica una comparación parcial como si estuviera completa.

Tiempo de espera del cliente: 10 s por solicitud. Una respuesta HTTP de error, un JSON mal formado, muestras alteradas o un tiempo agotado producen un error visible y desmarcan conectado. No hay fallback automático de motor. La persona debe elegir **Navegador** para calcular con JavaScript. Los datos de un experimento anterior conservan su etiqueta de origen.

## Límites, errores y CORS

La API admite máximo 7200 segundos/muestras por resultado, 128 eventos, cuerpo de 256 KiB y resultado de 32 MiB. Permite un cálculo a la vez (429 si está ocupado). Conserva límites adicionales de ingeniería: caudal de bomba/entrada ≤10000 L/min, área de 1 a 1e6 cm², altura de .01 a 1000 cm, k′ entre −100 y −1e−9, Kc entre −1e5 y −1e−9 y τi entre .001 y 1e5 s. θ y τc cumplen el contrato existente y τc≤1e5 s. Estos límites son del servicio, no nuevos parámetros del paper; no cambian las ecuaciones del núcleo.

Errores: 400 JSON inválido/no finito/claves duplicadas o consulta no admitida; 403 Origin no permitido/conexión no loopback; 413 tamaño excesivo; 415 Content-Type incorrecto; 422 esquema, parámetros o resultado numérico no válido; 429 cálculo ocupado. Host desconocido se rechaza con 400. No hay endpoint para abrir archivos, ejecutar comandos, cambiar configuración ni apagar el proceso desde la web. Swagger/OpenAPI están deshabilitados.

Se verificaron **preflight OPTIONS y respuestas CORS reales**. Sólo se autorizan inicialmente `http://127.0.0.1:8000` y `http://localhost:8000`; las peticiones con otro Origin son rechazadas antes del cálculo. CORS usa métodos GET/POST y cabecera Content-Type explícitos, sin credenciales ni comodines. La validación de Host restringe nombres a localhost/127.0.0.1. Las solicitudes CLI sin Origin se admiten; CORS y Origin no autentican otros programas locales.

Configuración: `configuracion_servidor.json` junto a `servidor.py`; `url_web=null` hasta disponer del origen HTTPS real. También se admiten `FLOTALAB_ALLOWED_ORIGINS` (arreglo JSON de orígenes exactos) y `FLOTALAB_PORT`. No se permite HTTP público, comodines, credenciales ni rutas en los orígenes. Reiniciar el servidor aplica los cambios.

## HTTPS y red local: prueba pública pendiente

CORS no garantiza por sí solo acceso desde un origen HTTPS público. Los navegadores también aplican controles de contexto seguro, contenido mixto y permisos de acceso local/loopback. El cliente consulta las capacidades de permisos disponibles (`loopback-network`, y alias anterior cuando procede); si no están soportadas no supone que el permiso esté concedido. Los destinos son loopback literales. No se añaden túneles ni mecanismos para desactivar la seguridad.

La documentación oficial de [Chrome sobre Local Network Access](https://developer.chrome.com/docs/modern-web-guidance/guides/security/local-network-access), [MDN](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Local_network_access) y [Microsoft Edge](https://learn.microsoft.com/en-us/deployedge/ms-edge-local-network-access) describe restricciones que dependen de versión, contexto y política. Se consultó el 16 de noviembre de 2026. La prueba local es PASS con Python real; Vercel HTTPS→Python es **NOT TESTED**. Después del despliegue se registrarán dominio real, navegador/versión, permiso concedido, preflight, /health, /simulate y series visualizadas.

Si el navegador rechaza la conexión, el intercambio de archivos anterior sigue disponible. No depende de CORS, certificados, apertura de puertos ni permisos de red local.

## Sobre de intercambio de archivos

El escenario y cada resultado conservan exactamente la versión 1.0.0 de la fase 1. Para transportar procedencia declarada y las dos estrategias juntas se usa un sobre externo:

```text
{
  "kind": "simulation_exchange",
  "exchange_version": "1.0.0",
  "engine": "python" | "javascript",
  "results": [<resultado directo>, <segundo resultado opcional>]
}
```

Cada resultado se valida con el esquema existente y con `verifyResult`. El sobre exige uno o dos resultados, estrategias no duplicadas y escenarios exactamente iguales. La web exporta este formato; Python lo emite con `--exchange` o `--strategy compare`. Los campos del sobre son auxiliares de comunicación, no un cuarto entregable académico.
