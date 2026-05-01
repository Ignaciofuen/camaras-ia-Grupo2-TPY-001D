import { useEffect, useRef } from 'react';
import Hls from 'hls.js';

/**
 * VideoPlayer
 * Componente puro para reproducir streams HLS.
 * Diseñado para consumir la salida de MediaMTX en tiempo real.
 * * @param {string} streamUrl - URL real del archivo .m3u8
 */
const VideoPlayer = ({ streamUrl }) => {
  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !streamUrl) return;

    let hls = null;

    if (Hls.isSupported()) {
      // Configuración orientada a latencia ultrabaja para VMS
      hls = new Hls({
        enableWorker: true,
        liveSyncDurationCount: 3, // Mantiene el buffer lo más cerca posible del borde en vivo
        maxLiveSyncPlaybackRate: 1.5, // Acelera levemente el video si el cliente se atrasa
        manifestLoadingMaxRetry: 5, // Intentos de reconexión si MediaMTX reinicia
        manifestLoadingRetryDelay: 1000,
      });

      hls.loadSource(streamUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        // En navegadores modernos, autoPlay requiere muted=true
        video.play().catch((err) => {
          console.warn(`[VideoPlayer] Autoplay bloqueado o fallido para ${streamUrl}:`, err);
        });
      });

      // Lógica de resiliencia frente a errores (Vital en producción)
      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.warn(`[VideoPlayer] Error de red HLS. Intentando recuperar ${streamUrl}...`);
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.warn(`[VideoPlayer] Error de media HLS. Intentando recuperar...`);
              hls.recoverMediaError();
              break;
            default:
              console.error(`[VideoPlayer] Error fatal HLS. Destruyendo instancia.`);
              hls.destroy();
              break;
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Fallback para Safari (Soporte nativo HLS de Apple)
      video.src = streamUrl;
      video.addEventListener('loadedmetadata', () => {
        video.play().catch((err) => {
          console.warn(`[VideoPlayer] Autoplay bloqueado en Safari para ${streamUrl}:`, err);
        });
      });
    }

    // Cleanup: Destruir la instancia de hls.js al desmontar
    // Regla estricta: Si esto no se hace, los Web Workers saturarán la memoria RAM.
    return () => {
      if (hls) {
        hls.destroy();
      }
      // Limpiar el source nativo si existe
      if (video) {
        video.removeAttribute('src');
        video.load();
      }
    };
  }, [streamUrl]);

  return (
    <video
      ref={videoRef}
      className="w-full h-full object-contain bg-black"
      autoPlay
      muted // Obligatorio para autoPlay en Chrome/Firefox/Safari
      playsInline // Evita que iOS abra el reproductor nativo en pantalla completa
    />
  );
};

export default VideoPlayer;