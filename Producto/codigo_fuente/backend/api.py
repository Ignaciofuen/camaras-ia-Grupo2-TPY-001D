"""
api.py · REST API para Cámaras-IA (FastAPI)
============================================
Expone la DB de PostgreSQL como una API HTTP read-only para el futuro
dashboard web y para integraciones externas.

No toca el detector ni el worker de Telegram — corre en paralelo.

Endpoints MVP (todos GET por ahora):
  GET  /                              info básica
  GET  /health                        status + ping DB
  GET  /config                        configuracion_sistema (filtrado: sin secretos)
  GET  /camaras                       lista de cámaras
  GET  /camaras/{id}                  detalle de una cámara
  GET  /estados                       todos los estados vivos (Redis, ~5ms)
  GET  /camaras/{nombre}/estado       último estado de una cámara (Redis)
  GET  /camaras/{nombre}/cooldown     diagnóstico del cooldown activo (Redis)
  GET  /alertas/stream                Server-Sent Events (push realtime)
  GET  /alertas                       lista de alertas con filtros
  GET  /alertas/{id}                  detalle de una alerta (con análisis)
  GET  /eventos                       lista de eventos
  GET  /eventos/{id}                  detalle (con detecciones YOLO)
  GET  /analisis/{id}                 detalle de un análisis LLaVA
  GET  /notificaciones                estado del worker Telegram

Uso:
  uvicorn api:app --reload --port 8000
  o:   python api.py

Docs interactivas:
  http://localhost:8000/docs          (Swagger UI)
  http://localhost:8000/redoc         (ReDoc)
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from contextlib import asynccontextmanager
from typing import Any, AsyncGenerator, Optional

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse, Response, StreamingResponse

# --- path setup: permite importar modulos hermanos (base_datos/, backend/, telegram/) ---
import os as _os, sys as _sys
_ROOT = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__)))
for _sub in ("base_datos", "backend", "telegram"):
    _p = _os.path.join(_ROOT, _sub)
    if _p not in _sys.path:
        _sys.path.insert(0, _p)
# --- end path setup ---

from db import db
from storage import storage
from redis_cache import (
    cache,
    REDIS_HOST, REDIS_PORT, REDIS_DB, REDIS_PASSWORD,
    CHANNEL_ALERTAS, CHANNEL_DETECCIONES,
)
from salud import reportar as reportar_salud, Heartbeat

log = logging.getLogger("camaras.api")

# =============================================================================
# Claves de configuracion_sistema que NO deben exponerse por GET /config
# =============================================================================
CONFIG_SECRETOS = {
    "TELEGRAM_BOT_TOKEN",
    "TELEGRAM_CHAT_ID",  # opcional, lo oculto porque es un dato personal
    "DB_PASSWORD",
    "AWS_SECRET_KEY",
    "MINIO_SECRET_KEY",
}

# =============================================================================
# MediaMTX: base URL para construir las URLs HLS de cada camara.
# El frontend usa esto directo (sin tener que armar la URL).
# Se puede sobreescribir con env var MEDIAMTX_HLS_BASE.
# =============================================================================
MEDIAMTX_HLS_BASE = _os.getenv("MEDIAMTX_HLS_BASE", "http://localhost:8888").rstrip("/")


def _attach_hls_url(row: dict) -> dict:
    """Si la fila tiene mediamtx_path, agrega hls_url; si no, deja la fila igual."""
    path = row.get("mediamtx_path") if isinstance(row, dict) else None
    if path:
        row["hls_url"] = f"{MEDIAMTX_HLS_BASE}/{path}/index.m3u8"
    return row


# =============================================================================
# LIFECYCLE: conectar DB al arrancar, cerrar al terminar
# =============================================================================

_hb_api: Heartbeat | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _hb_api
    # Startup
    ok = db.init()
    if not ok:
        log.error("[api] No se pudo conectar a la DB al arrancar")
    else:
        db.cargar_configuracion()
        log.info("[api] DB conectada y configuración cargada")
        reportar_salud("postgres", "online")

    # MinIO (opcional, graceful degradation)
    if storage.init():
        log.info("[api] MinIO conectado (snapshots disponibles)")
        reportar_salud("minio", "online")
    else:
        log.warning("[api] MinIO no disponible — endpoints de snapshot fallarán")
        reportar_salud("minio", "offline", error_msg="storage.init() devolvió False")

    # Redis/Memurai (opcional, graceful degradation)
    # cache.init() ya reporta salud internamente
    if cache.init():
        log.info("[api] Redis conectado (cache + pub/sub)")
    else:
        log.warning("[api] Redis no disponible — cooldowns y realtime desactivados")

    # Heartbeat de la propia API
    reportar_salud("api", "online", metrica={"version": "0.1.0"})
    _hb_api = Heartbeat("api", intervalo_s=30).start()

    yield
    # Shutdown
    if _hb_api:
        _hb_api.stop()
    cache.cerrar()
    db.cerrar()
    log.info("[api] DB cerrada")


app = FastAPI(
    title="Cámaras-IA API",
    description="API REST para el sistema de vigilancia IA.",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS abierto para desarrollo (restringir en producción)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =============================================================================
# Helper: ejecutar query con cursor dict y devolver filas
# =============================================================================

def _query(sql: str, params: tuple = ()) -> list[dict]:
    with db._conn() as conn:
        return conn.execute(sql, params).fetchall()


def _query_one(sql: str, params: tuple = ()) -> Optional[dict]:
    rows = _query(sql, params)
    return rows[0] if rows else None


# =============================================================================
# ROOT / HEALTH
# =============================================================================

@app.get("/", tags=["meta"])
def root():
    return {
        "service": "camaras-ia-api",
        "version": "0.1.0",
        "docs": "/docs",
    }


@app.get("/health", tags=["meta"])
def health():
    """
    Health global del sistema: ping a la DB + último estado reportado por cada
    componente (lee v_salud_sistema). Útil para dashboards y monitoring.
    """
    try:
        _query("SELECT 1 AS ok")
        db_ok = True
    except Exception as e:
        log.error(f"Health check DB falló: {e}")
        db_ok = False

    filas = []
    if db_ok:
        try:
            filas = _query("SELECT * FROM v_salud_sistema ORDER BY tipo, componente")
        except Exception as e:
            log.error(f"v_salud_sistema falló: {e}")

    # Agrupamos por tipo para el consumidor
    camaras = [f for f in filas if f["tipo"] == "camara"]
    servicios = [f for f in filas if f["tipo"] == "servicio"]

    # Estado global: si algún servicio está offline → degraded
    hay_offline = any(f["estado"] == "offline" for f in servicios)
    hay_degradado = any(f["estado"] == "degradado" for f in servicios)

    if not db_ok:
        status = "down"
    elif hay_offline:
        status = "degraded"
    elif hay_degradado:
        status = "degraded"
    else:
        status = "ok"

    return {
        "status":    status,
        "db":        "connected" if db_ok else "disconnected",
        "camaras":   camaras,
        "servicios": servicios,
    }


@app.get("/health/ia", tags=["meta"])
def health_ia():
    """
    Estado específico de la IA (yolo + llava + detector). Este es el endpoint
    que contesta '¿funciona el modelo?' sin tener que mirar logs.
    """
    filas = _query(
        """
        SELECT * FROM v_salud_sistema
        WHERE tipo = 'servicio' AND componente IN ('detector','yolo','llava')
        ORDER BY componente
        """
    )
    return {"servicios_ia": filas}


@app.get("/health/historico", tags=["meta"])
def health_historico(
    componente: Optional[str] = Query(None, description="ej. yolo, llava, detector"),
    horas: int = Query(24, ge=1, le=168, description="ventana hacia atrás"),
    limite: int = Query(500, ge=1, le=5000),
):
    """
    Últimos N heartbeats (por defecto últimas 24h). Útil para graficar.
    """
    where = ["verificado_en > now() - (%s || ' hours')::interval"]
    params: list[Any] = [str(horas)]
    if componente:
        where.append("servicio = %s")
        params.append(componente)

    sql = f"""
        SELECT servicio, estado, latencia_ms, metrica, error_msg, verificado_en
        FROM salud_servicios
        WHERE {' AND '.join(where)}
        ORDER BY verificado_en DESC
        LIMIT %s
    """
    params.append(limite)
    return {"heartbeats": _query(sql, tuple(params))}


# =============================================================================
# CONFIGURACIÓN
# =============================================================================

@app.get("/config", tags=["config"])
def get_config():
    """Devuelve la configuración del sistema con las claves sensibles ocultas."""
    rows = _query("SELECT clave, valor FROM configuracion_sistema ORDER BY clave")
    return {
        r["clave"]: (r["valor"] if r["clave"] not in CONFIG_SECRETOS else "***")
        for r in rows
    }


# =============================================================================
# CÁMARAS
# =============================================================================

@app.get("/camaras", tags=["camaras"])
def list_camaras(
    solo_activas: bool = Query(False, description="Filtrar solo las activas"),
):
    where = "WHERE activa = TRUE" if solo_activas else ""
    sql = f"""
        SELECT id::text AS id, nombre, descripcion,
               direccion_mac::text AS direccion_mac,
               host(ip_actual)   AS ip_actual,
               host(ip_respaldo) AS ip_respaldo,
               usuario_rtsp, puerto_rtsp, ruta_rtsp,
               mediamtx_path, modelo_hw,
               resolucion_w, resolucion_h, fps,
               modo_analisis, confianza_visual, confianza_alerta,
               procesar_cada_n_frames, duracion_alerta_seg, frames_ausencia,
               contexto_zona, activa, estado_salud,
               ultima_conexion_en, ip_actualizada_en
          FROM camaras
          {where}
         ORDER BY nombre
    """
    rows = _query(sql)
    if isinstance(rows, list):
        return [_attach_hls_url(r) for r in rows]
    if isinstance(rows, dict) and "camaras" in rows:
        rows["camaras"] = [_attach_hls_url(r) for r in rows["camaras"]]
    return rows


@app.get("/camaras/{camara_id}", tags=["camaras"])
def get_camara(camara_id: str):
    sql = """
        SELECT id::text AS id, nombre, descripcion,
               direccion_mac::text AS direccion_mac,
               host(ip_actual)   AS ip_actual,
               host(ip_respaldo) AS ip_respaldo,
               usuario_rtsp, puerto_rtsp, ruta_rtsp,
               mediamtx_path, modelo_hw,
               resolucion_w, resolucion_h, fps,
               modo_analisis, confianza_visual, confianza_alerta,
               procesar_cada_n_frames, duracion_alerta_seg, frames_ausencia,
               contexto_zona, activa, estado_salud,
               ultima_conexion_en, ip_actualizada_en
          FROM camaras
         WHERE id = %s
    """
    cam = _query_one(sql, (camara_id,))
    if not cam:
        raise HTTPException(status_code=404, detail="Cámara no encontrada")
    return _attach_hls_url(cam)


# =============================================================================
# ESTADOS EN VIVO (Redis) — respuesta en ~5ms sin tocar Postgres
# =============================================================================
# Estos endpoints leen el cache de Redis en lugar de la DB. Los valores vienen
# de lo que el detector escribió la última vez que LLaVA analizó la cámara
# (ver `cache.set_estado_camara(...)` en detector.py).
# - Si Redis está caído → degradación graciosa: devolvemos 503 / lista vacía.
# - Si la cámara nunca fue analizada → 404 (no hay estado cacheado).
# - Ideal para un dashboard que se refresca cada 1-2 segundos.

@app.get("/sistema/metricas", tags=["meta"])
def sistema_metricas():
    """
    Endpoint agregado para el panel "Sistema": junta camaras + servicios +
    latencias agregadas en una sola llamada. Asi el frontend no hace 4 fetches.

    Devuelve:
      {
        uptime_s: ...,
        servicios: [{componente, estado, latencia_ms, metrica, visto_en, segundos_sin_reporte}],
        camaras:   [{componente, estado, visto_en, segundos_sin_reporte,
                     ultima_latencia_yolo_ms, ultimo_evento_en}],
        totales: { camaras_total, camaras_online, latencia_yolo_ms_avg, latencia_llava_s_avg }
      }
    """
    # 1) Vista v_salud_sistema -> camaras + servicios
    filas = _query("SELECT * FROM v_salud_sistema ORDER BY tipo, componente")
    servicios = [f for f in filas if f["tipo"] == "servicio"]
    camaras   = [f for f in filas if f["tipo"] == "camara"]

    # 2) Para cada camara, ultima latencia YOLO (ultimo evento)
    cam_extras = _query(
        """
        SELECT c.nombre AS componente,
               MAX(e.capturado_en) AS ultimo_evento_en,
               (SELECT e2.latencia_yolo_ms
                  FROM eventos_deteccion e2
                 WHERE e2.camara_id = c.id
              ORDER BY e2.capturado_en DESC
                 LIMIT 1) AS ultima_latencia_yolo_ms
          FROM camaras c
     LEFT JOIN eventos_deteccion e ON e.camara_id = c.id
              AND e.capturado_en > now() - INTERVAL '1 hour'
         WHERE c.activa
      GROUP BY c.id, c.nombre
        """
    )
    extras_map = {x["componente"]: x for x in cam_extras}
    for cam in camaras:
        ex = extras_map.get(cam["componente"], {})
        cam["ultima_latencia_yolo_ms"] = ex.get("ultima_latencia_yolo_ms")
        cam["ultimo_evento_en"]        = ex.get("ultimo_evento_en")

    # 3) Latencia LLaVA promedio (ultimos 10 analisis)
    llava_row = _query_one(
        """
        SELECT AVG(tiempo_analisis_s)::FLOAT AS avg_s,
               COUNT(*)                       AS n
          FROM (
            SELECT tiempo_analisis_s
              FROM analisis_escena
             WHERE tiempo_analisis_s IS NOT NULL
          ORDER BY id DESC
             LIMIT 10
          ) t
        """
    ) or {}
    llava_avg_s = llava_row.get("avg_s")

    # 4) Latencia YOLO promedio (ultimos 50 eventos)
    yolo_row = _query_one(
        """
        SELECT AVG(latencia_yolo_ms)::INT AS avg_ms
          FROM (
            SELECT latencia_yolo_ms
              FROM eventos_deteccion
             WHERE latencia_yolo_ms IS NOT NULL
          ORDER BY id DESC
             LIMIT 50
          ) t
        """
    ) or {}
    yolo_avg_ms = yolo_row.get("avg_ms")

    # 5) Totales
    camaras_total  = len(camaras)
    camaras_online = sum(1 for c in camaras if c["estado"] == "online")

    return {
        "servicios": servicios,
        "camaras":   camaras,
        "totales": {
            "camaras_total":         camaras_total,
            "camaras_online":        camaras_online,
            "latencia_yolo_ms_avg":  yolo_avg_ms,
            "latencia_llava_s_avg":  llava_avg_s,
        },
    }


@app.get("/estados", tags=["realtime"])
def list_estados_live():
    """
    Todos los estados vivos de cámaras (lo que cada una vio por última vez).
    Lee desde Redis directamente — respuesta en milisegundos.

    Cada entrada incluye:
      - nivel      : 'alto' | 'medio' | 'bajo'
      - personas   : cantidad detectada por YOLO
      - descripcion: texto generado por LLaVA
      - acciones   : acciones detectadas
      - sospechoso : flag booleano
      - alerta_num : número de alerta (si se disparó)
      - evento_id  : id del evento en la DB
      - cached_at  : timestamp (float epoch) en que se cacheó
      - _camara    : nombre de la cámara
    """
    if not cache.habilitado or cache._client is None:
        raise HTTPException(
            status_code=503,
            detail="Redis no disponible — estados en vivo desactivados",
        )
    return {"estados": cache.listar_estados_camaras()}


@app.get("/camaras/{nombre}/estado", tags=["realtime"])
def get_camara_estado(nombre: str):
    """
    Estado en vivo de una cámara específica (lee desde Redis).
    Devuelve el último resultado de LLaVA mientras el TTL esté vivo.
    """
    if not cache.habilitado or cache._client is None:
        raise HTTPException(
            status_code=503,
            detail="Redis no disponible — estados en vivo desactivados",
        )
    estado = cache.get_estado_camara(nombre)
    if estado is None:
        raise HTTPException(
            status_code=404,
            detail=f"Sin estado cacheado para '{nombre}' (TTL expirado o nunca analizada)",
        )
    estado["_camara"] = nombre
    return estado


@app.get("/camaras/{nombre}/cooldown", tags=["realtime"])
def get_camara_cooldown(
    nombre: str,
    tipo: str = Query("analisis", description="Tipo de cooldown (default 'analisis')"),
):
    """
    Diagnóstico del cooldown activo para una cámara.
    Útil para entender por qué el detector está saltando LLaVA.
    Devuelve `{activo: bool, restante_s: int}`.
    """
    if not cache.habilitado or cache._client is None:
        raise HTTPException(
            status_code=503,
            detail="Redis no disponible",
        )
    activo = cache.cooldown_activo(nombre, tipo)
    restante = cache.cooldown_restante_s(nombre, tipo) if activo else 0
    return {
        "camara":     nombre,
        "tipo":       tipo,
        "activo":     bool(activo),
        "restante_s": int(restante),
    }


# =============================================================================
# ALERTAS
# =============================================================================

@app.get("/alertas", tags=["alertas"])
def list_alertas(
    limite: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    severidad: Optional[str] = Query(None, description="baja/media/alta/critica"),
    camara_id: Optional[str] = Query(None),
    estado: Optional[str] = Query(None, description="abierta/reconocida/resuelta/descartada"),
    desde: Optional[str] = Query(None, description="ISO-8601 datetime"),
    hasta: Optional[str] = Query(None, description="ISO-8601 datetime"),
):
    """Lista alertas ordenadas por más reciente primero. Usa la vista v_alertas_completas."""
    filtros = []
    params: list[Any] = []

    if severidad:
        filtros.append("severidad = %s")
        params.append(severidad.lower())
    if camara_id:
        # La vista no expone camara_id cruda; filtramos por nombre o hay que pegarle a la tabla cruda.
        # Hacemos join directo a la tabla para poder filtrar por id.
        pass
    if estado:
        filtros.append("estado = %s")
        params.append(estado.lower())
    if desde:
        filtros.append("disparada_en >= %s")
        params.append(desde)
    if hasta:
        filtros.append("disparada_en <= %s")
        params.append(hasta)

    if camara_id:
        # Caso con filtro por cámara → query sobre tabla cruda
        filtros_cam = ["a.camara_id = %s"]
        params_cam: list[Any] = [camara_id]
        for f, p in zip(filtros, params):
            filtros_cam.append(f.replace("severidad", "a.severidad")
                                 .replace("estado", "a.estado")
                                 .replace("disparada_en", "a.disparada_en"))
            params_cam.append(p)
        where = "WHERE " + " AND ".join(filtros_cam)
        sql = f"""
            SELECT a.id::text AS id, a.numero_alerta, a.titulo, a.severidad, a.estado,
                   a.disparada_en, a.reconocida_en, a.nota_resolucion,
                   a.evento_id, a.camara_id::text AS camara_id,
                   c.nombre AS camara_nombre,
                   ae.nivel AS llava_nivel, ae.sospechoso AS llava_sospechoso,
                   ae.descripcion AS llava_descripcion, ae.acciones AS llava_acciones
              FROM alertas a
              JOIN camaras c ON c.id = a.camara_id
         LEFT JOIN analisis_escena ae ON ae.id = a.analisis_id
              {where}
             ORDER BY a.disparada_en DESC
             LIMIT %s OFFSET %s
        """
        params_cam.extend([limite, offset])
        return _query(sql, tuple(params_cam))

    # Sin filtro por cámara → usamos la vista
    where = ("WHERE " + " AND ".join(filtros)) if filtros else ""
    sql = f"""
        SELECT id::text AS id, numero_alerta, titulo, severidad, estado, disparada_en,
               camara_nombre, modo_analisis, sitio_nombre,
               llava_nivel, llava_sospechoso, llava_descripcion, llava_acciones,
               cantidad_personas, reconocida_por_nombre
          FROM v_alertas_completas
          {where}
         ORDER BY disparada_en DESC
         LIMIT %s OFFSET %s
    """
    params.extend([limite, offset])
    return _query(sql, tuple(params))


@app.delete("/alertas/{alerta_id:int}", tags=["alertas"])
def delete_alerta(alerta_id: int):
    """
    Elimina una alerta por id. El evento_deteccion y el analisis_escena
    asociados NO se borran (son historial). Solo se borra el registro de
    `alertas` para que desaparezca del panel.
    """
    with db._conn() as conn:
        # Verificar existe primero (para devolver 404 si no)
        row = conn.execute(
            "SELECT id FROM alertas WHERE id = %s", (alerta_id,)
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Alerta no encontrada")
        conn.execute("DELETE FROM alertas WHERE id = %s", (alerta_id,))
    return {"ok": True, "deleted_id": alerta_id}


@app.delete("/alertas", tags=["alertas"])
def delete_alertas_batch(
    fecha: Optional[str] = Query(None, description="YYYY-MM-DD: borra todas las alertas de esa fecha"),
    desde: Optional[str] = Query(None, description="ISO datetime inicio"),
    hasta: Optional[str] = Query(None, description="ISO datetime fin"),
    confirmar: bool = Query(False, description="Debe ser true para que se ejecute"),
):
    """
    Borra alertas en batch. Por seguridad requiere ?confirmar=true.

    Opciones:
      - fecha=YYYY-MM-DD       -> borra todas las alertas de ese dia
      - desde=...&hasta=...    -> borra alertas en ese rango

    Si no se pasa ninguno, error 400 (no permitimos "borrar todo todo" por
    accidente).
    """
    if not confirmar:
        raise HTTPException(
            status_code=400,
            detail="Falta ?confirmar=true (medida de seguridad)",
        )

    where_parts = []
    params: list[Any] = []
    if fecha:
        # Borra del 00:00:00 al 23:59:59 del dia
        where_parts.append("disparada_en >= %s::date AND disparada_en < (%s::date + INTERVAL '1 day')")
        params.extend([fecha, fecha])
    elif desde or hasta:
        if desde:
            where_parts.append("disparada_en >= %s")
            params.append(desde)
        if hasta:
            where_parts.append("disparada_en <= %s")
            params.append(hasta)
    else:
        raise HTTPException(
            status_code=400,
            detail="Especifica ?fecha=YYYY-MM-DD o ?desde=...&hasta=...",
        )

    where_sql = " AND ".join(where_parts)
    with db._conn() as conn:
        result = conn.execute(
            f"DELETE FROM alertas WHERE {where_sql}",
            tuple(params),
        )
        # En psycopg, rowcount viene en cursor.rowcount; con su wrapper depende.
        # Hacemos un SELECT COUNT antes en caso de no tener rowcount confiable.
    return {"ok": True, "filtro": {"fecha": fecha, "desde": desde, "hasta": hasta}}


@app.get("/alertas/{alerta_id:int}", tags=["alertas"])
def get_alerta(alerta_id: int):
    """Detalle de una alerta: incluye evento, cámara y análisis LLaVA si existe.

    NOTA: el path converter `:int` es CRÍTICO. Sin él, FastAPI matchearía
    GET /alertas/stream con esta ruta (capturando "stream" como alerta_id)
    y nunca llegaría al endpoint SSE de la línea ~800.
    """
    sql = """
        SELECT a.id::text AS id, a.numero_alerta, a.titulo, a.mensaje,
               a.severidad, a.estado, a.disparada_en, a.reconocida_en,
               a.reconocida_por::text AS reconocida_por,
               a.resuelta_en, a.nota_resolucion, a.id_rastreo, a.metadatos,
               a.evento_id, a.analisis_id,
               a.camara_id::text AS camara_id,
               c.nombre AS camara_nombre, c.contexto_zona,
               ed.capturado_en, ed.cantidad_personas,
               ed.snapshot_bucket, ed.snapshot_key, ed.snapshot_anotado,
               ae.modelo AS llava_modelo, ae.nivel AS llava_nivel,
               ae.sospechoso AS llava_sospechoso,
               ae.descripcion AS llava_descripcion,
               ae.acciones AS llava_acciones,
               ae.personas AS llava_personas,
               ae.tiempo_analisis_s AS llava_tiempo_s,
               ae.respuesta_cruda AS llava_respuesta_cruda
          FROM alertas a
          JOIN camaras c ON c.id = a.camara_id
          JOIN eventos_deteccion ed ON ed.id = a.evento_id
     LEFT JOIN analisis_escena ae ON ae.id = a.analisis_id
         WHERE a.id = %s
    """
    alerta = _query_one(sql, (alerta_id,))
    if not alerta:
        raise HTTPException(status_code=404, detail="Alerta no encontrada")
    return alerta


# =============================================================================
# EVENTOS
# =============================================================================

@app.get("/eventos", tags=["eventos"])
def list_eventos(
    limite: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    camara_id: Optional[str] = Query(None),
    estado: Optional[str] = Query(None, description="pendiente/analizado/descartado"),
):
    filtros = []
    params: list[Any] = []
    if camara_id:
        filtros.append("e.camara_id = %s")
        params.append(camara_id)
    if estado:
        filtros.append("e.estado = %s")
        params.append(estado.lower())

    where = ("WHERE " + " AND ".join(filtros)) if filtros else ""
    sql = f"""
        SELECT e.id, e.camara_id::text AS camara_id, c.nombre AS camara_nombre,
               e.capturado_en, e.recibido_en, e.cantidad_personas,
               e.estado, e.latencia_yolo_ms, e.modelo_yolo,
               e.snapshot_bucket, e.snapshot_key, e.snapshot_anotado,
               e.frame_width, e.frame_height
          FROM eventos_deteccion e
          JOIN camaras c ON c.id = e.camara_id
          {where}
         ORDER BY e.capturado_en DESC
         LIMIT %s OFFSET %s
    """
    params.extend([limite, offset])
    return _query(sql, tuple(params))


@app.get("/eventos/{evento_id}", tags=["eventos"])
def get_evento(evento_id: int):
    sql_evento = """
        SELECT e.id, e.camara_id::text AS camara_id, c.nombre AS camara_nombre,
               e.capturado_en, e.recibido_en, e.cantidad_personas,
               e.estado, e.latencia_yolo_ms, e.modelo_yolo,
               e.snapshot_bucket, e.snapshot_key, e.snapshot_anotado,
               e.frame_width, e.frame_height
          FROM eventos_deteccion e
          JOIN camaras c ON c.id = e.camara_id
         WHERE e.id = %s
    """
    ev = _query_one(sql_evento, (evento_id,))
    if not ev:
        raise HTTPException(status_code=404, detail="Evento no encontrado")

    # Detecciones YOLO del evento (bboxes)
    sql_det = """
        SELECT id, clase_nombre, clase_id, confianza,
               bbox_x, bbox_y, bbox_w, bbox_h,
               id_rastreo, en_zona_id::text AS en_zona_id
          FROM detecciones
         WHERE evento_id = %s
         ORDER BY id ASC
    """
    ev["detecciones"] = _query(sql_det, (evento_id,))
    return ev


# =============================================================================
# ANÁLISIS (LLaVA)
# =============================================================================

@app.get("/analisis/{analisis_id}", tags=["analisis"])
def get_analisis(analisis_id: int):
    sql = """
        SELECT id, evento_id, modelo, contexto_zona,
               sospechoso, nivel, descripcion, personas, acciones,
               tiempo_analisis_s, estado, error_msg,
               respuesta_cruda, creado_en
          FROM analisis_escena
         WHERE id = %s
    """
    row = _query_one(sql, (analisis_id,))
    if not row:
        raise HTTPException(status_code=404, detail="Análisis no encontrado")
    return row


# =============================================================================
# NOTIFICACIONES (estado del worker Telegram)
# =============================================================================

@app.get("/notificaciones", tags=["notificaciones"])
def list_notificaciones(
    limite: int = Query(50, ge=1, le=500),
    estado: Optional[str] = Query(None, description="pendiente/enviada/fallida"),
):
    filtros = []
    params: list[Any] = []
    if estado:
        filtros.append("estado = %s")
        params.append(estado.lower())
    where = ("WHERE " + " AND ".join(filtros)) if filtros else ""
    sql = f"""
        SELECT id, alerta_id::text AS alerta_id, chat_id, estado, intentos,
               creado_en, enviada_en, telegram_message_id,
               LEFT(mensaje, 120) AS preview,
               ultimo_error
          FROM notificaciones
          {where}
         ORDER BY creado_en DESC
         LIMIT %s
    """
    params.append(limite)
    return _query(sql, tuple(params))


# =============================================================================
# SNAPSHOTS (MinIO)
# =============================================================================

@app.get("/alertas/{alerta_id:int}/snapshot", tags=["snapshots"])
def get_alerta_snapshot(
    alerta_id: int,
    modo: str = Query("redirect", description="'redirect' → 302 a presigned URL; 'bytes' → imagen JPG inline"),
    expires: int = Query(3600, ge=60, le=86400, description="Duración URL presignada (segundos)"),
):
    """
    Devuelve el snapshot JPG asociado a la alerta.
    - modo=redirect: responde 302 con URL presignada de MinIO (ideal para <img src>).
    - modo=bytes:    descarga el JPG y lo entrega como image/jpeg inline.
    """
    row = _query_one(
        """
        SELECT ed.snapshot_bucket, ed.snapshot_key, ed.snapshot_anotado
          FROM alertas a
          JOIN eventos_deteccion ed ON ed.id = a.evento_id
         WHERE a.id = %s
        """,
        (alerta_id,),
    )
    if not row:
        raise HTTPException(status_code=404, detail="Alerta no encontrada")
    key = row.get("snapshot_key")
    if not key:
        raise HTTPException(status_code=404, detail="Esta alerta no tiene snapshot asociado")

    if modo == "bytes":
        data = storage.download_bytes(key)
        if data is None:
            raise HTTPException(status_code=502, detail="No se pudo descargar el snapshot de MinIO")
        return Response(content=data, media_type="image/jpeg")

    url = storage.presigned_url(key, expires=expires)
    if not url:
        raise HTTPException(status_code=502, detail="No se pudo generar la URL presignada")
    return RedirectResponse(url=url, status_code=302)


@app.get("/eventos/{evento_id}/snapshot", tags=["snapshots"])
def get_evento_snapshot(
    evento_id: int,
    modo: str = Query("redirect"),
    expires: int = Query(3600, ge=60, le=86400),
):
    """Lo mismo que /alertas/{id}/snapshot pero direccionando por evento."""
    row = _query_one(
        "SELECT snapshot_bucket, snapshot_key FROM eventos_deteccion WHERE id = %s",
        (evento_id,),
    )
    if not row:
        raise HTTPException(status_code=404, detail="Evento no encontrado")
    key = row.get("snapshot_key")
    if not key:
        raise HTTPException(status_code=404, detail="Este evento no tiene snapshot asociado")

    if modo == "bytes":
        data = storage.download_bytes(key)
        if data is None:
            raise HTTPException(status_code=502, detail="No se pudo descargar el snapshot")
        return Response(content=data, media_type="image/jpeg")

    url = storage.presigned_url(key, expires=expires)
    if not url:
        raise HTTPException(status_code=502, detail="No se pudo generar la URL presignada")
    return RedirectResponse(url=url, status_code=302)


# =============================================================================
# REALTIME PUSH (Server-Sent Events sobre Redis Pub/Sub)
# =============================================================================
# Endpoint que mantiene una conexión HTTP abierta y "empuja" mensajes al cliente
# a medida que el detector publica al canal 'alertas' de Redis.
#
# ¿Por qué SSE y no WebSocket?
#   - SSE es unidireccional (server → cliente), justo lo que necesitamos.
#   - El navegador trae `EventSource` nativo, sin librerías.
#   - Auto-reconexión gratis en el cliente.
#   - Funciona detrás de proxies HTTP normales (no necesita Upgrade).
#
# Formato SSE de cada evento:
#     event: alerta
#     data: {"camara":"...","nivel":"alto",...}
#     <linea en blanco>
#
# Probarlo desde la terminal:
#     curl -N http://localhost:8000/alertas/stream
#
# Probarlo desde JS:
#     const es = new EventSource("http://localhost:8000/alertas/stream");
#     es.addEventListener("alerta", e => console.log(JSON.parse(e.data)));

# Heartbeat cada N segundos para evitar que proxies cierren conexiones idle
SSE_HEARTBEAT_S = 15


async def _stream_alertas(request: Request) -> AsyncGenerator[bytes, None]:
    """Generator async: subscribe a Redis y yield mensajes en formato SSE."""
    # Import diferido: solo cargamos redis.asyncio cuando alguien usa el stream
    try:
        import redis.asyncio as aioredis
    except ImportError:
        yield b"event: error\ndata: {\"msg\":\"redis-py no instalado\"}\n\n"
        return

    # Conexión async dedicada (NO reusamos el cliente sync de redis_cache.py
    # porque mezcla bloqueante con event loop)
    client = aioredis.Redis(
        host=REDIS_HOST,
        port=REDIS_PORT,
        db=REDIS_DB,
        password=REDIS_PASSWORD,
        decode_responses=True,
        socket_connect_timeout=3,
    )
    pubsub = client.pubsub()

    try:
        await pubsub.subscribe(CHANNEL_ALERTAS)
        # Saludo inicial: confirma al cliente que está conectado
        hello = json.dumps({
            "msg": "conectado al canal de alertas",
            "canal": CHANNEL_ALERTAS,
            "ts": time.time(),
        })
        yield f"event: hello\ndata: {hello}\n\n".encode("utf-8")

        last_heartbeat = time.time()

        while True:
            # Si el cliente cerró la conexión, salimos limpio
            if await request.is_disconnected():
                log.info("[sse] Cliente desconectado del stream de alertas")
                break

            # Polling no bloqueante con timeout corto (1s) para chequear heartbeat
            msg = await pubsub.get_message(
                ignore_subscribe_messages=True,
                timeout=1.0,
            )

            if msg and msg.get("type") == "message":
                # `data` ya viene como str (decode_responses=True)
                data = msg.get("data", "")
                yield f"event: alerta\ndata: {data}\n\n".encode("utf-8")
                last_heartbeat = time.time()

            # Heartbeat para mantener la conexión viva (proxies, balanceadores)
            elif (time.time() - last_heartbeat) > SSE_HEARTBEAT_S:
                yield b": heartbeat\n\n"   # los `:` al inicio son comentario en SSE
                last_heartbeat = time.time()

    except asyncio.CancelledError:
        log.info("[sse] Stream cancelado")
        raise
    except Exception as e:
        log.error(f"[sse] Error en stream: {e}")
        err = json.dumps({"msg": str(e)[:200]})
        yield f"event: error\ndata: {err}\n\n".encode("utf-8")
    finally:
        try:
            await pubsub.unsubscribe(CHANNEL_ALERTAS)
            await pubsub.close()
            await client.close()
        except Exception:
            pass


# =============================================================================
# SSE: stream de DETECCIONES (bboxes YOLO frame-por-frame, ~5fps por camara)
# Mismo patron que alertas, distinto canal Redis. La estructura del payload:
#   { "camara": "...", "ts": 17..., "boxes": [{"id","label","conf","x","y","w","h"}] }
# =============================================================================
async def _stream_detecciones(request: Request) -> AsyncGenerator[bytes, None]:
    try:
        import redis.asyncio as aioredis
    except ImportError:
        yield b"event: error\ndata: {\"msg\":\"redis-py no instalado\"}\n\n"
        return

    client = aioredis.Redis(
        host=REDIS_HOST, port=REDIS_PORT, db=REDIS_DB,
        password=REDIS_PASSWORD, decode_responses=True,
        socket_connect_timeout=3,
    )
    pubsub = client.pubsub()

    try:
        await pubsub.subscribe(CHANNEL_DETECCIONES)
        hello = json.dumps({
            "msg": "conectado al canal de detecciones",
            "canal": CHANNEL_DETECCIONES,
            "ts": time.time(),
        })
        yield f"event: hello\ndata: {hello}\n\n".encode("utf-8")

        last_heartbeat = time.time()
        while True:
            if await request.is_disconnected():
                log.info("[sse] Cliente desconectado del stream de detecciones")
                break
            msg = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
            if msg and msg.get("type") == "message":
                data = msg.get("data", "")
                yield f"event: deteccion\ndata: {data}\n\n".encode("utf-8")
                last_heartbeat = time.time()
            elif (time.time() - last_heartbeat) > SSE_HEARTBEAT_S:
                yield b": heartbeat\n\n"
                last_heartbeat = time.time()
    except asyncio.CancelledError:
        raise
    except Exception as e:
        log.error(f"[sse] Error en stream detecciones: {e}")
        err = json.dumps({"msg": str(e)[:200]})
        yield f"event: error\ndata: {err}\n\n".encode("utf-8")
    finally:
        try:
            await pubsub.unsubscribe(CHANNEL_DETECCIONES)
            await pubsub.close()
            await client.close()
        except Exception:
            pass


@app.get("/detecciones/stream", tags=["realtime"])
async def detecciones_stream(request: Request):
    """SSE: empuja bboxes YOLO en tiempo real (~5fps por camara)."""
    if not cache.habilitado:
        raise HTTPException(status_code=503, detail="Redis deshabilitado")
    return StreamingResponse(
        _stream_detecciones(request),
        media_type="text/event-stream",
        headers={
            "Cache-Control":     "no-cache",
            "Connection":        "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/alertas/stream", tags=["realtime"])
async def alertas_stream(request: Request):
    """SSE: empuja cada alerta nueva al cliente en tiempo real."""
    if not cache.habilitado:
        raise HTTPException(
            status_code=503,
            detail="Redis deshabilitado por configuracion (CAMARAS_REDIS_HABILITADO=0)",
        )
    return StreamingResponse(
        _stream_alertas(request),
        media_type="text/event-stream",
        headers={
            "Cache-Control":     "no-cache",
            "Connection":        "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# =============================================================================
# ENTRYPOINT
# =============================================================================
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=True)
