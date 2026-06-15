"""
auth.py
========
Capa de autenticación: hashing de passwords (bcrypt) + JWT + dependencies
para proteger endpoints de FastAPI.

Variables de entorno (.env):
    CAMARAS_JWT_SECRET       = "cambialo-por-uno-largo-aleatorio"
    CAMARAS_JWT_ALG          = "HS256"        (default)
    CAMARAS_JWT_EXPIRE_MIN   = "1440"         (24 hs, default)

Uso:
    from auth import autenticar_usuario, crear_jwt, get_current_user, require_admin

    @app.post("/auth/login")
    def login(body: LoginIn):
        user = autenticar_usuario(body.email, body.password)
        if not user:
            raise HTTPException(401, "Credenciales inválidas")
        return {"access_token": crear_jwt(user)}

    @app.get("/usuarios", dependencies=[Depends(require_admin)])
    def list_users(): ...
"""
from __future__ import annotations

import os
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

# psycopg lo da el módulo db.py — lo importamos sin tocar nada acá
from db import db

log = logging.getLogger("camaras.auth")

# -----------------------------------------------------------------------------
# CONFIG
# -----------------------------------------------------------------------------
JWT_SECRET     = os.getenv("CAMARAS_JWT_SECRET", "dev-secret-cambialo-en-prod-por-uno-largo")
JWT_ALG        = os.getenv("CAMARAS_JWT_ALG", "HS256")
JWT_EXPIRE_MIN = int(os.getenv("CAMARAS_JWT_EXPIRE_MIN", "1440"))   # 24 hs


# -----------------------------------------------------------------------------
# PASSWORD HASHING (bcrypt directo, sin passlib)
# Se usa el paquete `bcrypt` (pip install bcrypt) en lugar de passlib porque
# passlib con bcrypt>=4.0 tiene un bug conocido (AttributeError __about__).
# bcrypt directo es más simple y robusto.
# Limite duro de bcrypt: 72 bytes en el password. Truncamos a propósito.
# -----------------------------------------------------------------------------
try:
    import bcrypt as _bcrypt
except ImportError:
    _bcrypt = None
    log.warning("[auth] bcrypt no instalado. pip install bcrypt")


def _to_bytes_72(password: str) -> bytes:
    """bcrypt soporta máximo 72 bytes. Trunca si es más largo (RFC compatible)."""
    return password.encode("utf-8")[:72]


def hash_password(password: str) -> str:
    if not _bcrypt:
        raise RuntimeError("bcrypt no instalado")
    salt   = _bcrypt.gensalt(rounds=12)
    hashed = _bcrypt.hashpw(_to_bytes_72(password), salt)
    return hashed.decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    if not _bcrypt or not password_hash:
        return False
    try:
        return _bcrypt.checkpw(_to_bytes_72(password), password_hash.encode("utf-8"))
    except Exception:
        return False


# -----------------------------------------------------------------------------
# JWT
# -----------------------------------------------------------------------------
try:
    from jose import jwt, JWTError
except ImportError:
    jwt = None
    JWTError = Exception
    log.warning("[auth] python-jose no instalado. pip install 'python-jose[cryptography]'")


def crear_jwt(user: dict) -> str:
    """
    Crea un token JWT con sub=user.id y claims básicos (email, rol).
    """
    if not jwt:
        raise RuntimeError("python-jose no instalado")
    now = datetime.now(timezone.utc)
    payload = {
        "sub":   str(user["id"]),
        "email": user["email"],
        "rol":   user.get("rol") or "visualizador",
        "iat":   int(now.timestamp()),
        "exp":   int((now + timedelta(minutes=JWT_EXPIRE_MIN)).timestamp()),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


def decodificar_jwt(token: str) -> dict:
    """Devuelve el payload o tira HTTPException 401."""
    if not jwt:
        raise HTTPException(500, "JWT support no instalado")
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token inválido: {e}",
            headers={"WWW-Authenticate": "Bearer"},
        )


# -----------------------------------------------------------------------------
# DB QUERIES (consultas a Postgres)
# -----------------------------------------------------------------------------

def _row_a_user_dict(row: dict) -> dict:
    """Estandariza la fila de DB al formato user que devolvemos al frontend."""
    if not row:
        return None
    return {
        "id":              str(row.get("id")),
        "email":           row.get("email"),
        "nombre_completo": row.get("nombre_completo"),
        "telefono":        row.get("telefono"),
        "activo":          bool(row.get("activo", True)),
        "rol":             row.get("rol") or row.get("rol_nombre"),
    }


def get_user_by_email(email: str) -> Optional[dict]:
    """Trae el usuario por email + su rol primario (si tiene varios, primero)."""
    with db._conn() as conn:
        row = conn.execute(
            """
            SELECT u.id, u.email, u.password_hash, u.nombre_completo, u.telefono,
                   u.activo, r.nombre AS rol
              FROM usuarios u
         LEFT JOIN usuarios_roles ur ON ur.usuario_id = u.id
         LEFT JOIN roles r          ON r.id = ur.rol_id
             WHERE u.email = %s
             LIMIT 1
            """,
            (email,),
        ).fetchone()
    return row


def get_user_by_id(user_id: str) -> Optional[dict]:
    with db._conn() as conn:
        row = conn.execute(
            """
            SELECT u.id, u.email, u.nombre_completo, u.telefono, u.activo,
                   r.nombre AS rol
              FROM usuarios u
         LEFT JOIN usuarios_roles ur ON ur.usuario_id = u.id
         LEFT JOIN roles r          ON r.id = ur.rol_id
             WHERE u.id = %s
             LIMIT 1
            """,
            (user_id,),
        ).fetchone()
    return row


def autenticar_usuario(email: str, password: str) -> Optional[dict]:
    """
    Valida email + password contra la DB. Si OK devuelve dict del usuario
    (con `id`, `email`, `rol`, etc.). Si falla, devuelve None.
    """
    row = get_user_by_email(email)
    if not row:
        return None
    if not row.get("activo"):
        return None
    if not verify_password(password, row.get("password_hash") or ""):
        return None

    # Actualizar ultimo_acceso_en
    try:
        with db._conn() as conn:
            conn.execute(
                "UPDATE usuarios SET ultimo_acceso_en = now() WHERE id = %s",
                (row["id"],),
            )
    except Exception:
        pass

    return _row_a_user_dict(row)


# -----------------------------------------------------------------------------
# FastAPI DEPENDENCIES
# -----------------------------------------------------------------------------
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)


def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    """
    Resuelve el usuario actual desde el Authorization: Bearer <token>.
    Tira 401 si no hay token / es inválido / el user fue desactivado.
    """
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Falta token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    payload = decodificar_jwt(token)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(401, "Token sin sub")

    row = get_user_by_id(user_id)
    if not row or not row.get("activo"):
        raise HTTPException(401, "Usuario inactivo o no existe")

    return _row_a_user_dict(row)


def require_admin(user: dict = Depends(get_current_user)) -> dict:
    """Como get_current_user pero exige rol admin."""
    if user.get("rol") != "admin":
        raise HTTPException(403, "Requiere rol admin")
    return user


def require_operator(user: dict = Depends(get_current_user)) -> dict:
    """Como get_current_user pero exige rol operador o admin."""
    if user.get("rol") not in ("admin", "operador"):
        raise HTTPException(403, "Requiere rol operador o admin")
    return user
