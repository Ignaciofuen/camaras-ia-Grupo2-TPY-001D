import { useCallback, useEffect, useMemo, useState } from 'react';
import CameraToolbar from '../components/camera/CameraToolbar';
import CameraGrid from '../components/camera/CameraGrid';
import Loader from '../components/shared/Loader';
import { useCameras } from '../hooks/useCameras';
import { useDetections } from '../hooks/useDetections';
import { useSSE } from '../hooks/useSSE';

const Dashboard = () => {
  const [layout, setLayout] = useState('2x2');
  const [activeCameraId, setActiveCameraId] = useState(null);

  const {
    cameras,
    loading,
    isRefetching,
    error,
    refetch,
  } = useCameras();

  const handleAlerta = useCallback(() => {}, []);
  const sseUrl = import.meta.env.VITE_SSE_URL || '/alertas/stream';
  useSSE(sseUrl, handleAlerta);

  const { detectionsMap } = useDetections('/detecciones/stream');

  const visibleCameras = useMemo(() => {
    if (!cameras || cameras.length === 0) return [];

    if (layout === '1x1') {
      const active = cameras.find((camera) => (
        camera.id === activeCameraId || camera.uuid === activeCameraId
      )) || cameras[0];
      return active ? [active] : [];
    }

    const maxByLayout = { '2x2': 4, '3x3': 9 };
    return cameras.slice(0, maxByLayout[layout] || cameras.length);
  }, [activeCameraId, cameras, layout]);

  useEffect(() => {
    if (layout === '1x1' && !activeCameraId && cameras.length > 0) {
      queueMicrotask(() => setActiveCameraId(cameras[0].id || cameras[0].uuid));
    }
  }, [activeCameraId, cameras, layout]);

  const handleCameraClick = useCallback((camera) => {
    setActiveCameraId(camera.id || camera.uuid);
  }, []);

  const layoutClasses = {
    '1x1': 'grid-cols-1',
    '2x2': 'grid-cols-2',
    '3x3': 'grid-cols-3',
  };

  return (
    <div className="flex flex-col w-full h-full bg-black">
      <CameraToolbar
        currentLayout={layout}
        onLayoutChange={setLayout}
        onRefresh={refetch}
        isRefreshing={isRefetching}
      />

      {loading && (
        <div className="flex-1">
          <Loader text="INICIALIZANDO SISTEMA VMS..." />
        </div>
      )}

      {error && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-red-500 font-mono text-sm border border-red-900 bg-red-950/20 px-6 py-4 rounded shadow-lg">
            ERROR AL CARGAR CAMARAS: {error}
          </div>
        </div>
      )}

      {!loading && !error && (
        <div className="flex-1 min-h-0">
          <CameraGrid
            cameras={visibleCameras}
            detectionsMap={detectionsMap}
            layoutClass={layoutClasses[layout]}
            onCameraClick={handleCameraClick}
            activeCameraId={activeCameraId}
          />
        </div>
      )}
    </div>
  );
};

export default Dashboard;
