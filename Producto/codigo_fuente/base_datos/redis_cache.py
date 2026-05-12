"""
redis_cache.py · Capa de cache y pub/sub (Redis / Memurai)
==========================================================
Wrapper fino sobre redis-py con degradación graciosa: si Redis no está
arriba, cada método devuelve el `default` sin tirar excepción. El detector
y la API siguen funcionando normalmente — pierden features (cooldown,
cache, realtime) pero no se caen.

Casos de uso previstos:
  - Cooldown de alertas:   cooldown_activo / set_cooldown
  - Estado actual cámara:  set_estado_camara / get_estado_camara
  - Pub/Sub tiempo real:   publish_alerta (canal 'alertas')

Variables de entorno (.env):
    CAMARAS_REDIS_HOST        = "localhost"
    CAMARAS_REDIS_PORT        = "6379"
    CAMARAS_REDIS_DB          = "0"
    CAMARAS_REDIS_PASSWORD    = ""           (vacío si no tiene)
    CAMARAS_REDIS_HABILITADO  = "1"          ("0" apaga todo el cache)

Uso básico:
    from redis_cache import cache
    cache.init()

    if not cache.cooldown_activo("Camara_Sonoff", "persona"):
        cache.set_cooldown("Camara_Sonoff", "persona", ttl_s=30)
        disparar_alerta(...)
"""

from __future__ import annotations

import json
import logging
import os
import time
from pathlib import Path
from typing import Any, Optional

try:
    from dotenv import load_dotenv
    # Buscamos el .env en codigo_fuente/ (un nivel arriba), con fallback al lado del .py
    for _candidate in (Path(__file__).parent.parent / ".env", Path(__file__).parent / ".env"):
        if _candidate.exists():
            load_dotenv(_candidate)
            break
except ImportError:
    pass

# [SALUD] Reportes de heartbeat (no-op si salud.py no está disponible)
try:
    from salud import reportar as reportar_salud
except Exception:
    def reportar_salud(*args, **kwargs):
        pass

log = logging.getLogger("camaras.redis")

# -----------------------------------------------------------------------------
# CONFIG
# -----------------------------------------------------------------------------
REDIS_HOST       = os.getenv("CAMARAS_REDIS_HOST", "localhost")
REDIS_PORT       = int(os.getenv("CAMARAS_REDIS_PORT", "6379"))
REDIS_DB         = int(os.getenv("CAMARAS_REDIS_DB", "0"))
REDIS_PASSWORD   = os.getenv("CAMARAS_REDIS_PASSWORD", "") or None
REDIS_HABILITADO = os.getenv("CAMARAS_REDIS_HABILITADO", "1") != "0"

# TTLs por defecto (segundos). Se pueden override por llamada.
COOLDOWN_DEFAULT_S = int(os.getenv("CAMARAS_COOLDOWN_ALERTA_S", "60"))
ESTADO_CAMARA_TTL_S = int(os.getenv("CAMARAS_ESTADO_TTL_S", "300"))

# Prefijos de keys — convenio 'namespace:entidad:id'
PFX_COOLDOWN = "cd"        # cd:<camara>:<tipo>
PFX_ESTADO   = "estado"    # estado:<camara>
CHANNEL_ALERTAS     = "alertas"      # canal pub/sub - evento "alta" (resultado LLaVA)
CHANNEL_DETECCIONES = "detecciones"  # canal pub/sub - bboxes YOLO frame-por-frame


# -----------------------------------------------------------------------------
# DECORADOR: silencia errores (igual patrón que db.py y storage.py)
# -----------------------------------------------------------------------------

def _safe(default=None):
    def decorador(fn):
        def wrapper(self, *args, **kwargs):
            if not self.habilitado or self._client is None:
                return default
            try:
                return fn(self, *args, **kwargs)
            except Exception as e:
                log.warning(f"[redis.{fn.__name__}] error: {e}")
                # Reportamos degradado pero no spameamos heartbeats cada op
                self._ultimo_error = str(e)[:200]
                return default
        return wrapper
    return decorador


# -----------------------------------------------------------------------------
# CLASE PRINCIPAL
# -----------------------------------------------------------------------------

class Cache:
    """Wrapper sobre redis-py. Singleton: usar `cache` (instancia al final)."""

    def __init__(self):
        self._client = None
        self.habilitado = REDIS_HABILITADO
        self._ultimo_error: Optional[str] = None

    # ---------- ciclo de vida ----------

    def init(self) -> bool:
        """Abre cliente + ping. True si quedó listo."""
        if not self.habilitado:
            log.info("[redis] Deshabilitado (CAMARAS_REDIS_HABILITADO=0)")
            reportar_salud("redis", "offline", error_msg="deshabilitado por config")
            return False

        try:
            import redis
            ini = time.time()
            self._client = redis.Redis(
                host=REDIS_HOST,
                port=REDIS_PORT,
                db=REDIS_DB,
                password=REDIS_PASSWORD,
                socket_connect_timeout=3,
                socket_timeout=3,
                decode_responses=True,   # devuelve str, no bytes
            )
            self._client.ping()
            latencia = int((time.time() - ini) * 1000)
            log.info(f"[redis] Conectado a {REDIS_HOST}:{REDIS_PORT}/db{REDIS_DB} ({latencia}ms)")
            reportar_salud(
                "redis", "online",
                latencia_ms=latencia,
                metrica={"host": REDIS_HOST, "port": REDIS_PORT, "db": REDIS_DB},
            )
            return True
        except Exception as e:
            log.error(f"[redis] No se pudo conectar: {e}")
            reportar_salud("redis", "offline", error_msg=str(e)[:200])
            self._client = None
            return False

    def cerrar(self) -> None:
        if self._client is not None:
            try:
                self._client.close()
            except Exception:
                pass
            self._client = None
            log.info("[redis] Conexión cerrada")

    # ---------- helpers de keys ----------

    @staticmethod
    def _k_cooldown(camara: str, tipo: str) -> str:
        return f"{PFX_COOLDOWN}:{camara}:{tipo}"

    @staticmethod
    def _k_estado(camara: str) -> str:
        return f"{PFX_ESTADO}:{camara}"

    # ---------- cooldown de alertas ----------
    # Patrón: antes de disparar una alerta, verifico si hay cooldown activo.
    # Si no, seteo cooldown con TTL y disparo.

    @_safe(default=False)
    def cooldown_activo(self, camara: str, tipo: str = "persona") -> bool:
        """True si la clave existe (hay cooldown activo)."""
        return bool(self._client.exists(self._k_cooldown(camara, tipo)))

    @_safe(default=False)
    def set_cooldown(self, camara: str, tipo: str = "persona",
                     ttl_s: Optional[int] = None) -> bool:
        """Setea la clave con TTL. Devuelve True si la puso."""
        ttl = ttl_s if ttl_s is not None else COOLDOWN_DEFAULT_S
        self._client.setex(self._k_cooldown(camara, tipo), ttl, "1")
        return True

    @_safe(default=0)
    def cooldown_restante_s(self, camara: str, tipo: str = "persona") -> int:
        """Segundos que quedan de cooldown (0 si no hay)."""
        ttl = self._client.ttl(self._k_cooldown(camara, tipo))
        return max(0, ttl) if isinstance(ttl, int) else 0

    # ---------- estado actual por cámara ----------
    # Guardamos el último evento/frame como JSON con TTL corto.
    # La API puede leer esto en ms sin ir a Postgres.

    @_safe(default=False)
    def set_estado_camara(self, camara: str, estado: dict,
                          ttl_s: Optional[int] = None) -> bool:
        """Guarda dict con TTL (default 5 min)."""
        ttl = ttl_s if ttl_s is not None else ESTADO_CAMARA_TTL_S
        estado = {**estado, "cached_at": time.time()}
        self._client.setex(self._k_estado(camara), ttl, json.dumps(estado))
        return True

    @_safe(default=None)
    def get_estado_camara(self, camara: str) -> Optional[dict]:
        """Lee el dict guardado. None si no existe o expiró."""
        raw = self._client.get(self._k_estado(camara))
        if not raw:
            return None
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return None

    @_safe(default=[])
    def listar_estados_camaras(self) -> list[dict]:
        """Todos los estados vivos (para dashboard realtime)."""
        resultados = []
        for key in self._client.scan_iter(f"{PFX_ESTADO}:*"):
            raw = self._client.get(key)
            if raw:
                try:
                    d = json.loads(raw)
                    d["_camara"] = key.split(":", 1)[1]
                    resultados.append(d)
                except json.JSONDecodeError:
                    continue
        return resultados

    # ---------- pub/sub (preparación dashboard realtime) ----------

    @_safe(default=0)
    def publish_alerta(self, payload: dict) -> int:
        """Publica en canal 'alertas'. Devuelve nro de subscribers que recibieron."""
        return int(self._client.publish(CHANNEL_ALERTAS, json.dumps(payload)))

    # Throttle interno por cámara para detecciones (no saturar Redis)
    _last_pub_detecciones: dict = {}
    DETECCIONES_MIN_INTERVAL_S = 0.2  # max 5 fps por camara

    @_safe(default=0)
    def publish_detecciones(self, camara: str, boxes: list, force: bool = False) -> int:
        """
        Publica las bboxes de YOLO al canal 'detecciones' (frame-por-frame).
        Throttle: max 5 mensajes/seg por camara salvo que force=True.

        Estructura del payload:
          {
            "camara": "Camara_Sonoff",
            "ts": 1717..,
            "boxes": [
              {"id": 2, "label": "person", "conf": 0.87,
               "x": 0.12, "y": 0.34, "w": 0.20, "h": 0.55}   # normalizadas 0..1
            ]
          }
        """
        if not self.habilitado or self._client is None:
            return 0
        now = time.time()
        last = self._last_pub_detecciones.get(camara, 0)
        if not force and (now - last) < self.DETECCIONES_MIN_INTERVAL_S:
            return 0  # throttled, no publicar
        self._last_pub_detecciones[camara] = now
        payload = {"camara": camara, "ts": now, "boxes": boxes}
        return int(self._client.publish(CHANNEL_DETECCIONES, json.dumps(payload)))

    def subscribe_alertas(self):
        """
        Devuelve un PubSub listo para consumir.
        Uso:
            ps = cache.subscribe_alertas()
            for msg in ps.listen():
                if msg['type'] == 'message':
                    data = json.loads(msg['data'])
        """
        if not self.habilitado or self._client is None:
            return None
        ps = self._client.pubsub()
        ps.subscribe(CHANNEL_ALERTAS)
        return ps

    # ---------- utilidades genéricas ----------

    @_safe(default=None)
    def ping(self) -> Optional[bool]:
        return bool(self._client.ping())

    @_safe(default=None)
    def info(self) -> Optional[dict]:
        """Info del server Redis (para /health)."""
        data = self._client.info(section="server")
        return {
            "redis_version": data.get("redis_version"),
            "os": data.get("os"),
            "uptime_s": data.get("uptime_in_seconds"),
        }

    @_safe(default=False)
    def flush_cooldowns(self) -> bool:
        """Borra todos los cooldowns (útil para testing)."""
        for key in self._client.scan_iter(f"{PFX_COOLDOWN}:*"):
            self._client.delete(key)
        return True


# -----------------------------------------------------------------------------
# SINGLETON
# -----------------------------------------------------------------------------

cache = Cache()


# -----------------------------------------------------------------------------
# Modo CLI: test de conexión y operaciones básicas
# -----------------------------------------------------------------------------

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

    print("=" * 60)
    print(" Cámaras-IA · Test de conexión a Redis/Memurai")
    print("=" * 60)
    print(f" Host     : {REDIS_HOST}:{REDIS_PORT} (db={REDIS_DB})")
    print(f" Password : {'(ninguna)' if not REDIS_PASSWORD else '***'}")
    print("-" * 60)

    # Inicializamos la DB primero para que el heartbeat de salud quede grabado
    # (sino vemos el warning 'Pool no inicializado' y redis no aparece en salud.py).
    from db import db as _db
    if _db.init():
        print("[aux] Postgres conectado (para grabar heartbeat de redis).")
    else:
        print("[aux] Postgres NO conectado — el heartbeat no se va a registrar.")

    if not cache.init():
        print("No se pudo conectar. Revisá:")
        print("  1. Que Memurai/Redis esté corriendo (puerto 6379).")
        print("  2. Las variables CAMARAS_REDIS_* en .env.")
        raise SystemExit(1)

    info = cache.info()
    if info:
        print(f"Server: Redis {info['redis_version']} en {info['os']}")
        print(f"Uptime: {info['uptime_s']}s")
    print("-" * 60)

    # Test 1: cooldown
    print("\n[Test 1] Cooldown de alertas")
    cam = "TestCamara"
    print(f"  cooldown_activo ANTES: {cache.cooldown_activo(cam)}")
    cache.set_cooldown(cam, ttl_s=10)
    print(f"  cooldown_activo DESP.: {cache.cooldown_activo(cam)}")
    print(f"  restante: {cache.cooldown_restante_s(cam)}s")

    # Test 2: estado cámara
    print("\n[Test 2] Estado por cámara")
    cache.set_estado_camara(cam, {
        "personas": 2,
        "nivel": "medio",
        "descripcion": "test",
    }, ttl_s=30)
    estado = cache.get_estado_camara(cam)
    print(f"  get_estado_camara: {estado}")

    # Test 3: pub/sub (solo publicamos, no bloqueamos en subscribe)
    print("\n[Test 3] Publish a canal 'alertas'")
    n = cache.publish_alerta({"camara": cam, "nivel": "alto", "test": True})
    print(f"  subscribers que recibieron: {n}")

    # Test 4: pub/sub canal detecciones (bboxes YOLO)
    print("\n[Test 4] Publish a canal 'detecciones'")
    n = cache.publish_detecciones(cam, [
        {"id": 1, "label": "person", "conf": 0.92, "x": 0.1, "y": 0.1, "w": 0.3, "h": 0.5},
    ], force=True)
    print(f"  subscribers que recibieron: {n}")

    # Limpieza
    cache.flush_cooldowns()
    print("\nLimpieza OK — cooldowns borrados.")
    cache.cerrar()
    _db.cerrar()
