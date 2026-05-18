# =============================================================================
# Camaras-IA · Backend FastAPI
# =============================================================================
# Imagen multi-arch (funciona en ARM64 de Oracle Always Free y en x86_64 local).
# Usa python:slim para que la imagen sea liviana (~200MB final).
# =============================================================================

FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Dependencias de sistema mínimas: gcc para compilar bcrypt si pip no encuentra
# wheel ARM. libpq-dev para psycopg.
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 1. Instalar requirements primero (mejor cache de capas Docker)
COPY backend/requirements.txt ./
RUN pip install -r requirements.txt

# 2. Copiar el código (backend + base_datos para los imports)
COPY backend/    ./backend/
COPY base_datos/ ./base_datos/

# El backend hace `from db import db` y `from redis_cache import cache`, así que
# tenemos que poner /app/base_datos en el PYTHONPATH.
ENV PYTHONPATH=/app/backend:/app/base_datos

EXPOSE 8000

# uvicorn directo (en prod no usamos --reload)
CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8000", "--app-dir", "/app/backend"]
