# Validación de la guía definitiva del docente — fase 6

Fecha: 16 de noviembre de 2026. Distribución v1.0.1; modelo/API/esquema 1.0.0. Esta fase añade documentación, empaquetado versionado y enlaces, sin modificar núcleos matemáticos ni dependencias del programa.

## Experimentos comprobados

Se ejecutaron **nueve experimentos** en la interfaz pública, sin interceptar respuestas. Los experimentos 1–6 y 9 produjeron once exportaciones de configuración/resultados; el 7 añadió una exportación JavaScript y otra Python. Se contrastaron **13 exportaciones y 26 resultados de estrategia**, incluyendo todas sus series, con el núcleo Python. El experimento 8 fue una prueba de disponibilidad y recuperación, no una nueva configuración matemática.

| Experimento | Evidencia y conclusión |
|---|---|
| 1. Equilibrio | IAE cero; reproducción, pausa, continuar, avance y reinicio verificados |
| 2. Consigna | C1=29.5 en 60 s; respuesta PI y acoplamiento; captura real |
| 3. Alimentación | 45→55 en 120 s y retorno 45 en 420 s; generador real de eventos |
| 4. FB/FF | Referencia 900 s, literal y acumulado; el literal empeora C2/C3 |
| 5. SIMC | Planta física, SIMC y dos ediciones explícitas; agresividad aumenta IAE aguas abajo |
| 6. Dos modelos | SIMC recalculado, mismo escalón; niveles casi idénticos por compensación de ganancia |
| 7. Python–HTML | Vercel→127.0.0.1:8766; GET health, seis POST reales durante cambios y restauración; exportación de ambos motores |
| 8. Desconexión | Terminación real del proceso propio; heartbeat detecta caída; procedencia conservada; cálculo JS explícito; reinicio y dos POST 200 de recuperación; botón Desconectar comprobado |
| 9. Límites | Planta física, 120 L/min en t=30 y 45 en t=150, T=300; órdenes ≤90 y niveles ≤45; rebose contabilizado |

Las métricas completas y hashes están en [guia_docente/metricas_experimentos.json](guia_docente/metricas_experimentos.json). La diferencia máxima del experimento 7 es **2.2737367544323206×10⁻¹³**, dentro de tolerancia absoluta 10⁻⁹ más relativa 10⁻¹¹. En el experimento 6 la diferencia máxima de niveles es **1.2079226507921703×10⁻¹³ cm**. No se ajustaron resultados para favorecer FF ni se atribuyeron al artículo las curvas propias.

## Pruebas y comandos

- `npm.cmd test`: **48/48 PASS**, incluido build público de 27 archivos después de añadir la guía.
- `.venv-api/Scripts/python.exe -m unittest discover -s tests -v`: **34/34 PASS**.
- `scripts/validate_guide_experiments.py`: **13 archivos / 26 estrategias PASS**; analiza exportaciones reales guardadas en output/fase6.
- `scripts/validate_python_package.py --package entrega/Python_Flotacion_v1.0.1 --evidence output/fase6/paquete_autonomo.json`: **6/6 PASS** en carpeta temporal externa, entorno nuevo y dependencias fijadas instaladas desde PyPI.
- Paquete externo: BAT real inicia API; dos POST reales; consola matemática devuelve exactamente el mismo objeto que la API. Importaciones e intérprete resuelven dentro de la carpeta independiente.
- `scripts/audit_teacher_guide.py`: comprueba documentos, imágenes, índice, versiones, hashes del ZIP y descarga pública, y preservación de núcleos, ZIP anterior e informe.
- `tests/browser-guide-document.js`: nueve experimentos presentes, tres imágenes cargadas, índice válido y ausencia de desbordamiento a 1440 y 390 px.
- `scripts/audit_teacher_guide.py`: **52/52 comprobaciones PASS**.
- Sitio público después del despliegue: `tests/browser-guide-public.js`, **21/21 PASS**, sin errores JavaScript ni fallos de recursos durante la carga. El enlace visible descarga el ZIP v1.0.1 con el SHA256 esperado.
- Manual público: HTTP 200, nueve experimentos, tres capturas cargadas, índice y diseño a 1440/390 px comprobados en la URL estable de Vercel.
- Intercambio final por archivos: escenario descargado → consola autónoma → importación web → nueva exportación. Los resultados completos coinciden exactamente con los resultados de API del experimento 7. `tests/browser-guide-import.js` verifica la procedencia **Python · archivo (declarado)**.
- `tests/browser-guide-experiments.js`, `browser-guide-python.js`, `browser-guide-recovery.js` y `browser-guide-public.js`: recorridos mediante Playwright CLI; la herramienta se utiliza en desarrollo, no es requisito del docente.

Los scripts de experimentos requieren una web abierta y disponible; el de Python usa el servidor propio en 8766 y concede permiso loopback únicamente en el perfil aislado de prueba. Para reproducir como docente se solicita el permiso normal del navegador; no se deshabilitan protecciones.

## Paquete y publicación

Distribución: **Python_Flotacion_v1.0.1.zip**, 22 archivos, 857586 bytes.

SHA256: `36eaafd9ffece4d7a9ec6c2d5b23e6bd2e3518c79302d8cab0e8797fccbd96fa`.

[Release v1.0.1](https://github.com/etc031099/Flotacion-PI-Articulo-MethodsX/releases/tag/v1.0.1), [descarga pública](https://github.com/etc031099/Flotacion-PI-Articulo-MethodsX/releases/download/v1.0.1/Python_Flotacion_v1.0.1.zip). Se descargó anónimamente y se confirmó el hash **antes** de editar los enlaces del sitio, README y guías de conexión/entrega.

El release v1.0.0 no se sustituyó. Su ZIP conserva SHA256 `c68a64c529d9fb9f92afb5abf036da091efdff3d2b25553e25806cb83a1447aa`. Los manuales e imágenes están dentro del nuevo ZIP; no se requiere el repositorio para usar Python. No se incluyeron entornos virtuales, Node, credenciales ni datos experimentales inventados. El constructor impide regenerar la distribución histórica si su ZIP ya existe.

## Problemas detectados y medidas

1. Puerto 8765 ocupado: no se detuvo el proceso existente. Las pruebas propias usaron 8766 y documentan cómo cambiarlo en BAT y web.
2. SIMC recalculado produce niveles casi idénticos entre modelos en el caso 6: se documentó la compensación k′Kc; no se prometen curvas diferentes para ese caso.
3. Mayor agresividad empeora el IAE del caso 5: se informa el resultado, sin cambiar ecuaciones.
4. Chrome CLI restringe file://: el HTML sin scripts/fetch se revisó mediante un servidor limitado al manual y sus capturas. La apertura humana por doble clic no se observó; las rutas locales y el contenido del ZIP sí se comprobaron.
5. La revisión automática rechazó servir todo el repositorio; se usó una carpeta dedicada con solo manual HTML y tres capturas. No quedó trabajo bloqueado por esa restricción.
6. La raíz del servidor de prueba devuelve 404 por favicon ausente; no afecta manual ni API. El manual carga las tres imágenes completas y sus enlaces internos funcionan.
7. GitHub rechazó el identificador abreviado del commit al crear el release; se publicó correctamente con el identificador completo.
8. Este Windows tiene `python` 3.12.10 pero no el lanzador `py`: se comprobó la alternativa `python simulacion_flotacion.py flotalab_escenario.json --output resultados_python.json --strategy compare` en la carpeta independiente. En equipos sin `py`, sustituya `py -3` por `python` después de comprobar la versión, como alternativa a instalar el lanzador. El BAT ya detecta ambas opciones.

## Despliegue final comprobado

Vercel **Ready**, despliegue `dpl_EXBb2fSa9r6hoUNziEFTnWNecXGf`, alias estable **https://flotacion-pi-methodsx.vercel.app**. El build contiene 27 archivos públicos; no publica Python, configuración del servidor, entornos ni secretos. Manual: **https://flotacion-pi-methodsx.vercel.app/docs/GUIA_COMPLETA_DOCENTE.html**. La descarga desde el enlace de la interfaz vuelve a producir el SHA256 registrado.

## Navegadores, límites y alcance

Experimentos nuevos y revisión del manual: **Chrome 157.0.8103.51**, Windows, Python **3.12.10**. La fase 4 registra conexión pública en Chrome y Edge; no se atribuye esa ejecución anterior a las pruebas nuevas. Firefox, Safari y otro equipo físico no fueron comprobados. El clic humano de aceptación del permiso local no se observó en esta fase: se concedió el permiso en el perfil aislado mediante CDP, manteniendo origen, red y respuestas reales.

Los tiempos de reproducción son T/velocidad (600/20=30 s, 900/20=45 s); no se cronometró una lectura o interacción humana completa. El primer arranque depende de internet/PyPI. La consistencia entre motores no valida experimentalmente el banco físico. Las curvas generadas son simuladas; el artículo y sus IAE experimentales se distinguen de ellas.

## Entregables

- LEEME_PRIMERO.txt en raíz y ZIP.
- docs/GUIA_COMPLETA_DOCENTE.md y .html; copias en raíz del ZIP.
- Tres capturas en docs/guia_docente y en guia_docente dentro del ZIP.
- Métricas de experimentos, scripts de validación y este registro.
- entrega/Python_Flotacion_v1.0.1.zip y release público independiente.
- Se conservan el informe Word/PDF y los archivos previos de fase 5.
