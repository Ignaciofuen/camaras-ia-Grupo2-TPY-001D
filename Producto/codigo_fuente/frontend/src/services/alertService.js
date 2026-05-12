/**
 * alertService.js
 * Servicio de alertas: histórico (REST) + URL de snapshot.
 * Para el realtime de alertas usá `services/sse.js` + hook useSSE.
 *
 * Endpoints REST que cubre:
 *   GET /alertas                     → lista (filtros: limite, nivel)
 *   GET /alertas/{id}                → detalle
 *   GET /alertas/{id}/snapshot       → JPG binario (la URL la devolvemos lista)
 *   GET /alertas/stream              → SSE (esto NO se usa por axios, ver sse.js)
 */
import apiClient from './api';

export const alertService = {
  /**
   * Lista alertas históricas con filtros opcionales.
   * @param {Object} filtros — { limite?, nivel?, camara?, desde?, hasta? }
   */
  async getAlertas(filtros = {}) {
    const { data } = await apiClient.get('/alertas', { params: filtros });
    return Array.isArray(data) ? data : (data.alertas ?? []);
  },

  /** Detalle de una alerta por id */
  async getAlerta(id) {
    const { data } = await apiClient.get(`/alertas/${id}`);
    return data;
  },

  /**
   * URL absoluta del snapshot de una alerta (apunta al backend).
   * Útil para `<img src={alertService.getSnapshotUrl(id)} />`.
   */
  getSnapshotUrl(id) {
    const base = import.meta.env.VITE_API_URL || '';
    return `${base}/alertas/${id}/snapshot`;
  },

  /** Borra una alerta por id. */
  async deleteAlerta(id) {
    const { data } = await apiClient.delete(`/alertas/${id}`);
    return data;
  },

  /**
   * Borra todas las alertas de una fecha. Requiere confirmar=true en el query.
   * @param {string} fecha YYYY-MM-DD
   */
  async deleteAlertasByDate(fecha) {
    const { data } = await apiClient.delete('/alertas', {
      params: { fecha, confirmar: true },
    });
    return data;
  },
};

export default alertService;
