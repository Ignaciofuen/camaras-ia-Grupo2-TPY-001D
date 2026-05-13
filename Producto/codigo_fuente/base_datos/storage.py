"""
storage.py · Capa de almacenamiento de objetos (MinIO/S3)
=========================================================
Abstrae el cliente S3 para subir/bajar snapshots y clips a MinIO local.
Es compatible con AWS S3 puro — el día de mañana cambiás MINIO_ENDPOINT
por s3.amazonaws.com y funciona igual.

Variables de entorno (.env):
    CAMARAS_MINIO_ENDPOINT       = "http://localhost:9000"
    CAMARAS_MINIO_ACCESS_KEY     = "minioadmin"
    CAMARAS_MINIO_SECRET_KEY     = "minioadmin"
    CAMARAS_MINIO_BUCKET         = "camaras-ia-snapshots"
    CAMARAS_MINIO_REGION         = "us-east-1"        (default)
    CAMARAS_MINIO_HABILITADO     = "1"                ("0" apaga el upload)

Uso básico:
    from storage import storage
    key = storage.upload_snapshot(frame_bgr, camara_nombre="Camara_Sonoff")
    url = storage.presigned_url(key, expires=3600)   # URL temporal para <img src=...>
"""

from __future__ import annotations

import io
import logging
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

try:
    from dotenv import load_dotenv
    # Buscamos el .env en codigo_fuente/ (un nivel arriba), con fallback al lado del .py
    for _candidate in (Path(__file__).parent.parent / ".env", Path(__file__).parent / ".env"):
        if _candidate.exists():
            load_dotenv(_candidate)
            break
except ImportError:
    pass

log = logging.getLogger("camaras.storage")

# -----------------------------------------------------------------------------
# CONFIG
# -----------------------------------------------------------------------------
MINIO_ENDPOINT   = os.getenv("CAMARAS_MINIO_ENDPOINT",   "http://localhost:9000")
MINIO_ACCESS_KEY = os.getenv("CAMARAS_MINIO_ACCESS_KEY", "minioadmin")
MINIO_SECRET_KEY = os.getenv("CAMARAS_MINIO_SECRET_KEY", "minioadmin")
MINIO_BUCKET     = os.getenv("CAMARAS_MINIO_BUCKET",     "camaras-ia-snapshots")
MINIO_REGION     = os.getenv("CAMARAS_MINIO_REGION",     "us-east-1")
MINIO_HABILITADO = os.getenv("CAMARAS_MINIO_HABILITADO", "1") != "0"

JPEG_QUALITY_SNAPSHOT = int(os.getenv("CAMARAS_SNAPSHOT_JPEG_QUALITY", "85"))


# -----------------------------------------------------------------------------
# DECORADOR: silencia errores (graceful degradation, igual que db.py)
# -----------------------------------------------------------------------------

def _safe(default=None):
    def decorador(fn):
        def wrapper(self, *args, **kwargs):
            if not self.habilitado:
                return default
            try:
                return fn(self, *args, **kwargs)
            except Exception as e:
                log.warning(f"[storage.{fn.__name__}] error: {e}")
                return default
        return wrapper
    return decorador


# -----------------------------------------------------------------------------
# CLASE PRINCIPAL
# -----------------------------------------------------------------------------

class Storage:
    """Wrapper sobre boto3 para MinIO/S3 compatible."""

    def __init__(self):
        self._client = None
        self.habilitado = MINIO_HABILITADO

    # ---------- ciclo de vida ----------

    def init(self) -> bool:
        """Abre cliente + crea el bucket si no existe. True si quedó listo."""
        if not self.habilitado:
            log.info("[storage] Deshabilitado (CAMARAS_MINIO_HABILITADO=0)")
            return False

        try:
            import boto3
            from botocore.client import Config
            from botocore.exceptions import ClientError

            self._client = boto3.client(
                "s3",
                endpoint_url=MINIO_ENDPOINT,
                aws_access_key_id=MINIO_ACCESS_KEY,
                aws_secret_access_key=MINIO_SECRET_KEY,
                config=Config(signature_version="s3v4"),
                region_name=MINIO_REGION,
            )

            # Crear bucket si no existe.
            # MinIO devuelve 404 / NoSuchBucket cuando el bucket no existe,
            # PERO algunas versiones (especialmente cuando hay policies) devuelven
            # 403 Forbidden / AccessDenied. En ese caso, intentamos crearlo igual
            # y si ya existia, el create_bucket tira BucketAlreadyOwnedByYou que
            # capturamos como exito.
            try:
                self._client.head_bucket(Bucket=MINIO_BUCKET)
            except ClientError as e:
                code = e.response.get("Error", {}).get("Code", "")
                http_status = e.response.get("ResponseMetadata", {}).get("HTTPStatusCode")
                if code in ("404", "NoSuchBucket", "NotFound") or http_status in (403, 404):
                    try:
                        self._client.create_bucket(Bucket=MINIO_BUCKET)
                        log.info(f"[storage] Bucket creado: {MINIO_BUCKET}")
                    except ClientError as ce:
                        cc = ce.response.get("Error", {}).get("Code", "")
                        if cc in ("BucketAlreadyOwnedByYou", "BucketAlreadyExists"):
                            log.info(f"[storage] Bucket ya existia: {MINIO_BUCKET}")
                        else:
                            raise
                else:
                    raise

            log.info(f"[storage] Conectado a {MINIO_ENDPOINT} (bucket={MINIO_BUCKET})")
            return True
        except Exception as e:
            log.error(f"[storage] No se pudo conectar: {e}")
            self._client = None
            self.habilitado = False
            return False

    # ---------- helpers ----------

    @staticmethod
    def _fecha_prefix(ts: Optional[datetime] = None) -> str:
        """Devuelve 'YYYY/MM/DD' para organizar los objetos por fecha."""
        ts = ts or datetime.now(timezone.utc)
        return ts.strftime("%Y/%m/%d")

    @staticmethod
    def _encode_jpg(frame_bgr, quality: int = JPEG_QUALITY_SNAPSHOT) -> bytes:
        """Convierte un frame de OpenCV (BGR) a bytes JPG."""
        import cv2
        ok, buf = cv2.imencode(".jpg", frame_bgr, [cv2.IMWRITE_JPEG_QUALITY, quality])
        if not ok:
            raise RuntimeError("cv2.imencode devolvió False")
        return buf.tobytes()

    # ---------- operaciones de alto nivel ----------

    @_safe(default=None)
    def upload_snapshot(
        self,
        frame_bgr,
        camara_nombre: str = "desconocida",
        anotado: bool = True,
        quality: Optional[int] = None,
    ) -> Optional[str]:
        """
        Sube el frame como JPG y devuelve la `key` guardable en la DB.
        Formato de key: snapshots/YYYY/MM/DD/<camara>/<uuid>.jpg
        """
        q = quality if quality is not None else JPEG_QUALITY_SNAPSHOT
        data = self._encode_jpg(frame_bgr, quality=q)
        now = datetime.now(timezone.utc)
        key = f"snapshots/{self._fecha_prefix(now)}/{camara_nombre}/{uuid.uuid4()}.jpg"

        self._client.put_object(
            Bucket=MINIO_BUCKET,
            Key=key,
            Body=data,
            ContentType="image/jpeg",
            Metadata={
                "camara": camara_nombre,
                "anotado": str(anotado).lower(),
                "capturado_en": now.isoformat(),
            },
        )
        log.debug(f"[storage] Snapshot subido: {key} ({len(data)/1024:.1f} KB)")
        return key

    @_safe(default=None)
    def presigned_url(self, key: str, expires: int = 3600) -> Optional[str]:
        """URL temporal firmada para que el frontend pueda abrir la imagen."""
        return self._client.generate_presigned_url(
            "get_object",
            Params={"Bucket": MINIO_BUCKET, "Key": key},
            ExpiresIn=expires,
        )

    @_safe(default=None)
    def download_bytes(self, key: str) -> Optional[bytes]:
        """Baja el objeto completo (útil para servir desde FastAPI sin presigned)."""
        resp = self._client.get_object(Bucket=MINIO_BUCKET, Key=key)
        return resp["Body"].read()

    @_safe(default=False)
    def delete(self, key: str) -> bool:
        self._client.delete_object(Bucket=MINIO_BUCKET, Key=key)
        return True

    @_safe(default=None)
    def upload_recording(
        self,
        data: bytes,
        camara_nombre: str = "desconocida",
        content_type: str = "video/webm",
        ext: str = "webm",
    ) -> Optional[str]:
        """
        Sube un blob de video (webm/mp4) y devuelve la `key` de MinIO.
        Formato de key: recordings/YYYY/MM/DD/<camara>/<uuid>.<ext>
        """
        now = datetime.now(timezone.utc)
        key = f"recordings/{self._fecha_prefix(now)}/{camara_nombre}/{uuid.uuid4()}.{ext}"
        self._client.put_object(
            Bucket=MINIO_BUCKET,
            Key=key,
            Body=data,
            ContentType=content_type,
            Metadata={
                "camara": camara_nombre,
                "capturado_en": now.isoformat(),
            },
        )
        log.debug(f"[storage] Recording subido: {key} ({len(data)/1024/1024:.2f} MB)")
        return key


# -----------------------------------------------------------------------------
# SINGLETON
# -----------------------------------------------------------------------------

storage = Storage()


# -----------------------------------------------------------------------------
# Modo CLI: probar conexión y subir un JPG dummy
# -----------------------------------------------------------------------------

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

    print("=" * 60)
    print(" Cámaras-IA · Test de conexión a MinIO")
    print("=" * 60)
    print(f" Endpoint  : {MINIO_ENDPOINT}")
    print(f" Bucket    : {MINIO_BUCKET}")
    print(f" AccessKey : {MINIO_ACCESS_KEY}")
    print("-" * 60)

    if not storage.init():
        print("No se pudo conectar. Revisá:")
        print("  1. Que MinIO esté corriendo (minio.exe).")
        print("  2. Las variables CAMARAS_MINIO_* en .env.")
        raise SystemExit(1)

    print("Conexion OK")

    # Test: subir un JPG dummy (imagen negra 320x240) y generar presigned URL
    try:
        import numpy as np
        dummy = np.zeros((240, 320, 3), dtype=np.uint8)
        key = storage.upload_snapshot(dummy, camara_nombre="test", anotado=False)
        print(f"Subido: {key}")
        url = storage.presigned_url(key, expires=300)
        print(f"Presigned URL (5 min): {url}")
    except Exception as e:
        print(f"Test upload falló: {e}")
