@echo off
setlocal EnableDelayedExpansion
REM Version DEBUG: imprime las env vars antes de lanzar MediaMTX

set MEDIAMTX_HOME=C:\Users\ignfu\Downloads\mediamtx_v1.18.1_windows_amd64
set ENV_FILE=%~dp0..\.env

if not exist "%ENV_FILE%" (
    echo [ERROR] No se encontro .env en %ENV_FILE%
    pause
    exit /b 1
)

for /f "usebackq tokens=1,* delims==" %%a in ("%ENV_FILE%") do (
    set "_key=%%a"
    set "_val=%%b"
    if not "!_key!"=="" if not "!_key:~0,1!"=="#" (
        set "!_key!=!_val!"
    )
)

set "MTX_PATHS_CAM_PRINCIPAL_SOURCE=rtsp://admin:%CAMARA_PRINCIPAL_PASS%@192.168.1.2:554/live/ch0"
set "MTX_PATHS_CAM_SONOFF_SOURCE=rtsp://rtsp:%CAMARA_SONOFF_PASS%@192.168.1.14:554/av_stream/ch0"

echo.
echo ============== DEBUG: env vars que recibira MediaMTX ==============
echo CAMARA_PRINCIPAL_PASS=[%CAMARA_PRINCIPAL_PASS%]
echo CAMARA_SONOFF_PASS=[%CAMARA_SONOFF_PASS%]
echo.
echo MTX_PATHS_CAM_PRINCIPAL_SOURCE=[%MTX_PATHS_CAM_PRINCIPAL_SOURCE%]
echo MTX_PATHS_CAM_SONOFF_SOURCE=[%MTX_PATHS_CAM_SONOFF_SOURCE%]
echo ===================================================================
echo.
echo Apreta una tecla para arrancar MediaMTX (Ctrl+C para abortar)...
pause > nul

cd /d %MEDIAMTX_HOME%
mediamtx.exe
