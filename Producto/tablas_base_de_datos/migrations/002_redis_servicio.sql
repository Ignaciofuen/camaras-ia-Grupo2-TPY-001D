-- =========================================================================
-- Migracion 002: agregar 'redis' a los servicios validos de salud_servicios
-- =========================================================================
-- Postgres no tiene "ALTER CHECK CONSTRAINT", asi que toca
-- droppear y re-crearlo. Es seguro: no toca datos, solo la regla.
-- =========================================================================

BEGIN;

ALTER TABLE salud_servicios DROP CONSTRAINT IF EXISTS salud_servicios_servicio_check;

ALTER TABLE salud_servicios
    ADD CONSTRAINT salud_servicios_servicio_check
    CHECK (servicio IN ('detector','yolo','llava','telegram_worker','api','minio','postgres','redis'));

COMMIT;

-- Verificacion rapida (opcional, no falla si no corre):
-- SELECT conname, pg_get_constraintdef(oid)
--   FROM pg_constraint
--  WHERE conrelid = 'salud_servicios'::regclass
--    AND contype = 'c';
