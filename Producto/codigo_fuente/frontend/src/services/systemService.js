/**
 * systemService.js
 * Servicio de telemetría y salud del sistema.
 *
 * El backend NO tiene un único `/system/status`, así que componemos
 * la respuesta a partir de varios endpoints:
 *   GET /health             → {status, postgres, minio, redis, ollama, yolo, uptime_s}
 *   GET /health/ia          → {yolo, llava, modelo_yolo, modelo_llava}
 *   GET /estados            → estado live de cámaras
 */
import apiClient from './api';

export const systemService = {
  async getHealth() {
    const { data } = await apiClient.get('/health');
    return data;
  },

  async getHealthIA() {
    const { data } = await apiClient.get('/health/ia');
    return data;
  },

  async getHealthHistorico(limite = 50) {
    const { data } = await apiClient.get('/health/historico', { params: { limite } });
    return Array.isArray(data) ? data : (data.historico ?? []);
  },

  /**
   * Construye el objeto que la página `System.jsx` espera:
   *   { backend, activeCameras, totalCameras, latencyMs, services, ia }
   * Hace 3 requests en paralelo, tolera fallos parciales.
   */
  async getSystemStatus() {
    const [health, healthIA, estadosResp] = await Promise.allSettled([
      this.getHealth(),
      this.getHealthIA(),
      apiClient.get('/estados'),
    ]);

    const h   = health.status   === 'fulfilled' ? health.value   : null;
    const hia = healthIA.status === 'fulfilled' ? healthIA.value : null;
    const es  = estadosResp.status === 'fulfilled'
      ? (Array.isArray(estadosResp.value.data)
          ? estadosResp.value.data
          : estadosResp.value.data.estados ?? [])
      : [];

    const total  = es.length;
    const active = es.filter(e => e.online).length;

    return {
      backend:        h?.status === 'ok' ? 'online' : 'offline',
      activeCameras:  active,
      totalCameras:   total,
      latencyMs:      hia?.yolo?.latencia_ms ?? null,
      services: h ? {
        postgres: h.postgres, minio: h.minio, redis: h.redis,
        ollama: h.ollama, yolo: h.yolo,
      } : null,
      ia: hia,
    };
  },
};

export default systemService;
