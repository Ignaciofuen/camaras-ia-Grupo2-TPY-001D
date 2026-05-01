import axios from 'axios';

/**
 * api.js
 * Configuración centralizada del cliente HTTP (Axios).
 * Gestiona la URL base dinámica y define interceptores globales.
 */

// Se obtiene la URL base desde las variables de entorno.
// Nota: Si usas Create React App cambia 'import.meta.env.VITE_API_URL' por 'process.env.REACT_APP_API_URL'.
const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

const apiClient = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  // Un timeout es vital en sistemas de monitoreo para no colgar la UI si el backend se cae
  timeout: 10000, 
});

// Interceptor de Peticiones (Opcional, listo para Auth)
apiClient.interceptors.request.use(
  (config) => {
    // Aquí puedes inyectar el token JWT en el futuro:
    // const token = localStorage.getItem('token');
    // if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor de Respuestas (Manejo global de errores)
apiClient.interceptors.response.use(
  (response) => {
    // Si la respuesta es exitosa, la pasamos directamente
    return response;
  },
  (error) => {
    // Log técnico centralizado
    console.error(`[API Service] Error ${error.response?.status || 'Network'}:`, error.message);
    
    // Aquí podrías despachar un evento global para mostrar un Toast de error en la UI
    // si el código es 401 (No autorizado) o 500 (Server Error).
    
    return Promise.reject(error);
  }
);

export default apiClient;