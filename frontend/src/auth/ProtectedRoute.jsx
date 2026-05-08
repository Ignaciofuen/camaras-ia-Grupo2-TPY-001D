import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from "./useAuth";

/**
 * ProtectedRoute
 *
 * Controla acceso a rutas privadas.
 * No contiene UI, solo lógica de navegación.
 */
const ProtectedRoute = () => {
  const { isAuthenticated, isLoading } = useAuth();

  // mientras valida sesión, no renderizamos nada
  if (isLoading) return null;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;