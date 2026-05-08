import { useState } from 'react';
import CameraToolbar from '../components/camera/CameraToolbar';
import CameraGrid from '../components/camera/CameraGrid';
import Loader from '../components/shared/Loader';
import { useCameras } from '../hooks/useCameras';
import { useWebSocket } from '../hooks/useWebSocket';

/**
 * Dashboard
 *
 * Vista principal del sistema.
 * Orquesta cámaras (REST) y detecciones (WebSocket).
 */
const Dashboard = () => {
  const [layout, setLayout] = useState('2x2');

  const { cameras, loading, isRefetching, error, refetch } = useCameras();
  const { detectionsMap } = useWebSocket();

  // clases de grid según layout
  const layoutClasses = {
    '1x1': 'grid-cols-1',
    '2x2': 'grid-cols-2',
    '3x3': 'grid-cols-3',
  };

  return (
    // usa h-full para respetar el layout principal
    <div className="flex flex-col w-full h-full bg-black">

      <CameraToolbar
        currentLayout={layout}
        onLayoutChange={setLayout}
        onRefresh={refetch}
        isRefreshing={isRefetching}
      />

      {/* carga inicial */}
      {loading && (
        <div className="flex-1">
          <Loader text="INICIALIZANDO SISTEMA VMS..." />
        </div>
      )}

      {/* error */}
      {error && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-red-500 font-mono text-sm border border-red-900 bg-red-950/20 px-6 py-4 rounded shadow-lg">
            ⚠️ ERROR CRÍTICO AL CARGAR CÁMARAS: {error}
          </div>
        </div>
      )}

      {/* vista principal */}
      {!loading && !error && (
        <div className="flex-1 min-h-0">
          <CameraGrid
            cameras={cameras}
            detectionsMap={detectionsMap}
            layoutClass={layoutClasses[layout]}
          />
        </div>
      )}

    </div>
  );
};

export default Dashboard;