import { useCallback, useEffect, useRef, useState } from 'react';

export const useWebRTC = (videoRef, whepUrl) => {
  const [status, setStatus] = useState('loading');
  const pcRef = useRef(null);

  const initStream = useCallback(async () => {
    const video = videoRef.current;

    if (!whepUrl) {
      setStatus('loading');
      return;
    }

    if (!video) {
      setStatus('error');
      return;
    }

    setStatus('loading');

    if (pcRef.current) {
      try {
        pcRef.current.close();
      } catch {
        // noop
      }
      pcRef.current = null;
    }

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });
    pcRef.current = pc;

    pc.addTransceiver('video', { direction: 'recvonly' });
    pc.addTransceiver('audio', { direction: 'recvonly' });

    const stream = new MediaStream();
    pc.ontrack = (event) => {
      stream.addTrack(event.track);
      video.srcObject = stream;
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') setStatus('playing');
      if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) {
        setStatus('error');
      }
    };

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      await new Promise((resolve) => {
        if (pc.iceGatheringState === 'complete') {
          resolve();
          return;
        }

        const onChange = () => {
          if (pc.iceGatheringState === 'complete') {
            pc.removeEventListener('icegatheringstatechange', onChange);
            resolve();
          }
        };

        pc.addEventListener('icegatheringstatechange', onChange);
        window.setTimeout(resolve, 2000);
      });

      const response = await fetch(whepUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/sdp' },
        body: pc.localDescription.sdp,
      });

      if (!response.ok) {
        throw new Error(`WHEP ${response.status} ${response.statusText}`);
      }

      const answerSdp = await response.text();
      await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });
    } catch (error) {
      console.error(`[useWebRTC] fallo conectar a ${whepUrl}:`, error);
      setStatus('error');
      try {
        pc.close();
      } catch {
        // noop
      }
      pcRef.current = null;
    }
  }, [videoRef, whepUrl]);

  useEffect(() => {
    const video = videoRef.current;
    const initTimer = window.setTimeout(initStream, 0);

    return () => {
      window.clearTimeout(initTimer);

      if (pcRef.current) {
        try {
          pcRef.current.close();
        } catch {
          // noop
        }
        pcRef.current = null;
      }

      if (video) {
        video.srcObject = null;
      }
    };
  }, [initStream, videoRef]);

  const reloadStream = useCallback(() => {
    initStream();
  }, [initStream]);

  return {
    status,
    loading: status === 'loading',
    playing: status === 'playing',
    error: status === 'error',
    reloadStream,
  };
};

export default useWebRTC;
