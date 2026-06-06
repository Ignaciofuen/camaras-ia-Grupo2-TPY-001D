import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../services/api';
import { useAuth } from '../../auth/useAuth';

/**
 * Navbar
 * Barra superior. Muestra estado REAL del backend (ping /health cada 5s).
 * En móvil: muestra botón hamburguesa para abrir el sidebar.
 * En desktop: oculta el botón hamburguesa (sidebar siempre visible).
 */
const Navbar = ({ onMenuToggle }) => {
  const [time, setTime]     = useState(new Date());
  const [status, setStatus] = useState('connecting');
  const { user, logout }    = useAuth();
  const navigate            = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  // Reloj
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Polling /health cada 5s
  useEffect(() => {
    let cancelled = false;
    const checkHealth = async () => {
      try {
        const { data } = await apiClient.get('/health', { timeout: 4000 });
        if (cancelled) return;
        if (data?.status === 'ok')        setStatus('online');
        else if (data?.status === 'down') setStatus('offline');
        else                              setStatus('connecting');
      } catch {
        if (!cancelled) setStatus('offline');
      }
    };
    checkHealth();
    const id = setInterval(checkHealth, 5000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const statusConfig = (() => {
    const map = {
      online:     { color: 'bg-green-500 animate-pulse',  text: 'EN LÍNEA',     textColor: 'text-green-400' },
      offline:    { color: 'bg-red-600',                  text: 'DESCONECTADO', textColor: 'text-red-400' },
      connecting: { color: 'bg-yellow-500 animate-pulse', text: 'CONECTANDO…',  textColor: 'text-yellow-400' },
    };
    return map[status] || map.offline;
  })();

  const pad = (n) => String(n).padStart(2, '0');
  const timeStr = `${time.getFullYear()}-${pad(time.getMonth()+1)}-${pad(time.getDate())} ${pad(time.getHours())}:${pad(time.getMinutes())}:${pad(time.getSeconds())}`;

  return (
    <header className="h-14 bg-[#1a1a1a] border-b border-gray-800 flex items-center justify-between px-3 sm:px-4 shrink-0 shadow-sm gap-2">

      {/* ── Izquierda: hamburguesa (móvil) ── */}
      <div className="flex items-center gap-3 min-w-0">
        {/* Botón hamburguesa — solo visible en móvil/tablet */}
        <button
          onClick={onMenuToggle}
          className="lg:hidden flex-shrink-0 p-1.5 rounded text-gray-400 hover:text-gray-200 hover:bg-[#252526] transition-colors"
          aria-label="Abrir menú"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <h1 className="text-gray-100 font-semibold text-sm uppercase tracking-wide truncate">
          Sistema
        </h1>
      </div>

      {/* ── Derecha: estado + reloj + logout ── */}
      <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">

        {/* Indicador de conexión */}
        <div className="flex items-center gap-1.5 bg-[#121212] px-2 sm:px-3 py-1 rounded border border-gray-800">
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${statusConfig.color}`} />
          <span className={`text-[10px] font-mono font-bold tracking-wider hidden sm:inline ${statusConfig.textColor}`}>
            {statusConfig.text}
          </span>
        </div>

        {/* Reloj — compacto en móvil, completo en desktop */}
        <div className="text-gray-200 font-mono tracking-widest bg-black border border-gray-800 rounded text-center px-2 py-1">
          <span className="hidden md:inline text-sm">{timeStr}</span>
          <span className="md:hidden text-xs">
            {pad(time.getHours())}:{pad(time.getMinutes())}:{pad(time.getSeconds())}
          </span>
        </div>

        {/* Logout */}
        {user && (
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 bg-[#252526] hover:bg-red-900/40 border border-gray-700 hover:border-red-700 text-gray-300 hover:text-red-200 px-2 sm:px-3 py-1 rounded text-[10px] font-mono uppercase tracking-wider transition-colors"
            title="Cerrar sesión"
          >
            <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span className="hidden sm:inline">Salir</span>
          </button>
        )}
      </div>
    </header>
  );
};

export default Navbar;
