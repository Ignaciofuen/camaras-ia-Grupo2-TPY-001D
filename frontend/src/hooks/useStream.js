import { useCallback, useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';

export const useStream = (videoRef, streamUrl) => {
  const [status, setStatus] = useState('loading');
  const hlsRef = useRef(null);

  const initStream = useCallback(() => {
    const video = videoRef.current;

    if (!streamUrl) {
      setStatus('loading');
      return;
    }

    if (!video) {
      setStatus('error');
      return;
    }

    setStatus('loading');

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 5,
        liveSyncDurationCount: 2,
        liveMaxLatencyDurationCount: 6,
        maxLiveSyncPlaybackRate: 1.5,
        manifestLoadingMaxRetry: -1,
        manifestLoadingRetryDelay: 3000,
        levelLoadingMaxRetry: -1,
      });

      hlsRef.current = hls;
      hls.attachMedia(video);

      hls.on(Hls.Events.MEDIA_ATTACHED, () => {
        hls.loadSource(streamUrl);
      });

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => setStatus('error'));
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (!data.fatal) return;

        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            console.warn(`[useStream] problema de red en ${streamUrl}`);
            hls.startLoad();
            setStatus('loading');
            break;

          case Hls.ErrorTypes.MEDIA_ERROR:
            console.warn(`[useStream] error de video en ${streamUrl}`);
            hls.recoverMediaError();
            setStatus('loading');
            break;

          default:
            console.error(`[useStream] error fatal en ${streamUrl}`);
            hls.destroy();
            setStatus('error');
            break;
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = streamUrl;

      const handleLoadedMetadata = () => {
        video.play().catch(() => setStatus('error'));
      };

      video.addEventListener('loadedmetadata', handleLoadedMetadata);
      video._hlsHandler = handleLoadedMetadata;
    } else {
      console.error('[useStream] navegador no compatible con HLS');
      setStatus('error');
    }
  }, [streamUrl, videoRef]);

  useEffect(() => {
    const initTimer = window.setTimeout(initStream, 0);

    const video = videoRef.current;
    const handlePlaying = () => setStatus('playing');
    const handleWaiting = () => setStatus('loading');
    const handleError = () => setStatus('error');

    if (video) {
      video.addEventListener('playing', handlePlaying);
      video.addEventListener('waiting', handleWaiting);
      video.addEventListener('error', handleError);
    }

    return () => {
      window.clearTimeout(initTimer);

      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      if (video) {
        video.removeEventListener('playing', handlePlaying);
        video.removeEventListener('waiting', handleWaiting);
        video.removeEventListener('error', handleError);

        if (video._hlsHandler) {
          video.removeEventListener('loadedmetadata', video._hlsHandler);
          delete video._hlsHandler;
        }

        video.pause();
        video.src = '';
        video.removeAttribute('src');
        video.load();
      }
    };
  }, [initStream, videoRef]);

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
