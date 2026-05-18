-- =============================================================================
-- seed_camaras.sql
-- =============================================================================
-- Inserta el sitio "Casa Principal" + las 2 cámaras (UOKOO + Sonoff) en la DB.
-- Útil para bootstrappear un deployment nuevo (Oracle, otro server, etc.).
--
-- Idempotente: si ya existen las cámaras (por MAC), no las re-inserta.
-- =============================================================================

BEGIN;

-- 1. Sitio (idempotente por nombre)
INSERT INTO sitios (nombre, direccion, zona_horaria)
SELECT 'Casa Principal', 'Chile', 'America/Santiago'
WHERE NOT EXISTS (SELECT 1 FROM sitios WHERE nombre = 'Casa Principal');

-- 2. Cámara UOKOO (Principal)
INSERT INTO camaras (
    sitio_id, nombre, direccion_mac, ip_respaldo,
    usuario_rtsp, password_rtsp, puerto_rtsp, ruta_rtsp,
    mediamtx_path, modo_analisis, activa
)
SELECT
    (SELECT id FROM sitios WHERE nombre = 'Casa Principal' LIMIT 1),
    'Camara_Principal',
    '08:EA:40:54:9B:F5'::macaddr,
    '192.168.1.15'::inet,
    'admin',
    '123456',
    554,
    'live/ch0',
    'cam_principal',
    'solo_yolo',
    TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM camaras WHERE direccion_mac = '08:EA:40:54:9B:F5'::macaddr
);

-- 3. Cámara Sonoff
INSERT INTO camaras (
    sitio_id, nombre, direccion_mac, ip_respaldo,
    usuario_rtsp, password_rtsp, puerto_rtsp, ruta_rtsp,
    mediamtx_path, modo_analisis, activa
)
SELECT
    (SELECT id FROM sitios WHERE nombre = 'Casa Principal' LIMIT 1),
    'Camara_Sonoff',
    '68:B9:D3:5C:CC:FC'::macaddr,
    '192.168.1.17'::inet,
    'rtsp',
    'Camaras2026',
    554,
    'av_stream/ch0',
    'cam_sonoff',
    'yolo_llava',
    TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM camaras WHERE direccion_mac = '68:B9:D3:5C:CC:FC'::macaddr
);

COMMIT;

-- Verificación:
SELECT nombre, host(ip_respaldo) AS ip, usuario_rtsp, password_rtsp, mediamtx_path
FROM camaras ORDER BY nombre;
