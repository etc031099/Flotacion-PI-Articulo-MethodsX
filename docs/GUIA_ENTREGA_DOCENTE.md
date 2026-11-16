# Entrega al docente

Web: **https://flotacion-pi-methodsx.vercel.app**.

Paquete: [Python_Flotacion_v1.0.1.zip](https://github.com/etc031099/Flotacion-PI-Articulo-MethodsX/releases/download/v1.0.1/Python_Flotacion_v1.0.1.zip). Copia local: `entrega/Python_Flotacion_v1.0.1.zip`. Código fuente: https://github.com/etc031099/Flotacion-PI-Articulo-MethodsX.

## Conectar en tres pasos

1. Descargue y descomprima el ZIP en una carpeta normal de Windows. Necesita Python 3.11 o posterior instalado; se probó con Python 3.12.10. No ejecute desde dentro del ZIP.
2. Haga doble clic en `INICIAR_PYTHON.bat`. La primera vez crea su entorno e instala las versiones fijadas desde PyPI; necesita internet. Deje abierta la ventana cuando indique `http://127.0.0.1:8765`. No necesita Node, el repositorio, credenciales ni editar código o JSON.
3. Abra la web de Vercel, vaya a **Python local** y pulse **Conectar Python**. Si aparece un permiso de loopback o red local, permita el acceso para este sitio: se comunica con el programa que acaba de iniciar en su propia computadora. Seleccione el motor **Python local · API** y pulse **Aplicar y calcular**. Compruebe **Python · API local** en la cabecera.

Si no tiene Python, instálelo desde [python.org](https://www.python.org/downloads/windows/) con la opción Add Python to PATH. La ejecución del BAT muestra los errores; no cierre su ventana para seguir calculando. Ctrl+C detiene el servicio.

Si el permiso se denegó, abra los permisos del sitio en Chrome o Edge, permita loopback/red local para esta dirección y vuelva a conectar. No cambie flags ni desactive la seguridad. Las políticas de una computadora institucional pueden impedir la conexión; el modo Navegador y los archivos siguen disponibles.

## Demostración de cinco minutos

1. Abra la web con motor Navegador y referencia del artículo. Pulse Iniciar, Pausar, Continuar y Ver resultado final. Las tres celdas tienen descargas y retardos propios.
2. Compare feedback y feedback + feedforward bajo el mismo escenario; observe las seis gráficas y el IAE hasta T=900 s. FF no mejora siempre: C2 y C3 empeoran ligeramente en este modelo literal.
3. Active Python mediante los pasos anteriores, cambie alimentación a 50 L/min y consigna inicial C1 a 31 cm; aplique. La cabecera identifica el cálculo real Python. El escenario modificado produce IAE PI `[106.0299972924,83.2268886127,98.3132531741]` cm·s y PI+FF `[106.0273533009,83.2289072053,100.2185974427]` cm·s.
4. Exporte el escenario y resultados si desea conservarlos. Seleccione Navegador explícitamente para continuar sin la API. Los datos ya calculados conservan su procedencia al desconectar.
5. Explique la diferencia entre planta identificada y balance geométrico, el signo negativo de Kc y los valores SIMC iniciales frente a los finales experimentales. Las explicaciones están en la propia web.

## Alternativa por archivos

Exporte **↓ Escenario** y copie el archivo a la carpeta descomprimida. Desde una terminal allí:

```powershell
py -3 simulacion_flotacion.py flotalab_escenario.json --output resultados_python.json --strategy compare
```

Importe `resultados_python.json` desde la web. Se validan y grafican las series como **Python · archivo (declarado)**. No hay que editar el JSON. Este modo no requiere permitir conexiones de red local.

## Alcance académico

Todos los resultados propios son simulados. No son datos experimentales ni una reproducción exacta de Figura 14. Los parámetros finales del artículo, SIMC inicial, diferencias de escala, supuestos y limitaciones están documentados en `AUDITORIA_ARTICULO.md` y `MODELO_MATEMATICO.md`.

Chrome y Edge 157 se probaron realmente en esta computadora; los perfiles automatizados recibieron permiso de loopback específico mediante CDP, sin flags inseguros ni túneles. No se afirma haber probado otra computadora física, Safari, Firefox ni el clic humano en el diálogo del navegador. El informe académico Word corresponde a la fase 5.

## Manual definitivo de fase 6

Consulte [la gu?a completa y sus nueve experimentos](GUIA_COMPLETA_DOCENTE.md) o [el manual HTML](GUIA_COMPLETA_DOCENTE.html). La distribuci?n v1.0.1 a?ade estos documentos; el modelo sigue intacto y el release v1.0.0 se conserva.
