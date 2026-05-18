import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import Toast from '../common/Toast';

/**
 * MainLayout
 * Estructura base del VMS (Video Management System).
 * Organiza la disposición espacial de la aplicación sin contener lógica de estado.
 */
const MainLayout = () => {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-black text-gray-100 select-none font-sans">
      {/* Toasts globales (errores 403, mensajes de éxito/info) */}
      <Toast />

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
            <span>System Status: <span className="text-green-500">Optimal</span></span>
            <span>Latency: <span className="text-blue-400">24ms</span></span>
          </div>
          <div className="text-[10px] text-gray-600 font-mono">
            VMS CORE v1.0.4-PROD
          </div>
        </footer>
      </div>
    </div>
  );
};

export default MainLayout;