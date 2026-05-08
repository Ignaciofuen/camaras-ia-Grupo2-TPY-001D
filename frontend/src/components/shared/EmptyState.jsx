import PropTypes from 'prop-types';

/**
 * EmptyState
 *
 * Estado vacío reutilizable.
 * Se usa cuando no hay datos para mostrar.
 */
const EmptyState = ({ text = 'SIN DATOS' }) => {
  return (
    <div className="flex flex-col w-full h-full items-center justify-center bg-[#0a0a0a] text-center">
      <svg
        className="w-10 h-10 text-gray-700 opacity-50 mb-2"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1"
          d="M9 17v-2a4 4 0 018 0v2M5 10h14M5 6h14M4 20h16"
        />
      </svg>

      <span className="text-gray-600 font-mono text-xs tracking-widest uppercase">
        {text}
      </span>
    </div>
  );
};

EmptyState.propTypes = {
  text: PropTypes.string,
};

export default EmptyState;