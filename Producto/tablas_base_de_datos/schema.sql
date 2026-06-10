-- =============================================================================
-- Cámaras-IA · Esquema PostgreSQL (v1.1 - MVP)
-- Ejecutar: psql -U <user> -d <db> -f schema.sql
-- Requiere PostgreSQL >= 13
--
-- MVP: Telegram a UNA sola cuenta (chat_id + bot_token en configuracion_sistema).
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- EXTENSIONES
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid() + cifrado
CREATE EXTENSION IF NOT EXISTS citext;     -- emails case-insensitive

-- -----------------------------------------------------------------------------
-- FUNCIÓN AUXILIAR: actualiza "actualizado_en" automáticamente
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_actualizado_en()
RETURNS TRIGGER AS $$
BEGIN
    NEW.actualizado_en = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 1. USUARIOS Y SEGURIDAD
-- =============================================================================

CREATE TABLE usuarios (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email             CITEXT UNIQUE NOT NULL,
    password_hash     VARCHAR(255) NOT NULL,
    nombre_completo   VARCHAR(150),
    telefono          VARCHAR(30),
    activo            BOOLEAN NOT NULL DEFAULT TRUE,
    ultimo_acceso_en  TIMESTAMPTZ,
    creado_en         TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_usuarios_activo ON usuarios(activo);
CREATE TRIGGER trg_usuarios_updated BEFORE UPDATE ON usuarios
    FOR EACH ROW EXECUTE FUNCTION set_actualizado_en();

CREATE TABLE roles (
    id          SMALLSERIAL PRIMARY KEY,
    nombre      VARCHAR(40) UNIQUE NOT NULL,
    descripcion VARCHAR(200)
);
INSERT INTO roles (nombre, descripcion) VALUES
    ('admin',        'Control total del sistema'),
    ('operador',     'Gestiona cámaras y reconoce alertas'),
    ('visualizador', 'Solo lectura del dashboard');

CREATE TABLE usuarios_roles (
    usuario_id  UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    rol_id      SMALLINT NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    asignado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (usuario_id, rol_id)
);

CREATE TABLE tokens_refresco (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id  UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    token_hash  VARCHAR(128) UNIQUE NOT NULL,
    user_agent  VARCHAR(255),
    ip_cliente  INET,
    expira_en   TIMESTAMPTZ NOT NULL,
    revocado_en TIMESTAMPTZ,
    creado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tokens_usuario ON tokens_refresco(usuario_id);
CREATE INDEX idx_tokens_expira  ON tokens_refresco(expira_en);

-- =============================================================================
-- 2. INFRAESTRUCTURA
-- =============================================================================

CREATE TABLE sitios (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre       VARCHAR(120) NOT NULL,
    direccion    VARCHAR(255),
    latitud      NUMERIC(9,6),
    longitud     NUMERIC(9,6),
    zona_horaria VARCHAR(60) DEFAULT 'America/Argentina/Buenos_Aires',
    creado_en    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE camaras (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sitio_id               UUID NOT NULL REFERENCES sitios(id) ON DELETE RESTRICT,
    nombre                 VARCHAR(120) UNIQUE NOT NULL,
    descripcion            VARCHAR(255),
    direccion_mac          MACADDR UNIQUE NOT NULL,
    ip_actual              INET,
    ip_respaldo            INET NOT NULL,
    ip_actualizada_en      TIMESTAMPTZ,
    usuario_rtsp           VARCHAR(80),
    password_rtsp_cifrada  BYTEA,
    password_rtsp          VARCHAR(120),  -- texto plano editable desde UI (migration 008)
    puerto_rtsp            INTEGER NOT NULL DEFAULT 554,
    ruta_rtsp              VARCHAR(200) NOT NULL,
    mediamtx_path          VARCHAR(120),
    modelo_hw              VARCHAR(80),
    resolucion_w           SMALLINT,
    resolucion_h           SMALLINT,
    fps                    SMALLINT DEFAULT 15,
    modo_analisis          VARCHAR(20) NOT NULL DEFAULT 'solo_yolo'
                           CHECK (modo_analisis IN ('solo_yolo','yolo_llava')),
    confianza_visual       NUMERIC(4,3) DEFAULT 0.450
                           CHECK (confianza_visual BETWEEN 0 AND 1),
    confianza_alerta       NUMERIC(4,3) DEFAULT 0.670
                           CHECK (confianza_alerta BETWEEN 0 AND 1),
    procesar_cada_n_frames SMALLINT DEFAULT 2,
    duracion_alerta_seg    SMALLINT DEFAULT 5,
    frames_ausencia        SMALLINT DEFAULT 92,
    contexto_zona          VARCHAR(120),
    activa                 BOOLEAN NOT NULL DEFAULT TRUE,
    estado_salud           VARCHAR(20) DEFAULT 'desconocido'
                           CHECK (estado_salud IN ('online','offline','degradada','desconocido')),
    ultima_conexion_en     TIMESTAMPTZ,
    creado_en              TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_camaras_sitio  ON camaras(sitio_id);
CREATE INDEX idx_camaras_activa ON camaras(activa);
CREATE TRIGGER trg_camaras_updated BEFORE UPDATE ON camaras
    FOR EACH ROW EXECUTE FUNCTION set_actualizado_en();
COMMENT ON COLUMN camaras.password_rtsp_cifrada IS
    'Cifrar con: pgp_sym_encrypt(password, current_setting(''app.rtsp_key''))';
COMMENT ON COLUMN camaras.password_rtsp IS
    'Contraseña RTSP en texto plano (MVP). Reemplaza CAMARA_*_PASS del .env. '
    'Editable desde el frontend (página Configuración). En prod usar password_rtsp_cifrada.';

CREATE TABLE zonas (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    camara_id  UUID NOT NULL REFERENCES camaras(id) ON DELETE CASCADE,
    nombre     VARCHAR(120) NOT NULL,
    poligono   JSONB,
    prioridad  SMALLINT NOT NULL DEFAULT 1 CHECK (prioridad BETWEEN 1 AND 5),
    armada     BOOLEAN NOT NULL DEFAULT TRUE,
    horario    JSONB,
    creado_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_zonas_camara ON zonas(camara_id);
CREATE INDEX idx_zonas_armada ON zonas(armada);

-- =============================================================================
-- 3. PIPELINE DE DETECCIÓN
-- =============================================================================

CREATE TABLE eventos_deteccion (
    id                BIGSERIAL PRIMARY KEY,
    camara_id         UUID NOT NULL REFERENCES camaras(id) ON DELETE CASCADE,
    capturado_en      TIMESTAMPTZ NOT NULL,
    recibido_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Snapshot del frame (JPG en MinIO/S3)
    snapshot_bucket   VARCHAR(120) DEFAULT 'camaras-ia-snapshots',
    snapshot_key      VARCHAR(500),
    snapshot_anotado  BOOLEAN DEFAULT FALSE,
    frame_width       SMALLINT,
    frame_height      SMALLINT,
    modelo_yolo       VARCHAR(60) DEFAULT 'yolov8n',
    latencia_yolo_ms  INTEGER,
    cantidad_personas SMALLINT NOT NULL DEFAULT 0,
    estado            VARCHAR(20) NOT NULL DEFAULT 'pendiente'
                      CHECK (estado IN ('pendiente','analizado','descartado')),
    creado_en         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_eventos_camara_tiempo ON eventos_deteccion(camara_id, capturado_en DESC);
CREATE INDEX idx_eventos_estado        ON eventos_deteccion(estado);
COMMENT ON COLUMN eventos_deteccion.snapshot_anotado IS
    'TRUE si el JPG ya viene con los bounding boxes dibujados encima';

CREATE TABLE detecciones (
    id           BIGSERIAL PRIMARY KEY,
    evento_id    BIGINT NOT NULL REFERENCES eventos_deteccion(id) ON DELETE CASCADE,
    clase_nombre VARCHAR(40) NOT NULL DEFAULT 'person',
    clase_id     SMALLINT NOT NULL DEFAULT 0,
    confianza    NUMERIC(5,4) NOT NULL CHECK (confianza BETWEEN 0 AND 1),
    bbox_x       NUMERIC(6,5) NOT NULL,
    bbox_y       NUMERIC(6,5) NOT NULL,
    bbox_w       NUMERIC(6,5) NOT NULL,
    bbox_h       NUMERIC(6,5) NOT NULL,
    id_rastreo   INTEGER,
    en_zona_id   UUID REFERENCES zonas(id) ON DELETE SET NULL
);
CREATE INDEX idx_detecciones_evento ON detecciones(evento_id);
CREATE INDEX idx_detecciones_zona   ON detecciones(en_zona_id);
CREATE INDEX idx_detecciones_track  ON detecciones(id_rastreo);

CREATE TABLE analisis_escena (
    id                BIGSERIAL PRIMARY KEY,
    evento_id         BIGINT UNIQUE NOT NULL REFERENCES eventos_deteccion(id) ON DELETE CASCADE,
    modelo            VARCHAR(60) DEFAULT 'llava',
    contexto_zona     VARCHAR(120),
    prompt_usado      TEXT,
    sospechoso        BOOLEAN NOT NULL DEFAULT FALSE,
    nivel             VARCHAR(10) NOT NULL DEFAULT 'bajo'
                      CHECK (nivel IN ('alto','medio','bajo')),
    descripcion       TEXT,
    personas          SMALLINT NOT NULL DEFAULT 0,
    acciones          TEXT,
    tiempo_analisis_s NUMERIC(6,2),
    estado            VARCHAR(20) NOT NULL DEFAULT 'ok'
                      CHECK (estado IN ('ok','timeout','error_json','error')),
    error_msg         TEXT,
    respuesta_cruda   JSONB,
    creado_en         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_analisis_nivel      ON analisis_escena(nivel);
CREATE INDEX idx_analisis_sospechoso ON analisis_escena(sospechoso);
CREATE INDEX idx_analisis_creado     ON analisis_escena(creado_en DESC);

-- =============================================================================
-- 4. ALERTAS Y REGLAS
-- =============================================================================

CREATE TABLE reglas_alerta (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre              VARCHAR(120) NOT NULL,
    camara_id           UUID REFERENCES camaras(id) ON DELETE CASCADE,
    zona_id             UUID REFERENCES zonas(id)   ON DELETE CASCADE,
    min_confianza       NUMERIC(4,3) NOT NULL DEFAULT 0.670,
    nivel_minimo        VARCHAR(10) DEFAULT 'bajo'
                        CHECK (nivel_minimo IN ('alto','medio','bajo')),
    requiere_sospechoso BOOLEAN DEFAULT FALSE,
    horario             JSONB,
    enfriamiento_s      INTEGER NOT NULL DEFAULT 60,
    severidad           VARCHAR(20) NOT NULL DEFAULT 'alta'
                        CHECK (severidad IN ('baja','media','alta','critica')),
    habilitada          BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en           TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_reglas_habilitada ON reglas_alerta(habilitada);
CREATE INDEX idx_reglas_camara     ON reglas_alerta(camara_id);
CREATE TRIGGER trg_reglas_updated BEFORE UPDATE ON reglas_alerta
    FOR EACH ROW EXECUTE FUNCTION set_actualizado_en();

CREATE SEQUENCE seq_numero_alerta;

CREATE TABLE alertas (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero_alerta   BIGINT UNIQUE NOT NULL DEFAULT nextval('seq_numero_alerta'),
    -- [MIGRATION 009] nullable + ON DELETE SET NULL para permitir borrar el
    -- evento del historial conservando la alerta visible en /alertas.
    evento_id       BIGINT REFERENCES eventos_deteccion(id) ON DELETE SET NULL,
    analisis_id     BIGINT REFERENCES analisis_escena(id) ON DELETE SET NULL,
    regla_id        UUID   REFERENCES reglas_alerta(id)   ON DELETE SET NULL,
    camara_id       UUID NOT NULL REFERENCES camaras(id)  ON DELETE CASCADE,
    zona_id         UUID   REFERENCES zonas(id)           ON DELETE SET NULL,
    id_rastreo      INTEGER,
    severidad       VARCHAR(20) NOT NULL DEFAULT 'alta'
                    CHECK (severidad IN ('baja','media','alta','critica')),
    estado          VARCHAR(20) NOT NULL DEFAULT 'abierta'
                    CHECK (estado IN ('abierta','reconocida','resuelta','descartada')),
    titulo          VARCHAR(200) NOT NULL,
    mensaje         TEXT,
    disparada_en    TIMESTAMPTZ NOT NULL DEFAULT now(),
    reconocida_en   TIMESTAMPTZ,
    reconocida_por  UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    resuelta_en     TIMESTAMPTZ,
    resuelta_por    UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    nota_resolucion TEXT,
    metadatos       JSONB
);
CREATE INDEX idx_alertas_camara_tiempo ON alertas(camara_id, disparada_en DESC);
CREATE INDEX idx_alertas_estado        ON alertas(estado);
CREATE INDEX idx_alertas_disparada     ON alertas(disparada_en DESC);
CREATE INDEX idx_alertas_rastreo       ON alertas(id_rastreo);

-- =============================================================================
-- 5. MEDIA
-- =============================================================================

CREATE TABLE clips (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alerta_id      UUID REFERENCES alertas(id) ON DELETE SET NULL,
    camara_id      UUID NOT NULL REFERENCES camaras(id) ON DELETE CASCADE,
    object_key     VARCHAR(500) NOT NULL,
    bucket         VARCHAR(120) NOT NULL DEFAULT 'camaras-ia-clips',
    content_type   VARCHAR(60) DEFAULT 'video/mp4',
    duracion_s     NUMERIC(6,2),
    tamano_bytes   BIGINT,
    iniciado_en    TIMESTAMPTZ NOT NULL,
    finalizado_en  TIMESTAMPTZ NOT NULL,
    hls_playlist   VARCHAR(500),
    miniatura_key  VARCHAR(500),
    retener_hasta  TIMESTAMPTZ,
    creado_en      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_clips_alerta   ON clips(alerta_id);
CREATE INDEX idx_clips_camara   ON clips(camara_id);
CREATE INDEX idx_clips_iniciado ON clips(iniciado_en DESC);

-- =============================================================================
-- 6. NOTIFICACIONES TELEGRAM (MVP — una sola cuenta)
-- =============================================================================

CREATE TABLE notificaciones (
    id                  BIGSERIAL PRIMARY KEY,
    alerta_id           UUID NOT NULL REFERENCES alertas(id) ON DELETE CASCADE,
    chat_id             BIGINT NOT NULL,
    mensaje             TEXT NOT NULL,
    estado              VARCHAR(20) NOT NULL DEFAULT 'pendiente'
                        CHECK (estado IN ('pendiente','enviada','fallida')),
    intentos            SMALLINT NOT NULL DEFAULT 0,
    ultimo_error        TEXT,
    telegram_message_id BIGINT,
    enviada_en          TIMESTAMPTZ,
    creado_en           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notif_alerta ON notificaciones(alerta_id);
CREATE INDEX idx_notif_estado ON notificaciones(estado);
CREATE INDEX idx_notif_creado ON notificaciones(creado_en DESC);
COMMENT ON TABLE notificaciones IS
    'Log de mensajes enviados por el bot. bot_token y chat_id destino viven en configuracion_sistema.';

-- =============================================================================
-- 7. OPERACIONES
-- =============================================================================

CREATE TABLE salud_camaras (
    id            BIGSERIAL PRIMARY KEY,
    camara_id     UUID NOT NULL REFERENCES camaras(id) ON DELETE CASCADE,
    estado        VARCHAR(20) NOT NULL
                  CHECK (estado IN ('online','offline','degradada')),
    latencia_ms   INTEGER,
    fps_observado NUMERIC(5,2),
    error_msg     TEXT,
    verificado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_salud_camara_tiempo ON salud_camaras(camara_id, verificado_en DESC);

-- Heartbeats de servicios de software (IA + backend). Paralelo a salud_camaras.
-- El detector/analizador/worker/api escriben acá cada N seg para decir "estoy vivo".
-- Permite detectar caídas proactivamente aunque no haya actividad de cámara.
CREATE TABLE salud_servicios (
    id            BIGSERIAL PRIMARY KEY,
    servicio      VARCHAR(40) NOT NULL
                  CHECK (servicio IN ('detector','yolo','llava','telegram_worker','api','minio','postgres','redis')),
    estado        VARCHAR(20) NOT NULL
                  CHECK (estado IN ('online','degradado','offline')),
    latencia_ms   INTEGER,
    metrica       JSONB,
    error_msg     TEXT,
    verificado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_salud_servicio_tiempo ON salud_servicios(servicio, verificado_en DESC);
COMMENT ON TABLE salud_servicios IS
    'Heartbeats de componentes software. Complementa salud_camaras (hardware).';
COMMENT ON COLUMN salud_servicios.metrica IS
    'Datos variables por servicio: {"fps":8.2} yolo, {"cola":3} llava, {"pendientes":5} worker, etc.';

-- =============================================================================
-- 7.bis  GRABACIONES MANUALES (introducida en migration 007)
-- =============================================================================
-- Videos .webm/.mp4 que el operador dispara manualmente desde el dashboard
-- (boton REC en CameraCard). El navegador graba con MediaRecorder+captureStream
-- y al stop sube el blob al backend, que lo guarda en MinIO bajo
-- recordings/YYYY/MM/DD/<camara>/<uuid>.<ext> y registra esta fila.
--
-- Distinto a eventos_deteccion.snapshot_key (que es JPG generado por YOLO):
-- aca son videos completos disparados a propósito por el operador.
-- =============================================================================
CREATE TABLE grabaciones (
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
    nota            TEXT,
    -- [MIGRATION 010] tipo de grabacion: video (default) o snapshot manual
    tipo            VARCHAR(20)  NOT NULL DEFAULT 'video' CHECK (tipo IN ('video','snapshot'))
);
CREATE INDEX idx_grabaciones_camara_creado ON grabaciones (camara_id, creado_en DESC);
CREATE INDEX idx_grabaciones_creado        ON grabaciones (creado_en DESC);
CREATE INDEX idx_grabaciones_tipo_creado   ON grabaciones (tipo, creado_en DESC);
COMMENT ON TABLE grabaciones IS
    'Grabaciones manuales disparadas por el operador desde el dashboard (CameraCard).';
COMMENT ON COLUMN grabaciones.storage_key IS
    'Key en MinIO. Convención: recordings/YYYY/MM/DD/<camara>/<uuid>.webm';

CREATE TABLE configuracion_sistema (
    clave           VARCHAR(80) PRIMARY KEY,
    valor           JSONB NOT NULL,
    descripcion     VARCHAR(255),
    actualizado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seeds MVP
INSERT INTO configuracion_sistema (clave, valor, descripcion) VALUES
    ('CONFIANZA_VISUAL',       '0.45',   'Umbral YOLO para dibujar bbox'),
    ('CONFIANZA_ALERTA',       '0.67',   'Umbral YOLO para disparar alerta'),
    ('PROCESAR_CADA_N_FRAMES', '2',      'Cada N frames se ejecuta YOLO'),
    ('DURACION_ALERTA_SEG',    '5',      'Segundos de cartel de alerta'),
    ('FRAMES_AUSENCIA',        '92',     'Frames sin ver al track para olvidarlo'),
    ('OLLAMA_URL',             '"http://localhost:11434/api/generate"', 'Endpoint Ollama'),
    ('MODELO_YOLO',            '"yolov8n"', 'Modelo YOLO'),
    ('MODELO_LLAVA',           '"llava"',   'Modelo LLaVA'),
    ('TIMEOUT_LLAVA',          '200',       'Timeout HTTP (seg)'),
    ('TELEGRAM_BOT_TOKEN',     '""',        'Token del bot (completar)'),
    ('TELEGRAM_CHAT_ID',       '0',         'chat_id destino (única cuenta de prueba)'),
    ('TELEGRAM_HABILITADO',    'false',     'Encender/apagar envío de alertas');

-- =============================================================================
-- 8. VISTA ÚTIL
-- =============================================================================

-- Vista unificada para /health: junta cámaras (hardware) + servicios (software).
-- Lógica para cámaras:
--   · Si el detector NO tiene heartbeat reciente en salud_servicios (90s) → todas offline
--   · Si el detector está vivo → se usa camaras.estado_salud (lo que el detector reportó)
-- Esto evita falsos "offline" cuando la cámara está OK pero sin detecciones recientes,
-- y refleja correctamente el estado cuando el detector está apagado.
CREATE VIEW v_salud_sistema AS
SELECT
    'camara'::VARCHAR          AS tipo,
    c.nombre                   AS componente,
    CASE
        -- Si el detector está caído (sin heartbeat en 90s) → todas offline
        WHEN NOT EXISTS (
            SELECT 1 FROM salud_servicios
            WHERE servicio = 'detector'
              AND estado = 'online'
              AND verificado_en > now() - INTERVAL '90 seconds'
        ) THEN 'offline'
        -- Detector vivo: confiamos en camaras.estado_salud
        ELSE COALESCE(c.estado_salud, 'desconocido')
    END                        AS estado,
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


CREATE VIEW v_alertas_completas AS
SELECT
    a.id,
    a.numero_alerta,
    a.titulo,
    a.severidad,
    a.estado,
    a.disparada_en,
    c.nombre           AS camara_nombre,
    c.modo_analisis,
    s.nombre           AS sitio_nombre,
    ae.nivel           AS llava_nivel,
    ae.sospechoso      AS llava_sospechoso,
    ae.descripcion     AS llava_descripcion,
    ae.acciones        AS llava_acciones,
    ed.cantidad_personas,
    u.nombre_completo  AS reconocida_por_nombre
FROM alertas a
JOIN camaras c            ON c.id  = a.camara_id
JOIN sitios  s            ON s.id  = c.sitio_id
JOIN eventos_deteccion ed ON ed.id = a.evento_id
LEFT JOIN analisis_escena ae ON ae.id = a.analisis_id
LEFT JOIN usuarios u         ON u.id  = a.reconocida_por;

COMMIT;
