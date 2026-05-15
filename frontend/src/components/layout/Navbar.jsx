import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Navbar
 *
 * Barra superior del sistema.
 * Muestra título según ruta, estado WS y reloj.
 */
const Navbar = ({ wsStatus = 'offline' }) => {
  const [time, setTime] = useState(new Date());
  const location = useLocation();

  // reloj en tiempo real
  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // título según ruta
  const getPageTitle = (path) => {
    const titles = {
      '/': 'Dashboard',
      '/alerts': 'Alertas',
      '/history': 'Historial',
      '/playback': 'Playback',
      '/users': 'Usuarios',
      '/settings': 'Configuracion',
      '/system': 'Sistema'
    };
    return titles[path] || 'Sistema';
  };

  // estado visual WS
  const getStatusDisplay = (status) => {
    const config = {
      online: { color: 'bg-green-500', text: 'EN LÍNEA' },
      offline: { color: 'bg-red-600', text: 'DESCONECTADO' },
      connecting: { color: 'bg-yellow-500 animate-pulse', text: 'CONECTANDO...' }
    };
    return config[status] || config.offline;
  };

  const statusConfig = getStatusDisplay(wsStatus);
  const currentTitle = getPageTitle(location.pathname);

  return (
    <header className="h-14 bg-[#1a1a1a] border-b border-gray-800 flex items-center justify-between px-4 shrink-0 shadow-sm">
      
      {/* título */}
      <h1 className="text-gray-100 font-semibold text-sm uppercase tracking-wide">
        {currentTitle}
      </h1>

      {/* estado + reloj */}
      <div className="flex items-center gap-6">
        
        {/* estado WS */}
        <div className="flex items-center gap-2 bg-[#121212] px-3 py-1 rounded border border-gray-800">
          <div className={`w-2 h-2 rounded-full ${statusConfig.color}`} />
          <span className="text-gray-300 text-[10px] font-mono font-bold tracking-wider">
            {statusConfig.text}
          </span>
        </div>

        {/* reloj */}
        <div className="text-gray-200 font-mono text-sm tracking-widest bg-black px-3 py-1 border border-gray-800 rounded min-w-[180px] text-center">
          {time.getFullYear()}-
          {String(time.getMonth() + 1).padStart(2, '0')}-
          {String(time.getDate()).padStart(2, '0')}
          {' '}
          {String(time.getHours()).padStart(2, '0')}:
          {String(time.getMinutes()).padStart(2, '0')}:
          {String(time.getSeconds()).padStart(2, '0')}
        </div>
      </div>
    </header>
  );
};

export default Navbar;
