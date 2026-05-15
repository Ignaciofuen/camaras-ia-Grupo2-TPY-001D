-- =============================================================================
-- 010_capturas_manuales.sql
-- =============================================================================
-- Soporte para capturas manuales (snapshots disparados desde el botón Snapshot
-- del CameraCard del frontend).
--
-- En lugar de crear una tabla nueva, extendemos `grabaciones` con una columna
-- `tipo` que distingue:
--   - 'video' (default, comportamiento anterior — grabación .webm)
--   - 'snapshot' (nuevo — JPG)
--
-- Asi las consultas, endpoints y UI son uniformes (mismo CRUD para los dos).
-- En el frontend se separan visualmente con tabs.
-- =============================================================================

BEGIN;

ALTER TABLE grabaciones
    ADD COLUMN IF NOT EXISTS tipo VARCHAR(20) NOT NULL DEFAULT 'video'
        CHECK (tipo IN ('video','snapshot'));

CREATE INDEX IF NOT EXISTS idx_grabaciones_tipo_creado
    ON grabaciones (tipo, creado_en DESC);

COMMENT ON COLUMN grabaciones.tipo IS
    'video = .webm/.mp4 (MediaRecorder), snapshot = JPG manual';

COMMIT;
