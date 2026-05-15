import api from './api';

const normalizeAlertList = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.alertas)) return data.alertas;
  if (Array.isArray(data?.alerts)) return data.alerts;
  return [];
};

export const alertService = {
  async getAlertas(filtros = {}) {
    const { data } = await api.get('/alertas', { params: filtros });
    return normalizeAlertList(data);
  },

  async getAlerta(id) {
    const { data } = await api.get(`/alertas/${id}`);
    return data;
  },

  getSnapshotUrl(id) {
    const baseURL = import.meta.env.VITE_API_URL || '';
    return `${baseURL}/alertas/${id}/snapshot`;
  },

  async deleteAlerta(id) {
    const { data } = await api.delete(`/alertas/${id}`);
    return data;
  },

  async deleteAlertasByDate(fecha) {
    const { data } = await api.delete('/alertas', {
      params: { fecha, confirmar: true },
    });
    return data;
  },
};

export default alertService;
