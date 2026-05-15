-- =============================================================================
-- 008_password_rtsp.sql
-- =============================================================================
-- Agrega la columna password_rtsp a la tabla camaras.
--
-- Antes: cada cámara tenía su password hardcoded en .env como variable de
-- entorno (CAMARA_PRINCIPAL_PASS, CAMARA_SONOFF_PASS). Eso obliga a editar
-- archivos y reiniciar procesos cada vez que la cámara cambia su pass RTSP
-- (cosa que pasa con frecuencia en cámaras chinas baratas tipo Sonoff/UOKOO).
--
-- Ahora: la pass vive en la DB, editable desde el frontend. El detector y el
-- discover_camera_ips leen de la DB con fallback al .env para retro-compat.
--
-- NOTA SEG: en producción esta columna debería estar cifrada (ej. pgcrypto +
-- una key en .env). Para el MVP la dejamos en texto plano. Cuando se agregue
-- auth con roles, sólo el rol admin podrá leerla.
-- =============================================================================

BEGIN;

ALTER TABLE camaras
    ADD COLUMN IF NOT EXISTS password_rtsp VARCHAR(120);

COMMENT ON COLUMN camaras.password_rtsp IS
    'Contraseña RTSP. Reemplaza la variable de entorno CAMARA_*_PASS. '
    'Editable desde el frontend (página Configuración).';

-- Seed inicial con las passes actuales del .env (para no romper nada al migrar).
-- Si en el futuro la cambias desde el frontend, se sobreescribe.
UPDATE camaras SET password_rtsp = '123456'        WHERE nombre = 'Camara_Principal' AND password_rtsp IS NULL;
UPDATE camaras SET password_rtsp = 'Camaras2026'   WHERE nombre = 'Camara_Sonoff'    AND password_rtsp IS NULL;

COMMIT;

-- Verificación:
-- SELECT nombre, usuario_rtsp, password_rtsp FROM camaras;
