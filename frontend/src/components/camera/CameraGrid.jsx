import PropTypes from 'prop-types';
import CameraCard from './CameraCard';

/**
 * CameraGrid
 *
 * Renderiza todas las cámaras en formato grilla.
 *
 * Este componente no tiene lógica:
 * - no hace fetch
 * - no usa WebSocket
 *
 * Solo recibe datos ya procesados desde la página.
 */
const CameraGrid = ({ cameras = [], detectionsMap = {}, layoutClass = 'grid-cols-2' }) => {

  // Estado vacío: no hay cámaras disponibles
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
    /**
     * Grid tipo VMS:
     * - columnas dinámicas según layout
     * - todas las cámaras con mismo tamaño
     * - separación mínima para aprovechar espacio
     */
    <div className={`grid ${layoutClass} auto-rows-fr gap-[2px] p-[2px] bg-gray-900 w-full h-full overflow-y-auto`}>
      {cameras.map((camera) => (
        <CameraCard
          key={camera.id}
          camera={camera}
          // solo pasamos las detecciones de esta cámara
          detections={detectionsMap[camera.id] || []}
        />
      ))}
    </div>
  );
};

CameraGrid.propTypes = {
  cameras: PropTypes.array,
  detectionsMap: PropTypes.object,
  layoutClass: PropTypes.string,
};

export default CameraGrid;