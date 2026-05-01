import VideoPlayer from './VideoPlayer';

/**
 * CameraCard
 * Contenedor visual de una cámara individual.
 * Renderiza el reproductor HLS y el overlay de estado (OSD) sin manejar lógica de negocio.
 * * @param {Object} props
 * @param {Object} props.camera - Datos de la cámara provenientes del backend
 * @param {string} props.camera.id - ID único
 * @param {string} props.camera.name - Nombre asignado a la cámara
 * @param {string} props.camera.streamUrl - URL del stream HLS
 * @param {'online'|'offline'} props.camera.status - Estado operativo actual
 */
const CameraCard = ({ camera }) => {
  if (!camera) return null;

  const isOnline = camera.status === 'online';
  const hasStream = Boolean(camera.streamUrl);

  return (
    <div className="relative flex flex-col w-full h-full bg-black border border-gray-800 overflow-hidden group">
      
      {/* OSD (On-Screen Display) Overlay */}
      <div className="absolute top-0 left-0 w-full px-3 py-2 z-10 flex justify-between items-start bg-gradient-to-b from-black/90 via-black/50 to-transparent pointer-events-none">
        {/* Nombre de la cámara */}
        <span className="text-gray-100 text-xs font-mono font-bold tracking-wide drop-shadow-[0_1px_2px_rgba(0,0,0,1)] truncate pr-2">
          {camera.name}
        </span>
        
        {/* Indicador de Estado */}
        <div className="flex items-center gap-1.5 bg-black/50 px-1.5 py-0.5 rounded backdrop-blur-sm border border-gray-700/50 shrink-0">
          <div 
            className={`w-2 h-2 rounded-full ${
              isOnline ? 'bg-green-500 animate-pulse' : 'bg-red-600'
            }`} 
          />
          <span className="text-[9px] text-gray-300 font-mono uppercase tracking-wider">
            {camera.status}
          </span>
        </div>
      </div>

      {/* Contenedor del Stream / Fallback */}
      <div className="flex-1 w-full h-full min-h-0 flex items-center justify-center bg-[#0a0a0a]">
        {isOnline && hasStream ? (
          <VideoPlayer streamUrl={camera.streamUrl} />
        ) : (
          <div className="flex flex-col items-center gap-3 opacity-70">
            <svg 
              className="w-10 h-10 text-gray-600" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth="1.5" 
                d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" 
              />
            </svg>
            <span className="text-gray-500 font-mono text-[10px] tracking-widest uppercase">
              NO VIDEO
            </span>
          </div>
        )}
      </div>

      {/* Highlight interactivo (estilo VMS) */}
      <div className="absolute inset-0 border-[3px] border-transparent group-hover:border-blue-500/40 transition-colors pointer-events-none z-20" />
    </div>
  );
};

export default CameraCard;