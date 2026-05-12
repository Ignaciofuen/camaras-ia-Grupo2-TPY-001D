import AlertList from './AlertList';

/**
 * AlertSection
 * Contenedor principal del panel lateral de alertas (Event Log).
 * Diseñado para alojar las detecciones en tiempo real (YOLO) sin manejar la lógica del WebSocket.
 * * @param {Object} props
 * @param {Array} props.alerts - Arreglo de alertas provenientes del backend/WS
 */
const AlertSection = ({ alerts = [], onDelete }) => {
  return (
    <aside className="w-80 h-full flex flex-col bg-[#121212] border-l border-gray-800 flex-shrink-0 z-20 shadow-[-4px_0_15px_rgba(0,0,0,0.3)]">
      
      {/* Cabecera del Panel */}
      <div className="h-10 px-4 bg-[#1a1a1a] border-b border-gray-800 flex items-center justify-between shrink-0">
        <h2 className="text-gray-200 text-xs font-bold uppercase tracking-widest flex items-center gap-2">
          {/* Indicador visual de monitoreo activo */}
          <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse" />
          Registro de Eventos
        </h2>
        
        {/* Contador técnico para el operador */}
        <div className="text-[10px] font-mono text-gray-500 bg-black px-1.5 py-0.5 rounded border border-gray-800">
          {alerts.length} EVENTOS
        </div>
      </div>

      {/* Controles de Filtro (Estructurales, listos para futura implementación) */}
      <div className="px-3 py-2 bg-[#161616] border-b border-gray-800 flex gap-2 shrink-0">
        <input 
          type="text" 
          placeholder="Filtrar por cámara o tipo..." 
          className="w-full bg-black border border-gray-700 text-xs text-gray-300 px-2 py-1 rounded placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors font-mono"
          readOnly // ReadOnly por ahora, para cumplir la regla de no lógica compleja
        />
      </div>

      {/* Contenedor desplazable para la lista de alertas */}
      <div className="flex-1 overflow-hidden relative bg-[#0a0a0a]">
        {/* Se delega el renderizado de los items a AlertList */}
        <AlertList alerts={alerts} onDelete={onDelete} />
      </div>

    </aside>
  );
};

export default AlertSection;