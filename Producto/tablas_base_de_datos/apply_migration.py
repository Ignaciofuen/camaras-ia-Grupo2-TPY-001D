"""
apply_migration.py · Aplica un archivo .sql sobre la base Postgres local.
=========================================================================
Uso:
    python apply_migration.py migrations/001_salud_servicios.sql

Lee las credenciales del mismo .env que usa db.py (CAMARAS_DB_*).
Reusable para futuras migraciones — cada una debe ser idempotente
(IF NOT EXISTS / CREATE OR REPLACE) para que se pueda correr 2 veces.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

# Cargar .env de codigo_fuente (ahí viven CAMARAS_DB_*)
try:
    from dotenv import load_dotenv
    _env = Path(__file__).resolve().parent.parent / "codigo_fuente" / ".env"
    if _env.exists():
        load_dotenv(_env)
        print(f"[env] Cargado {_env}")
    else:
        print(f"[env] .env no encontrado en {_env}", file=sys.stderr)
except ImportError:
    print("[env] python-dotenv no instalado, leyendo solo os.environ", file=sys.stderr)

DB_HOST     = os.getenv("CAMARAS_DB_HOST",     "localhost")
DB_PORT     = int(os.getenv("CAMARAS_DB_PORT", "5432"))
DB_NAME     = os.getenv("CAMARAS_DB_NAME",     "camaras_ia")
DB_USER     = os.getenv("CAMARAS_DB_USER",     "postgres")
DB_PASSWORD = os.getenv("CAMARAS_DB_PASSWORD", "")


def main():
    if len(sys.argv) < 2:
        print("Uso: python apply_migration.py <ruta_al_sql>", file=sys.stderr)
        sys.exit(1)

    sql_path = Path(sys.argv[1])
    if not sql_path.exists():
        print(f"ERROR: no existe {sql_path}", file=sys.stderr)
        sys.exit(1)

    sql = sql_path.read_text(encoding="utf-8")
    print(f"[sql] Leído {sql_path.name} ({len(sql)} chars)")

    import psycopg

    dsn = f"host={DB_HOST} port={DB_PORT} dbname={DB_NAME} user={DB_USER} password={DB_PASSWORD}"
    print(f"[db] Conectando a {DB_USER}@{DB_HOST}:{DB_PORT}/{DB_NAME} ...")

    with psycopg.connect(dsn) as conn:
        with conn.cursor() as cur:
            cur.execute(sql)
        conn.commit()

    print("[ok] Migración aplicada")

    # Verificación
    with psycopg.connect(dsn) as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT table_name FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name LIKE 'salud_%'
                ORDER BY table_name
            """)
            tablas = [r[0] for r in cur.fetchall()]
            print(f"[verif] Tablas salud_*: {tablas}")

            cur.execute("""
                SELECT table_name FROM information_schema.views
                WHERE table_schema = 'public' AND table_name LIKE 'v_salud%'
                ORDER BY table_name
            """)
            vistas = [r[0] for r in cur.fetchall()]
            print(f"[verif] Vistas v_salud*: {vistas}")


if __name__ == "__main__":
    main()
