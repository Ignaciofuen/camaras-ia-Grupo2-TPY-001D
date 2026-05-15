import { useContext } from 'react';
import { AuthContext } from '../auth/AuthContext';

/**
 * useAuth
 *
 * Hook para acceder al estado global de autenticación.
 * Evita usar useContext directamente en los componentes.
 */
export const useAuth = () => {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }

  return context;
};
