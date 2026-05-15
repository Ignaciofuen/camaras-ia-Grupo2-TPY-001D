import { useState, useEffect } from 'react';
import apiClient from '../../services/api';

/**
 * Navbar
 * Barra superior. Muestra el estado de conexión REAL del backend (no un prop
 * estático): hace ping a /health cada 5s. Si responde 200 -> "EN LÍNEA".
 *
 * @param {string} pageTitle - Título de la vista actual (opcional)
 */
const Navbar = ({ pageTitle = 'Sistema' }) => {
  const [time, setTime]     = useState(new Date());
  const [status, setStatus] = useState('connecting'); // online | offline | connecting

  // Reloj
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Polling de /health cada 5s
  useEffect(() => {
    let cancelled = false;

    const checkHealth = async () => {
      try {
        const { data } = await apiClient.get('/health', { timeout: 4000 });
        if (cancelled) return;
        // status del backend: 'ok' | 'degraded' | 'down'
        if (data?.status === 'ok')        setStatus('online');
        else if (data?.status === 'down') setStatus('offline');
        else                              setStatus('connecting');
      } catch (err) {
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

  return (
    <header className="h-14 bg-[#1a1a1a] border-b border-gray-800 flex items-center justify-between px-4 shrink-0 shadow-sm">
      <div className="flex items-center gap-3">
        <h1 className="text-gray-100 font-semibold text-sm uppercase tracking-wide">
          {pageTitle}
        </h1>
      </div>

      <div className="flex items-center gap-6">
        {/* Indicador de conexión REAL al backend */}
        <div className="flex items-center gap-2 bg-[#121212] px-3 py-1 rounded border border-gray-800">
          <div className={`w-2 h-2 rounded-full ${statusConfig.color}`} />
          <span className={`text-[10px] font-mono font-bold tracking-wider ${statusConfig.textColor}`}>
            {statusConfig.text}
          </span>
        </div>

        {/* Reloj */}
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
