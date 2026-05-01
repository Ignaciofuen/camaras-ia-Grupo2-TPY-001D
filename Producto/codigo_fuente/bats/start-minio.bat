@echo off
REM =========================================================
REM  Camaras-IA - MinIO Launcher
REM  Arranca el servidor S3-compatible MinIO en local.
REM
REM  Endpoints:
REM    API S3:   http://localhost:9000
REM    Consola:  http://localhost:9001  (login: admin / camaras-ia-2025)
REM
REM  Datos persistidos en: C:\minio-data
REM =========================================================

set MINIO_HOME=C:\minio
set MINIO_DATA=C:\minio-data

REM Credenciales (deben coincidir con las de .env: MINIO_ACCESS_KEY / MINIO_SECRET_KEY)
set MINIO_ROOT_USER=admin
set MINIO_ROOT_PASSWORD=camaras-ia-2025

echo.
echo === Camaras-IA MinIO ===
echo API S3:  http://localhost:9000
echo Consola: http://localhost:9001
echo User:    %MINIO_ROOT_USER%
echo Data:    %MINIO_DATA%
echo Ctrl+C para parar.
echo.

if not exist "%MINIO_HOME%\minio.exe" (
    echo [ERROR] No se encontro minio.exe en %MINIO_HOME%
    echo Descargalo de https://dl.min.io/server/minio/release/windows-amd64/minio.exe
    pause
    exit /b 1
)

if not exist "%MINIO_DATA%" (
    echo [INFO] Creando carpeta de datos %MINIO_DATA%...
    mkdir "%MINIO_DATA%"
)

cd /d %MINIO_HOME%
minio.exe server "%MINIO_DATA%" --console-address ":9001"
