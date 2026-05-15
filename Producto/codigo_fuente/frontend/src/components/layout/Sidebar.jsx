import { useNavigate, useLocation } from 'react-router-dom';

const navItems = [
  { path: '/',          label: 'Dashboard' },
  { path: '/alerts',    label: 'Alertas' },
  { path: '/history',   label: 'Historial' },
  { path: '/playback',  label: 'Playback' },
  { path: '/system',    label: 'Sistema' },
  { path: '/settings',  label: 'Configuración' },
];

/**
 * Sidebar
 * Componente puramente presentacional y de navegación.
 * Utiliza useNavigate para el enrutamiento programático como fue requerido.
 */
const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <aside className="w-64 bg-[#121212] border-r border-gray-800 flex flex-col h-full flex-shrink-0">
      {/* Cabecera del Sidebar */}
      <div className="h-14 flex items-center px-4 border-b border-gray-800 bg-[#1a1a1a]">
        <h2 className="text-gray-300 font-bold uppercase tracking-widest text-xs">
          VMS Explorer
        </h2>
      </div>

      {/* Navegación principal */}
      <nav className="flex-1 overflow-y-auto p-2 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`w-full text-left px-3 py-2 text-sm font-medium transition-colors ${
                isActive 
                  ? 'bg-blue-600 text-white' 
                  : 'text-gray-400 hover:bg-[#252526] hover:text-gray-200'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>
    </aside>
  );
};

export default Sidebar;