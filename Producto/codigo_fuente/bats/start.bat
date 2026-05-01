@echo off
REM =========================================================
REM  Camaras-IA - Detector (modo RAPIDO / v1)
REM  Arranca SOLO el detector usando analizador.py (generico).
REM
REM  Mas rapido (~76s por analisis de LLaVA) pero menos sensible
REM  a amenazas. Para detectar armas/capucha/etc usar
REM  start-seguridad.bat (analizador2).
REM
REM  NOTA: este .bat ya no arranca telegram_worker.
REM        Usa start-telegram.bat por separado, o start-todo.bat
REM        para levantar el sistema completo.
REM =========================================================

set PY=C:\Users\ignfu\AppData\Local\Programs\Python\Python310\python.exe
set BASE=C:\Users\ignfu\OneDrive\Desktop\camaras-ia\Producto\codigo_fuente

echo.
echo === Camaras-IA - Detector (analizador v1) ===
echo Ctrl+C para parar.
echo.

cd /d %BASE%\backend
%PY% detector.py
