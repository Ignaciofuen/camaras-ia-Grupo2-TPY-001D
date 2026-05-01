import { memo } from 'react';
import PropTypes from 'prop-types';

/**
 * DetectionOverlay
 *
 * Dibuja las detecciones de IA sobre el video.
 * Recibe las bounding boxes por props.
 *
 * Está envuelto en memo para evitar renders innecesarios.
 */
const DetectionOverlay = memo(({ detections = [] }) => {
  // si no hay detecciones, no renderizamos nada
  if (!detections || detections.length === 0) return null;

  return (
    <div className="w-full h-full relative pointer-events-none">
      
      {detections.map((det) => {
        // pequeña protección por si vienen datos malos
        if (
          det.x == null ||
          det.y == null ||
          det.width == null ||
          det.height == null
        ) return null;

        // normalizar confidence (soporta 0-1 o 0-100)
        const confidence =
          det.confidence <= 1
            ? Math.round(det.confidence * 100)
            : Math.round(det.confidence);

        return (
          <div
            key={det.id}
            className="absolute border-[1.5px] border-red-500 bg-red-500/20"
            style={{
              left: `${det.x}%`,
              top: `${det.y}%`,
              width: `${det.width}%`,
              height: `${det.height}%`,
            }}
          >
            {/* etiqueta */}
            <span className="absolute bottom-full left-[-1.5px] bg-red-500 text-white text-[9px] font-mono px-1 whitespace-nowrap">
              {det.label} {confidence}%
            </span>
          </div>
        );
      })}

    </div>
  );
});

DetectionOverlay.displayName = 'DetectionOverlay';

DetectionOverlay.propTypes = {
  detections: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      label: PropTypes.string.isRequired,
      confidence: PropTypes.number.isRequired,
      x: PropTypes.number.isRequired,
      y: PropTypes.number.isRequired,
      width: PropTypes.number.isRequired,
      height: PropTypes.number.isRequired,
    })
  ),
};

export default DetectionOverlay;