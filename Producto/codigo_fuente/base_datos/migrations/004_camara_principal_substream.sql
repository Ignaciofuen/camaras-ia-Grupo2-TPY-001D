-- =============================================================================
-- 004_camara_principal_substream.sql
-- =============================================================================
-- Reduce la resolucion del feed Camara_Principal (UOKOO X Series).
--
-- Hay dos caminos. Aplica UNO de los dos (no los dos a la vez):
--
--  CAMINO 1 - Sub-stream NATIVO de la camara (recomendado: 0 CPU extra).
--             Usar cuando ONVIF Device Manager muestre que la camara expone
--             un segundo profile de menor resolucion.
--
--  CAMINO 2 - FFmpeg transcoding (plan B: 10-15% CPU extra, garantizado).
--             Usar cuando la camara NO expone sub-stream. Requiere ffmpeg
--             en el PATH y el path "cam_principal_lite" en mediamtx.template.yml
--             (ya esta agregado).
-- =============================================================================

-- ========== CAMINO 1: sub-stream nativo ==========
-- Reemplazar '/REPLACE_ME' por la ruta que te dio ONVIF Device Manager
-- (ej: /live/ch1, /onvif2, /h264Preview_01_sub, /1, etc.)
--
-- UPDATE camaras
--    SET ruta_rtsp   = '/REPLACE_ME',
--        puerto_rtsp = 554
--  WHERE nombre = 'Camara_Principal';


-- ========== CAMINO 2: FFmpeg transcoding via cam_principal_lite ==========
-- Esto le dice al detector y al frontend que consuman el path liviano.
-- MediaMTX se encarga (transparente para todos): cuando alguien pide
-- cam_principal_lite, ejecuta ffmpeg que rescala 1080p->720p.
--
UPDATE camaras
   SET mediamtx_path = 'cam_principal_lite'
 WHERE nombre = 'Camara_Principal';


-- Verificar el cambio:
-- SELECT nombre, host(ip_actual), puerto_rtsp, ruta_rtsp, mediamtx_path
--   FROM camaras WHERE activa = TRUE;
--
-- Para revertir a 1080p directo:
-- UPDATE camaras SET mediamtx_path = 'cam_principal' WHERE nombre = 'Camara_Principal';
