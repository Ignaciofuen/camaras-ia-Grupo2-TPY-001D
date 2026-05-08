/**
 * tokenService.js
 *
 * Manejo centralizado del token JWT.
 * Permite cambiar la estrategia de almacenamiento sin afectar el resto del código.
 */

const TOKEN_KEY = 'vms_token';

const isBrowser = typeof window !== 'undefined';

export const getToken = () => {
  if (!isBrowser) return null;

  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

export const setToken = (token) => {
  if (!isBrowser) return;

  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // fallback silencioso
  }
};

export const removeToken = () => {
  if (!isBrowser) return;

  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // fallback silencioso
  }
};