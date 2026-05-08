import PropTypes from 'prop-types';

/**
 * CameraStatusCard
 *
 * Muestra info básica de una cámara y su estado.
 * Puede ser clickeable si recibe onClick.
 */
const CameraStatusCard = ({ camera, onClick }) => {
  if (!camera) return null;

  const isOnline = camera.status === 'online';
  
  // si tiene onClick, se comporta como botón
  const interactiveClasses = onClick 
    ? 'cursor-pointer hover:bg-[#252526] hover:border-gray-700 transition-colors' 
    : '';

  return (
    <div 
      onClick={onClick ? () => onClick(camera) : undefined}
      className={`flex items-center justify-between bg-[#1e1e1e] border border-gray-800 p-3 rounded shadow-sm ${interactiveClasses}`}
    >
      
      {/* info */}
      <div className="flex flex-col overflow-hidden mr-2">
        <span 
          className="text-gray-200 text-sm font-mono font-bold truncate" 
          title={camera.name}
        >
          {camera.name}
        </span>
        <span className="text-gray-500 text-xs font-mono truncate">
          ID: {camera.id}
        </span>
      </div>

      {/* estado */}
      <div className="flex items-center gap-2 shrink-0 bg-black/40 px-2 py-1 rounded border border-gray-800/50">
        <div
          className={`w-2 h-2 rounded-full shadow-sm ${
            isOnline 
              ? 'bg-green-500 animate-pulse shadow-green-500/50' 
              : 'bg-red-600 shadow-red-600/50'
          }`}
        />
        <span 
          className={`text-[10px] font-mono uppercase tracking-wider ${
            isOnline ? 'text-green-500' : 'text-red-500'
          }`}
        >
          {camera.status}
        </span>
      </div>
    </div>
  );
};

CameraStatusCard.propTypes = {
  camera: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    name: PropTypes.string.isRequired,
    status: PropTypes.string.isRequired,
  }).isRequired,
  onClick: PropTypes.func,
};

export default CameraStatusCard;