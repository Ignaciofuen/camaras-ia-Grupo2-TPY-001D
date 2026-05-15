"""
db.py · Capa de persistencia de Cámaras-IA
==========================================
Módulo único que centraliza toda la comunicación con PostgreSQL.

Ideas clave:
  - Pool de conexiones (reusa sockets, evita abrir/cerrar por cada insert).
  - Todas las funciones son THREAD-SAFE (el detector corre varios hilos).
  - Si la DB falla, NO tira el proceso: solo loggea. El detector debe seguir
    vigilando aunque Postgres se caiga (degradación graceful).
  - Flag GUARDAR_EN_DB: permite apagar la persistencia con una variable
    de entorno, útil mientras desarrollás cámaras sin tener Postgres arriba.

Dependencia:  pip install "psycopg[binary,pool]>=3.1"

Uso mínimo desde detector.py:

    from db import db

    db.init()  # una sola vez al arrancar

    # cuando YOLO detecta algo:
    evento_id = db.guardar_evento(camara_id, capturado_en, cantidad_personas, latencia_ms)
    db.guardar_detecciones(evento_id, bboxes)  # lista de dicts

    # cuando se dispara alerta nueva:
    alerta_id, numero = db.crear_alerta(evento_id, camara_id, id_rastreo, titulo)

    # cuando LLaVA termina:
    analisis_id = db.guardar_analisis(evento_id, resultado_dict)
    db.vincular_analisis_alerta(alerta_id, analisis_id)

    # para Telegram:
    db.encolar_notificacion(alerta_id, chat_id, mensaje)
"""

from __future__ import annotations

import os
import json
import logging
import threading
from contextlib import contextmanager
from datetime import datetime
from typing import Any, Iterable

try:
    import psycopg
    from psycopg.rows import dict_row
    from psycopg_pool import ConnectionPool
except ImportError as e:
    raise ImportError(
        'Falta instalar psycopg: pip install "psycopg[binary,pool]>=3.1"'
    ) from e

# Carga automática de .env si está disponible (opcional pero recomendado)
try:
    from dotenv import load_dotenv
    # Busca el .env en codigo_fuente/ (un nivel arriba de base_datos/),
    # con fallback a la misma carpeta del .py.
    _here = os.path.dirname(os.path.abspath(__file__))
    for _candidate in (os.path.join(_here, "..", ".env"), os.path.join(_here, ".env")):
        if os.path.isfile(_candidate):
            load_dotenv(_candidate)
            break
except ImportError:
    pass  # python-dotenv no instalado, se ignora


# -----------------------------------------------------------------------------
# CONFIGURACIÓN (lee de variables de entorno con defaults razonables)
# -----------------------------------------------------------------------------

DB_HOST     = os.getenv("CAMARAS_DB_HOST", "localhost")
DB_PORT     = int(os.getenv("CAMARAS_DB_PORT", "5432"))
DB_NAME     = os.getenv("CAMARAS_DB_NAME", "camaras_ia")
DB_USER     = os.getenv("CAMARAS_DB_USER", "postgres")
DB_PASSWORD = os.getenv("CAMARAS_DB_PASSWORD", "")

# Apagá persistencia sin tocar código: set CAMARAS_GUARDAR_EN_DB=0
GUARDAR_EN_DB = os.getenv("CAMARAS_GUARDAR_EN_DB", "1") != "0"

POOL_MIN = int(os.getenv("CAMARAS_DB_POOL_MIN", "1"))
POOL_MAX = int(os.getenv("CAMARAS_DB_POOL_MAX", "5"))

log = logging.getLogger("camaras.db")


# -----------------------------------------------------------------------------
# DECORADOR: silencia errores de DB para no matar al detector
# -----------------------------------------------------------------------------

def _safe(default=None):
    """Si la función falla (o DB apagada), loggea y devuelve `default`."""
    def decorador(fn):
        def wrapper(self, *args, **kwargs):
            if not GUARDAR_EN_DB:
                return default
            try:
                return fn(self, *args, **kwargs)
            except Exception as e:
                log.warning(f"[db.{fn.__name__}] error: {e}")
                return default
        return wrapper
    return decorador


# -----------------------------------------------------------------------------
# CLASE PRINCIPAL
# -----------------------------------------------------------------------------

class DB:
    """Wrapper sobre el pool de conexiones con métodos de alto nivel."""

    def __init__(self):
        self._pool: ConnectionPool | None = None
        self._lock = threading.Lock()
        self._cache_config: dict[str, Any] = {}

    # ---------- ciclo de vida ----------

    def init(self) -> bool:
        """Abre el pool. Devuelve True si quedó listo, False si falló."""
        if not GUARDAR_EN_DB:
            log.info("[db] Persistencia DESACTIVADA (CAMARAS_GUARDAR_EN_DB=0)")
            return False

        dsn = (
            f"host={DB_HOST} port={DB_PORT} dbname={DB_NAME} "
            f"user={DB_USER} password={DB_PASSWORD}"
        )
        try:
            self._pool = ConnectionPool(
                conninfo=dsn, min_size=POOL_MIN, max_size=POOL_MAX,
                kwargs={"row_factory": dict_row},
                open=True,
            )
            # ping
            with self._pool.connection() as conn:
                conn.execute("SELECT 1")
            log.info(f"[db] Conectado a {DB_NAME}@{DB_HOST}:{DB_PORT}")
            return True
        except Exception as e:
            log.error(f"[db] No se pudo conectar: {e}")
            self._pool = None
            return False

    def cerrar(self) -> None:
        if self._pool:
            self._pool.close()
            self._pool = None

    @contextmanager
    def _conn(self):
        if not self._pool:
            raise RuntimeError("Pool no inicializado. Llamá a db.init() primero.")
        with self._pool.connection() as conn:
            yield conn

    # =========================================================================
    # CONFIGURACIÓN DEL SISTEMA
    # =========================================================================

    @_safe(default={})
    def cargar_configuracion(self) -> dict[str, Any]:
        """Lee toda la tabla configuracion_sistema y la cachea en memoria."""
        with self._conn() as conn:
            rows = conn.execute("SELECT clave, valor FROM configuracion_sistema").fetchall()
        self._cache_config = {r["clave"]: r["valor"] for r in rows}
        return self._cache_config

    def config(self, clave: str, default=None):
        """Accede a un valor cacheado (llamar cargar_configuracion() al inicio)."""
        return self._cache_config.get(clave, default)

    # =========================================================================
    # CÁMARAS
    # =========================================================================

    @_safe(default=[])
    def camaras_activas(self) -> list[dict]:
        """Devuelve todas las cámaras activas con su config."""
        with self._conn() as conn:
            return conn.execute(
                """
                SELECT id, nombre, direccion_mac::text AS direccion_mac,
                       host(ip_actual)   AS ip_actual,
                       host(ip_respaldo) AS ip_respaldo,
                       usuario_rtsp, password_rtsp,  -- [MIGRATION 008] pass editable desde UI
                       puerto_rtsp, ruta_rtsp,
                       modo_analisis, confianza_visual, confianza_alerta,
                       procesar_cada_n_frames, duracion_alerta_seg, frames_ausencia,
                       contexto_zona, activa,
                       mediamtx_path  -- [MEDIAMTX] habilita modo proxy en detector.py
                FROM camaras
                WHERE activa = TRUE
                ORDER BY nombre
                """
            ).fetchall()

    @_safe()
    def actualizar_ip_camara(self, camara_id: str, ip: str) -> None:
        """Guarda la IP recién descubierta por ARP."""
        with self._conn() as conn:
            conn.execute(
                """
                UPDATE camaras
                   SET ip_actual = %s::inet, ip_actualizada_en = now()
                 WHERE id = %s
                """,
                (ip, camara_id),
            )

    @_safe()
    def actualizar_salud_camara(
        self, camara_id: str, estado: str,
        latencia_ms: int | None = None, fps: float | None = None,
        error_msg: str | None = None,
    ) -> None:
        """Updatea cámaras.estado_salud + inserta log en salud_camaras."""
        with self._conn() as conn, conn.transaction():
            conn.execute(
                """
                UPDATE camaras
                   SET estado_salud = %s,
                       ultima_conexion_en = CASE WHEN %s = 'online' THEN now() ELSE ultima_conexion_en END
                 WHERE id = %s
                """,
                (estado, estado, camara_id),
            )
            conn.execute(
                """
                INSERT INTO salud_camaras (camara_id, estado, latencia_ms, fps_observado, error_msg)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (camara_id, estado, latencia_ms, fps, error_msg),
            )

    # =========================================================================
    # PIPELINE DE DETECCIÓN
    # =========================================================================

    @_safe()
    def guardar_evento(
        self,
        camara_id: str,
        capturado_en: datetime,
        cantidad_personas: int,
        latencia_yolo_ms: int | None = None,
        frame_width: int | None = None,
        frame_height: int | None = None,
        modelo_yolo: str = "yolov8n",
        snapshot_key: str | None = None,
        snapshot_anotado: bool = False,
    ) -> int | None:
        """
        Inserta un evento_deteccion y devuelve su id (bigint).
        Llamá a esto solo cuando YOLO detectó >=1 persona.
        """
        with self._conn() as conn:
            row = conn.execute(
                """
                INSERT INTO eventos_deteccion
                    (camara_id, capturado_en, cantidad_personas, latencia_yolo_ms,
                     frame_width, frame_height, modelo_yolo,
                     snapshot_key, snapshot_anotado, estado)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 'pendiente')
                RETURNING id
                """,
                (camara_id, capturado_en, cantidad_personas, latencia_yolo_ms,
                 frame_width, frame_height, modelo_yolo,
                 snapshot_key, snapshot_anotado),
            ).fetchone()
        return row["id"] if row else None

    @_safe()
    def guardar_detecciones(self, evento_id: int, bboxes: Iterable[dict]) -> None:
        """
        Guarda N bounding boxes asociados al evento.
        Cada bbox es un dict: {confianza, bbox_x, bbox_y, bbox_w, bbox_h,
                              id_rastreo?, clase_nombre?, clase_id?, en_zona_id?}
        Todos los bbox_* están normalizados 0-1.
        """
        filas = [
            (
                evento_id,
                b.get("clase_nombre", "person"),
                b.get("clase_id", 0),
                b["confianza"],
                b["bbox_x"], b["bbox_y"], b["bbox_w"], b["bbox_h"],
                b.get("id_rastreo"),
                b.get("en_zona_id"),
            )
            for b in bboxes
        ]
        if not filas:
            return
        with self._conn() as conn:
            conn.cursor().executemany(
                """
                INSERT INTO detecciones
                    (evento_id, clase_nombre, clase_id, confianza,
                     bbox_x, bbox_y, bbox_w, bbox_h, id_rastreo, en_zona_id)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                filas,
            )

    @_safe()
    def guardar_analisis(self, evento_id: int, resultado: dict) -> int | None:
        """
        Guarda el veredicto de LLaVA (output de analizar_frame).
        `resultado` = dict tal cual lo devuelve analizador.py.
        Hace UPSERT por si se reprocesa el mismo evento.
        """
        with self._conn() as conn:
            row = conn.execute(
                """
                INSERT INTO analisis_escena
                    (evento_id, modelo, contexto_zona,
                     sospechoso, nivel, descripcion, personas, acciones,
                     tiempo_analisis_s, estado, error_msg, respuesta_cruda)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb)
                ON CONFLICT (evento_id) DO UPDATE SET
                    sospechoso        = EXCLUDED.sospechoso,
                    nivel             = EXCLUDED.nivel,
                    descripcion       = EXCLUDED.descripcion,
                    personas          = EXCLUDED.personas,
                    acciones          = EXCLUDED.acciones,
                    tiempo_analisis_s = EXCLUDED.tiempo_analisis_s,
                    estado            = EXCLUDED.estado,
                    error_msg         = EXCLUDED.error_msg,
                    respuesta_cruda   = EXCLUDED.respuesta_cruda
                RETURNING id
                """,
                (
                    evento_id,
                    resultado.get("modelo", "llava"),
                    resultado.get("zona"),
                    bool(resultado.get("sospechoso", False)),
                    str(resultado.get("nivel", "bajo")).lower(),
                    resultado.get("descripcion"),
                    int(resultado.get("personas", 0)),
                    resultado.get("acciones"),
                    float(resultado.get("tiempo_analisis", 0) or 0),
                    resultado.get("estado", "ok"),
                    resultado.get("error_msg"),
                    json.dumps(resultado),
                ),
            ).fetchone()
            # Marcamos el evento como analizado
            conn.execute(
                "UPDATE eventos_deteccion SET estado = 'analizado' WHERE id = %s",
                (evento_id,),
            )
        return row["id"] if row else None

    # =========================================================================
    # ALERTAS
    # =========================================================================

    @_safe()
    def crear_alerta(
        self,
        evento_id: int,
        camara_id: str,
        id_rastreo: int | None,
        titulo: str,
        severidad: str = "alta",
        mensaje: str | None = None,
    ) -> tuple[str, int] | None:
        """
        Crea una alerta ABIERTA (analisis_id inicialmente NULL).
        Devuelve (alerta_uuid, numero_alerta).
        """
        with self._conn() as conn:
            row = conn.execute(
                """
                INSERT INTO alertas
                    (evento_id, camara_id, id_rastreo, titulo, mensaje, severidad)
                VALUES (%s, %s, %s, %s, %s, %s)
                RETURNING id::text, numero_alerta
                """,
                (evento_id, camara_id, id_rastreo, titulo, mensaje, severidad),
            ).fetchone()
        return (row["id"], row["numero_alerta"]) if row else None

    @_safe()
    def vincular_analisis_alerta(self, alerta_id: str, analisis_id: int) -> None:
        """Cuando LLaVA termina, actualiza la alerta con su analisis_id."""
        with self._conn() as conn:
            conn.execute(
                "UPDATE alertas SET analisis_id = %s WHERE id = %s",
                (analisis_id, alerta_id),
            )

    @_safe(default=None)
    def guardar_grabacion(
        self,
        camara_id: str,
        iniciada_en,
        finalizada_en,
        duracion_s: int,
        storage_key: str,
        content_type: str = "video/webm",
        tamano_bytes: int | None = None,
        storage_bucket: str | None = None,
        nota: str | None = None,
        tipo: str = "video",
    ) -> int | None:
        """Inserta una fila en `grabaciones` y devuelve el id."""
        with self._conn() as conn:
            row = conn.execute(
                """
                INSERT INTO grabaciones
                    (camara_id, iniciada_en, finalizada_en, duracion_s,
                     storage_bucket, storage_key, content_type, tamano_bytes, nota, tipo)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
                """,
                (camara_id, iniciada_en, finalizada_en, duracion_s,
                 storage_bucket, storage_key, content_type, tamano_bytes, nota, tipo),
            ).fetchone()
        return row["id"] if row else None

    @_safe()
    def reconocer_alerta(self, alerta_id: str, usuario_id: str, nota: str | None = None) -> None:
        with self._conn() as conn:
            conn.execute(
                """
                UPDATE alertas
                   SET estado = 'reconocida',
                       reconocida_en = now(),
                       reconocida_por = %s,
                       nota_resolucion = COALESCE(%s, nota_resolucion)
                 WHERE id = %s
                """,
                (usuario_id, nota, alerta_id),
            )

    # =========================================================================
    # SALUD DE SERVICIOS (heartbeats de IA + backend)
    # =========================================================================

    @_safe()
    def reportar_salud_servicio(
        self,
        servicio: str,
        estado: str,
        latencia_ms: int | None = None,
        metrica: dict | None = None,
        error_msg: str | None = None,
    ) -> None:
        """
        Inserta un heartbeat en salud_servicios.
        servicio: 'detector' | 'yolo' | 'llava' | 'telegram_worker' | 'api' | 'minio' | 'postgres'
        estado:   'online' | 'degradado' | 'offline'
        """
        with self._conn() as conn:
            conn.execute(
                """
                INSERT INTO salud_servicios
                    (servicio, estado, latencia_ms, metrica, error_msg)
                VALUES (%s, %s, %s, %s::jsonb, %s)
                """,
                (
                    servicio, estado, latencia_ms,
                    json.dumps(metrica) if metrica else None,
                    error_msg,
                ),
            )

    @_safe(default=[])
    def salud_sistema(self) -> list[dict]:
        """Lee la vista v_salud_sistema (cámaras + servicios, último estado)."""
        with self._conn() as conn:
            return conn.execute("SELECT * FROM v_salud_sistema").fetchall()

    # =========================================================================
    # NOTIFICACIONES (Telegram)
    # =========================================================================

    @_safe()
    def encolar_notificacion(self, alerta_id: str, chat_id: int, mensaje: str) -> int | None:
        """
        Inserta una notificación en estado 'pendiente'.
        Un worker aparte (o el bot) la tomará y la enviará.
        """
        with self._conn() as conn:
            row = conn.execute(
                """
                INSERT INTO notificaciones (alerta_id, chat_id, mensaje, estado)
                VALUES (%s, %s, %s, 'pendiente')
                RETURNING id
                """,
                (alerta_id, chat_id, mensaje),
            ).fetchone()
        return row["id"] if row else None

    @_safe(default=[])
    def notificaciones_pendientes(self, limite: int = 20) -> list[dict]:
        with self._conn() as conn:
            return conn.execute(
                """
                SELECT id, alerta_id::text AS alerta_id, chat_id, mensaje, intentos
                FROM notificaciones
                WHERE estado = 'pendiente'
                ORDER BY creado_en
                LIMIT %s
                """,
                (limite,),
            ).fetchall()

    @_safe()
    def marcar_notificacion_enviada(self, notif_id: int, telegram_message_id: int | None) -> None:
        with self._conn() as conn:
            conn.execute(
                """
                UPDATE notificaciones
                   SET estado = 'enviada',
                       enviada_en = now(),
                       telegram_message_id = %s,
                       intentos = intentos + 1
                 WHERE id = %s
                """,
                (telegram_message_id, notif_id),
            )

    @_safe()
    def marcar_notificacion_fallida(self, notif_id: int, error: str) -> None:
        with self._conn() as conn:
            conn.execute(
                """
                UPDATE notificaciones
                   SET estado = 'fallida',
                       ultimo_error = %s,
                       intentos = intentos + 1
                 WHERE id = %s
                """,
                (error, notif_id),
            )


# -----------------------------------------------------------------------------
# SINGLETON: en todo el proyecto usamos la misma instancia
# -----------------------------------------------------------------------------

db = DB()


# -----------------------------------------------------------------------------
# Modo CLI: probar conexión y listar cámaras
# -----------------------------------------------------------------------------

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

    print("=" * 60)
    print(f" Cámaras-IA · Test de conexión a PostgreSQL")
    print("=" * 60)
    print(f" Host     : {DB_HOST}:{DB_PORT}")
    print(f" Database : {DB_NAME}")
    print(f" User     : {DB_USER}")
    print(f" Enabled  : {GUARDAR_EN_DB}")
    print("-" * 60)

    if not db.init():
        print("❌ No se pudo conectar. Revisá las variables CAMARAS_DB_*")
        raise SystemExit(1)

    print("✅ Conexión OK\n")

    config = db.cargar_configuracion()
    print(f"📋 Config cargada: {len(config)} claves")
    for k in list(config)[:5]:
        print(f"   - {k} = {config[k]}")

    camaras = db.camaras_activas()
    print(f"\n📷 Cámaras activas: {len(camaras)}")
    for c in camaras:
        print(f"   - {c['nombre']:20} mac={c['direccion_mac']}  modo={c['modo_analisis']}")

    db.cerrar()
    print("\n✅ Test completo")
