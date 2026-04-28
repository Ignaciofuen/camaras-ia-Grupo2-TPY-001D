import React from 'react';
import CameraGrid from '../components/camera/CameraGrid';
import AlertSection from '../components/alerts/AlertSection';
import Loader from '../components/shared/Loader';
import { useCameras } from '../hooks/useCameras';
import { useWebSocket } from '../hooks/useWebSocket';
import '../styles/pages.css';

const Dashboard = () => {
  // 1. Obtenemos estado inicial (FastAPI REST)
  const { cameras, loading, error } = useCameras();
  
  // 2. Abrimos conexión a eventos IA (FastAPI WebSockets)
  useWebSocket(import.meta.env.VITE_WS_ALERTS_URL);

  if (loading) return <Loader text="Conectando al servidor VMS..." />;
  if (error) return <div className="error-screen">Error de conexión: {error.message}</div>;

  return (
    <div className="page-layout-split">
      {/* Sección Izquierda: Monitoreo Crítico */}
      <section className="main-workspace">
        <CameraGrid cameras={cameras} />
      </section>

      {/* Sección Derecha: Inteligencia Artificial */}
      <aside className="side-panel">
        <AlertSection />
      </aside>
    </div>
  );
};

export default Dashboard;