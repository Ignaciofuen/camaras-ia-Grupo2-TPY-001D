import { useState, useEffect, useRef, useCallback } from 'react';
import Hls from 'hls.js';

/**
 * useStream
 * Hook para gestionar la reproducción de video en tiempo real vía HLS.
 * Incluye gestión de memoria, recuperación de errores y soporte nativo (Safari).
 * * @param {Object} videoRef - Referencia al elemento HTML <video> (useRef)
 * @param {string} streamUrl - URL del stream M3U8 (MediaMTX)
 * @returns {Object} { status, loading, playing, error, reloadStream }
 */
export const useStream = (videoRef, streamUrl) => {
  const [status, setStatus] = useState('loading'); // 'loading' | 'playing' | 'error'
  const hlsRef = useRef(null);

  const initStream = useCallback(() => {
    const video = videoRef.current;
    if (!video || !streamUrl) {
      setStatus('error');
      return;
    }

    setStatus('loading');

    // 1. Destruir instancia previa si existe (Cleanup)
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    // 2. Comprobar si el navegador soporta MSE (Media Source Extensions) para hls.js
    if (Hls.isSupported()) {
      // Configuración orientada a baja latencia para videovigilancia
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 30, // Mantener buffer corto
        liveSyncDurationCount: 3, // Intentar mantenerse cerca del live edge
        manifestLoadingTimeOut: 10000,
        manifestLoadingMaxRetry: 5,
        levelLoadingTimeOut: 10000,
        levelLoadingMaxRetry: 5,
      });

      hlsRef.current = hls;
      hls.attachMedia(video);

      hls.on(Hls.Events.MEDIA_ATTACHED, () => {
        hls.loadSource(streamUrl);
      });

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        // En navegadores modernos, requiere que el video tenga atributo 'muted'
        video.play().catch(() => setStatus('error'));
      });

      // Gestión avanzada de reconexión y recuperación de errores
      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.warn(`[useStream] Error de red en stream ${streamUrl}. Intentando recuperar...`);
              hls.startLoad();
              setStatus('loading');
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.warn(`[useStream] Error de medios en stream ${streamUrl}. Intentando recuperar...`);
              hls.recoverMediaError();
              setStatus('loading');
              break;
            default:
              console.error(`[useStream] Error fatal no recuperable en stream ${streamUrl}.`);
              hls.destroy();
              setStatus('error');
              break;
          }
        }
      });
    } 
    // 3. Fallback para Safari (Soporte nativo HLS sin MSE)
    else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = streamUrl;
      video.addEventListener('loadedmetadata', () => {
        video.play().catch(() => setStatus('error'));
      });
    } else {
      console.error('[useStream] El navegador no soporta reproducción HLS.');
      setStatus('error');
    }
  }, [streamUrl, videoRef]);

  // Ciclo de vida principal del stream y listeners nativos del elemento video
  useEffect(() => {
    initStream();

    const video = videoRef.current;
    
    // Sincronización de estado con los eventos nativos del reproductor
    const handlePlaying = () => setStatus('playing');
    const handleWaiting = () => setStatus('loading');
    const handleError = () => setStatus('error');

    if (video) {
      video.addEventListener('playing', handlePlaying);
      video.addEventListener('waiting', handleWaiting);
      video.addEventListener('error', handleError);
    }

    // Cleanup profundo al desmontar
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (video) {
        video.removeEventListener('playing', handlePlaying);
        video.removeEventListener('waiting', handleWaiting);
        video.removeEventListener('error', handleError);
        video.src = '';
        video.removeAttribute('src');
      }
    };
  }, [initStream, videoRef]);

  // Expone una función para forzar el reinicio manual del stream
  const reloadStream = useCallback(() => {
    initStream();
  }, [initStream]);

  return {
    status,
    loading: status === 'loading',
    playing: status === 'playing',
    error: status === 'error',
    reloadStream
  };
};