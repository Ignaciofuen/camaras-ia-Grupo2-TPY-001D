/**
 * CameraControls
 * Barra de herramientas inferior para una cámara individual.
 * Estrictamente UI; ejecuta callbacks inyectados por el componente padre.
 * * @param {Object} props
 * @param {Function} props.onFullscreen - Callback para alternar pantalla completa
 * @param {Function} props.onToggleMute - Callback para mutear/desmutear el stream HLS
 * @param {Function} props.onSnapshot - Callback para capturar un frame del canvas/video
 * @param {boolean} props.isMuted - Estado actual del audio
 */
const CameraControls = ({ onFullscreen, onToggleMute, onSnapshot, isMuted }) => {
  return (
    <div className="absolute bottom-0 left-0 w-full p-2 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-30 flex justify-end items-center gap-2">
      
      {/* Botón Snapshot (Captura Forense) */}
      <button 
        onClick={onSnapshot}
        className="p-1.5 text-gray-300 hover:text-white hover:bg-white/20 rounded transition-colors"
        title="Capturar Frame"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>

      {/* Botón Audio */}
      <button 
        onClick={onToggleMute}
        className="p-1.5 text-gray-300 hover:text-white hover:bg-white/20 rounded transition-colors"
        title={isMuted ? "Activar Audio" : "Silenciar"}
      >
        {isMuted ? (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" clipRule="evenodd" />
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
          </svg>
        )}
      </button>

      {/* Botón Fullscreen */}
      <button 
        onClick={onFullscreen}
        className="p-1.5 text-gray-300 hover:text-white hover:bg-white/20 rounded transition-colors"
        title="Pantalla Completa"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
        </svg>
      </button>
    </div>
  );
};

export default CameraControls;