import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

/**
 * useCameras
 *
 * Este hook se encarga de traer las cámaras desde el backend.
 *
 * Maneja dos tipos de carga:
 * - loading: carga inicial (pantalla completa)
 * - isRefetching: actualización en segundo plano (no rompe la UI)
 */
export const useCameras = () => {
  const [cameras, setCameras] = useState([]);

  // loading principal (cuando la vista recién carga)
  const [loading, setLoading] = useState(true);

  // loading en segundo plano (para refresh sin bloquear UI)
  const [isRefetching, setIsRefetching] = useState(false);

  const [error, setError] = useState(null);

  /**
   * Función base para traer cámaras
   *
   * isBackground:
   * - false → carga inicial
   * - true → actualización silenciosa
   */
  const fetchCameras = useCallback(async (signal, isBackground = false) => {
    try {
      if (isBackground) {
        setIsRefetching(true);
      } else {
        setLoading(true);
      }

      setError(null);

      // llamada real al backend
      const response = await api.get('/cameras', { signal });
      const data = response.data;

      // defensivo: aseguramos que siempre sea array
      setCameras(Array.isArray(data) ? data : []);

    } catch (err) {
      // axios usa CanceledError cuando abortas
      if (err.name === 'CanceledError') return;

      setError(err.message || 'Error al obtener cámaras');

      // si falla la carga inicial, limpiamos
      // si falla el refetch, mantenemos lo que ya había
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

  /**
   * Carga inicial (cuando entra a la vista)
   */
  useEffect(() => {
    const controller = new AbortController();

    fetchCameras(controller.signal, false);

    return () => controller.abort();
  }, [fetchCameras]);

  /**
   * Refetch manual (no rompe la UI)
   * útil para botón "Actualizar" o auto-refresh
   */
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