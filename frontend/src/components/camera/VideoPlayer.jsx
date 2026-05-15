import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import PropTypes from 'prop-types';
import { useStream } from '../../hooks/useStream';
import { useWebRTC } from '../../hooks/useWebRTC';

const VideoPlayer = forwardRef(({
  streamUrl,
  muted = true,
  paused = false,
  onStatusChange,
}, ref) => {
  const videoRef = useRef(null);
  const isWebRTC = typeof streamUrl === 'string' && streamUrl.includes('/whep');

  const hls = useStream(videoRef, isWebRTC ? null : streamUrl);
  const webrtc = useWebRTC(videoRef, isWebRTC ? streamUrl : null);
  const { status, reloadStream } = isWebRTC ? webrtc : hls;

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = muted;
    }
  }, [muted]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (paused) {
      video.pause();
    } else if (video.paused) {
      video.play().catch(() => {});
    }
  }, [paused]);

  useEffect(() => {
    onStatusChange?.(status);
  }, [onStatusChange, status]);

  useImperativeHandle(ref, () => ({
    captureFrame: () => {
      const video = videoRef.current;

      if (!video || !video.videoWidth || !video.videoHeight) {
        return null;
      }

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');

      try {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/jpeg', 0.92);
      } catch (error) {
        console.warn('[VideoPlayer] no se pudo capturar frame:', error);
        return null;
      }
    },
    setMuted: (nextMuted) => {
      if (videoRef.current) videoRef.current.muted = Boolean(nextMuted);
    },
    pause: () => videoRef.current?.pause(),
    play: () => videoRef.current?.play().catch(() => {}),
    reload: () => reloadStream?.(),
    getElement: () => videoRef.current,
  }), [reloadStream]);

  return (
    <video
      ref={videoRef}
      className="w-full h-full object-contain bg-black"
      autoPlay
      muted={muted}
      playsInline
    />
  );
});

VideoPlayer.displayName = 'VideoPlayer';

VideoPlayer.propTypes = {
  streamUrl: PropTypes.string.isRequired,
  muted: PropTypes.bool,
  paused: PropTypes.bool,
  onStatusChange: PropTypes.func,
};

export default VideoPlayer;
