"""
telegram_worker.py · Worker de notificaciones Telegram
======================================================
Corre en loop independiente del detector. Su única responsabilidad es:
  1. Leer notificaciones con estado='pendiente' de la DB.
  2. Enviarlas vía Telegram Bot API.
  3. Marcarlas como 'enviada' o 'fallida'.

No comparte memoria con el detector → podés correrlo en otra máquina
(ej. en Oracle cuando migremos) siempre que tenga acceso a la DB.

Uso:
    python telegram_worker.py

Requisitos: requests (ya instalada por analizador.py).
"""

import time
import logging
import requests

# --- path setup: permite importar modulos hermanos (base_datos/, backend/, telegram/) ---
import os as _os, sys as _sys
_ROOT = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__)))
for _sub in ("base_datos", "backend", "telegram"):
    _p = _os.path.join(_ROOT, _sub)
    if _p not in _sys.path:
        _sys.path.insert(0, _p)
# --- end path setup ---

from db import db
from salud import reportar as reportar_salud  # [SALUD] heartbeat del worker

# -----------------------------------------------------------------------------
# CONFIG
# -----------------------------------------------------------------------------
INTERVALO_POLLING_SEG = 5      # cada cuánto consulta la DB
TIMEOUT_TELEGRAM_SEG  = 15     # timeout por request a Telegram
LIMITE_POR_CICLO      = 20     # máx notifs que procesa en cada vuelta

log = logging.getLogger("camaras.telegram")


# -----------------------------------------------------------------------------
# TELEGRAM API
# -----------------------------------------------------------------------------

def enviar_mensaje(token: str, chat_id: int, texto: str) -> int | None:
    """
    Envía un mensaje de texto plano al chat_id indicado.
    Devuelve el message_id de Telegram si anduvo.
    Lanza excepción si falla (la atrapa el loop principal).
    """
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    r = requests.post(
        url,
        json={"chat_id": chat_id, "text": texto, "disable_web_page_preview": True},
        timeout=TIMEOUT_TELEGRAM_SEG,
    )
    r.raise_for_status()
    data = r.json()
    if not data.get("ok"):
        raise RuntimeError(f"Telegram respondió ok=false: {data}")
    return data["result"]["message_id"]


def verificar_bot(token: str) -> dict:
    """Ping inicial al bot: confirma que el token es válido."""
    r = requests.get(f"https://api.telegram.org/bot{token}/getMe", timeout=10)
    r.raise_for_status()
    return r.json()["result"]


# -----------------------------------------------------------------------------
# LOOP PRINCIPAL
# -----------------------------------------------------------------------------

def procesar_pendientes(token: str) -> int:
    """Procesa 1 ciclo de notificaciones. Devuelve cuántas mandó."""
    pendientes = db.notificaciones_pendientes(limite=LIMITE_POR_CICLO)
    if not pendientes:
        return 0

    mandadas = 0
    for n in pendientes:
        notif_id = n["id"]
        chat_id  = int(n["chat_id"])
        texto    = n["mensaje"]

        try:
            tg_msg_id = enviar_mensaje(token, chat_id, texto)
            db.marcar_notificacion_enviada(notif_id, tg_msg_id)
            log.info(f"✅ Notif {notif_id} enviada (tg_msg={tg_msg_id})")
            mandadas += 1
        except Exception as e:
            err = str(e)[:200]
            db.marcar_notificacion_fallida(notif_id, err)
            log.error(f"❌ Notif {notif_id} falló: {err}")

    return mandadas


def main():
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
        datefmt="%H:%M:%S",
    )

    print("=" * 60)
    print(" Cámaras-IA · Telegram Worker")
    print("=" * 60)

    # 1. DB
    if not db.init():
        print("❌ No se pudo conectar a la DB. Revisá CAMARAS_DB_* en .env")
        return

    db.cargar_configuracion()
    token = db.config("TELEGRAM_BOT_TOKEN")
    if not token:
        print("❌ Falta TELEGRAM_BOT_TOKEN en configuracion_sistema")
        print("   Cargalo con un INSERT/UPDATE en la tabla configuracion_sistema.")
        return

    # 2. Telegram
    try:
        bot = verificar_bot(token)
        print(f"✅ Bot conectado: @{bot['username']} ({bot.get('first_name','')})")
    except Exception as e:
        print(f"❌ Token inválido o sin internet: {e}")
        return

    print(f"📡 Polling cada {INTERVALO_POLLING_SEG}s · Ctrl+C para salir\n")

    # [SALUD] Marcamos el arranque
    reportar_salud("telegram_worker", "online",
                   metrica={"bot": bot.get("username"), "polling_s": INTERVALO_POLLING_SEG})

    # 3. Loop
    try:
        enviadas_total = 0
        while True:
            ciclo_ok = True
            ciclo_ini = time.time()
            try:
                n = procesar_pendientes(token)
                enviadas_total += n
                if n > 0:
                    print(f"[{time.strftime('%H:%M:%S')}] {n} notificación(es) enviada(s)")
            except Exception as e:
                ciclo_ok = False
                log.error(f"Error en ciclo: {e}")
                reportar_salud("telegram_worker", "degradado",
                               error_msg=str(e)[:200])

            if ciclo_ok:
                reportar_salud(
                    "telegram_worker", "online",
                    latencia_ms=int((time.time() - ciclo_ini) * 1000),
                    metrica={"enviadas_total": enviadas_total},
                )
            time.sleep(INTERVALO_POLLING_SEG)
    except KeyboardInterrupt:
        print("\n🛑 Worker detenido por usuario")
        reportar_salud("telegram_worker", "offline", error_msg="detenido por usuario")
    finally:
        db.cerrar()


if __name__ == "__main__":
    main()
