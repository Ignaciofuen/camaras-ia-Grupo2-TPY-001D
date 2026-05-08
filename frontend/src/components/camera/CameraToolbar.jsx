import PropTypes from 'prop-types';

/**
 * CameraToolbar
 *
 * Barra superior del dashboard.
 *
 * Permite:
 * - cambiar el layout de la grilla
 * - recargar cámaras (refetch)
 *
 * No tiene lógica, solo dispara callbacks al padre.
 */
const CameraToolbar = ({ currentLayout, onLayoutChange, onRefresh, isRefreshing = false }) => {
  // layouts disponibles para la grilla
  const layouts = [
    { id: '1x1', label: 'Cámara Única', icon: 'M4 4h16v16H4z' },
    { id: '2x2', label: 'Grilla 4 (2x2)', icon: 'M4 4h7v7H4zm9 0h7v7h-7zM4 13h7v7H4zm9 0h7v7h-7z' },
    { id: '3x3', label: 'Grilla 9 (3x3)', icon: 'M3 3h5v5H3zm7 0h5v5h-5zm7 0h5v5h-5zM3 10h5v5H3zm7 0h5v5h-5zm7 0h5v5h-5zM3 17h5v5H3zm7 0h5v5h-5zm7 0h5v5h-5z' }
  ];

  return (
    <div className="w-full h-10 bg-[#161616] border-b border-gray-800 flex items-center px-4 justify-between shrink-0">
      
      {/* Título */}
      <div className="text-gray-400 text-xs font-mono uppercase tracking-widest flex items-center gap-2">
        Disposición de Vista
      </div>

      {/* Controles */}
      <div className="flex items-center gap-1 bg-black p-0.5 rounded border border-gray-800">
        
        {/* Layout */}
        {layouts.map((layout) => (
          <button
            key={layout.id}
            onClick={() => onLayoutChange(layout.id)}
            title={layout.label}
            className={`p-1.5 rounded transition-colors flex items-center justify-center ${
              currentLayout === layout.id 
                ? 'bg-[#2d2d30] text-blue-400 shadow-sm' 
                : 'text-gray-500 hover:text-gray-300 hover:bg-[#1e1e1e]'
            }`}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d={layout.icon} />
            </svg>
          </button>
        ))}

        {/* Separador */}
        <div className="w-px h-4 bg-gray-700 mx-1"></div>

        {/* Refetch */}
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className={`p-1.5 rounded transition-colors flex items-center justify-center text-gray-500 hover:text-gray-300 hover:bg-[#1e1e1e] ${
            isRefreshing ? 'opacity-50 cursor-not-allowed' : ''
          }`}
          title="Recargar cámaras"
        >
          <svg 
            className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-blue-400' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>

      </div>
      
    </div>
  );
};

CameraToolbar.propTypes = {
  currentLayout: PropTypes.string.isRequired,
  onLayoutChange: PropTypes.func.isRequired,
  onRefresh: PropTypes.func.isRequired,
  isRefreshing: PropTypes.bool,
};

export default CameraToolbar;