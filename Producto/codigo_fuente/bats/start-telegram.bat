@echo off
REM =========================================================
REM  Camaras-IA - Telegram Worker Launcher
REM  Arranca el worker que envia notificaciones por Telegram.
REM
REM  Lee notificaciones con estado='pendiente' de la DB,
REM  las manda al chat configurado y las marca como enviadas.
REM
REM  Requisitos:
REM    - TELEGRAM_BOT_TOKEN cargado en tabla configuracion_sistema
REM    - DB Postgres corriendo (CAMARAS_DB_* en .env)
REM =========================================================

set PY=C:\Users\ignfu\AppData\Local\Programs\Python\Python310\python.exe
set BASE=C:\Users\ignfu\OneDrive\Desktop\camaras-ia\Producto\codigo_fuente

echo.
echo === Camaras-IA Telegram Worker ===
echo Polling cada 5s a la tabla notificaciones.
echo Ctrl+C para parar.
echo.

cd /d %BASE%\telegram
%PY% telegram_worker.py
