import PropTypes from 'prop-types';
import CameraCard from './CameraCard';

/**
 * CameraGrid
 *
 * Renderiza las cámaras visibles en formato grilla. La pagina padre
 * (Dashboard) ya filtro las camaras segun el layout.
 *
 * Recibe ademas:
 *   - onCameraClick: callback cuando el usuario hace click sobre una camara.
 *     Sirve para marcarla como "activa" (modo 1x1) en el Dashboard.
 *   - activeCameraId: id de la camara actualmente "activa" para dibujar un
 *     ring azul de feedback.
 */
const CameraGrid = ({
  cameras = [],
  detectionsMap = {},
  layoutClass = 'grid-cols-2',
  onCameraClick,
  activeCameraId,
}) => {

  if (!cameras || cameras.length === 0) {
    return (
      <div className="flex flex-col w-full h-full items-center justify-center bg-[#0a0a0a] border border-gray-800">
        <span className="text-gray-600 font-mono text-xs tracking-widest uppercase">
          SIN CÁMARAS
        </span>
      </div>
    );
  }

  return (
    <div className={`grid ${layoutClass} auto-rows-fr gap-[2px] p-[2px] bg-gray-900 w-full h-full overflow-y-auto`}>
      {cameras.map((camera) => {
        const key = camera.nombre || camera.name || camera.id;
        const detections = detectionsMap[key] || detectionsMap[camera.id] || [];
        const isActive   = activeCameraId === camera.id;

        return (
          <div
            key={camera.id}
            onClick={() => onCameraClick && onCameraClick(camera)}
            className={`relative ${isActive ? 'ring-2 ring-blue-500/60 ring-inset' : 'cursor-pointer'}`}
          >
            <CameraCard
              camera={camera}
              detections={detections}
            />
          </div>
        );
      })}
    </div>
  );
};

CameraGrid.propTypes = {
  cameras:        PropTypes.array,
  detectionsMap:  PropTypes.object,
  layoutClass:    PropTypes.string,
  onCameraClick:  PropTypes.func,
  activeCameraId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};

export default CameraGrid;
