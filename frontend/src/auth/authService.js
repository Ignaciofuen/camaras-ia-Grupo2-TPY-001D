import { setToken, removeToken } from '../auth/tokenService';

/**
 * authService.js
 *
 * Servicio temporal de autenticación.
 * Simula backend durante desarrollo frontend.
 */

export const login = async (username, password) => {
  // usuarios temporales
  const users = [
    {
      username: 'admin',
      password: 'admin123',
      role: 'administrator',
    },
    {
      username: 'operador',
      password: 'operador123',
      role: 'operator',
    },
  ];

  const user = users.find(
    (u) =>
      u.username === username &&
      u.password === password
  );

  if (!user) {
    throw new Error('Credenciales inválidas');
  }

  const fakeToken = 'fake-jwt-token';

  setToken(fakeToken);

  return {
    access_token: fakeToken,
    user: {
      username: user.username,
      role: user.role,
    },
  };
};

export const logout = () => {
  removeToken();
};

export const getProfile = async () => {
  return {
    username: 'admin',
    role: 'administrator',
  };
};