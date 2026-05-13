"""
limpiar_capturas.py
====================
Borra TODAS las capturas (snapshots JPG) del bucket MinIO.
Útil cuando querés empezar limpio.

Uso:
    cd Producto\codigo_fuente
    python bats\limpiar_capturas.py

NOTA: este script SOLO borra el objeto en MinIO. La DB hay que limpiarla
aparte con:
    TRUNCATE TABLE eventos_deteccion RESTART IDENTITY CASCADE;
"""
from __future__ import annotations

import os
import sys

# Permitir importar base_datos.storage desde acá
_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

from base_datos.storage import storage, MINIO_BUCKET


def borrar_prefijo(prefix: str) -> int:
    """Borra todos los objetos del bucket que empiezan con `prefix`."""
    if not storage.init():
        print("[ERROR] No se pudo conectar a MinIO. Revisá .env.")
        return 0

    print(f"[*] Buscando objetos con prefijo '{prefix}/' en {MINIO_BUCKET}...")

    # Listar paginando (S3 corta en 1000 por respuesta)
    paginator = storage._client.get_paginator('list_objects_v2')
    total = 0
    for page in paginator.paginate(Bucket=MINIO_BUCKET, Prefix=prefix):
        objs = page.get('Contents', [])
        if not objs:
            continue
        # delete_objects acepta hasta 1000 por batch
        delete_req = {'Objects': [{'Key': o['Key']} for o in objs]}
        storage._client.delete_objects(Bucket=MINIO_BUCKET, Delete=delete_req)
        total += len(objs)
        print(f"    borrados {len(objs)} (total acumulado: {total})")

    print(f"[OK] {total} objetos borrados con prefijo '{prefix}/'")
    return total


if __name__ == "__main__":
    # Por default limpia solo 'snapshots/'. Pasá 'recordings' como argv[1]
    # si querés limpiar las grabaciones también.
    prefijo = sys.argv[1] if len(sys.argv) > 1 else "snapshots"

    print("=" * 60)
    print(f" Limpieza MinIO · prefijo '{prefijo}/' · bucket {MINIO_BUCKET}")
    print("=" * 60)

    confirmacion = input(f"\n⚠ ¿Confirmás borrar TODO en '{prefijo}/'? (escribir SI): ").strip()
    if confirmacion != "SI":
        print("Cancelado.")
        sys.exit(0)

    total = borrar_prefijo(prefijo)
    print(f"\nListo. {total} archivos borrados.")
    print("\nRecordá limpiar también la DB:")
    if prefijo == "snapshots":
        print("    TRUNCATE TABLE eventos_deteccion RESTART IDENTITY CASCADE;")
    elif prefijo == "recordings":
        print("    TRUNCATE TABLE grabaciones RESTART IDENTITY;")
