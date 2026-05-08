import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * useSystemStatus
 *
 * Hook para monitorear el estado del backend y la latencia.
 *
 * Este hook:
 * - hace un "ping" al backend cada cierto tiempo
 * - mide cuánto demora la respuesta
 * - clasifica el estado del sistema según la latencia
 *
 * No tiene lógica de UI, solo entrega datos.
 */
export const useSystemStatus = () => {
  // estados del sistema
  const [status, setStatus] = useState('connecting'); 
  const [latency, setLatency] = useState('--ms');
  const [version, setVersion] = useState('v1.0.4');

  // referencia para cancelar requests en curso
  const abortRef = useRef(null);

  /**
   * checkSystemHealth
   *
   * Hace la petición al backend y calcula la latencia.
   * Si hay una request anterior, la cancela para evitar solapamiento.
   */
  const checkSystemHealth = useCallback(async () => {
    // cancelar request anterior si existe
    if (abortRef.current) {
      abortRef.current.abort();
    }

    const controller = new AbortController();
    abortRef.current = controller;

    const startTime = performance.now();

    try {
      // debería venir desde configuración, no hardcodeado
      const apiUrl =
        import.meta.env.VITE_API_URL || 'http://localhost:8000';

      // timeout manual para evitar que quede colgado
      const timeout = setTimeout(() => {
        controller.abort();
      }, 3000);

      const response = await fetch(`${apiUrl}/health`, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Cache-Control': 'no-cache',
        },
      });

      clearTimeout(timeout);

      const endTime = performance.now();
      const currentLatency = Math.round(endTime - startTime);

      // actualizamos latencia siempre que haya respuesta
      setLatency(`${currentLatency}ms`);

      // clasificación simple del estado
      if (response.ok) {
        if (currentLatency < 150) {
          setStatus('optimal');
        } else if (currentLatency < 400) {
          setStatus('degraded');
        } else {
          setStatus('critical');
        }

        // intento de leer versión (opcional)
        try {
          const data = await response.json();
          if (data?.version) {
            setVersion(data.version);
          }
        } catch {
          // no todos los /health devuelven JSON
        }

      } else {
        setStatus('critical');
      }

    } catch (error) {
      // si se aborta, no lo tratamos como error real
      if (error.name === 'AbortError') return;

      // error de red o backend caído
      setStatus('offline');
      setLatency('--ms');
    }
  }, []);

  useEffect(() => {
    // ejecución inicial
    checkSystemHealth();

    // ejecución periódica
    const intervalId = setInterval(checkSystemHealth, 10000);

    return () => {
      // limpiar request activa
      if (abortRef.current) {
        abortRef.current.abort();
      }

      // limpiar intervalo
      clearInterval(intervalId);
    };
  }, [checkSystemHealth]);

  return { status, latency, version };
};