import { useState, useRef, useCallback, useEffect } from 'react';
import VideoPlayer from './VideoPlayer';
import CameraOverlay from '../camera/overlays/CameraOverlay';
import DetectionOverlay from '../camera/overlays/DetectionOverlay';
import CameraControls from './CameraControls';
import { useRecording } from '../../hooks/useRecording';

// Cuanto esperamos antes de propagar una transicion "mala" (loading/error)
// al badge de la UI. Las transiciones a 'playing' son inmediatas. Esto
// elimina el flapping visual durante el warmup de LL-HLS (donde el muxer
// puede tener 1-2 micro-blips antes de quedar estable).
const STATUS_DEBOUNCE_MS = 1500;

/**
 * CameraCard
 *
 * Contenedor visual de una camara.
 * Junta todas las capas: video, IA, UI y controles.
 */
const CameraCard = ({ camera, detections = [] }) => {
  const [streamStatus, setStreamStatus] = useState('loading');
  const [isMuted, setIsMuted]           = useState(true);
  const [isPaused, setIsPaused]         = useState(false);

  // Refs hacia el VideoPlayer (exposed via forwardRef) y al card mismo
  // (para fullscreen).
  const playerRef = useRef(null);
  const cardRef   = useRef(null);

  // Timer pendiente para propagar una transicion "mala" del player al UI.
  // Si entra una transicion buena (playing) o un nuevo estado mientras
  // este timer esta vivo, lo cancelamos.
  const statusDebounceRef = useRef(null);

  /**
   * Handler "anti-flap" para el streamStatus que viene del VideoPlayer.
   *
   * playing  -> aplicamos YA y cancelamos cualquier debounce pendiente
   * (las buenas noticias se ven inmediato).
   * loading  -> esperamos 1.5s antes de aplicar. Si en ese plazo entra
   * error       un 'playing', cancelamos el cambio. Esto absorbe los
   * micro-blips del muxer LL-HLS durante el warmup.
   */
  const handleStatusChange = useCallback((next) => {
    if (next === 'playing') {
      if (statusDebounceRef.current) {
        clearTimeout(statusDebounceRef.current);
        statusDebounceRef.current = null;
      }
      setStreamStatus('playing');
      return;
    }

    // 'loading' o 'error' -> debounce
    if (statusDebounceRef.current) {
      clearTimeout(statusDebounceRef.current);
    }
    statusDebounceRef.current = setTimeout(() => {
      setStreamStatus(next);
      statusDebounceRef.current = null;
    }, STATUS_DEBOUNCE_MS);
  }, []);

  // Cleanup del timer al desmontar el componente.
  useEffect(() => () => {
    if (statusDebounceRef.current) {
      clearTimeout(statusDebounceRef.current);
      statusDebounceRef.current = null;
    }
  }, []);

  /** Toggle del audio. Tambien le aviso al <video> directamente por si la
   * prop muted aun no se sincronizo. */
  const handleToggleMute = useCallback(() => {
    setIsMuted((m) => {
      const next = !m;
      playerRef.current?.setMuted(next);
      return next;
    });
  }, []);

  /** Pantalla completa del card entero (incluye overlays y bboxes). */
  const handleFullscreen = useCallback(() => {
    const el = cardRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    } else {
      el.requestFullscreen?.().catch((err) => {
        console.warn('[CameraCard] fullscreen falló:', err);
      });
    }
  }, []);

  /** Captura el frame actual y lo SUBE al servidor (aparece en Playback).
   * Si el upload falla, fallback a descarga local. */
  const handleSnapshot = useCallback(async () => {
    const dataUrl = playerRef.current?.captureFrame();
    if (!dataUrl) {
      console.warn('[CameraCard] snapshot vacio (video no esta listo)');
      return;
    }

    // dataURL → Blob
    const res = await fetch(dataUrl);
    const blob = await res.blob();

    // Subir al backend
    try {
      const form = new FormData();
      form.append('camara_id', camera?.id || '');
      const now = new Date();
      form.append('iniciada_en',   now.toISOString());
      form.append('finalizada_en', now.toISOString());
      form.append('duracion_s', '0');
      form.append('content_type', 'image/jpeg');
      form.append('tipo', 'snapshot');
      form.append('archivo', blob, `${camera?.nombre || 'camara'}.jpg`);
      const resp = await fetch('/grabaciones', { method: 'POST', body: form });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      console.log('[CameraCard] snapshot subido OK');
    } catch (e) {
      console.warn('[CameraCard] upload snapshot falló, descargo local:', e);
      const a = document.createElement('a');
      const camName = camera?.nombre || camera?.name || 'camara';
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      a.href = dataUrl;
      a.download = `${camName}_${ts}.jpg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  }, [camera]);

  /** Pausa/reanuda el stream del lado del cliente. La camara y el detector
   * no se enteran (solo el <video> local). */
  const handleTogglePause = useCallback(() => {
    setIsPaused((p) => {
      const next = !p;
      if (next) playerRef.current?.pause();
      else      playerRef.current?.play();
      return next;
    });
  }, []);

  /** Reinicia la conexion al stream (util cuando se traba el WebRTC). */
  const handleReload = useCallback(() => {
    playerRef.current?.reload();
  }, []);

  // ----- Grabación (MediaRecorder + captureStream + upload a MinIO) -----
  const { isRecording, uploading, start: startRec, stop: stopRec, error: recError } = useRecording();

  const handleToggleRecord = useCallback(() => {
    if (isRecording) {
      stopRec();
      return;
    }
    const videoEl = playerRef.current?.getElement?.();
    if (!videoEl) {
      console.warn('[CameraCard] no se puede grabar: video no listo');
      return;
    }
    const camName = camera?.nombre || camera?.name || 'camara';
    startRec(videoEl, camName, camera?.id);
  }, [isRecording, startRec, stopRec, camera]);

  if (!camera) return null;

  const isOnline = camera.activa ?? (camera.status === 'online');

  const buildStreamUrl = () => {
    if (!camera.nombre && camera.id == null && !camera.mediamtx_path) return null;
    const mtxPath = camera.mediamtx_path || camera.nombre || '';
    const mode    = (import.meta.env.VITE_PLAYER_MODE || 'webrtc').toLowerCase();
    
    if (mode === 'hls') {
      // MAGIA FUSIONADA: URL DINÁMICA DE CLOUDFLARE
      if (camera.hls_url) {
        return camera.hls_url;
      }
      const base = import.meta.env.VITE_HLS_BASE || 'http://localhost:8888';
      return `${base.replace(/\/$/, '')}/${mtxPath}/index.m3u8`;
    }
    const base = import.meta.env.VITE_WEBRTC_BASE || 'http://localhost:8889';
    return `${base.replace(/\/$/, '')}/${mtxPath}/whep`;
  };
  const streamUrl = buildStreamUrl();
  const hasStream = Boolean(streamUrl);

  return (
    <div
      ref={cardRef}
      className="relative w-full h-full bg-black border border-gray-800 overflow-hidden group"
    >
      {/* capa base: video */}
      <div className="absolute inset-0 z-0">
        {isOnline && hasStream ? (
          <VideoPlayer
            ref={playerRef}
            streamUrl={streamUrl}
            muted={isMuted}
            paused={isPaused}
            onStatusChange={handleStatusChange}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-[#0a0a0a] text-gray-500 text-xs font-mono">
            NO VIDEO
          </div>
        )}
      </div>

      {/* capa IA: bounding boxes */}
      <div className="absolute inset-0 z-10 pointer-events-none">
        <DetectionOverlay detections={detections} />
      </div>

      {/* capa UI: nombre, estado, loading/error + cartel de pausado */}
      <div className="absolute inset-0 z-20 pointer-events-none">
        <CameraOverlay
          name={camera.nombre || camera.name}
          status={isOnline ? 'online' : 'offline'}
          streamStatus={streamStatus}
        />
        {isPaused && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <span className="text-white text-xs font-mono tracking-widest uppercase border border-white px-3 py-1">
              PAUSADO
            </span>
          </div>
        )}
        {isRecording && (
          <div className="absolute top-2 left-2 flex items-center gap-1 bg-red-600/90 text-white text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded">
            <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
            REC
          </div>
        )}
        {uploading && !isRecording && (
          <div className="absolute top-2 left-2 flex items-center gap-1 bg-blue-600/90 text-white text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded">
            <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
            SUBIENDO…
          </div>
        )}
      </div>

      {/* capa interaccion: botones */}
      <div className="absolute inset-0 z-30 pointer-events-none">
        <CameraControls
          isMuted={isMuted}
          isPaused={isPaused}
          isRecording={isRecording}
          onToggleMute={handleToggleMute}
          onFullscreen={handleFullscreen}
          onSnapshot={handleSnapshot}
          onTogglePause={handleTogglePause}
          onReload={handleReload}
          onToggleRecord={handleToggleRecord}
        />
      </div>

      {/* borde al hacer hover (feedback visual tipo VMS) */}
      <div className="absolute inset-0 border-[3px] border-transparent group-hover:border-blue-500/40 transition-colors pointer-events-none z-40" />
    </div>
  );
};

export default CameraCard;