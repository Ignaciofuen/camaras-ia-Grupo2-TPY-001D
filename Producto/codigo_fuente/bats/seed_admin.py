"""
seed_admin.py
=============
Crea el usuario admin inicial en la DB. Lo corrés UNA vez antes de usar
el sistema con auth. Después podés crear más usuarios desde el frontend.

Uso:
    cd Producto\codigo_fuente
    python bats\seed_admin.py

Te pide email y password por consola.
"""
from __future__ import annotations

import os, sys, getpass

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
for _sub in ("base_datos", "backend"):
    _p = os.path.join(_ROOT, _sub)
    if _p not in sys.path:
        sys.path.insert(0, _p)

from db import db
from auth import hash_password, get_user_by_email


def crear_admin(email: str, password: str, nombre: str | None = None) -> str:
    """Inserta el usuario y le asigna rol admin. Devuelve el UUID."""
    if get_user_by_email(email):
        raise SystemExit(f"[ERROR] Ya existe un usuario con email '{email}'.")

    pw_hash = hash_password(password)
    with db._conn() as conn:
        row = conn.execute(
            """
            INSERT INTO usuarios (email, password_hash, nombre_completo, activo)
            VALUES (%s, %s, %s, TRUE)
            RETURNING id
            """,
            (email, pw_hash, nombre or "Administrador"),
        ).fetchone()
        user_id = row["id"]

        rol = conn.execute("SELECT id FROM roles WHERE nombre = 'admin'").fetchone()
        if not rol:
            raise SystemExit("[ERROR] La tabla roles no tiene 'admin'. Ejecutá schema.sql primero.")

        conn.execute(
            "INSERT INTO usuarios_roles (usuario_id, rol_id) VALUES (%s, %s)",
            (user_id, rol["id"]),
        )

    return str(user_id)


if __name__ == "__main__":
    print("=" * 60)
    print(" Camaras-IA · seed_admin")
    print("=" * 60)

    if not db.init():
        raise SystemExit("[ERROR] No se pudo conectar a Postgres.")

    email = input("Email del admin: ").strip()
    if not email or "@" not in email:
        raise SystemExit("[ERROR] Email inválido.")

    pw1 = getpass.getpass("Contraseña: ")
    pw2 = getpass.getpass("Repetir:    ")
    if pw1 != pw2:
        raise SystemExit("[ERROR] Las contraseñas no coinciden.")
    if len(pw1) < 6:
        raise SystemExit("[ERROR] Mínimo 6 caracteres.")

    nombre = input("Nombre completo (opcional): ").strip() or None

    user_id = crear_admin(email, pw1, nombre)
    print(f"\n[OK] Admin creado con id={user_id}")
    print(f"     Email: {email}")
    print(f"     Rol:   admin")
    print(f"\nAhora podés entrar al frontend con esas credenciales.")
