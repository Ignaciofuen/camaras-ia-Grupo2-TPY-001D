import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import PropTypes from 'prop-types';

const baseNavItems = [
  { path: '/',          label: 'Dashboard' },
  { path: '/alerts',    label: 'Alertas' },
  { path: '/history',   label: 'Historial' },
  { path: '/playback',  label: 'Playback' },
  { path: '/system',    label: 'Sistema' },
];

// Items visibles para operador (solo operador, no admin)
const operadorNavItems = [
  { path: '/settings', label: 'Configuración', operadorOnly: true },
];

// Items solo visibles para admin
const adminNavItems = [
  { path: '/users', label: 'Usuarios', adminOnly: true },
];

/**
 * Sidebar
 * onNavigate: callback opcional, se llama después de navegar (útil en móvil para cerrar el drawer).
 */
const Sidebar = ({ onNavigate }) => {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { user }  = useAuth();

  const userRole   = user?.role || user?.rol;
  const isAdmin    = userRole === 'admin' || userRole === 'administrator';
  const isOperador = userRole === 'operador';

  const items = [
    ...baseNavItems,
    ...(isOperador ? operadorNavItems : []),
    ...(isAdmin    ? adminNavItems    : []),
  ];

  const handleNav = (path) => {
    navigate(path);
    onNavigate?.();
  };

  return (
    <aside className="w-64 bg-[#121212] border-r border-gray-800 flex flex-col h-full flex-shrink-0">
      <div className="h-14 flex items-center px-4 border-b border-gray-800 bg-[#1a1a1a]">
        <h2 className="text-gray-300 font-bold uppercase tracking-widest text-xs">
          VMS Explorer
        </h2>
      </div>

      <nav className="flex-1 overflow-y-auto p-2 space-y-1">
        {items.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => handleNav(item.path)}
              className={`w-full text-left px-3 py-2 text-sm font-medium transition-colors flex items-center justify-between ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:bg-[#252526] hover:text-gray-200'
              }`}
            >
              <span>{item.label}</span>
              {item.adminOnly && (
                <span className="text-[8px] font-mono uppercase bg-purple-600/30 text-purple-300 px-1 py-0.5 rounded">
                  admin
                </span>
              )}
              {item.operadorOnly && (
                <span className="text-[8px] font-mono uppercase bg-blue-600/30 text-blue-300 px-1 py-0.5 rounded">
                  oper
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer con datos del user */}
      {user && (
        <div className="border-t border-gray-800 p-3 text-xs font-mono">
          <div className="text-gray-200 truncate" title={user.email || user.username}>
            {user.nombre_completo || user.username || user.email}
          </div>
          <div className="text-gray-500 text-[10px] uppercase tracking-wider mt-0.5">
            {user.role || user.rol || '—'}
          </div>
        </div>
      )}
    </aside>
  );
};

Sidebar.propTypes = {
  onNavigate: PropTypes.func,
};

export default Sidebar;
