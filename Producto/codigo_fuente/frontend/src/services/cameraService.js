/**
 * cameraService.js
 * Servicio de cámaras: consulta el backend FastAPI.
 *
 * Endpoints REST que cubre:
 *   GET /camaras                       → lista de cámaras
 *   GET /camaras/{id}                  → detalle
 *   GET /estados                       → estado live de TODAS (Redis, ~5ms)
 *   GET /camaras/{nombre}/estado       → estado live de una
 *   GET /camaras/{nombre}/cooldown     → cooldown del LLaVA
 */
import apiClient from './api';

export const cameraService = {
  /** Lista todas las cámaras configuradas en la DB */
  async getCameras() {
    const { data } = await apiClient.get('/camaras');
    // El backend devuelve { camaras: [...], total: N }
    return Array.isArray(data) ? data : (data.camaras ?? []);
  },

  /** Detalle de una cámara por id (numérico) o nombre */
  async getCamera(idOrName) {
    const { data } = await apiClient.get(`/camaras/${idOrName}`);
    return data;
  },

  /** Estado en vivo de TODAS las cámaras (Redis, no Postgres) */
  async getEstados() {
    const { data } = await apiClient.get('/estados');
    return Array.isArray(data) ? data : (data.estados ?? []);
  },

  /** Estado en vivo de UNA cámara puntual (Redis) */
  async getEstadoCamara(nombre) {
    const { data } = await apiClient.get(`/camaras/${encodeURIComponent(nombre)}/estado`);
    return data;
  },

  /** ¿Está activo el cooldown anti-spam del LLaVA en esa cámara? */
  async getCooldown(nombre, tipo = 'analisis') {
    const { data } = await apiClient.get(
      `/camaras/${encodeURIComponent(nombre)}/cooldown`,
      { params: { tipo } }
    );
    return data;
  },
};

export default cameraService;
