@echo off
REM =========================================================
REM  Camaras-IA - Launcher TODO (modo RAPIDO / v1)
REM  Arranca el sistema completo en 4 ventanas separadas:
REM    1. MinIO            (storage S3, puerto 9000/9001)
REM    2. API FastAPI      (puerto 8000)
REM    3. Telegram Worker  (polling notificaciones)
REM    4. Detector v1      (YOLO + LLaVA analizador generico)
REM
REM  Diferencia con start-todo.bat:
REM    - Este usa analizador.py  (v1, ~76s por analisis, descripcion generica)
REM    - start-todo.bat usa analizador2.py (v2, ~115-135s, detecta armas/capucha)
REM
REM  Cerralos con Ctrl+C o cerrando la ventana.
REM =========================================================

set BATS=%~dp0

echo.
echo ==========================================================
echo   Camaras-IA - Arranque completo (modo RAPIDO v1)
echo ==========================================================
echo.
echo Orden de arranque:
echo   [1/4] MinIO
echo   [2/4] API FastAPI
echo   [3/4] Telegram Worker
echo   [4/4] Detector (modo rapido v1)
echo.

REM ---- 1. MinIO ----
echo [1/4] Arrancando MinIO...
start "Camaras-IA - MinIO" cmd /k "%BATS%start-minio.bat"
timeout /t 5 /nobreak > nul

REM ---- 2. API FastAPI ----
echo [2/4] Arrancando API FastAPI...
start "Camaras-IA - API" cmd /k "%BATS%start-api.bat"
timeout /t 3 /nobreak > nul

REM ---- 3. Telegram Worker ----
echo [3/4] Arrancando Telegram Worker...
start "Camaras-IA - Telegram Worker" cmd /k "%BATS%start-telegram.bat"
timeout /t 3 /nobreak > nul

REM ---- 4. Detector en modo rapido (v1) ----
echo [4/4] Arrancando Detector (analizador v1)...
start "Camaras-IA - Detector (v1 rapido)" cmd /k "%BATS%start.bat"

echo.
echo ==========================================================
echo   Listo. Se abrieron 4 ventanas.
echo ==========================================================
echo.
echo Enlaces utiles:
echo   - API docs:       http://localhost:8000/docs
echo   - /health:        http://localhost:8000/health
echo   - MinIO consola:  http://localhost:9001
echo.
echo Esta ventana ya podes cerrarla.
pause
