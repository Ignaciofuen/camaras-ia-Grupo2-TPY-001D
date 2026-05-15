import api from './api';

const normalizeList = (data, key) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.[key])) return data[key];
  return [];
};

export const systemService = {
  async getHealth() {
    const { data } = await api.get('/health');
    return data;
  },

  async getHealthIA() {
    const { data } = await api.get('/health/ia');
    return data;
  },

  async getHealthHistorico(limite = 50) {
    const { data } = await api.get('/health/historico', { params: { limite } });
    return normalizeList(data, 'historico');
  },

  async getMetrics() {
    const { data } = await api.get('/sistema/metricas');
    return data;
  },

  async getSystemStatus() {
    try {
      const metrics = await this.getMetrics();
      const camaras = normalizeList(metrics?.camaras, 'camaras');
      const servicios = normalizeList(metrics?.servicios, 'servicios');
      const totales = metrics?.totales || {};

      return {
        backend: servicios.some((service) => service.estado === 'offline')
          ? 'degraded'
          : 'online',
        activeCameras:
          totales.camaras_online ??
          camaras.filter((camera) => camera.estado === 'online').length,
        totalCameras: totales.camaras_total ?? camaras.length,
        latencyMs: totales.latencia_yolo_ms_avg ?? null,
        services: servicios,
        ia: metrics?.ia || null,
        raw: metrics,
      };
    } catch {
      const [health, healthIA, estadosResp] = await Promise.allSettled([
        this.getHealth(),
        this.getHealthIA(),
        api.get('/estados'),
      ]);

      const h = health.status === 'fulfilled' ? health.value : null;
      const hia = healthIA.status === 'fulfilled' ? healthIA.value : null;
      const estados = estadosResp.status === 'fulfilled'
        ? normalizeList(estadosResp.value.data, 'estados')
        : [];

      const total = estados.length;
      const active = estados.filter((estado) => (
        estado.online || estado.estado === 'online'
      )).length;

      return {
        backend: h?.status === 'ok' ? 'online' : 'offline',
        activeCameras: active,
        totalCameras: total,
        latencyMs: hia?.yolo?.latencia_ms ?? null,
        services: h ? [
          { componente: 'postgres', estado: h.postgres },
          { componente: 'minio', estado: h.minio },
          { componente: 'redis', estado: h.redis },
          { componente: 'ollama', estado: h.ollama },
          { componente: 'yolo', estado: h.yolo },
        ] : [],
        ia: hia,
        raw: { health: h, healthIA: hia, estados },
      };
    }
  },
};

export default systemService;
