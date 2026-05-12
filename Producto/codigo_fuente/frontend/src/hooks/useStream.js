import { useState, useEffect, useRef, useCallback } from 'react';
import Hls from 'hls.js';

/**
 * useStream
 *
 * Este hook maneja toda la lógica del stream HLS.
 *
 * Acá se hace:
 * - inicialización del video
 * - reconexión automática
 * - manejo de errores
 * - limpieza de memoria
 *
 * Importante:
 * Este hook tiene la lógica, el componente solo debería renderizar el <video>
 *
 * @param {Object} videoRef referencia al elemento <video>
 * @param {string} streamUrl URL del stream (.m3u8)
 */
export const useStream = (videoRef, streamUrl) => {
  // estado general del stream para mostrar loading / error en UI
  const [status, setStatus] = useState('loading');

  // guardo la instancia de hls para poder destruirla después
  const hlsRef = useRef(null);

  /**
   * función que inicia o reinicia el stream
   */
  const initStream = useCallback(() => {
    const video = videoRef.current;

    // Si no hay URL: idle (el VideoPlayer puede estar usando WebRTC).
    // No marcamos error y no tocamos el <video>.
    if (!streamUrl) {
      setStatus('loading');
      return;
    }
    if (!video) {
      setStatus('error');
      return;
    }

    setStatus('loading');

    // si ya había un stream activo, lo destruyo para evitar fugas de memoria
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    /**
     * caso normal (Chrome, Firefox, Edge, Android)
     */
    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true, // mejora rendimiento usando web workers
        lowLatencyMode: true, // intenta reducir el delay

        // RAM: poco backbuffer (somos un VMS en vivo, no un VOD).
        // Antes 30s -> 5s. La pagina Playback usa otro player.
        backBufferLength: 5,

        // Sincronizacion con el live edge:
        //  - liveSyncDurationCount: 2 (antes 3) -> mas cerca del "ahora"
        //  - liveMaxLatencyDurationCount: 6 -> si quedo mas atras, jump
        //  - maxLiveSyncPlaybackRate: 1.5 -> si esta atrasado, acelera
        //    el video 1.5x hasta alcanzar el live (sin saltar feo)
        liveSyncDurationCount: 2,
        liveMaxLatencyDurationCount: 6,
        maxLiveSyncPlaybackRate: 1.5,

        // en sistemas de cámaras no queremos que el stream muera
        // por eso dejamos reintentos infinitos
        manifestLoadingMaxRetry: -1,
        manifestLoadingRetryDelay: 3000,
        levelLoadingMaxRetry: -1,
      });

      hlsRef.current = hls;

      // conecto hls con el elemento <video>
      hls.attachMedia(video);

      hls.on(Hls.Events.MEDIA_ATTACHED, () => {
        hls.loadSource(streamUrl);
      });

      // cuando ya se puede reproducir
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => setStatus('error'));
      });

      /**
       * manejo de errores
       * esto es clave porque los streams pueden caerse en cualquier momento
       */
      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              // si se cae la red, intento reconectar
              console.warn(`[useStream] problema de red en ${streamUrl}`);
              hls.startLoad();
              setStatus('loading');
              break;

            case Hls.ErrorTypes.MEDIA_ERROR:
              // si falla el video, intento recuperarlo
              console.warn(`[useStream] error de video en ${streamUrl}`);
              hls.recoverMediaError();
              setStatus('loading');
              break;

            default:
              // error grave, no se puede recuperar
              console.error(`[useStream] error fatal en ${streamUrl}`);
              hls.destroy();
              setStatus('error');
              break;
          }
        }
      });
    }

    /**
     * Safari / iOS
     * estos navegadores ya soportan HLS sin hls.js
     */
    else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = streamUrl;

      const handleLoadedMetadata = () => {
        video.play().catch(() => setStatus('error'));
      };

      video.addEventListener('loadedmetadata', handleLoadedMetadata);

      // guardo la referencia para poder limpiarlo después
      video._hlsHandler = handleLoadedMetadata;
    }

    /**
     * navegador no soportado
     */
    else {
      console.error('[useStream] navegador no compatible con HLS');
      setStatus('error');
    }
  }, [streamUrl, videoRef]);

  /**
   * efecto principal
   */
  useEffect(() => {
    initStream();

    const video = videoRef.current;

    // eventos del video para saber en qué estado está
    const handlePlaying = () => setStatus('playing');
    const handleWaiting = () => setStatus('loading');
    const handleError = () => setStatus('error');

    if (video) {
      video.addEventListener('playing', handlePlaying);
      video.addEventListener('waiting', handleWaiting);
      video.addEventListener('error', handleError);
    }

    /**
     * limpieza cuando se desmonta el componente
     * esto es MUY importante si hay varias cámaras
     */
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      if (video) {
        video.removeEventListener('playing', handlePlaying);
        video.removeEventListener('waiting', handleWaiting);
        video.removeEventListener('error', handleError);

        // limpiar listener de safari
        if (video._hlsHandler) {
          video.removeEventListener('loadedmetadata', video._hlsHandler);
          delete video._hlsHandler;
        }

        // limpiar completamente el video para liberar memoria
        video.pause();
        video.src = '';
        video.removeAttribute('src');
        video.load();
      }
    };
  }, [initStream, videoRef]);

  /**
   * permite recargar el stream manualmente
   */
  const reloadStream = useCallback(() => {
    initStream();
  }, [initStream]);

  return {
    status,
    loading: status === 'loading',
    playing: status === 'playing',
    error: status === 'error',
    reloadStream,
  };
};