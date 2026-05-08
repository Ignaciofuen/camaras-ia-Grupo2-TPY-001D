import { createContext, useState, useEffect } from 'react';
import { getToken, removeToken } from '../auth/tokenService';
import * as authService from '../auth/authService';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const token = getToken();

      if (token) {
        try {
          // validación real contra backend
          const profile = await authService.getProfile();
          setUser(profile);
          setIsAuthenticated(true);
        } catch {
          removeToken();
          setIsAuthenticated(false);
        }
      }

      setIsLoading(false);
    };

    initAuth();
  }, []);

  const login = async (username, password) => {
    const data = await authService.login(username, password);

    // ❌ ya NO guardamos token aquí

    setIsAuthenticated(true);

    if (data.user) {
      setUser(data.user);
    }
  };

  const logout = () => {
    authService.logout(); // centralizado
    setIsAuthenticated(false);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        user,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};