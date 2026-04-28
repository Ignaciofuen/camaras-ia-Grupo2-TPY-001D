import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';

const PAGE_TITLES = {
  '/': 'Monitor en Vivo',
  '/alerts': 'Alertas',
  '/history': 'Historial de Eventos',
  '/playback': 'Reproducción',
  '/system': 'Estado del Sistema',
  '/settings': 'Configuración',
};

export default function MainLayout() {
  const { pathname } = useLocation();
  const title = PAGE_TITLES[pathname] ?? 'VisionAI';

  return (
    <div className="main-layout">
      <Sidebar />
      <div className="main-content">
        <Navbar pageTitle={title} />
        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}