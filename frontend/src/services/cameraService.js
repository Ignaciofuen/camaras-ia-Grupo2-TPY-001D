import api from './api';

const normalizeCameraList = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.camaras)) return data.camaras;
  if (Array.isArray(data?.cameras)) return data.cameras;
  if (Array.isArray(data?.estados)) return data.estados;
  return [];
};

export const cameraService = {
  async getCameras(signal) {
    const { data } = await api.get('/camaras', { signal });
    return normalizeCameraList(data);
  },

  async getCamera(idOrName) {
    const { data } = await api.get(`/camaras/${encodeURIComponent(idOrName)}`);
    return data;
  },

  async getEstados() {
    const { data } = await api.get('/estados');
    return normalizeCameraList(data);
  },

  async getEstadoCamara(nombre) {
    const { data } = await api.get(`/camaras/${encodeURIComponent(nombre)}/estado`);
    return data;
  },

  async getCooldown(nombre, tipo = 'analisis') {
    const { data } = await api.get(
      `/camaras/${encodeURIComponent(nombre)}/cooldown`,
      { params: { tipo } }
    );
    return data;
  },
};

export const getCameras = (signal) => cameraService.getCameras(signal);

export default cameraService;
