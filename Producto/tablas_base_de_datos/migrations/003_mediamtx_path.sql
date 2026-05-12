-- =========================================================
-- 003_mediamtx_path.sql
-- =========================================================
-- Pobla el campo `mediamtx_path` en la tabla `camaras`.
-- Este path es lo que MediaMTX expone como ruta HLS en :8888,
-- y lo que el frontend usa para construir la URL del video.
--
-- Convencion: lowercase, sin acentos, prefijo `cam_`.
-- DEBE coincidir con los paths definidos en mediamtx.yml.
-- =========================================================

UPDATE camaras
SET    mediamtx_path = 'cam_principal'
WHERE  nombre = 'Camara_Principal';

UPDATE camaras
SET    mediamtx_path = 'cam_sonoff'
WHERE  nombre = 'Camara_Sonoff';

-- Verificacion
SELECT nombre, mediamtx_path
FROM   camaras
ORDER BY nombre;
