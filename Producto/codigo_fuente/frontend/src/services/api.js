import axios from 'axios';

/**
 * api.js
 * Configuracion centralizada del cliente HTTP (Axios).
 *
 * En dev: baseURL queda vacio y los servicios usan rutas relativas.
 * Vite redirige /health, /camaras, /alertas, etc. al backend FastAPI
 * en localhost:8000 via el proxy definido en vite.config.js.
 *
 * En prod: setear VITE_API_URL=https://api.tu-dominio.com en .env.production
 *
 * IMPORTANTE: el backend FastAPI NO tiene prefix /api. Los endpoints son
 * /health, /camaras, /alertas, etc. (no /api/health).
 */
const baseURL = import.meta.env.VITE_API_URL || '';

const apiClient = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
    'Accept':       'application/json',
  },
  // Timeout vital en sistemas de monitoreo: si el backend se cae, no colgamos la UI
  timeout: 10000,
});

// Interceptor de request (listo para inyectar JWT en el futuro)
apiClient.interceptors.request.use(
  (config) => {
    // const token = localStorage.getItem('token');
    // if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor de response (log centralizado de errores)
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const code = error.response?.status || 'Network';
    console.error(`[API] Error ${code}:`, error.message);
    return Promise.reject(error);
  }
);

export default apiClient;
