import { useState, useEffect } from 'react';
import { getToken, removeToken } from './tokenService';
import * as authService from './authService';
import { AuthContext } from './AuthContext';

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser]                       = useState(null);
  const [isLoading, setIsLoading]             = useState(true);

  // Al montar: si hay token guardado, validar contra backend
  useEffect(() => {
    const initAuth = async () => {
      const token = getToken();
      if (!token) {
        setIsLoading(false);
        return;
      }
      try {
        const profile = await authService.getProfile();
        setUser(profile);
        setIsAuthenticated(true);
      } catch {
        removeToken();
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    };
    initAuth();
  }, []);

  const login = async (username, password) => {
    const data = await authService.login(username, password);
    setIsAuthenticated(true);
    if (data?.user) setUser(data.user);
  };

  const logout = async () => {
    await authService.logout();
    setIsAuthenticated(false);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ isAuthenticated, user, isLoading, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
};
