import { useState, useEffect, useRef } from 'react';
import { SSEService } from '../services/sse';

/**
 * useDetections
 *
 * Se subscribe al SSE /detecciones/stream y mantiene un mapa
 * { [cameraName]: detectionsArray } con las ultimas bboxes recibidas
 * por camara.
 *
 * El backend manda payloads con throttle ~5fps por camara con esta forma:
 *   {
 *     "camara": "Camara_Sonoff",
 *     "ts": 1717..,
 *     "boxes": [
 *       {"id":2,"label":"person","conf":0.87,"x":0.12,"y":0.34,"w":0.20,"h":0.55}
 *     ]
 *   }
 *
 * Las coordenadas vienen normalizadas (0..1). Las multiplicamos por 100
 * para pasarlas al DetectionOverlay que las usa como porcentaje.
 *
 * Si una camara deja de mandar updates por mas de TTL_MS, sus bboxes
 * se limpian automaticamente (asi no quedan boxes "fantasma" en pantalla
 * cuando la persona ya no esta).
 *
 * @param {string} url URL del endpoint SSE (default '/detecciones/stream')
 * @returns {Object} { detectionsMap, status }
 */
const TTL_MS = 1500;  // 1.5s sin updates -> bboxes se borran

export const useDetections = (url = '/detecciones/stream') => {
  const [detectionsMap, setDetectionsMap] = useState({});
  const [status, setStatus] = useState('disconnected');

  const sseRef = useRef(null);
  const lastUpdateRef = useRef({});  // {camara: tsMs}

  useEffect(() => {
    if (!url) return;
    if (sseRef.current) return;

    setStatus('connecting');
    const sse = new SSEService();
    sseRef.current = sse;

    sse.connect(url, {
      onOpen:  () => setStatus('connected'),
      onHello: () => setStatus('connected'),
      onError: () => setStatus('error'),
      onAlerta: () => {},  // ignoramos eventos de otro tipo si viniesen
    });

    // El SSEService ya engancha eventos "hello", "alerta" y "error", pero NO
    // tiene handler para "deteccion". Lo agregamos manualmente sobre el
    // EventSource interno (sse.es).
    const attachDeteccionListener = () => {
      if (!sse.es) {
        setTimeout(attachDeteccionListener, 50);
        return;
      }
      sse.es.addEventListener('deteccion', (event) => {
        try {
          const payload = JSON.parse(event.data);
          const cam = payload.camara;
          if (!cam) return;

          // Normalizar boxes al schema que espera DetectionOverlay
          const boxes = (payload.boxes || []).map((b) => ({
            id:         b.id ?? Math.random(),
            label:      b.label || 'object',
            confidence: b.conf ?? 0,
            x:          (b.x ?? 0) * 100,
            y:          (b.y ?? 0) * 100,
            width:      (b.w ?? 0) * 100,
            height:     (b.h ?? 0) * 100,
          }));

          lastUpdateRef.current[cam] = Date.now();
          setDetectionsMap((prev) => ({ ...prev, [cam]: boxes }));
        } catch (e) {
          console.error('[useDetections] payload invalido', e);
        }
      });
    };
    attachDeteccionListener();

    // GC periodico: limpiar boxes de camaras que dejaron de mandar updates
    const gcId = setInterval(() => {
      const now = Date.now();
      const stale = [];
      for (const [cam, ts] of Object.entries(lastUpdateRef.current)) {
        if (now - ts > TTL_MS) stale.push(cam);
      }
      if (stale.length) {
        setDetectionsMap((prev) => {
          const next = { ...prev };
          for (const cam of stale) {
            delete next[cam];
            delete lastUpdateRef.current[cam];
          }
          return next;
        });
      }
    }, 500);

    return () => {
      clearInterval(gcId);
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
