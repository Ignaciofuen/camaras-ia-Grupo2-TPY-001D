import { useAlerts } from '../../hooks/useAlerts';

/**
 * AlertList
 * Lista virtualizable de eventos de seguridad.
 * Se conecta directamente al hook/store de alertas para evitar re-renderizados 
 * innecesarios en la jerarquía superior del layout.
 */
const AlertList = () => {
  // Obtiene el flujo en tiempo real desde el WebSocket (o Store global como Zustand)
  const { alerts } = useAlerts();

  // Estado vacío defensivo
  if (!alerts || alerts.length === 0) {
    return (
      <div className="flex flex-col w-full h-full items-center justify-center bg-[#0a0a0a] p-4 text-center">
        <svg className="w-8 h-8 text-gray-700 opacity-50 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        <span className="text-gray-600 font-mono text-[10px] tracking-widest uppercase">
          Registro de eventos vacío
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto custom-scrollbar p-1 space-y-1">
      {alerts.map((alert) => {
        // En un VMS, el nivel de severidad suele determinar el color.
        // Asumimos un estilo rojo/carmesí típico para detecciones de intrusión (YOLO).
        const confidencePercent = (alert.confidence * 100).toFixed(0);
        
        // Formateo estricto del timestamp (ISO 8601 o formato local técnico)
        const timeString = new Date(alert.timestamp).toLocaleTimeString('es-ES', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });

        return (
          <div 
            key={alert.id} 
            className="flex flex-col bg-[#1e1e1e] border-l-4 border-red-600 hover:bg-[#252526] transition-colors p-2 cursor-pointer group"
          >
            <div className="flex justify-between items-start mb-1">
              <div className="flex items-center gap-2">
                <span className="text-red-500 font-bold text-xs uppercase tracking-wider">
                  {alert.label}
                </span>
                <span className="text-gray-400 text-[9px] font-mono bg-black px-1 rounded border border-gray-700">
                  {confidencePercent}%
                </span>
              </div>
              <span className="text-gray-500 text-[10px] font-mono group-hover:text-gray-300 transition-colors">
                {timeString}
              </span>
            </div>
            
            <div className="flex justify-between items-end mt-1">
              <span className="text-gray-400 text-[10px] font-mono uppercase tracking-wide truncate pr-2">
                CAM: {alert.cameraId}
              </span>
              
              {/* Botón rápido para saltar al playback del evento */}
              <button 
                className="opacity-0 group-hover:opacity-100 text-blue-400 hover:text-blue-300 transition-opacity p-1"
                title="Ver grabación"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default AlertList;