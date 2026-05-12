import { useState, useEffect, useRef } from 'react';
import { SSEService } from '../services/sse';

/**
 * useSSE
 * Hook para consumir el stream de alertas SSE del backend.
 *
 * @param {string}   url        URL del endpoint SSE (ej. '/alertas/stream')
 * @param {Function} onAlerta   Callback con cada alerta nueva (objeto)
 *
 * @returns {Object} { status }
 *   status: 'disconnected' | 'connecting' | 'connected' | 'error'
 */
export const useSSE = (url, onAlerta) => {
  const [status, setStatus] = useState('disconnected');

  const sseRef = useRef(null);
  const onAlertaRef = useRef(onAlerta);

  // Mantenemos la ref del callback al día sin reconectar
  useEffect(() => {
    onAlertaRef.current = onAlerta;
  }, [onAlerta]);

  useEffect(() => {
    if (!url) return;
    if (sseRef.current) return;

    setStatus('connecting');
    const sse = new SSEService();
    sseRef.current = sse;

    sse.connect(url, {
      onOpen:   () => setStatus('connected'),
      onHello:  () => setStatus('connected'),
      onAlerta: (data) => onAlertaRef.current?.(data),
      onError:  () => setStatus('error'),
    });

    return () => {
      if (sseRef.current) {
        sseRef.current.disconnect();
        sseRef.current = null;
      }
      setStatus('disconnected');
    };
  }, [url]);

  return { status };
};
