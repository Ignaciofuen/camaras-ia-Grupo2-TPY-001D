import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './useAuth';

/**
 * ProtectedRoute
 * Controla acceso a rutas privadas. Si el user no está autenticado,
 * redirect a /login. Mientras se valida la sesión, no renderiza nada.
 *
 * Props opcional:
 *   requireRole: string | string[] → uno o varios roles permitidos.
 *                Si el user no tiene ninguno de esos roles, redirige a /.
 *                Ejemplo: requireRole="admin"
 *                Ejemplo: requireRole={['admin', 'operador']}
 */
const ProtectedRoute = ({ requireRole }) => {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="h-screen w-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gray-600 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requireRole) {
    const userRole = user?.role || user?.rol;
    const allowed  = Array.isArray(requireRole) ? requireRole : [requireRole];
    if (!allowed.includes(userRole)) {
      return <Navigate to="/" replace />;
    }
  }

  return <Outlet />;
};

export default ProtectedRoute;
