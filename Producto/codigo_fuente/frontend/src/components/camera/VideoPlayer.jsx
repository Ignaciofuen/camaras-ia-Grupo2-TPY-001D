import { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import PropTypes from 'prop-types';
import { useStream } from '../../hooks/useStream';
import { useWebRTC } from '../../hooks/useWebRTC';

/**
 * VideoPlayer
 *
 * Renderiza un <video> y delega la conexion al stream segun el formato
 * de la URL:
 *   - termina en /whep      -> WebRTC (latencia ~300ms)
 *   - termina en .m3u8 / *  -> HLS via hls.js (latencia ~3-4s)
 *
 * Expone al padre via ref los siguientes metodos:
 *   - captureFrame()       -> devuelve un dataURL JPG del frame actual
 *   - setMuted(boolean)    -> mute/unmute del audio
 *   - pause()              -> congela el video
 *   - play()               -> reanuda
 *   - reload()             -> reconecta el stream (util cuando se traba)
 *
 * @param {string} streamUrl URL del stream (HLS .m3u8 o WHEP /whep)
 * @param {boolean} muted    inicial; el padre puede cambiarlo via setMuted
 * @param {boolean} paused   inicial; el padre puede cambiarlo via pause/play
 * @param {function} onStatusChange callback opcional con el estado al padre
 */
const VideoPlayer = forwardRef(({
  streamUrl,
  muted = true,
  paused = false,
  onStatusChange,
}, ref) => {
  const videoRef = useRef(null);

  const isWebRTC = typeof streamUrl === 'string' && streamUrl.includes('/whep');

  const hls    = useStream(videoRef, isWebRTC ? null : streamUrl);
  const webrtc = useWebRTC(videoRef, isWebRTC ? streamUrl : null);
  const { status, reloadStream } = isWebRTC ? webrtc : hls;

  // Sincronizar el estado de muted con el <video>.
  // Asi cuando el padre cambia la prop, el audio responde.
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = muted;
    }
  }, [muted]);

  // Sincronizar pausa/play.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (paused) {
      v.pause();
    } else if (v.paused) {
      v.play().catch(() => {});
    }
  }, [paused]);

  // Avisar al padre del estado del stream (loading / playing / error)
  useEffect(() => {
    if (onStatusChange) onStatusChange(status);
  }, [status, onStatusChange]);

  // Metodos expuestos al padre via ref
  useImperativeHandle(ref, () => ({
    /**
     * Captura el frame actual del video y devuelve un dataURL JPG.
     * El padre puede crear un <a download> con esa data.
     */
    captureFrame: () => {
      const v = videoRef.current;
      if (!v || !v.videoWidth || !v.videoHeight) return null;
      const canvas = document.createElement('canvas');
      canvas.width  = v.videoWidth;
      canvas.height = v.videoHeight;
      const ctx = canvas.getContext('2d');
      try {
        ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/jpeg', 0.92);
      } catch (err) {
        // Tainted canvas si el stream viene cross-origin sin CORS headers.
        console.warn('[VideoPlayer] no se pudo capturar frame:', err);
        return null;
      }
    },
    setMuted: (m) => {
      if (videoRef.current) videoRef.current.muted = !!m;
    },
    pause: () => videoRef.current?.pause(),
    play:  () => videoRef.current?.play().catch(() => {}),
    reload: () => reloadStream && reloadStream(),
    /** Acceso directo al <video> para casos avanzados (fullscreen, etc). */
    getElement: () => videoRef.current,
  }), [reloadStream]);

  return (
    <video
      ref={videoRef}
      className="w-full h-full object-contain bg-black"
      autoPlay
      muted={muted}   // controlado por prop
      playsInline
    />
  );
});

VideoPlayer.displayName = 'VideoPlayer';

VideoPlayer.propTypes = {
  streamUrl: PropTypes.string.isRequired,
  muted: PropTypes.bool,
  paused: PropTypes.bool,
  onStatusChange: PropTypes.func,
};

export default VideoPlayer;
