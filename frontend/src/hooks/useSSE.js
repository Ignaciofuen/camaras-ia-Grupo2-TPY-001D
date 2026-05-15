import { useEffect, useRef, useState } from 'react';
import { SSEService } from '../services/sse';

export const useSSE = (url, onAlerta) => {
  const [status, setStatus] = useState('disconnected');
  const sseRef = useRef(null);
  const onAlertaRef = useRef(onAlerta);

  useEffect(() => {
    onAlertaRef.current = onAlerta;
  }, [onAlerta]);

  useEffect(() => {
    if (!url || sseRef.current) return undefined;

    setStatus('connecting');
    const sse = new SSEService();
    sseRef.current = sse;

    sse.connect(url, {
      onOpen: () => setStatus('connected'),
      onHello: () => setStatus('connected'),
      onAlerta: (data) => onAlertaRef.current?.(data),
      onError: () => setStatus('error'),
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
