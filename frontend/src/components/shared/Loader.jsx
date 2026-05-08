import PropTypes from 'prop-types';

/**
 * Loader
 *
 * Spinner simple reutilizable.
 * Se usa para estados de carga.
 */
const Loader = ({ text = 'CARGANDO...' }) => {
  return (
    <div className="flex flex-col items-center justify-center w-full h-full text-gray-400 font-mono text-sm">
      <div className="flex flex-col items-center gap-3">
        <div className="w-6 h-6 border-2 border-gray-600 border-t-blue-500 rounded-full animate-spin" />
        <span className="tracking-widest uppercase text-xs">
          {text}
        </span>
      </div>
    </div>
  );
};

Loader.propTypes = {
  text: PropTypes.string,
};

export default Loader;