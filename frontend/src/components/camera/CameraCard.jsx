import { useState } from 'react';
import VideoPlayer from './VideoPlayer';
import CameraOverlay from '../camera/overlays/CameraOverlay';
import DetectionOverlay from '../camera/overlays/DetectionOverlay';
import CameraControls from './CameraControls';

/**
 * CameraCard
 *
 * Contenedor visual de una cámara.
 * Junta todas las capas: video, IA, UI y controles.
 *
 * No maneja lógica, solo organiza lo que recibe por props.
 *
 * @param {Object} camera
 * @param {Array} detections
 */
const CameraCard = ({ camera, detections = [] }) => {
  if (!camera) return null;

  // estado del stream (lo envía VideoPlayer)
  const [streamStatus, setStreamStatus] = useState('loading');

  const isOnline = camera.status === 'online';
  const hasStream = Boolean(camera.streamUrl);

  return (
    <div className="relative w-full h-full bg-black border border-gray-800 overflow-hidden group">

      {/* capa base: video */}
      <div className="absolute inset-0 z-0">
        {isOnline && hasStream ? (
          <VideoPlayer
            streamUrl={camera.streamUrl}
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

      {/* capa UI: nombre, estado, loading/error */}
      <div className="absolute inset-0 z-20 pointer-events-none">
        <CameraOverlay
          name={camera.name}
          status={camera.status}
          streamStatus={streamStatus}
        />
      </div>

      {/* capa interacción: botones */}
      <div className="absolute inset-0 z-30">
        <CameraControls cameraId={camera.id} />
      </div>

      {/* borde al hacer hover (feedback visual tipo VMS) */}
      <div className="absolute inset-0 border-[3px] border-transparent group-hover:border-blue-500/40 transition-colors pointer-events-none z-40" />
    </div>
  );
};

export default CameraCard;