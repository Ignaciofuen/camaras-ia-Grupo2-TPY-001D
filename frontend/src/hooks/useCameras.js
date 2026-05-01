import { useState, useEffect, useCallback } from 'react';

/**
 * useCameras
 * Hook personalizado para obtener y gestionar la lista de cámaras desde el backend.
 * * @param {string} baseUrl - URL base de la API (opcional, por si usas variables de entorno)
 * @returns {Object} { cameras, loading, error, refetch }
 */
export const useCameras = (baseUrl = '') => {
  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchCameras = useCallback(async (abortSignal) => {
    try {
      setLoading(true);
      setError(null);

      // Petición real al endpoint
      const response = await fetch(`${baseUrl}/cameras`, {
        signal: abortSignal,
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status} - ${response.statusText}`);
      }

      const data = await response.json();
      
      // Asegurar que guardamos un array (defensivo ante respuestas malformadas del backend)
      setCameras(Array.isArray(data) ? data : []);

    } catch (err) {
      // Ignorar errores generados intencionalmente por el AbortController
      if (err.name === 'AbortError') return;
      
      setError(err.message || 'Error desconocido al conectar con el servidor');
      setCameras([]); // Limpiar estado previo en caso de error crítico
    } finally {
      setLoading(false);
    }
  }, [baseUrl]);

  useEffect(() => {
    const abortController = new AbortController();
    
    fetchCameras(abortController.signal);

    // Cleanup: Cancela la petición HTTP si el componente se desmonta antes de recibir respuesta
    return () => {
      abortController.abort();
    };
  }, [fetchCameras]);

  // Exponer una función para recargar la lista manualmente (útil para botones de "Actualizar" en la UI)
  const refetch = () => {
    fetchCameras();
  };

  return { cameras, loading, error, refetch };
};