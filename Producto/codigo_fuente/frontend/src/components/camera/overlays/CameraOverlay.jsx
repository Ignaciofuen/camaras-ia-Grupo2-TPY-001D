import PropTypes from 'prop-types';

/**
 * CameraOverlay
 *
 * UI sobre el video. Muestra nombre + un badge con el estado REAL del
 * stream (basado en streamStatus del player):
 *   playing  → verde "CONECTADA"
 *   loading  → amarillo "CONECTANDO…"
 *   error    → rojo "DESCONECTADA"
 *
 * Si la cámara está marcada como inactiva en la DB (status === 'offline'),
 * mostramos "INACTIVA" en gris (independiente del streamStatus).
 *
 * No tiene lógica, solo renderiza lo que recibe.
 */
const CameraOverlay = ({ name, status, streamStatus }) => {

  // Decide color/texto del badge según el estado real del stream
  const badge = (() => {
    if (status === 'offline') {
      return { dot: 'bg-gray-500',                 text: 'INACTIVA',     color: 'text-gray-400' };
    }
    if (streamStatus === 'playing') {
      return { dot: 'bg-green-500 animate-pulse',  text: 'CONECTADA',    color: 'text-green-400' };
    }
    if (streamStatus === 'loading') {
      return { dot: 'bg-yellow-500 animate-pulse', text: 'CONECTANDO…',  color: 'text-yellow-400' };
    }
    if (streamStatus === 'error') {
      return { dot: 'bg-red-600 animate-pulse',    text: 'DESCONECTADA', color: 'text-red-400' };
    }
    return { dot: 'bg-gray-500', text: '—', color: 'text-gray-400' };
  })();

  return (
    <div className="w-full h-full flex flex-col">

      {/* Barra superior con nombre + badge de estado */}
      <div className="w-full px-3 py-2 flex justify-between items-start bg-gradient-to-b from-black/80 via-black/40 to-transparent">
        <span className="text-gray-100 text-xs font-mono font-bold tracking-wide drop-shadow-md truncate pr-2">
          {name}
        </span>

        <div className="flex items-center gap-1.5 bg-black/60 px-1.5 py-0.5 rounded backdrop-blur-sm border border-gray-700/50 shrink-0">
          <div className={`w-2 h-2 rounded-full ${badge.dot}`} />
          <span className={`text-[9px] font-mono uppercase tracking-wider ${badge.color}`}>
            {badge.text}
          </span>
        </div>
      </div>

      {/* Overlay central de "cargando" */}
      {streamStatus === 'loading' && status !== 'offline' && (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2 opacity-80">
            <div className="w-5 h-5 border-2 border-gray-600 border-t-white rounded-full animate-spin" />
            <span className="text-gray-400 text-[10px] font-mono tracking-widest uppercase">
              CARGANDO STREAM...
            </span>
          </div>
        </div>
      )}

      {/* Overlay central de "error" */}
      {streamStatus === 'error' && status !== 'offline' && (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2 opacity-90 bg-black/40 px-4 py-2 rounded">
            <span className="text-red-500 text-xs font-mono tracking-wider font-bold">
              ERROR DE CONEXIÓN
            </span>
          </div>
        </div>
      )}

      {/* Indicador discreto LIVE cuando reproduce OK */}
      {streamStatus === 'playing' && (
        <div className="absolute bottom-2 right-2 pointer-events-none">
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
