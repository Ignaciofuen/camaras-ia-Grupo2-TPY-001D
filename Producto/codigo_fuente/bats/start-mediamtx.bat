@echo off
setlocal EnableDelayedExpansion
REM =========================================================
REM  Camaras-IA - MediaMTX Launcher (auto-discovery via DB)
REM
REM  Flujo:
REM    1. discover_camera_ips.py descubre las IPs por ARP,
REM       las actualiza en la tabla `camaras` y escribe un JSON
REM       con las URLs RTSP completas.
REM    2. _render-mediamtx-yml.ps1 lee ese JSON y reemplaza los
REM       placeholders del mediamtx.yml -> mediamtx.runtime.yml.
REM    3. Arranca mediamtx.exe con el yml resuelto.
REM
REM  Requisitos:
REM    - Postgres corriendo (CAMARAS_DB_* en .env)
REM    - Tabla `camaras` poblada con MAC + ip_respaldo + ruta_rtsp
REM      + mediamtx_path (corre la migration 003_mediamtx_path.sql)
REM
REM  Si una camara cambia de IP (corte de luz, DHCP nuevo), basta
REM  con reiniciar este .bat: la redescubre solita.
REM =========================================================

set MEDIAMTX_HOME=C:\Users\ignfu\Downloads\mediamtx_v1.18.1_windows_amd64
set RENDER_PS=%~dp0_render-mediamtx-yml.ps1
set DISCOVER_PY=%~dp0discover_camera_ips.py
REM El template AHORA esta versionado en el repo (bats/mediamtx.template.yml).
REM Asi cualquier tuneo de latencia/HLS queda en git, no en %MEDIAMTX_HOME%.
set YML_TEMPLATE=%~dp0mediamtx.template.yml
set YML_RUNTIME=%MEDIAMTX_HOME%\mediamtx.runtime.yml
set DISCOVERED_JSON=%TEMP%\camaras_ips_descubiertas.json
set PY=C:\Users\ignfu\AppData\Local\Programs\Python\Python310\python.exe

REM ---- 1. Descubrir IPs y escribir JSON ----
echo.
echo [1/3] Descubriendo IPs de las camaras (ARP + DB)...
"%PY%" "%DISCOVER_PY%" --out "%DISCOVERED_JSON%"
if errorlevel 1 (
    echo [ERROR] discover_camera_ips.py fallo
    pause
    exit /b 1
)

REM ---- 2. Renderizar yml runtime ----
echo.
echo [2/3] Renderizando mediamtx.runtime.yml...
powershell -NoProfile -ExecutionPolicy Bypass -File "%RENDER_PS%" ^
    -Template "%YML_TEMPLATE%" ^
    -Runtime "%YML_RUNTIME%" ^
    -DiscoveredJson "%DISCOVERED_JSON%"
if errorlevel 1 (
    echo [ERROR] Fallo el renderizado del yml
    pause
    exit /b 1
)

REM ---- 3. Arrancar MediaMTX ----
echo.
echo [3/3] Arrancando MediaMTX...
echo === Camaras-IA - MediaMTX ===
echo Runtime:    %YML_RUNTIME%
echo HLS:        http://localhost:8888/cam_principal/index.m3u8
echo HLS:        http://localhost:8888/cam_sonoff/index.m3u8
echo Ctrl+C para parar.
echo.

if not exist "%MEDIAMTX_HOME%\mediamtx.exe" (
    echo [ERROR] No se encontro mediamtx.exe en %MEDIAMTX_HOME%
    pause
    exit /b 1
)

cd /d %MEDIAMTX_HOME%
mediamtx.exe mediamtx.runtime.yml
