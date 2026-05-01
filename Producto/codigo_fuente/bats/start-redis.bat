@echo off
REM =========================================================
REM  Camaras-IA - Redis/Memurai Launcher
REM  Verifica que Memurai (Redis-compatible) este corriendo.
REM
REM  Memurai se instala como servicio de Windows y arranca solo,
REM  pero este script te permite:
REM    - Ver si el servicio esta arriba
REM    - Iniciarlo si esta detenido
REM    - Testear la conexion en :6379
REM
REM  Instalacion (1 sola vez):
REM    https://www.memurai.com/get-memurai
REM    Descarga "Memurai Developer Edition" (gratis)
REM =========================================================

echo.
echo === Camaras-IA - Redis/Memurai ===
echo.

REM -- 1. Detectar si Memurai esta instalado --
sc query Memurai >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] El servicio "Memurai" no esta instalado.
    echo.
    echo Descargalo de: https://www.memurai.com/get-memurai
    echo Elegi la "Developer Edition" ^(gratis^).
    echo.
    pause
    exit /b 1
)

REM -- 2. Ver estado del servicio --
echo [INFO] Verificando estado del servicio Memurai...
sc query Memurai | findstr "RUNNING" >nul
if %ERRORLEVEL% EQU 0 (
    echo [OK] Memurai ya esta corriendo.
) else (
    echo [WARN] Memurai esta detenido. Intentando arrancar...
    net start Memurai
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] No se pudo arrancar. Probalo con permisos de admin:
        echo   net start Memurai
        pause
        exit /b 1
    )
)

REM -- 3. Test de conexion con Python --
echo.
echo [INFO] Test de conexion en localhost:6379...
set PY=C:\Users\ignfu\AppData\Local\Programs\Python\Python310\python.exe
set BASE=C:\Users\ignfu\OneDrive\Desktop\camaras-ia\Producto\codigo_fuente

cd /d %BASE%\base_datos
%PY% -c "from db import db; db.init(); from redis_cache import cache; import sys; sys.exit(0 if cache.init() else 1)"
if %ERRORLEVEL% EQU 0 (
    echo.
    echo [OK] Redis respondiendo en :6379
    echo.
    echo Endpoints:
    echo   host:  localhost
    echo   port:  6379
    echo   db:    0
    echo.
    echo Para testear a fondo: python redis_cache.py
) else (
    echo.
    echo [ERROR] El servicio esta arriba pero redis-py no puede conectar.
    echo Revisa CAMARAS_REDIS_* en .env, o que no tengas password configurada.
)

echo.
pause
