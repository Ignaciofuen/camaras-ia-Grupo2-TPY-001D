import axios from 'axios';
import { getToken, removeToken } from '../auth/tokenService';

/**
 * Instancia central de Axios.
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 5000,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Interceptor de request
 */
api.interceptors.request.use(
  (config) => {
    const token = getToken();

    if (token) {
      // aseguramos que headers exista
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

/**
 * Interceptor de response
 */
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // sin respuesta → backend caído / red
    if (!error.response) {
      console.error('[API] sin conexión o servidor caído');
      return Promise.reject({
        message: 'Servidor no disponible',
        type: 'network',
      });
    }

    const { status } = error.response;

    // 401 → sesión inválida
    if (status === 401) {
      removeToken();

      // evitamos loop si ya estamos en login
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }

    // timeout
    if (error.code === 'ECONNABORTED') {
      console.error('[API] timeout');
      return Promise.reject({
        message: 'Tiempo de espera agotado',
        type: 'timeout',
      });
    }

    // errores del backend
    return Promise.reject({
      message: error.response.data?.message || 'Error del servidor',
      status,
      type: 'api',
    });
  }
);

export default api;