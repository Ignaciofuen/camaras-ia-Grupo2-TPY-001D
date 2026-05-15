import PropTypes from 'prop-types';
import CameraCard from './CameraCard';

const getCameraKey = (camera) => (
  camera?.nombre || camera?.name || camera?.id || camera?.uuid
);

const CameraGrid = ({
  cameras = [],
  detectionsMap = {},
  layoutClass = 'grid-cols-2',
  onCameraClick,
  activeCameraId,
}) => {
  if (!cameras || cameras.length === 0) {
    return (
      <div className="flex flex-col w-full h-full items-center justify-center bg-[#0a0a0a] border border-gray-800">
        <span className="text-gray-600 font-mono text-xs tracking-widest uppercase">
          SIN CAMARAS
        </span>
      </div>
    );
  }

  return (
    <div className={`grid ${layoutClass} auto-rows-fr gap-[2px] p-[2px] bg-gray-900 w-full h-full overflow-y-auto`}>
      {cameras.map((camera) => {
        const cameraKey = getCameraKey(camera);
        const detections =
          detectionsMap[cameraKey] ||
          detectionsMap[camera.id] ||
          detectionsMap[camera.uuid] ||
          [];
        const isActive = activeCameraId === camera.id || activeCameraId === camera.uuid;

        return (
          <div
            key={camera.id || camera.uuid || cameraKey}
            onClick={() => onCameraClick?.(camera)}
            className={`relative ${isActive ? 'ring-2 ring-blue-500/60 ring-inset' : 'cursor-pointer'}`}
          >
            <CameraCard camera={camera} detections={detections} />
          </div>
        );
      })}
    </div>
  );
};

CameraGrid.propTypes = {
  cameras: PropTypes.array,
  detectionsMap: PropTypes.object,
  layoutClass: PropTypes.string,
  onCameraClick: PropTypes.func,
  activeCameraId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};

export default CameraGrid;
