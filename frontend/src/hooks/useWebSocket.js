import { useState, useEffect, useRef } from 'react';
import { WebSocketService } from '../services/websocket';

/**
 * useWebSocket
 * Hook personalizado para manejar el estado y ciclo de vida de la conexión WS.
 * * @param {string} url - URL del servidor WebSocket
 * @param {Function} onMessage - Callback ejecutado al recibir datos
 * @returns {Object} { status, send } - Estado de la conexión y función de envío
 */
export const useWebSocket = (url, onMessage) => {
  // Estados posibles: 'disconnected' | 'connecting' | 'connected' | 'error'
  const [status, setStatus] = useState('disconnected');
  
  // Refs para evitar problemas de dependencias y conexiones duplicadas
  const wsRef = useRef(null);
  const onMessageRef = useRef(onMessage);

  // Mantenemos la referencia del callback actualizada sin disparar re-renders
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    if (!url) return;

    // Prevención estricta de conexiones duplicadas
    if (wsRef.current) {
      return;
    }

    setStatus('connecting');
    const wsService = new WebSocketService();
    wsRef.current = wsService;

    wsService.connect(url, {
      onOpen: () => {
        setStatus('connected');
      },
      onMessage: (data) => {
        if (onMessageRef.current) {
          onMessageRef.current(data);
        }
      },
      onError: () => {
        setStatus('error');
      },
      onClose: () => {
        setStatus('disconnected');
      }
    });

    // Cleanup: Se ejecuta al desmontar el componente o si la URL cambia
    return () => {
      if (wsRef.current) {
        wsRef.current.disconnect();
        wsRef.current = null;
      }
    };
  }, [url]);

  // Exponemos el método send para que los componentes puedan hablar con el servidor
  const send = (data) => {
    if (wsRef.current) {
      wsRef.current.send(data);
    }
  };

  return { status, send };
};