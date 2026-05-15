import { useCallback, useEffect, useState } from 'react';
import { cameraService } from '../services/cameraService';

export const useCameras = () => {
  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefetching, setIsRefetching] = useState(false);
  const [error, setError] = useState(null);

  const fetchCameras = useCallback(async (signal, isBackground = false) => {
    try {
      if (isBackground) {
        setIsRefetching(true);
      } else {
        setLoading(true);
      }

      setError(null);
      const data = await cameraService.getCameras(signal);
      setCameras(Array.isArray(data) ? data : []);
    } catch (err) {
      if (err.name === 'CanceledError' || err.name === 'AbortError') return;

      setError(err.message || 'Error al obtener camaras');

      if (!isBackground) {
        setCameras([]);
      }
    } finally {
      if (isBackground) {
        setIsRefetching(false);
      } else {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => fetchCameras(controller.signal, false));
    return () => controller.abort();
  }, [fetchCameras]);

  const refetch = useCallback(() => {
    const controller = new AbortController();
    fetchCameras(controller.signal, true);
  }, [fetchCameras]);

  return {
    cameras,
    loading,
    isRefetching,
    error,
    refetch,
  };
};
