"""
discover_camera_ips.py
======================
Descubre la IP actual de cada camara via ARP scan, actualiza
`camaras.ip_actual` en Postgres y escribe un JSON con las URLs
RTSP completas (con password desde el .env) para que el .ps1
arme el mediamtx.runtime.yml.

Lo invoca `bats\start-mediamtx.bat` ANTES de arrancar MediaMTX.

Uso:
    python discover_camera_ips.py [--out path\al\json]

Salida (JSON):
{
  "Camara_Principal": {
    "mediamtx_path": "cam_principal",
    "rtsp_url": "rtsp://admin:123456@192.168.1.10:554/live/ch0",
    "ip_actual": "192.168.1.10",
    "fuente_ip": "arp"      // o "respaldo" si no la encontro
  },
  "Camara_Sonoff": { ... }
}
"""
from __future__ import annotations

# --- path setup: importar modulos del proyecto ---
import os, sys
_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
for _sub in ("base_datos", "backend"):
    _p = os.path.join(_ROOT, _sub)
    if _p not in sys.path:
        sys.path.insert(0, _p)
# --- end path setup ---

import argparse
import json
import re
import socket
import subprocess
import time

from db import db


def detectar_base_ip() -> str:
    """
    Detecta la base /24 de la red local actual (el adaptador con conectividad
    saliente). Ej: si la PC esta en 192.168.43.100, devuelve '192.168.43'.

    Truco: socket.connect() a una IP externa por UDP NO envía nada, pero
    Windows/Linux asignan el adaptador correcto y getsockname() devuelve
    la IP local de ese adaptador. Robusto a redes nuevas, hotspots, etc.

    Si falla por algún motivo, cae a 192.168.1 (la convención de tu casa).
    """
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))   # no manda paquetes (UDP sin send)
        local_ip = s.getsockname()[0]
        s.close()
        partes = local_ip.split(".")
        if len(partes) == 4:
            return ".".join(partes[:3])
    except Exception:
        pass
    return "192.168.1"


# Passwords RTSP fallback (por MAC). Se usan SOLO si en la DB la columna
# `camaras.password_rtsp` está vacía (NULL/''). Cuando la migration 008 ya
# se aplicó, las passes deberían venir de la DB y editarse desde el frontend.
CAMERA_PASSWORDS_FALLBACK = {
    "08:ea:40:54:9b:f5": os.getenv("CAMARA_PRINCIPAL_PASS", "123456"),
    "68:b9:d3:5c:cc:fc": os.getenv("CAMARA_SONOFF_PASS",    "Camaras2026"),
}


def despertar_red(base_ip: str = "192.168.1") -> None:
    """Pinguea broadcast + IPs comunes para refrescar la tabla ARP."""
    print("[*] Pulso de red para despertar dispositivos...")
    # Broadcast (a veces las camaras solo responden a esto)
    subprocess.run(
        ["ping", "-n", "1", "-w", "200", f"{base_ip}.255"],
        capture_output=True, timeout=2,
    )
    # Pings paralelos a /24
    procs = []
    for i in range(1, 255):
        p = subprocess.Popen(
            ["ping", "-n", "1", "-w", "150", f"{base_ip}.{i}"],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )
        procs.append(p)
    # Dar tiempo a que terminen, pero sin bloquearnos demasiado
    deadline = time.time() + 4
    for p in procs:
        timeout = max(0.05, deadline - time.time())
        try:
            p.wait(timeout=timeout)
        except subprocess.TimeoutExpired:
            p.kill()


def leer_tabla_arp() -> dict:
    """Devuelve {mac_normalizada: ip} desde `arp -a`."""
    out = subprocess.run(
        ["arp", "-a"], capture_output=True, text=True, timeout=5
    ).stdout
    mapa = {}
    # Formato Windows:  "  192.168.1.2          08-ea-40-54-9b-f5     dynamic"
    pat = re.compile(r"\s+(\d+\.\d+\.\d+\.\d+)\s+([0-9a-fA-F\-:]{17})")
    for line in out.splitlines():
        m = pat.match(line)
        if m:
            ip  = m.group(1)
            mac = m.group(2).lower().replace("-", ":")
            mapa[mac] = ip
    return mapa


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=os.path.join(os.environ.get("TEMP", "."),
                                                  "camaras_ips_descubiertas.json"))
    ap.add_argument("--no-arp-scan", action="store_true",
                    help="Saltea el pulso de red (mas rapido si las IPs ya estan en cache ARP)")
    args = ap.parse_args()

    # 1) Conectar a Postgres
    if not db.init():
        print("[ERROR] No se pudo conectar a Postgres. Verifica .env y que el servicio este arriba.")
        return 1

    # 2) Leer config de las camaras
    try:
        camaras = db.camaras_activas()
    except Exception as e:
        print(f"[ERROR] No se pudo leer la tabla camaras: {e}")
        return 1

    if not camaras:
        print("[WARN] La tabla `camaras` esta vacia o todas estan desactivadas.")
        return 0

    print(f"[*] {len(camaras)} camaras activas en la DB")

    # 3) Despertar la red (detectando la base IP automaticamente segun el
    #    adaptador actual: wifi de casa, hotspot del celular, VPN, etc.)
    base_ip = detectar_base_ip()
    print(f"[*] Red detectada: {base_ip}.X")
    if not args.no_arp_scan:
        despertar_red(base_ip)

    # 4) Leer ARP
    arp = leer_tabla_arp()
    print(f"[*] {len(arp)} entradas en la tabla ARP")

    # 5) Resolver IP de cada camara y armar JSON de salida
    resultado = {}
    for c in camaras:
        nombre   = c["nombre"]
        mac      = c["direccion_mac"].lower()
        ip_resp  = c["ip_respaldo"]
        usuario  = c["usuario_rtsp"] or ""
        puerto   = c.get("puerto_rtsp") or 554
        ruta     = c["ruta_rtsp"]
        mtx_path = c.get("mediamtx_path") or ""
        # [MIGRATION 008] Pass desde DB. Si está vacía, fallback al .env.
        password = c.get("password_rtsp") or CAMERA_PASSWORDS_FALLBACK.get(mac, "")

        if mac in arp:
            ip = arp[mac]
            fuente = "arp"
            print(f"  [OK]  {nombre}: MAC={mac} -> IP={ip} (descubierta por ARP)")
            # Persistir la IP nueva en DB
            try:
                db.actualizar_ip_camara(c["id"], ip)
                db.actualizar_salud_camara(c["id"], estado="online")
            except Exception as e:
                print(f"        [WARN] No se pudo actualizar la DB: {e}")
        else:
            ip = ip_resp
            fuente = "respaldo"
            print(f"  [WARN] {nombre}: no encontrada en ARP. Usando IP de respaldo {ip}")

        rtsp_url = f"rtsp://{usuario}:{password}@{ip}:{puerto}/{ruta}"

        # placeholder_path = el path del yml donde esta el `rtsp://placeholder/X`
        # a reemplazar. mediamtx_path = el path que consume el cliente.
        # Normalmente son iguales (cam_principal == cam_principal). Pero si
        # estamos usando un transcode (cam_principal_lite con FFmpeg), el
        # placeholder vive en el path base (cam_principal) y el cliente
        # consume el `_lite` que MediaMTX arma con FFmpeg.
        placeholder_path = mtx_path
        if placeholder_path.endswith("_lite"):
            placeholder_path = placeholder_path[:-len("_lite")]

        resultado[nombre] = {
            "mediamtx_path":    mtx_path,           # lo que consume el cliente
            "placeholder_path": placeholder_path,   # el path con `rtsp://placeholder/...`
            "rtsp_url":         rtsp_url,
            "ip_actual":        ip,
            "fuente_ip":        fuente,
        }

    # 6) Escribir JSON
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(resultado, f, indent=2, ensure_ascii=False)
    print(f"[OK] JSON escrito en {args.out}")

    db.cerrar()
    return 0


if __name__ == "__main__":
    sys.exit(main())
