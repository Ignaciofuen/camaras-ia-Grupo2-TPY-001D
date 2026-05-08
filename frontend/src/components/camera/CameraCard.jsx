import { useState, useRef } from 'react';
import PropTypes from 'prop-types';
import VideoPlayer from './VideoPlayer';
import CameraOverlay from '../camera/overlays/CameraOverlay';
import DetectionOverlay from '../camera/overlays/DetectionOverlay';
import CameraControls from './CameraControls';

/**
 * CameraCard
 *
 * Contenedor principal de una cámara.
 * Aquí se juntan todas las capas:
 * - video
 * - detecciones (IA)
 * - overlay (nombre, estado, errores)
 * - controles
 */
const CameraCard = ({ camera, detections = [] }) => {
  const cardRef = useRef(null);

  // estado del stream (loading, playing, error)
  const [streamStatus, setStreamStatus] = useState('loading');

  // en sistemas tipo VMS el audio parte muteado
  const [isMuted, setIsMuted] = useState(true);

  if (!camera) return null;

  const isOnline = camera.status === 'online';
  const hasStream = Boolean(camera.streamUrl);

  // --- handlers de controles ---

  const handleToggleMute = () => {
    setIsMuted((prev) => !prev);
  };

  const handleFullscreen = () => {
    if (!cardRef.current) return;

    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      cardRef.current.requestFullscreen();
    }
  };

  const handleSnapshot = () => {
    // pendiente: implementar captura real desde video/canvas
    console.log(`[Snapshot] ${camera.name}`);
  };

  return (
    <div
      ref={cardRef}
      className="relative w-full h-full bg-black border border-gray-800 overflow-hidden group"
    >

      {/* VIDEO (base) */}
      <div className="absolute inset-0 z-0">
        {isOnline && hasStream ? (
          <VideoPlayer
            streamUrl={camera.streamUrl}
            onStatusChange={setStreamStatus}
            isMuted={isMuted}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-[#0a0a0a] text-gray-500 text-xs font-mono">
            NO VIDEO
          </div>
        )}
      </div>

      {/* IA (bounding boxes) */}
      <div className="absolute inset-0 z-10 pointer-events-none">
        <DetectionOverlay detections={detections} />
      </div>

      {/* UI (nombre, estado, loading/error) */}
      <div className="absolute inset-0 z-20 pointer-events-none">
        <CameraOverlay
          name={camera.name}
          status={camera.status}
          streamStatus={streamStatus}
        />
      </div>

      {/* CONTROLES (solo interactivos abajo) */}
      <div className="absolute inset-0 z-30 pointer-events-none flex flex-col justify-end">
        <div className="pointer-events-auto">
          <CameraControls
            isMuted={isMuted}
            onToggleMute={handleToggleMute}
            onFullscreen={handleFullscreen}
            onSnapshot={handleSnapshot}
          />
        </div>
      </div>

      {/* borde hover tipo VMS */}
      <div className="absolute inset-0 border-[3px] border-transparent group-hover:border-blue-500/40 transition-colors pointer-events-none z-40" />

    </div>
  );
};

CameraCard.propTypes = {
  camera: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    name: PropTypes.string.isRequired,
    status: PropTypes.string.isRequired,
    streamUrl: PropTypes.string,
  }).isRequired,
  detections: PropTypes.array,
};

export default CameraCard;