import PropTypes from 'prop-types';
import CameraStatusCard from './CameraStatusCard';
import EmptyState from '../shared/EmptyState';

/**
 * SystemStatus
 *
 * Muestra el estado general del sistema.
 * Incluye resumen y lista de cámaras.
 */
const SystemStatus = ({ cameras = [] }) => {
  if (!cameras || cameras.length === 0) {
    return <EmptyState text="SIN DATOS DE SISTEMA" />;
  }

  const total = cameras.length;
  const online = cameras.filter((c) => c.status === 'online').length;
  const offline = total - online;

  return (
    // contenedor principal (sin scroll)
    <div className="flex flex-col w-full h-full p-4 gap-4 overflow-hidden bg-[#0a0a0a]">

      {/* resumen */}
      <div className="flex gap-4 shrink-0">
        <div className="flex-1 bg-[#1e1e1e] border border-gray-800 border-b-2 border-b-gray-600 p-3 rounded shadow-sm">
          <span className="text-gray-400 text-xs font-mono uppercase">
            TOTAL
          </span>
          <div className="text-white text-lg font-bold font-mono mt-1">{total}</div>
        </div>

        <div className="flex-1 bg-[#1e1e1e] border border-gray-800 border-b-2 border-b-green-500/50 p-3 rounded shadow-sm">
          <span className="text-gray-400 text-xs font-mono uppercase">
            ONLINE
          </span>
          <div className="text-green-400 text-lg font-bold font-mono mt-1">{online}</div>
        </div>

        <div className="flex-1 bg-[#1e1e1e] border border-gray-800 border-b-2 border-b-red-600/50 p-3 rounded shadow-sm">
          <span className="text-gray-400 text-xs font-mono uppercase">
            OFFLINE
          </span>
          <div className="text-red-400 text-lg font-bold font-mono mt-1">{offline}</div>
        </div>
      </div>

      {/* lista con scroll */}
      <div className="flex-1 flex flex-col gap-2 overflow-y-auto custom-scrollbar pr-1 pb-2">
        {cameras.map((camera) => (
          <CameraStatusCard 
            key={camera.id} 
            camera={camera} 
          />
        ))}
      </div>

    </div>
  );
};

SystemStatus.propTypes = {
  cameras: PropTypes.array,
};

export default SystemStatus;