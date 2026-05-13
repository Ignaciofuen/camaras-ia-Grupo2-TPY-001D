-- =============================================================================
-- 007_grabaciones.sql
-- =============================================================================
-- Tabla para grabaciones manuales que el operador inicia desde el dashboard.
-- Las grabaciones se hacen client-side con MediaRecorder + captureStream y
-- al finalizar el browser sube el .webm al backend, que lo persiste en MinIO
-- (bucket camaras-ia-snapshots, prefijo recordings/YYYY/MM/DD/<camara>/).
--
-- Diferente a `eventos_deteccion`:
--   - eventos_deteccion: snapshots JPG generados por YOLO automaticamente
--   - grabaciones:       videos webm/mp4 disparados manualmente por el operador
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS grabaciones (
    id              SERIAL PRIMARY KEY,
    camara_id       UUID         NOT NULL REFERENCES camaras(id) ON DELETE CASCADE,
    creado_en       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    iniciada_en     TIMESTAMPTZ  NOT NULL,
    finalizada_en   TIMESTAMPTZ  NOT NULL,
    duracion_s      INTEGER      NOT NULL,
    storage_bucket  VARCHAR(120),
    storage_key     VARCHAR(400) NOT NULL,
    content_type    VARCHAR(60)  NOT NULL DEFAULT 'video/webm',
    tamano_bytes    BIGINT,
    nota            TEXT
);

CREATE INDEX IF NOT EXISTS idx_grabaciones_camara_creado
    ON grabaciones (camara_id, creado_en DESC);

CREATE INDEX IF NOT EXISTS idx_grabaciones_creado
    ON grabaciones (creado_en DESC);

COMMENT ON TABLE grabaciones IS
    'Grabaciones manuales disparadas por el operador desde el dashboard (CameraCard).';
COMMENT ON COLUMN grabaciones.storage_key IS
    'Key en MinIO. Convención: recordings/YYYY/MM/DD/<camara>/<uuid>.webm';

COMMIT;

-- Verificación rápida (correr después del COMMIT):
-- \d grabaciones
-- SELECT * FROM grabaciones;
