import { useState, useEffect, useCallback } from 'react';
import { cameraService } from '../services/cameraService';

/**
 * useCameras
 * Trae la lista de camaras desde el backend y la mantiene en estado.
 *
 * El backend expone GET /camaras (en espanol). Usamos cameraService
 * en vez de fetch crudo para respetar el axios client centralizado
 * (timeout, interceptors, baseURL).
 *
 * @returns {Object} { cameras, loading, error, refetch }
 */
export const useCameras = () => {
  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const fetchCameras = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await cameraService.getCameras();
      setCameras(Array.isArray(data) ? data : []);
    } catch (err) {
      if (err.name === 'CanceledError' || err.name === 'AbortError') return;
      setError(err.message || 'Error desconocido al conectar con el servidor');
      setCameras([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCameras();
  }, [fetchCameras]);

  return { cameras, loading, error, refetch: fetchCameras };
};
