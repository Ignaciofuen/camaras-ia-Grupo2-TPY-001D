import { useCallback, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import VideoPlayer from './VideoPlayer';
import CameraOverlay from '../camera/overlays/CameraOverlay';
import DetectionOverlay from '../camera/overlays/DetectionOverlay';
import CameraControls from './CameraControls';
import { useRecording } from '../../hooks/useRecording';

const getCameraName = (camera) => (
  camera?.nombre || camera?.name || camera?.id || 'camara'
);

const buildStreamUrl = (camera) => {
  if (camera?.streamUrl) return camera.streamUrl;
  if (camera?.stream_url) return camera.stream_url;
  if (camera?.hls_url) return camera.hls_url;
  if (camera?.whep_url) return camera.whep_url;

  const mediaPath = camera?.mediamtx_path || camera?.nombre || camera?.name;
  if (!mediaPath) return null;

  return `http://localhost:8889/${mediaPath}/whep`;
};

const CameraCard = ({ camera, detections = [] }) => {
  const [streamStatus, setStreamStatus] = useState('loading');
  const [isMuted, setIsMuted] = useState(true);
  const [isPaused, setIsPaused] = useState(false);

  const playerRef = useRef(null);
  const cardRef = useRef(null);
  const {
    isRecording,
    uploading,
    start: startRecording,
    stop: stopRecording,
  } = useRecording();

  const handleToggleMute = useCallback(() => {
    setIsMuted((current) => {
      const next = !current;
      playerRef.current?.setMuted(next);
      return next;
    });
  }, []);

  const handleFullscreen = useCallback(() => {
    const element = cardRef.current;
    if (!element) return;

    if (document.fullscreenElement) {
      document.exitFullscreen?.();
    } else {
      element.requestFullscreen?.().catch((error) => {
        console.warn('[CameraCard] fullscreen fallo:', error);
      });
    }
  }, []);

  const handleSnapshot = useCallback(() => {
    const dataUrl = playerRef.current?.captureFrame();

    if (!dataUrl) {
      console.warn('[CameraCard] snapshot vacio');
      return;
    }

    const link = document.createElement('a');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    link.href = dataUrl;
    link.download = `${getCameraName(camera)}_${timestamp}.jpg`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }, [camera]);

  const handleTogglePause = useCallback(() => {
    setIsPaused((current) => {
      const next = !current;

      if (next) {
        playerRef.current?.pause();
      } else {
        playerRef.current?.play();
      }

      return next;
    });
  }, []);

  const handleReload = useCallback(() => {
    playerRef.current?.reload();
  }, []);

  const handleToggleRecord = useCallback(() => {
    if (isRecording) {
      stopRecording();
      return;
    }

    const videoElement = playerRef.current?.getElement?.();
    if (!videoElement) {
      console.warn('[CameraCard] no se puede grabar: video no listo');
      return;
    }

    startRecording(videoElement, getCameraName(camera), camera?.id || camera?.uuid);
  }, [camera, isRecording, startRecording, stopRecording]);

  if (!camera) return null;

  const isOnline = camera.activa ?? camera.online ?? (
    camera.status ? camera.status === 'online' : true
  );
  const streamUrl = buildStreamUrl(camera);
  const hasStream = Boolean(streamUrl);

  return (
    <div
      ref={cardRef}
      className="relative w-full h-full bg-black border border-gray-800 overflow-hidden group"
    >
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

      <div className="absolute inset-0 z-10 pointer-events-none">
        <DetectionOverlay detections={detections} />
      </div>

      <div className="absolute inset-0 z-20 pointer-events-none">
        <CameraOverlay
          name={getCameraName(camera)}
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
            SUBIENDO
          </div>
        )}
      </div>

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

      <div className="absolute inset-0 border-[3px] border-transparent group-hover:border-blue-500/40 transition-colors pointer-events-none z-40" />
    </div>
  );
};

CameraCard.propTypes = {
  camera: PropTypes.object,
  detections: PropTypes.array,
};

export default CameraCard;
