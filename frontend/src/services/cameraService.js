import api from './api';

/**
 * Servicio de cámaras.
 * Encapsula todas las llamadas relacionadas.
 */
export const getCameras = (signal) => {
  return api.get('/cameras', { signal });
};