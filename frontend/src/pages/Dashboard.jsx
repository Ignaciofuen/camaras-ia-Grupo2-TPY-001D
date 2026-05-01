import { useState, useCallback } from 'react';
import { useCameras } from '../hooks/useCameras';
import { useWebSocket } from '../hooks/useWebSocket';
import CameraGrid from '../components/camera/CameraGrid';
import AlertSection from '../components/alerts/AlertSection';

const Dashboard = () => {
  // 1. Obtener lista de cámaras (HTTP)
  const { cameras, loading, error } = useCameras();
  
  // 2. Estado local para almacenar el flujo de alertas del WS
  const [alerts, setAlerts] = useState([]);

  // Callback memorizado para evitar re-renderizados innecesarios del Hook WS
  const handleNewAlert = useCallback((newAlert) => {
    setAlerts((prevAlerts) => {
      // Mantiene un buffer de las últimas 100 alertas para no saturar la memoria
      return [newAlert, ...prevAlerts].slice(0, 100);
    });
  }, []);

  // 3. Conexión WebSocket para detecciones (YOLO/FastAPI)
  const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws/alerts';
  useWebSocket(wsUrl, handleNewAlert);

  return (
    <div className="flex h-screen w-full bg-black overflow-hidden font-sans">
      {/* Columna Principal: Grilla de Cámaras (ocupa el espacio restante) */}
      <main className="flex-1 flex flex-col min-w-0 relative">
        {loading && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 text-blue-400 font-mono text-sm tracking-widest uppercase">
            Cargando fuentes de video...
          </div>
        )}
        {error && (
          <div className="absolute top-4 left-4 z-50 bg-red-900/90 text-white px-4 py-2 rounded text-xs font-mono">
            Error: {error}
          </div>
        )}
        <CameraGrid cameras={cameras} />
      </main>

      {/* Columna Lateral: Panel de Alertas */}
      <AlertSection alerts={alerts} />
    </div>
  );
};

export default Dashboard;