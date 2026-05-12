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
const DetectionOverlay = memo(({ detections = [], aspectRatio = '16 / 9' }) => {
  // si no hay detecciones, no renderizamos nada
  if (!detections || detections.length === 0) return null;

  /**
   * El <video> de adentro usa `object-fit: contain`, que mantiene el aspect
   * ratio del stream (16:9 con cams normales). Si el contenedor del card es
   * mas cuadrado, quedan barras negras arriba/abajo y los bboxes en % se
   * desplazaban a esas zonas vacias (se "salian del video").
   *
   * La fix: un wrapper con `aspect-ratio` igual al del video, centrado por
   * flex. Los bboxes se posicionan en % DE ESE wrapper, asi quedan siempre
   * dentro del area real del video.
   */
  return (
    <div className="w-full h-full flex items-center justify-center pointer-events-none">
      <div
        className="relative"
        style={{
          aspectRatio,
          maxWidth:  '100%',
          maxHeight: '100%',
          width:     '100%',   // CSS aspect-ratio derivara la altura
          height:    'auto',
        }}
      >
        {detections.map((det) => {
          if (
            det.x == null ||
            det.y == null ||
            det.width == null ||
            det.height == null
          ) return null;

          const confidence =
            det.confidence <= 1
              ? Math.round(det.confidence * 100)
              : Math.round(det.confidence);

          return (
            <div
              key={det.id}
              className="absolute border-[1.5px] border-red-500 bg-red-500/20"
              style={{
                left:   `${det.x}%`,
                top:    `${det.y}%`,
                width:  `${det.width}%`,
                height: `${det.height}%`,
                // Interpolacion visual: el bbox "anima" entre posiciones en
                // lugar de saltar, oculta perceptualmente la latencia YOLO.
                // 80ms es ~2 frames a 25fps, suficientemente fluido sin
                // sentirse "pegajoso".
                transition: 'left 80ms linear, top 80ms linear, width 80ms linear, height 80ms linear',
              }}
            >
              <span className="absolute bottom-full left-[-1.5px] bg-red-500 text-white text-[9px] font-mono px-1 whitespace-nowrap">
                {det.label} {confidence}%
              </span>
            </div>
          );
        })}
      </div>
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
  // Aspect ratio del video real, ej '16 / 9' o '4 / 3'. Default 16:9.
  aspectRatio: PropTypes.string,
};

export default DetectionOverlay;