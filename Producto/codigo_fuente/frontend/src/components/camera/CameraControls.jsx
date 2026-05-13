import PropTypes from 'prop-types';

/**
 * CameraControls
 *
 * Barra de controles que aparece al pasar el mouse sobre la cámara.
 * Solo renderiza botones; toda la lógica vive en CameraCard.
 *
 * Botones disponibles:
 *   - Snapshot   : descarga el frame actual como JPG
 *   - Audio      : mute/unmute del <video>
 *   - Pause/Play : congela el video local (no afecta camara/detector)
 *   - Reload     : reconecta el WebRTC (cuando se traba)
 *   - Fullscreen : pantalla completa del card entero
 */
const CameraControls = ({
  onFullscreen,
  onToggleMute,
  onSnapshot,
  onTogglePause,
  onReload,
  onToggleRecord,
  isMuted = true,
  isPaused = false,
  isRecording = false,
}) => {
  const btn = "pointer-events-auto p-1.5 text-gray-300 hover:text-white hover:bg-white/20 rounded transition-colors";

  return (
    <div className="absolute bottom-0 left-0 w-full p-2 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-30 flex justify-end items-center gap-2 pointer-events-none">

      {/* Grabar / Detener */}
      <button
        onClick={onToggleRecord}
        className={`${btn} ${isRecording ? 'text-red-500 hover:text-red-300 animate-pulse' : ''}`}
        title={isRecording ? "Detener grabación (descarga .webm)" : "Iniciar grabación"}
      >
        {isRecording ? (
          // Square stop
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <rect x="6" y="6" width="12" height="12" rx="1" />
          </svg>
        ) : (
          // Red circle "REC"
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="6" />
          </svg>
        )}
      </button>

      {/* Snapshot */}
      <button onClick={onSnapshot} className={btn} title="Capturar frame (JPG)">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>

      {/* Audio */}
      <button onClick={onToggleMute} className={btn} title={isMuted ? "Activar audio" : "Silenciar"}>
        {isMuted ? (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
          </svg>
        )}
      </button>

      {/* Pause / Play */}
      <button onClick={onTogglePause} className={btn} title={isPaused ? "Reanudar" : "Pausar stream"}>
        {isPaused ? (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
          </svg>
        )}
      </button>

      {/* Reload (reconectar) */}
      <button onClick={onReload} className={btn} title="Reconectar stream (cuando se traba)">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v6h6M20 20v-6h-6M4 10a8 8 0 0114-4M20 14a8 8 0 01-14 4" />
        </svg>
      </button>

      {/* Fullscreen */}
      <button onClick={onFullscreen} className={btn} title="Pantalla completa">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
        </svg>
      </button>
    </div>
  );
};

CameraControls.propTypes = {
  onFullscreen:   PropTypes.func,
  onToggleMute:   PropTypes.func,
  onSnapshot:     PropTypes.func,
  onTogglePause:  PropTypes.func,
  onReload:       PropTypes.func,
  onToggleRecord: PropTypes.func,
  isMuted:        PropTypes.bool,
  isPaused:       PropTypes.bool,
  isRecording:    PropTypes.bool,
};

export default CameraControls;
