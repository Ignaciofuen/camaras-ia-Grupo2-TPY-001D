import { useState, useCallback, useMemo, useEffect } from 'react';
import CameraToolbar from '../components/camera/CameraToolbar';
import CameraGrid from '../components/camera/CameraGrid';
import { useCameras } from '../hooks/useCameras';
import { useSSE } from '../hooks/useSSE';
import { useDetections } from '../hooks/useDetections';

/**
 * Dashboard
 *
 * - obtiene camaras (REST /camaras)
 * - escucha alertas en realtime (SSE /alertas/stream)
 * - arma un detectionsMap por camara
 * - controla el layout del grid (1x1 / 2x2 / 3x3)
 *
 * Logica del layout:
 *   1x1 -> muestra UNA sola camara (la "activa"). Click en una camara la
 *          marca como activa. Si nadie clickeo, es la primera.
 *   2x2 -> muestra hasta 4 camaras.
 *   3x3 -> muestra hasta 9 camaras.
 *
 * Si la cantidad de camaras es menor a los slots, los huecos quedan negros.
 */
const Dashboard = () => {
  const [layout, setLayout]                 = useState('2x2');
  const [activeCameraId, setActiveCameraId] = useState(null);

  const { cameras, loading, error } = useCameras();

  // SSE de alertas LLaVA (las consume la pagina /alerts; aca solo
  // dejamos la conexion abierta por si en el futuro queremos un toast).
  const handleAlerta = useCallback(() => {}, []);
  const sseUrl = import.meta.env.VITE_SSE_URL || '/alertas/stream';
  useSSE(sseUrl, handleAlerta);

  // SSE de DETECCIONES (bboxes YOLO frame-por-frame, ~5fps por camara).
  const { detectionsMap } = useDetections('/detecciones/stream');

  // Elige la mejor camara para el modo 1x1:
  //   - Si exactamente una tiene estado_salud='online' → esa
  //   - Si cero o varias online → primera del array (Principal viene primero)
  const pickBestCamera = useCallback((cams) => {
    if (!cams || cams.length === 0) return null;
    const online = cams.filter((c) => c.estado_salud === 'online');
    return online.length === 1 ? online[0] : cams[0];
  }, []);

  // Filtrar camaras segun layout. En 1x1 mostramos solo la activa.
  const visibleCameras = useMemo(() => {
    if (!cameras || cameras.length === 0) return [];
    if (layout === '1x1') {
      const active = cameras.find((c) => c.id === activeCameraId) || pickBestCamera(cameras);
      return active ? [active] : [];
    }
    const maxByLayout = { '2x2': 4, '3x3': 9 };
    return cameras.slice(0, maxByLayout[layout] || cameras.length);
  }, [cameras, layout, activeCameraId, pickBestCamera]);

  // Al cambiar al layout 1x1 sin camara activa → elegir la mejor segun estado.
  useEffect(() => {
    if (layout === '1x1' && !activeCameraId && cameras && cameras.length > 0) {
      const best = pickBestCamera(cameras);
      if (best) setActiveCameraId(best.id);
    }
  }, [layout, activeCameraId, cameras, pickBestCamera]);

  const handleCameraClick = useCallback((camera) => {
    setActiveCameraId(camera.id);
    // Al click sobre una camara, si estamos en grilla, saltamos a 1x1 (focus).
    // Si ya estamos en 1x1, solo cambia la activa.
    // (Si la UX te molesta, sacar la siguiente linea.)
    // setLayout('1x1');
  }, []);

  const layoutClasses = {
    '1x1': 'grid-cols-1',
    '2x2': 'grid-cols-2',
    '3x3': 'grid-cols-3',
  };

  return (
    <div className="flex flex-col w-full h-full">
      <CameraToolbar
        currentLayout={layout}
        onLayoutChange={setLayout}
      />

      {loading && (
        <div className="flex-1 flex items-center justify-center text-gray-400 font-mono text-sm">
          Cargando camaras...
        </div>
      )}

      {error && (
        <div className="flex-1 flex items-center justify-center text-red-500 font-mono text-sm">
          Error al cargar camaras: {error}
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
