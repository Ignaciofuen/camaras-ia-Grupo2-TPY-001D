import VideoPlayer from '../camera/VideoPlayer';

/**
 * AlertDetail
 * Vista detallada de una alerta de seguridad.
 * Incluye la reproducción del clip de video asociado al momento de la detección.
 * * @param {Object} props
 * @param {Object} props.alert - El objeto de alerta seleccionado
 * @param {Function} props.onClose - Callback para cerrar el detalle o volver a la lista
 */
const AlertDetail = ({ alert, onClose }) => {
  if (!alert) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#0a0a0a] text-gray-500 font-mono text-xs uppercase tracking-widest">
        Seleccione un evento para ver detalles
      </div>
    );
  }

  const timeString = new Date(alert.timestamp).toLocaleString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  return (
    <div className="flex-1 flex flex-col bg-[#0a0a0a] overflow-y-auto custom-scrollbar">
      {/* Cabecera del Detalle */}
      <div className="h-14 px-6 flex items-center justify-between border-b border-gray-800 bg-[#161616] shrink-0">
        <div className="flex items-center gap-3">
          <button 
            onClick={onClose}
            className="p-2 -ml-2 text-gray-400 hover:text-white transition-colors"
            title="Cerrar"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <h2 className="text-gray-100 font-bold uppercase tracking-widest text-sm">
            Detalle de Evidencia
          </h2>
        </div>
        
        {/* Badge de ID de Evento */}
        <div className="text-[10px] font-mono text-blue-400 bg-blue-500/10 px-2 py-1 rounded border border-blue-500/20">
          UUID: {alert.id?.substring(0, 8)}
        </div>
      </div>

      {/* Reproductor de Evidencia (Video) */}
      <div className="w-full aspect-video bg-black border-b border-gray-800 relative group">
        {alert.streamUrl || alert.videoUrl ? (
          <VideoPlayer streamUrl={alert.streamUrl || alert.videoUrl} />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-700">
            <svg className="w-16 h-16 mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <span className="font-mono text-xs uppercase tracking-[0.2em]">Video no disponible</span>
          </div>
        )}
      </div>

      {/* Panel de Información Técnica */}
      <div className="p-6 space-y-6">
        
        {/* Sección: Descripción y Riesgo */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-1 font-bold">Tipo de Detección</label>
            <div className="text-xl font-bold text-gray-100 flex items-center gap-3">
              {alert.label}
              <span className="text-xs font-mono bg-gray-800 px-2 py-0.5 rounded text-gray-400 border border-gray-700">
                {(alert.confidence * 100).toFixed(1)}% Confianza
              </span>
            </div>
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-1 font-bold">Nivel de Riesgo</label>
            <div className={`text-lg font-bold uppercase tracking-wider ${
              alert.riskLevel === 'critical' ? 'text-red-500' : 'text-orange-500'
            }`}>
              {alert.riskLevel || 'Alta'}
            </div>
          </div>
        </div>

        {/* Sección: Ubicación y Tiempo */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-gray-800/50">
          <div>
            <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-1 font-bold">Cámara de Origen</label>
            <div className="text-gray-300 flex items-center gap-2">
              <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              {alert.cameraName || alert.cameraId || 'Cámara Desconocida'}
            </div>
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-1 font-bold">Timestamp del Evento</label>
            <div className="text-gray-300 font-mono">
              {timeString}
            </div>
          </div>
        </div>

        {/* Placeholder para Acciones Forenses */}
        <div className="pt-8 flex gap-3">
          <button className="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold uppercase py-3 rounded transition-colors shadow-lg shadow-blue-900/20">
            Descargar Clip de Evidencia
          </button>
          <button className="flex-1 bg-transparent border border-gray-700 hover:border-gray-500 text-gray-300 text-xs font-bold uppercase py-3 rounded transition-colors">
            Marcar como Falso Positivo
          </button>
        </div>
      </div>
    </div>
  );
};

export default AlertDetail;