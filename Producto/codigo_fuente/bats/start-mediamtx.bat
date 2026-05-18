@echo off
setlocal EnableDelayedExpansion
REM =========================================================
REM  Camaras-IA - MediaMTX Launcher (Dynamic Service Discovery)
REM =========================================================

REM --- RUTAS PORTABLES (Ajustadas a la ubicación de este .bat) ---
REM Si mediamtx y cloudflared están en la misma carpeta que este script, usa %~dp0
REM Si están en descargas, dejamos una ruta por defecto pero fácil de cambiar de forma relativa.
set MEDIAMTX_HOME=%~dp0mediamtx_v1.18.1_windows_amd64
if not exist "%MEDIAMTX_HOME%\mediamtx.exe" (
    REM Fallback por si mantienes la carpeta en Descargas de tu usuario actual
    set MEDIAMTX_HOME=C:\Users\%USERNAME%\Downloads\mediamtx_v1.18.1_windows_amd64
)

set RENDER_PS=%~dp0_render-mediamtx-yml.ps1
set DISCOVER_PY=%~dp0discover_camera_ips.py
set UPDATE_TUNNEL_PY=%~dp0update_tunnel_url.py
set YML_TEMPLATE=%~dp0mediamtx.template.yml
set YML_RUNTIME=%MEDIAMTX_HOME%\mediamtx.runtime.yml
set DISCOVERED_JSON=%TEMP%\camaras_ips_descubiertas.json
set TUNNEL_LOG=%TEMP%\cloudflare_tunnel.log

REM Buscamos Python en las rutas comunes de instalación del sistema para que sea portable
set PY=python.exe
where %PY% >nul 2>nul
if errorlevel 1 (
    REM Fallback a tu ruta fija por si no está en el PATH del sistema
    set PY=C:\Users\%USERNAME%\AppData\Local\Programs\Python\Python310\python.exe
)

REM ---- 1. Descubrir IPs y escribir JSON ----
echo.
echo [1/5] Descubriendo IPs de las camaras (ARP + DB)...
"%PY%" "%DISCOVER_PY%" --out "%DISCOVERED_JSON%"
if errorlevel 1 (
    echo [ERROR] discover_camera_ips.py fallo
    pause
    exit /b 1
)

REM ---- 2. Renderizar yml runtime ----
echo.
echo [2/5] Renderizando mediamtx.runtime.yml...
powershell -NoProfile -ExecutionPolicy Bypass -File "%RENDER_PS%" ^
    -Template "%YML_TEMPLATE%" ^
    -Runtime "%YML_RUNTIME%" ^
    -DiscoveredJson "%DISCOVERED_JSON%"
if errorlevel 1 (
    echo [ERROR] Fallo el renderizado del yml
    pause
    exit /b 1
)

REM ---- 3. Lanzar Tunel de Cloudflare (TryCloudflare con Log) ----
echo.
echo [3/5] Levantando puente de video ultra-estable de Cloudflare...

REM 3.1 Matar cualquier cloudflared.exe vivo de sesiones previas.
REM     Sin esto, el log queda lockeado y el nuevo tunel nunca escribe
REM     su URL. taskkill /F mata sin preguntar; 2>nul oculta el mensaje
REM     "no se encontro proceso" cuando es la primera corrida del dia.
echo Cerrando instancias previas de cloudflared.exe...
taskkill /F /IM cloudflared.exe >nul 2>&1
REM Damos 2s al SO para que libere los handles del log.
timeout /t 2 /nobreak >nul

REM 3.2 Borrar (o truncar) el log anterior con tolerancia a locks.
if exist "%TUNNEL_LOG%" (
    del /F /Q "%TUNNEL_LOG%" >nul 2>&1
    if exist "%TUNNEL_LOG%" (
        REM Si seguimos sin poder borrar (Windows raro), lo truncamos a vacio.
        type nul > "%TUNNEL_LOG%" 2>nul
    )
)

if not exist "%MEDIAMTX_HOME%\cloudflared.exe" (
    echo [WARN] No se encontro cloudflared.exe en %MEDIAMTX_HOME%. El video no sera accesible desde internet.
) else (
    REM 3.3 Iniciamos el tunel minimizado, salida a archivo LOG.
    start "Cloudflare Tunnel - VMS" /min cmd /c ""%MEDIAMTX_HOME%\cloudflared.exe" tunnel --url http://localhost:8888 > "%TUNNEL_LOG%" 2>&1"

    REM 3.4 Esperamos hasta 15s. Antes eran 5, pero en redes lentas
    REM     (Duoc, datos moviles) cloudflared tarda mas en obtener la URL.
    REM     Si igual no alcanza, update_tunnel_url.py tiene su propio
    REM     polling de 20 intentos x 1s = +20s extra de tolerancia.
    echo Esperando hasta 15s a que Cloudflare asigne la URL publica...
    timeout /t 15 /nobreak >nul
)

REM ---- 4. Actualizar la URL del Túnel en la Base de Datos ----
echo.
echo [4/5] Reportando nueva URL dinamica a PostgreSQL en Oracle...
if exist "%MEDIAMTX_HOME%\cloudflared.exe" (
    if exist "%UPDATE_TUNNEL_PY%" (
        "%PY%" "%UPDATE_TUNNEL_PY%" --log "%TUNNEL_LOG%"
    ) else (
        echo [WARN] No se encontro el script %UPDATE_TUNNEL_PY% para actualizar la BD.
    )
)

REM ---- 5. Arrancar MediaMTX ----
echo.
echo [5/5] Arrancando MediaMTX...
echo === Camaras-IA - MediaMTX ===
echo Runtime:    %YML_RUNTIME%
echo Ctrl+C en esta ventana para parar todos los servicios.
echo.

if not exist "%MEDIAMTX_HOME%\mediamtx.exe" (
    echo [ERROR] No se encontro mediamtx.exe en %MEDIAMTX_HOME%
    pause
    exit /b 1
)

cd /d %MEDIAMTX_HOME%
mediamtx.exe mediamtx.runtime.yml