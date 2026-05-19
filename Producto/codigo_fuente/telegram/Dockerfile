# =============================================================================
# Camaras-IA · Telegram Worker
# =============================================================================
# Imagen ligera (~150 MB) que ejecuta telegram/telegram_worker.py en loop.
# Lee la tabla `notificaciones` en Postgres y envia push via Telegram Bot API.
# Multi-arch: corre tanto en ARM64 (Oracle Always Free) como en x86_64.
#
# Build:    docker compose build telegram
# Logs:     docker compose logs -f telegram
# =============================================================================

FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Deps de sistema para compilar psycopg si pip no encuentra wheel ARM.
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 1. Requirements (cache de capa)
COPY telegram/requirements.txt ./
RUN pip install -r requirements.txt

# 2. Codigo del worker + modulos compartidos
COPY telegram/    ./telegram/
COPY base_datos/  ./base_datos/
# El worker tambien usa salud.py (heartbeat), que vive en backend/.
# Solo copiamos ese archivo, no todo el backend.
COPY backend/salud.py ./backend/salud.py

# Mismo PYTHONPATH que el backend para que `from db import db` y
# `from salud import reportar` funcionen sin tocar el codigo del worker.
ENV PYTHONPATH=/app/telegram:/app/base_datos:/app/backend

# Sin EXPOSE: el worker no escucha en ningun puerto, solo hace polling
# saliente a Postgres y a api.telegram.org.

CMD ["python", "/app/telegram/telegram_worker.py"]
