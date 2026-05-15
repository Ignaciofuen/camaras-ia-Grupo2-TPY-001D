import axios from 'axios';
import { getToken, removeToken } from '../auth/tokenService';

/**
 * Cliente HTTP centralizado.
 *
 * En desarrollo usa rutas relativas para aprovechar el proxy de Vite.
 * En produccion se puede definir VITE_API_URL.
 *
 * La seguridad se mantiene aca: cualquier servicio que use este cliente
 * recibe automaticamente Authorization: Bearer <token>.
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = getToken();

    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.name === 'CanceledError' || error.code === 'ERR_CANCELED') {
      return Promise.reject(error);
    }

    if (error.code === 'ECONNABORTED') {
      console.error('[API] timeout');
      return Promise.reject({
        message: 'Tiempo de espera agotado',
        type: 'timeout',
      });
    }

    if (!error.response) {
      console.error('[API] sin conexion o servidor caido');
      return Promise.reject({
        message: 'Servidor no disponible',
        type: 'network',
      });
    }

    const { status } = error.response;

    if (status === 401) {
      removeToken();

      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }

    return Promise.reject({
      message:
        error.response.data?.message ||
        error.response.data?.detail ||
        'Error del servidor',
      status,
      type: 'api',
      data: error.response.data,
    });
  }
);

export default api;
