import CameraCard from './CameraCard';

/**
 * CameraGrid
 * Contenedor visual responsivo para múltiples transmisiones de video.
 * Carece de lógica de negocio o fetch; puramente presentacional.
 * * @param {Object} props
 * @param {Array} props.cameras - Colección de cámaras provenientes del backend
 */
const CameraGrid = ({ cameras = [] }) => {
  // Estado vacío defensivo
  if (!cameras || cameras.length === 0) {
    return (
      <div className="flex flex-col w-full h-full items-center justify-center bg-[#0a0a0a] border border-gray-800">
        <svg className="w-12 h-12 text-gray-700 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
        <span className="text-gray-600 font-mono text-xs tracking-widest uppercase">
          Sin cámaras asignadas a esta vista
        </span>
      </div>
    );
  }

  return (
    /* Grid responsivo puro en CSS:
      - bg-gray-900: Fondo oscuro para los separadores (gap)
      - gap-[2px]: Separación mínima para aprovechar pantalla (estilo XProtect)
      - auto-rows-fr: Obliga a que todas las filas tengan la misma altura
    */
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 auto-rows-fr gap-[2px] p-[2px] bg-gray-900 w-full h-full overflow-y-auto custom-scrollbar">
      {cameras.map((camera) => (
        <CameraCard key={camera.id} camera={camera} />
      ))}
    </div>
  );
};

export default CameraGrid;