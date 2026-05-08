import PropTypes from 'prop-types';

/**
 * Modal
 *
 * Contenedor reutilizable para overlays.
 * Se usa para modales como AlertDetail.
 */
const Modal = ({ isOpen, onClose, children, maxWidthClass = 'max-w-lg' }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      
      {/* fondo (cerrar al hacer click fuera) */}
      <div
        className="absolute inset-0"
        onClick={onClose}
      />

      {/* contenido */}
      <div className={`relative bg-[#1e1e1e] border border-gray-800 rounded shadow-lg p-4 w-full ${maxWidthClass}`}>
        
        {/* botón cerrar */}
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-400 hover:text-white transition-colors z-10"
          title="Cerrar"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {children}
      </div>
    </div>
  );
};

Modal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  children: PropTypes.node,
  maxWidthClass: PropTypes.string,
};

export default Modal;