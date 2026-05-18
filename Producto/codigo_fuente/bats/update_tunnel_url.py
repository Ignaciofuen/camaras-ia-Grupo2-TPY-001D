"""
update_tunnel_url.py
====================
Extrae la URL dinámica de Cloudflare desde el archivo de log 
y la actualiza en PostgreSQL en la nube de Oracle.
"""
from __future__ import annotations
import os, sys, argparse, re, time, json

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
for _sub in ("base_datos", "backend"):
    _p = os.path.join(_ROOT, _sub)
    if _p not in sys.path:
        sys.path.insert(0, _p)

from db import db

def extraer_url_cloudflare(
    log_path: str,
    max_intentos: int = 20,
    espera_s: float = 1.0,
) -> str | None:
    """
    Lee el log de cloudflared y devuelve la URL publica de TryCloudflare.

    - Si el archivo todavia no existe (cloudflared aun arrancando), espera
      hasta `max_intentos * espera_s` segundos a que aparezca.
    - Una vez que existe, lo polea con la misma cadencia hasta encontrar
      la URL en el contenido (o agotar intentos).

    En total: ~20 segundos de tolerancia, suficiente para redes lentas
    (universidades, datos moviles, etc.).
    """
    patron = re.compile(r"https://[a-zA-Z0-9\-]+\.trycloudflare\.com")

    # 1) Esperar a que el archivo exista.
    for _ in range(max_intentos):
        if os.path.exists(log_path):
            break
        time.sleep(espera_s)
    else:
        print(f"[WARN] El log {log_path} nunca aparecio.")
        return None

    # 2) Polear el contenido hasta encontrar la URL.
    for _ in range(max_intentos):
        try:
            # errors="ignore": cloudflared puede estar escribiendo bytes
            # raros mid-read; preferimos seguir intentando antes que crashear.
            with open(log_path, "r", encoding="utf-8", errors="ignore") as f:
                contenido = f.read()
            m = patron.search(contenido)
            if m:
                return m.group(0)
        except Exception:
            # El archivo puede estar bloqueado por cloudflared en este
            # instante; ignoramos y reintentamos en el proximo ciclo.
            pass
        time.sleep(espera_s)

    return None

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--log", required=True)
    args = ap.parse_args()

    url_tunnel = extraer_url_cloudflare(args.log)
    if not url_tunnel:
        print("[ERROR] No se halló la URL en el log de Cloudflare.")
        return 1

    print(f"[OK] URL Encontrada: {url_tunnel}")

    if not db.init():
        print("[ERROR] No se pudo conectar a Postgres.")
        return 1

    try:
        with db._conn() as conn:
            # NOTA: la columna `valor` en tu DB existente es JSON/JSONB
            # (el CREATE TABLE de abajo es solo un fallback con IF NOT EXISTS,
            # no se aplica si la tabla ya existe). Por eso envolvemos la URL
            # en json.dumps -> guarda el string primitive JSON '"https://..."'.
            # api.py lo lee y psycopg lo entrega ya desempacado como Python str.
            conn.execute("""
                CREATE TABLE IF NOT EXISTS configuracion_sistema (
                    clave VARCHAR(100) PRIMARY KEY,
                    valor JSONB,
                    descripcion TEXT,
                    creado_en TIMESTAMP DEFAULT now(),
                    actualizado_en TIMESTAMP DEFAULT now()
                );
            """)

            # Envolvemos la URL en JSON valido (string primitive con comillas).
            url_json = json.dumps(url_tunnel)

            conn.execute("""
                INSERT INTO configuracion_sistema (clave, valor, descripcion, actualizado_en)
                VALUES ('MEDIAMTX_HLS_DYNAMIC', %s::jsonb, 'URL publica dinamica del tunel de Cloudflare', now())
                ON CONFLICT (clave) DO UPDATE
                SET valor = EXCLUDED.valor, actualizado_en = now();
            """, (url_json,))
        print("[OK] Base de datos actualizada con éxito.")
    except Exception as e:
        print(f"[ERROR] Falló el UPDATE en Postgres: {e}")
        return 1
    finally:
        db.cerrar()
    return 0

if __name__ == "__main__":
    sys.exit(main())