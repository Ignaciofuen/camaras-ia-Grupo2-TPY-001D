-- =============================================================================
-- Cámaras-IA · Migración 001: Tabla salud_servicios + vista v_salud_sistema
-- =============================================================================
-- Agrega heartbeats de servicios software (detector, yolo, llava, worker, api,
-- minio, postgres) sin tocar lo existente.
--
-- Aplicar con:
--   psql -U postgres -d camaras_ia -f migrations/001_salud_servicios.sql
--
-- Es idempotente (IF NOT EXISTS / CREATE OR REPLACE) — se puede correr 2 veces.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- TABLA: salud_servicios
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS salud_servicios (
    id            BIGSERIAL PRIMARY KEY,
    servicio      VARCHAR(40) NOT NULL
                  CHECK (servicio IN ('detector','yolo','llava','telegram_worker','api','minio','postgres')),
    estado        VARCHAR(20) NOT NULL
                  CHECK (estado IN ('online','degradado','offline')),
    latencia_ms   INTEGER,
    metrica       JSONB,
    error_msg     TEXT,
    verificado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_salud_servicio_tiempo
    ON salud_servicios(servicio, verificado_en DESC);

COMMENT ON TABLE salud_servicios IS
    'Heartbeats de componentes software. Complementa salud_camaras (hardware).';
COMMENT ON COLUMN salud_servicios.metrica IS
    'Datos variables por servicio: {"fps":8.2} yolo, {"cola":3} llava, {"pendientes":5} worker, etc.';

-- -----------------------------------------------------------------------------
-- VISTA: v_salud_sistema (cámaras + servicios en un solo select)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_salud_sistema AS
SELECT
    'camara'::VARCHAR          AS tipo,
    c.nombre                   AS componente,
    c.estado_salud             AS estado,
    c.ultima_conexion_en       AS visto_en,
    NULL::INTEGER              AS latencia_ms,
    NULL::JSONB                AS metrica,
    NULL::TEXT                 AS error_msg,
    EXTRACT(EPOCH FROM (now() - c.ultima_conexion_en))::INT AS segundos_sin_reporte
FROM camaras c
WHERE c.activa
UNION ALL
SELECT
    'servicio'::VARCHAR        AS tipo,
    s.servicio                 AS componente,
    s.estado                   AS estado,
    s.verificado_en            AS visto_en,
    s.latencia_ms,
    s.metrica,
    s.error_msg,
    EXTRACT(EPOCH FROM (now() - s.verificado_en))::INT AS segundos_sin_reporte
FROM (
    SELECT DISTINCT ON (servicio)
        servicio, estado, verificado_en, latencia_ms, metrica, error_msg
    FROM salud_servicios
    ORDER BY servicio, verificado_en DESC
) s;

COMMIT;

-- -----------------------------------------------------------------------------
-- Verificación rápida (correr después del COMMIT para confirmar que quedó OK)
-- -----------------------------------------------------------------------------
-- \d salud_servicios
-- \d+ v_salud_sistema
-- SELECT * FROM v_salud_sistema;   -- sin filas de servicio todavía, solo cámaras
