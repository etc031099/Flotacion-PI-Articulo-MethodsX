@echo off
setlocal
title FlotaLab - Motor Python local
cd /d "%~dp0"
echo.
echo FlotaLab - Motor matematico de flotacion
echo Se utilizara un entorno virtual dentro de esta carpeta.
echo.

if exist ".venv\Scripts\python.exe" goto verificar_version

py -3 -c "import sys; sys.exit(0 if sys.version_info >= (3,11) else 1)" >nul 2>&1
if not errorlevel 1 (
  py -3 -m venv ".venv"
  goto comprobar_entorno
)
python -c "import sys; sys.exit(0 if sys.version_info >= (3,11) else 1)" >nul 2>&1
if not errorlevel 1 (
  python -m venv ".venv"
  goto comprobar_entorno
)
echo No se encontro Python 3.11 o posterior.
echo Instale Python desde https://www.python.org/downloads/windows/
echo Active la opcion Add Python to PATH y vuelva a abrir este archivo.
goto error

:comprobar_entorno
if not exist ".venv\Scripts\python.exe" (
  echo No se pudo crear el entorno. Descomprima el paquete en una carpeta con permisos de escritura.
  goto error
)

:verificar_version
".venv\Scripts\python.exe" -c "import sys; sys.exit(0 if sys.version_info >= (3,11) else 1)"
if errorlevel 1 (
  echo El entorno existente requiere Python 3.11 o posterior.
  echo Renombre la carpeta .venv y vuelva a iniciar con una version compatible.
  goto error
)

".venv\Scripts\python.exe" comprobar_dependencias.py
if errorlevel 1 (
  echo Instalando dependencias desde PyPI. La primera vez se necesita internet.
  ".venv\Scripts\python.exe" -m pip --isolated install --index-url https://pypi.org/simple --requirement requirements.txt
  if errorlevel 1 goto error
  ".venv\Scripts\python.exe" comprobar_dependencias.py
  if errorlevel 1 goto error
)
echo.
echo Abra la simulacion web y pulse Conectar Python.
echo La API escuchara solamente en 127.0.0.1, puerto 8765 salvo configuracion local.
echo Mantenga esta ventana abierta. Ctrl+C detiene el servicio.
echo.
".venv\Scripts\python.exe" servidor.py
if errorlevel 1 goto error
echo.
echo El servidor se ha detenido.
pause
exit /b 0

:error
echo.
echo No se pudo iniciar FlotaLab. Conserve el mensaje anterior para revisar el problema.
echo Consulte LEEME.txt para instrucciones alternativas.
pause
exit /b 1
