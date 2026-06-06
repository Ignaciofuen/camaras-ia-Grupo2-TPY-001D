import { useState, useCallback } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import Toast from '../common/Toast';

/**
 * MainLayout
 * Estructura base del VMS.
 * En desktop: sidebar siempre visible a la izquierda.
 * En móvil/tablet: sidebar oculto, aparece como overlay con botón hamburguesa.
 */
const MainLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);
  const toggleSidebar = useCallback(() => setSidebarOpen((v) => !v), []);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-black text-gray-100 select-none font-sans">
      <Toast />

      {/* ── Overlay oscuro (solo móvil cuando sidebar está abierto) ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/60 lg:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* ── Sidebar ──
          Desktop (lg+): siempre visible, estático.
          Móvil: posición fija como drawer, z-30 encima del overlay. */}
      <div
        className={`
          fixed inset-y-0 left-0 z-30 w-64 transition-transform duration-300
          lg:static lg:translate-x-0 lg:z-auto lg:flex-shrink-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <Sidebar onNavigate={closeSidebar} />
      </div>

      {/* ── Contenedor principal ── */}
      <div className="flex flex-col flex-1 min-w-0 bg-[#0a0a0a]">
        <Navbar onMenuToggle={toggleSidebar} />

        <main className="flex-1 relative overflow-hidden">
          <Outlet />
        </main>

        <footer className="h-6 bg-[#1a1a1a] border-t border-gray-800 flex items-center px-3 justify-between shrink-0">
          <div className="flex items-center gap-4 text-[10px] uppercase tracking-tighter text-gray-500">
            <span>System Status: <span className="text-green-500">Optimal</span></span>
            <span className="hidden sm:inline">Latency: <span className="text-blue-400">24ms</span></span>
          </div>
          <div className="text-[10px] text-gray-600 font-mono">
            VMS CORE v1.0.4
          </div>
        </footer>
      </div>
    </div>
  );
};

export default MainLayout;