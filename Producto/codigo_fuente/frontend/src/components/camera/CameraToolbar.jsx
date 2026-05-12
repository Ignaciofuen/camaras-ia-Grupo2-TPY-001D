import PropTypes from 'prop-types';

/**
 * CameraToolbar
 * * Controles globales sobre el Viewport principal (Ej: layouts de la grilla).
 * * @param {string} currentLayout - El layout activo (ej: '1x1', '2x2', '3x3')
 * @param {Function} onLayoutChange - Función que recibe el nuevo layout seleccionado
 */
const CameraToolbar = ({ currentLayout, onLayoutChange }) => {
  const layouts = [
    { id: '1x1', label: 'Cámara Única', icon: 'M4 4h16v16H4z' },
    { id: '2x2', label: 'Grilla 4 (2x2)', icon: 'M4 4h7v7H4zm9 0h7v7h-7zM4 13h7v7H4zm9 0h7v7h-7z' },
    { id: '3x3', label: 'Grilla 9 (3x3)', icon: 'M3 3h5v5H3zm7 0h5v5h-5zm7 0h5v5h-5zM3 10h5v5H3zm7 0h5v5h-5zm7 0h5v5h-5zM3 17h5v5H3zm7 0h5v5h-5zm7 0h5v5h-5z' }
  ];

  return (
    <div className="w-full h-10 bg-[#161616] border-b border-gray-800 flex items-center px-4 justify-between shrink-0">
      
      {/* Título de la vista */}
      <div className="text-gray-400 text-xs font-mono uppercase tracking-widest">
        Disposición de Vista
      </div>

      {/* Controles de Layout */}
      <div className="flex items-center gap-1 bg-black p-0.5 rounded border border-gray-800">
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
      </div>
      
    </div>
  );
};

CameraToolbar.propTypes = {
  currentLayout: PropTypes.string.isRequired,
  onLayoutChange: PropTypes.func.isRequired,
};

export default CameraToolbar;