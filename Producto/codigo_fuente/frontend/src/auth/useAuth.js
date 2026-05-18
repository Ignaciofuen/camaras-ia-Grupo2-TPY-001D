import { useContext } from 'react';
import { AuthContext } from './AuthContext';

/**
 * useAuth — Hook para acceder al estado global de autenticación.
 * Lanza error si no está dentro de <AuthProvider>.
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }
  return context;
};
