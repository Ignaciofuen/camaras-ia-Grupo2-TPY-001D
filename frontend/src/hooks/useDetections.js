import { useEffect, useRef, useState } from 'react';
import { SSEService } from '../services/sse';

const TTL_MS = 1500;

export const useDetections = (url = '/detecciones/stream') => {
  const [detectionsMap, setDetectionsMap] = useState({});
  const [status, setStatus] = useState('disconnected');
  const sseRef = useRef(null);
  const lastUpdateRef = useRef({});

  useEffect(() => {
    if (!url || sseRef.current) return undefined;

    setStatus('connecting');
    const sse = new SSEService();
    sseRef.current = sse;

    sse.connect(url, {
      onOpen: () => setStatus('connected'),
      onHello: () => setStatus('connected'),
      onError: () => setStatus('error'),
    });

    const attachDeteccionListener = () => {
      if (!sse.es) {
        window.setTimeout(attachDeteccionListener, 50);
        return;
      }

      sse.es.addEventListener('deteccion', (event) => {
        try {
          const payload = JSON.parse(event.data);
          const cameraKey = payload.camara || payload.cameraId;

          if (!cameraKey) return;

          const boxes = (payload.boxes || payload.detections || []).map((box) => ({
            id: box.id ?? `${cameraKey}-${Math.random()}`,
            label: box.label || box.class || 'object',
            confidence: box.conf ?? box.confidence ?? 0,
            x: (box.x ?? 0) * 100,
            y: (box.y ?? 0) * 100,
            width: (box.w ?? box.width ?? 0) * 100,
            height: (box.h ?? box.height ?? 0) * 100,
          }));

          lastUpdateRef.current[cameraKey] = Date.now();
          setDetectionsMap((prev) => ({ ...prev, [cameraKey]: boxes }));
        } catch (error) {
          console.error('[useDetections] payload invalido:', error);
        }
      });
    };

    attachDeteccionListener();

    const gcId = window.setInterval(() => {
      const now = Date.now();
      const stale = Object.entries(lastUpdateRef.current)
        .filter(([, ts]) => now - ts > TTL_MS)
        .map(([cameraKey]) => cameraKey);

      if (!stale.length) return;

      setDetectionsMap((prev) => {
        const next = { ...prev };

        stale.forEach((cameraKey) => {
          delete next[cameraKey];
          delete lastUpdateRef.current[cameraKey];
        });

        return next;
      });
    }, 500);

    return () => {
      window.clearInterval(gcId);

      if (sseRef.current) {
        sseRef.current.disconnect();
        sseRef.current = null;
      }

      setStatus('disconnected');
    };
  }, [url]);

  return { detectionsMap, status };
};

export default useDetections;
