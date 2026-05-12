@echo off
REM =========================================================
REM  Camaras-IA - Launcher TODO
REM  Arranca el sistema completo en 5 ventanas separadas:
REM    1. MediaMTX         (RTSP -> HLS, puerto 8888)
REM    2. MinIO            (storage S3, puerto 9000/9001)
REM    3. API FastAPI      (puerto 8000)
REM    4. Telegram Worker  (polling notificaciones)
REM    5. Detector v2      (YOLO + LLaVA modo seguridad)
REM
REM  Cada servicio abre su propia ventana con sus logs.
REM  Cerralos con Ctrl+C o cerrando la ventana.
REM =========================================================

set BATS=%~dp0

echo.
echo ==========================================================
echo   Camaras-IA - Arranque completo del sistema
echo ==========================================================
echo.
echo Orden de arranque:
echo   [1/5] MediaMTX
echo   [2/5] MinIO
echo   [3/5] API FastAPI
echo   [4/5] Telegram Worker
echo   [5/5] Detector (modo seguridad)
echo.

REM ---- 1. MediaMTX (primero, asi cuando arranque el frontend ya tiene HLS) ----
echo [1/5] Arrancando MediaMTX...
start "Camaras-IA - MediaMTX" cmd /k "%BATS%start-mediamtx.bat"
timeout /t 4 /nobreak > nul

REM ---- 2. MinIO ----
echo [2/5] Arrancando MinIO...
start "Camaras-IA - MinIO" cmd /k "%BATS%start-minio.bat"
timeout /t 5 /nobreak > nul

REM ---- 3. API FastAPI ----
echo [3/5] Arrancando API FastAPI...
start "Camaras-IA - API" cmd /k "%BATS%start-api.bat"
timeout /t 3 /nobreak > nul

REM ---- 4. Telegram Worker ----
echo [4/5] Arrancando Telegram Worker...
start "Camaras-IA - Telegram Worker" cmd /k "%BATS%start-telegram.bat"
timeout /t 3 /nobreak > nul

REM ---- 5. Detector en modo seguridad ----
echo [5/5] Arrancando Detector (analizador v2)...
start "Camaras-IA - Detector (v2 seguridad)" cmd /k "%BATS%start-seguridad.bat"

echo.
echo ==========================================================
echo   Listo. Se abrieron 5 ventanas.
echo ==========================================================
echo.
echo Enlaces utiles:
echo   - API docs:        http://localhost:8000/docs
echo   - /health:         http://localhost:8000/health
echo   - MinIO consola:   http://localhost:9001
echo   - MediaMTX HLS:    http://localhost:8888/cam_principal/index.m3u8
echo   - Frontend:        cd ..\frontend ^&^& npm run dev   (luego http://localhost:5173)
echo.
echo Esta ventana ya podes cerrarla.
pause
