@echo off
REM =========================================================
REM  Camaras-IA - Detector (modo SEGURIDAD / v2)
REM  Arranca SOLO el detector forzando analizador2.py
REM  (armas, capucha, merodeo, trepar, forzar puertas, peleas).
REM
REM  Costo: LLaVA tarda ~115-135s por analisis (vs ~76s del v1).
REM
REM  NOTA: este .bat ya no arranca telegram_worker.
REM        Usa start-telegram.bat por separado, o start-todo.bat
REM        para levantar el sistema completo.
REM =========================================================

set PY=C:\Users\ignfu\AppData\Local\Programs\Python\Python310\python.exe
set BASE=C:\Users\ignfu\OneDrive\Desktop\camaras-ia\Producto\codigo_fuente

echo.
echo === Camaras-IA - Detector MODO SEGURIDAD (v2) ===
echo Ctrl+C para parar.
echo.

cd /d %BASE%\backend
set CAMARAS_ANALIZADOR=v2
%PY% detector.py
