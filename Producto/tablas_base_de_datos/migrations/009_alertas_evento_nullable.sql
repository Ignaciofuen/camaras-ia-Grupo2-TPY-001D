-- =============================================================================
-- 009_alertas_evento_nullable.sql
-- =============================================================================
-- Permite que una alerta exista sin un evento_deteccion asociado.
-- Caso de uso: el operador borra una captura desde /historial pero quiere
-- conservar la alerta visible en /alertas. Sin esta migration el ON DELETE
-- CASCADE de evento_id borraba la alerta junto con el evento.
--
-- Cambia:
--   alertas.evento_id  BIGINT NOT NULL REFERENCES eventos_deteccion(id) ON DELETE CASCADE
-- a:
--   alertas.evento_id  BIGINT NULL    REFERENCES eventos_deteccion(id) ON DELETE SET NULL
-- =============================================================================

BEGIN;

ALTER TABLE alertas
    ALTER COLUMN evento_id DROP NOT NULL;

-- Re-crear la FK con ON DELETE SET NULL (en lugar de CASCADE)
ALTER TABLE alertas
    DROP CONSTRAINT IF EXISTS alertas_evento_id_fkey;

ALTER TABLE alertas
    ADD CONSTRAINT alertas_evento_id_fkey
    FOREIGN KEY (evento_id) REFERENCES eventos_deteccion(id) ON DELETE SET NULL;

COMMIT;
