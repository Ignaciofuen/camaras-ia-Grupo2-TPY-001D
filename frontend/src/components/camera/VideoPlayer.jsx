import { useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useStream } from '../../hooks/useStream';

/**
 * VideoPlayer
 *
 * Componente simple que renderiza el <video>.
 * Toda la lógica del stream (HLS, errores, reconexión) está en useStream.
 */
const VideoPlayer = ({ streamUrl, onStatusChange, isMuted = true }) => {
  const videoRef = useRef(null);

  const { status } = useStream(videoRef, streamUrl);

  // avisamos al padre cuando cambia el estado del stream
  useEffect(() => {
    if (onStatusChange) {
      onStatusChange(status);
    }
  }, [status, onStatusChange]);

  // sincroniza el mute directamente con el elemento <video>
  // necesario para evitar bloqueos de autoplay en navegadores
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
    }
  }, [isMuted]);

  return (
    <video
      ref={videoRef}
      className="w-full h-full object-contain bg-black"
      autoPlay
      playsInline
      muted={isMuted}
    />
  );
};

VideoPlayer.propTypes = {
  streamUrl: PropTypes.string.isRequired,
  onStatusChange: PropTypes.func,
  isMuted: PropTypes.bool,
};

export default VideoPlayer;