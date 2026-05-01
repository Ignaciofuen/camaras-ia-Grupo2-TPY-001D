import { useState } from 'react';
import CameraToolbar from '../components/camera/CameraToolbar';
import CameraGrid from '../components/camera/CameraGrid';
import { useCameras } from '../hooks/useCameras';
import { useWebSocket } from '../hooks/useWebSocket';

/**
 * Dashboard
 *
 * Página principal del sistema.
 * Aquí se conectan los datos reales (API + WebSocket) con la UI.
 *
 * Este archivo actúa como punto de unión:
 * - obtiene cámaras (API)
 * - obtiene detecciones (WebSocket)
 * - controla el layout del grid
 *
 * No renderiza lógica compleja, solo organiza todo.
 */
const Dashboard = () => {
  // Layout actual del grid (lo cambia el toolbar)
  const [layout, setLayout] = useState('2x2');

  // Cámaras desde backend
  const { cameras, loading, error } = useCameras();

  // Detecciones en tiempo real (IA)
  const { detectionsMap } = useWebSocket();

  // Mapeo simple de layout → columnas del grid
  const layoutClasses = {
    '1x1': 'grid-cols-1',
    '2x2': 'grid-cols-2',
    '3x3': 'grid-cols-3',
  };

  return (
    <div className="flex flex-col w-full h-full">

      {/* Toolbar: solo cambia el layout */}
      <CameraToolbar
        currentLayout={layout}
        onLayoutChange={setLayout}
      />

      {/* Estado de carga inicial */}
      {loading && (
        <div className="flex-1 flex items-center justify-center text-gray-400 font-mono text-sm">
          Cargando cámaras...
        </div>
      )}

      {/* Error de API */}
      {error && (
        <div className="flex-1 flex items-center justify-center text-red-500 font-mono text-sm">
          Error al cargar cámaras
        </div>
      )}

      {/* Grid principal (solo cuando hay datos) */}
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