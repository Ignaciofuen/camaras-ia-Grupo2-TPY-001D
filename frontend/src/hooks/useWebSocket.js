import { useEffect, useRef, useState } from 'react';
import { WebSocketService } from '../services/websocket';

/**
 * useWebSocket
 *
 * Hook encargado de:
 * - abrir conexión WS
 * - recibir detecciones
 * - mantener estado local
 */
export const useWebSocket = () => {
  const [status, setStatus] = useState('disconnected');
  const [detectionsMap, setDetectionsMap] = useState({});

  const wsRef = useRef(null);
  const bufferRef = useRef({});

  useEffect(() => {
    const wsUrl =
      import.meta.env.VITE_WS_URL ||
      'ws://localhost:8080/ws/detections';

    if (wsRef.current) return;

    setStatus('connecting');

    const wsService = new WebSocketService();
    wsRef.current = wsService;

    wsService.connect(wsUrl, {
      onOpen: () => setStatus('connected'),

      onMessage: (message) => {
        try {
          const data =
            typeof message === 'string'
              ? JSON.parse(message)
              : message;

          if (!data.cameraId) return;

          bufferRef.current[data.cameraId] =
            data.boxes || data.detections || [];
        } catch (error) {
          console.error('Error parseando WebSocket:', error);
        }
      },

      onError: () => setStatus('error'),

      onClose: () => setStatus('disconnected'),
    });

    /*
     * Actualización controlada del estado
     * para evitar demasiados renders.
     */
    const interval = setInterval(() => {
      setDetectionsMap({ ...bufferRef.current });
    }, 100);

    return () => {
      clearInterval(interval);

      if (wsRef.current) {
        wsRef.current.disconnect();
        wsRef.current = null;
      }
    };
  }, []);

  return {
    status,
    detectionsMap,
  };
};