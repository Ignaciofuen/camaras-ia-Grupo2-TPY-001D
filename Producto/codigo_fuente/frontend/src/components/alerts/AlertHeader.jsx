/**
 * AlertHeader
 * Cabecera principal del módulo de gestión y auditoría de alertas.
 * Muestra el resumen cuantitativo de eventos e incluye la estructura visual para futuros filtros.
 * * @param {Object} props
 * @param {number} props.activeCount - Número total de alertas activas o filtradas
 */
const AlertHeader = ({ activeCount = 0, onClearByDate }) => {
  return (
    <header className="h-16 px-6 bg-[#161616] border-b border-gray-800 flex items-center justify-between shrink-0 shadow-sm z-10">
      
      {/* Sección Izquierda: Título y Contador */}
      <div className="flex items-center gap-4">
        <h1 className="text-gray-100 font-bold uppercase tracking-widest text-lg">
          Registro de Alertas
        </h1>
        
        {/* Badge Técnico de Conteo */}
        <div className="flex items-center gap-2 bg-[#1e1e1e] border border-gray-700 px-3 py-1 rounded-full shadow-inner">
          <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse" />
          <span className="text-gray-300 text-xs font-mono font-semibold tracking-wider">
            {activeCount} ACTIVAS
          </span>
        </div>
      </div>

      {/* Sección Derecha: Controles de Filtro (Placeholders Visuales) */}
      <div className="flex items-center gap-3">
        
        {/* Input de Búsqueda Estructural */}
        <div className="relative group">
          <svg 
            className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2 group-hover:text-blue-400 transition-colors" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input 
            type="text" 
            placeholder="Buscar por ID, cámara o evento..." 
            className="bg-[#0a0a0a] border border-gray-700 text-xs text-gray-300 pl-9 pr-3 py-1.5 rounded focus:outline-none focus:border-blue-500 transition-colors font-mono w-64 placeholder-gray-600"
            readOnly // Preparado visualmente, sin lógica interna
          />
        </div>

        {/* Botón de Filtros Avanzados (Severidad/Tipo) */}
        <button 
          className="flex items-center gap-2 bg-[#252526] hover:bg-[#2d2d30] border border-gray-700 text-gray-300 hover:text-white px-3 py-1.5 rounded text-xs transition-colors font-mono uppercase tracking-wide"
          title="Filtros avanzados"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          Filtros
        </button>

        {/* Botón de Rango de Fechas */}
        <button
          className="flex items-center gap-2 bg-[#252526] hover:bg-[#2d2d30] border border-gray-700 text-gray-300 hover:text-white px-3 py-1.5 rounded text-xs transition-colors font-mono uppercase tracking-wide"
          title="Seleccionar rango de tiempo"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Últimas 24H
        </button>

        {/* Botón Limpiar Alertas */}
        <button
          onClick={onClearByDate}
          className="flex items-center gap-2 bg-red-900/40 hover:bg-red-800/60 border border-red-700/50 text-red-300 hover:text-red-100 px-3 py-1.5 rounded text-xs transition-colors font-mono uppercase tracking-wide"
          title="Borrar alertas por fecha"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2" />
          </svg>
          Limpiar
        </button>
      </div>
      
    </header>
  );
};

export default AlertHeader;
