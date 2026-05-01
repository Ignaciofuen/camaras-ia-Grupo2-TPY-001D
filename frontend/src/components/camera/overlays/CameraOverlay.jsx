/**
 * CameraOverlay
 * Capa de visualización superpuesta al stream de video.
 * Muestra metadatos y está preparada estructuralmente para renderizar detecciones IA.
 * * @param {Object} props
 * @param {string} props.name - Nombre de la cámara
 * @param {'online'|'offline'} props.status - Estado actual
 * @param {Array} props.detections - (Placeholder) Detecciones de YOLO para pintar BBoxes
 */
const CameraOverlay = ({ name, status, detections = [] }) => {
  const isOnline = status === 'online';

  return (
    <div className="absolute inset-0 pointer-events-none z-20 flex flex-col">
      
      {/* Barra Superior OSD (On-Screen Display) */}
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

      {/* Contenedor de Detecciones (IA) 
        Aquí se mapearán las cajas de YOLO en un futuro. 
        Mantiene pointer-events-none para no bloquear clics al video.
      */}
      <div className="flex-1 relative w-full h-full">
        {detections.map((det) => (
          // Placeholder estructural para futuros Bounding Boxes
          <div 
            key={det.id} 
            className="absolute border-2 border-red-500 bg-red-500/20"
            style={{
              left: `${det.x}%`,
              top: `${det.y}%`,
              width: `${det.width}%`,
              height: `${det.height}%`
            }}
          >
            <span className="absolute -top-4 left-0 bg-red-500 text-white text-[9px] font-mono px-1">
              {det.label} {det.confidence}%
            </span>
          </div>
        ))}
      </div>

    </div>
  );
};

export default CameraOverlay;