/**
 * authService.js
 *
 * Servicio REAL de autenticación contra el backend FastAPI.
 * Endpoints:
 *   POST /auth/login    → {access_token, user}
 *   GET  /auth/profile  → {username, email, nombre_completo, role}
 *   POST /auth/logout   → {ok}
 */
import api from '../services/api';
import { setToken, removeToken } from './tokenService';

export const login = async (username, password) => {
  const { data } = await api.post('/auth/login', { username, password });
  if (data?.access_token) {
    setToken(data.access_token);
  }
  return data;   // {access_token, token_type, user}
};

export const logout = async () => {
  try {
    await api.post('/auth/logout');
  } catch {
    // si el backend no responde, igual hacemos logout local
  }
  removeToken();
};

export const getProfile = async () => {
  const { data } = await api.get('/auth/profile');
  return data;
};
