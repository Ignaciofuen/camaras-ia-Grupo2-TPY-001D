"""
salud.py · Heartbeats de servicios (Cámaras-IA)
================================================
Observabilidad del backend: detector, yolo, llava, telegram_worker, api,
minio, postgres. Cada componente reporta cada N segundos "estoy vivo"
y opcionalmente deja métricas (fps, cola, pendientes, etc.).

El resultado vive en la tabla `salud_servicios` y se lee vía la vista
`v_salud_sistema` (junto con `camaras.estado_salud`).

Uso básico (1 línea):

    from salud import reportar
    reportar('yolo', 'online', latencia_ms=45, metrica={'fps': 8.2})

Uso con heartbeat automático en background:

    from salud import Heartbeat
    hb = Heartbeat('detector', intervalo_s=30,
                   callback_metrica=lambda: {'fps': fps_actual})
    hb.start()
    # ... app corre ...
    hb.stop()   # al cerrar

El heartbeat es thread-safe (daemon thread). Si la DB se cae, el
decorador @_safe en db.py silencia el error; el servicio sigue vivo.
"""

from __future__ import annotations

# --- path setup: permite importar modulos hermanos (base_datos/, backend/, telegram/) ---
import os as _os, sys as _sys
_ROOT = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__)))
for _sub in ("base_datos", "backend", "telegram"):
    _p = _os.path.join(_ROOT, _sub)
    if _p not in _sys.path:
        _sys.path.insert(0, _p)
# --- end path setup ---

import logging
import threading
import time
from typing import Callable, Optional

from db import db

log = logging.getLogger("camaras.salud")

# Componentes válidos (deben matchear el CHECK de la tabla)
SERVICIOS_VALIDOS = {
    "detector", "yolo", "llava",
    "telegram_worker", "api",
    "minio", "postgres", "redis",
}
ESTADOS_VALIDOS = {"online", "degradado", "offline"}


# -----------------------------------------------------------------------------
# API pública: función one-shot
# -----------------------------------------------------------------------------

def reportar(
    servicio: str,
    estado: str = "online",
    latencia_ms: Optional[int] = None,
    metrica: Optional[dict] = None,
    error_msg: Optional[str] = None,
) -> None:
    """
    Graba un heartbeat inmediato. Silencioso si la DB está apagada/caída.
    """
    if servicio not in SERVICIOS_VALIDOS:
        log.warning(f"[salud] servicio desconocido: {servicio}")
        return
    if estado not in ESTADOS_VALIDOS:
        log.warning(f"[salud] estado desconocido: {estado}")
        return

    db.reportar_salud_servicio(
        servicio=servicio,
        estado=estado,
        latencia_ms=latencia_ms,
        metrica=metrica,
        error_msg=error_msg,
    )


# -----------------------------------------------------------------------------
# Heartbeat periódico (daemon thread)
# -----------------------------------------------------------------------------

class Heartbeat:
    """
    Corre un thread daemon que cada `intervalo_s` llama a reportar().
    El callback_metrica (opcional) devuelve un dict con datos variables.

    Ejemplo:
        contador = {'frames': 0}
        hb = Heartbeat(
            'detector',
            intervalo_s=30,
            callback_metrica=lambda: {'frames_procesados': contador['frames']},
        )
        hb.start()
    """

    def __init__(
        self,
        servicio: str,
        intervalo_s: int = 30,
        callback_metrica: Optional[Callable[[], dict]] = None,
    ):
        if servicio not in SERVICIOS_VALIDOS:
            raise ValueError(f"servicio desconocido: {servicio}")
        self.servicio = servicio
        self.intervalo_s = intervalo_s
        self.callback_metrica = callback_metrica
        self._stop_event = threading.Event()
        self._thread: Optional[threading.Thread] = None

    def _loop(self):
        # Reporte inmediato al arrancar
        self._tick()
        while not self._stop_event.wait(self.intervalo_s):
            self._tick()

    def _tick(self):
        try:
            metrica = self.callback_metrica() if self.callback_metrica else None
            reportar(self.servicio, "online", metrica=metrica)
        except Exception as e:
            # Si el callback explota, reportamos degradado con el mensaje
            try:
                reportar(self.servicio, "degradado", error_msg=str(e))
            except Exception:
                pass
            log.warning(f"[salud] heartbeat {self.servicio} falló: {e}")

    def start(self) -> "Heartbeat":
        if self._thread and self._thread.is_alive():
            return self
        self._stop_event.clear()
        self._thread = threading.Thread(
            target=self._loop,
            name=f"heartbeat-{self.servicio}",
            daemon=True,
        )
        self._thread.start()
        log.info(f"[salud] heartbeat '{self.servicio}' arrancado (cada {self.intervalo_s}s)")
        return self

    def stop(self, reporte_final_offline: bool = True) -> None:
        self._stop_event.set()
        if self._thread:
            self._thread.join(timeout=2)
        if reporte_final_offline:
            try:
                reportar(self.servicio, "offline")
            except Exception:
                pass
        log.info(f"[salud] heartbeat '{self.servicio}' detenido")


# -----------------------------------------------------------------------------
# CLI: imprimir estado actual del sistema
# -----------------------------------------------------------------------------

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

    print("=" * 70)
    print(" Cámaras-IA · Estado del sistema (v_salud_sistema)")
    print("=" * 70)

    if not db.init():
        print("No se pudo conectar a Postgres.")
        raise SystemExit(1)

    filas = db.salud_sistema()
    if not filas:
        print("(vacío) — todavía no hay heartbeats ni camaras activas.")
    else:
        print(f"{'TIPO':<10} {'COMPONENTE':<22} {'ESTADO':<12} {'HACE':<10}  MÉTRICA")
        print("-" * 80)
        for f in filas:
            edad = f.get("segundos_sin_reporte")
            edad_txt = f"{edad}s" if edad is not None else "—"
            print(
                f"{f['tipo']:<10} {f['componente'] or '—':<22} "
                f"{f['estado'] or 'desconocido':<12} {edad_txt:<10}  "
                f"{f.get('metrica') or ''}"
            )
    db.cerrar()
