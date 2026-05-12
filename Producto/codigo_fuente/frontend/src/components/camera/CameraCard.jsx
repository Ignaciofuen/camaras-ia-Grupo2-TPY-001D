import { useState, useRef, useCallback } from 'react';
import VideoPlayer from './VideoPlayer';
import CameraOverlay from '../camera/overlays/CameraOverlay';
import DetectionOverlay from '../camera/overlays/DetectionOverlay';
import CameraControls from './CameraControls';

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

  /** Toggle del audio. Tambien le aviso al <video> directamente por si la
   *  prop muted aun no se sincronizo. */
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

  /** Captura el frame actual y lo descarga como JPG. */
  const handleSnapshot = useCallback(() => {
    const dataUrl = playerRef.current?.captureFrame();
    if (!dataUrl) {
      console.warn('[CameraCard] snapshot vacio (video no esta listo)');
      return;
    }
    const a = document.createElement('a');
    const camName = camera?.nombre || camera?.name || 'camara';
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    a.href = dataUrl;
    a.download = `${camName}_${ts}.jpg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }, [camera]);

  /** Pausa/reanuda el stream del lado del cliente. La camara y el detector
   *  no se enteran (solo el <video> local). */
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

  if (!camera) return null;

  const isOnline = camera.activa ?? (camera.status === 'online');

  // Construir URL WebRTC contra MediaMTX (puerto 8889 /whep).
  const buildStreamUrl = () => {
    if (!camera.nombre && camera.id == null && !camera.mediamtx_path) return null;
    const mtxPath = camera.mediamtx_path || camera.nombre || '';
    return `http://localhost:8889/${mtxPath}/whep`;
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
            onStatusChange={setStreamStatus}
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
      </div>

      {/* capa interaccion: botones */}
      <div className="absolute inset-0 z-30 pointer-events-none">
        <CameraControls
          isMuted={isMuted}
          isPaused={isPaused}
          onToggleMute={handleToggleMute}
          onFullscreen={handleFullscreen}
          onSnapshot={handleSnapshot}
          onTogglePause={handleTogglePause}
          onReload={handleReload}
        />
      </div>

      {/* borde al hacer hover (feedback visual tipo VMS) */}
      <div className="absolute inset-0 border-[3px] border-transparent group-hover:border-blue-500/40 transition-colors pointer-events-none z-40" />
    </div>
  );
};

export default CameraCard;
