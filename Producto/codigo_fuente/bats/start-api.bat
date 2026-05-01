@echo off
REM =========================================================
REM  Camaras-IA · API Launcher
REM  Arranca FastAPI + Uvicorn con autoreload en puerto 8000.
REM  Docs interactivas en:
REM    http://localhost:8000/docs
REM =========================================================

set PY=C:\Users\ignfu\AppData\Local\Programs\Python\Python310\python.exe
set BASE=C:\Users\ignfu\OneDrive\Desktop\camaras-ia\Producto\codigo_fuente

echo.
echo === Camaras-IA API ===
echo Docs: http://localhost:8000/docs
echo Ctrl+C para parar.
echo.

cd /d %BASE%\backend
%PY% -m uvicorn api:app --reload --host 0.0.0.0 --port 8000
