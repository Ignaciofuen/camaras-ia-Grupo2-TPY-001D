import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import { useSystemStatus } from '../../hooks/useSystemStatus';

/**
 * MainLayout
 * Estructura base del VMS (Video Management System).
 * Organiza la disposición espacial de la aplicación sin contener lógica de estado.
 */
const MainLayout = () => {
  const { status: systemStatus, latency, version } = useSystemStatus();
  const statusClass = {
    optimal: 'text-green-500',
    degraded: 'text-yellow-400',
    critical: 'text-red-500',
    offline: 'text-red-600',
    connecting: 'text-yellow-400',
  }[systemStatus] || 'text-gray-400';

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-black text-gray-100 select-none font-sans">
      {/* Navegación Lateral: 
          Contiene el árbol de cámaras, vistas guardadas y configuración técnica.
      */}
      <Sidebar />

      {/* Contenedor de visualización */}
      <div className="flex flex-col flex-1 min-w-0 bg-[#0a0a0a]">
        
        {/* Barra Superior: 
            Contiene el estado de conexión del backend, alertas críticas y perfil.
        */}
        <Navbar />

        {/* Viewport Principal: 
            Aquí se renderiza la grilla de cámaras (Dashboard) o la vista de grabaciones.
            'overflow-hidden' es crítico para evitar scrollbars innecesarios en la grilla.
        */}
        <main className="flex-1 relative overflow-hidden">
          <Outlet />
        </main>
        
        {/* Footer Opcional (Barra de estado del sistema/CPU/Red) */}
        <footer className="h-6 bg-[#1a1a1a] border-t border-gray-800 flex items-center px-3 justify-between">
          <div className="flex items-center gap-4 text-[10px] uppercase tracking-tighter text-gray-500">
            <span>System Status: <span className={statusClass}>{systemStatus}</span></span>
            <span>Latency: <span className="text-blue-400">{latency}</span></span>
          </div>
          <div className="text-[10px] text-gray-600 font-mono">
            VMS VIGILANCIA ACTIVA {version}-PROD
          </div>
        </footer>
      </div>
    </div>
  );
};

export default MainLayout;
