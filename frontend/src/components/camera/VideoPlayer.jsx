import { useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useStream } from '../../hooks/useStream';

/**
 * VideoPlayer
 *
 * Este componente SOLO renderiza el <video>.
 * No maneja lógica de HLS, errores ni reconexión.
 *
 * Toda esa lógica vive en el hook useStream.
 *
 * La idea es que este componente sea reutilizable
 * y que no se rompa aunque cambie la lógica del stream.
 *
 * @param {string} streamUrl - URL del stream HLS (.m3u8)
 * @param {function} onStatusChange - función opcional para avisar el estado al padre
 */
const VideoPlayer = ({ streamUrl, onStatusChange }) => {
  // referencia directa al <video> del DOM
  const videoRef = useRef(null);

  /**
   * El hook se encarga de todo:
   * - conectar al stream
   * - manejar errores
   * - reconectar si se cae
   * - limpiar memoria
   */
  const { status } = useStream(videoRef, streamUrl);

  /**
   * Cada vez que cambia el estado del stream,
   * se lo avisamos al componente padre (ej: CameraCard).
   *
   * Esto sirve para:
   * - mostrar loading
   * - mostrar error
   * - cambiar overlays
   *
   * Importante: esto NO es lógica de negocio,
   * solo estamos pasando información hacia arriba.
   */
  useEffect(() => {
    if (onStatusChange) {
      onStatusChange(status);
    }
  }, [status, onStatusChange]);

  return (
    <video
      ref={videoRef}
      className="w-full h-full object-contain bg-black"
      autoPlay
      muted // sin esto, autoplay falla en la mayoría de navegadores
      playsInline // evita que en móviles (sobre todo iOS) se abra en pantalla completa
    />
  );
};

VideoPlayer.propTypes = {
  // URL del stream, debería venir desde backend (MediaMTX)
  streamUrl: PropTypes.string.isRequired,

  // función opcional para que el padre reaccione al estado del stream
  onStatusChange: PropTypes.func,
};

export default VideoPlayer;