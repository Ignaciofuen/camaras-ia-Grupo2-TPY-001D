import PropTypes from 'prop-types';

/**
 * CameraOverlay
 *
 * UI sobre el video.
 * Muestra nombre de cámara, estado (online/offline)
 * y estado del stream (loading / error).
 *
 * No tiene lógica, solo renderiza lo que recibe.
 */
const CameraOverlay = ({ name, status, streamStatus }) => {
  // indicador simple de si la cámara está activa
  const isOnline = status === 'online';

  return (
    // el padre (CameraCard) controla posicionamiento y capas
    // aquí solo nos preocupamos del contenido visual
    <div className="w-full h-full flex flex-col">
      
      {/* barra superior */}
      <div className="w-full px-3 py-2 flex justify-between items-start bg-gradient-to-b from-black/80 via-black/40 to-transparent">
        <span className="text-gray-100 text-xs font-mono font-bold tracking-wide drop-shadow-md truncate pr-2">
          {name}
        </span>
        
        <div className="flex items-center gap-1.5 bg-black/50 px-1.5 py-0.5 rounded backdrop-blur-sm border border-gray-700/50 shrink-0">
          <div 
            className={`w-2 h-2 rounded-full ${
              isOnline ? 'bg-green-500 animate-pulse' : 'bg-red-600'
            }`} 
          />
          <span className="text-[9px] text-gray-300 font-mono uppercase tracking-wider">
            {status}
          </span>
        </div>
      </div>

      {/* estado: cargando */}
      {streamStatus === 'loading' && (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2 opacity-80">
            <div className="w-5 h-5 border-2 border-gray-600 border-t-white rounded-full animate-spin" />
            <span className="text-gray-400 text-[10px] font-mono tracking-widest uppercase">
              CARGANDO STREAM...
            </span>
          </div>
        </div>
      )}

      {/* estado: error */}
      {streamStatus === 'error' && (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2 opacity-90 bg-black/40 px-4 py-2 rounded">
            <span className="text-red-500 text-xs font-mono tracking-wider font-bold">
              ERROR DE CONEXIÓN
            </span>
          </div>
        </div>
      )}

      {/* estado: reproduciendo (opcional, estilo VMS) */}
      {streamStatus === 'playing' && (
        <div className="absolute bottom-2 right-2">
          <span className="text-[9px] text-green-400 font-mono opacity-70">
            LIVE
          </span>
        </div>
      )}
    </div>
  );
};

CameraOverlay.propTypes = {
  name: PropTypes.string.isRequired,
  status: PropTypes.oneOf(['online', 'offline']).isRequired,
  streamStatus: PropTypes.oneOf(['loading', 'playing', 'error']).isRequired,
};

export default CameraOverlay;