import axios from 'axios';
import { getToken, removeToken } from '../auth/tokenService';

/**
 * api.js — Cliente HTTP centralizado con auth JWT.
 *
 * - En dev: baseURL = '' → Vite hace proxy a localhost:8000 (vite.config.js).
 * - En prod: setear VITE_API_URL.
 *
 * Interceptors:
 *   - request:  agrega Authorization: Bearer <token> si hay JWT.
 *   - response: 401 → borra token y redirige a /login.
 */
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    'Accept':       'application/json',
  },
});

apiClient.interceptors.request.use(
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

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Ignorar cancelaciones (AbortController)
    if (error.name === 'CanceledError' || error.code === 'ERR_CANCELED') {
      return Promise.reject(error);
    }

    const status = error.response?.status;
    const code   = status || 'Network';
    console.error(`[API] Error ${code}:`, error.message);

    // 401 → sesión expirada / inválida
    if (status === 401) {
      removeToken();
      // Solo redirigir si NO estamos ya en /login (evita loop)
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }

    // 403 → autenticado pero sin permisos. Toast global para el operador
    // sepa que la acción la rechazó el backend por rol insuficiente.
    if (status === 403 && typeof window !== 'undefined') {
      const detail = error.response?.data?.detail || 'Permisos insuficientes para esta acción.';
      window.dispatchEvent(new CustomEvent('app:toast', {
        detail: { type: 'error', message: detail, duration: 4000 },
      }));
    }
    return Promise.reject(error);
  }
);

export default apiClient;
