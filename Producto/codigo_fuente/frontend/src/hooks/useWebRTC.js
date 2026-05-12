import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * useWebRTC
 *
 * Conecta un <video> a MediaMTX via WHEP (WebRTC-HTTP Egress Protocol).
 *
 * Flujo:
 *   1. Crea RTCPeerConnection con dos transceivers recvonly (video + audio).
 *   2. Genera offer SDP, espera a que junte sus ICE candidates.
 *   3. POSTea la offer al endpoint WHEP de MediaMTX (puerto 8889).
 *   4. Recibe el answer SDP, lo aplica como remote description.
 *   5. ontrack -> arma un MediaStream y lo asigna a video.srcObject.
 *
 * Latencia tipica en LAN: 200-400ms (vs 3-5s con HLS).
 *
 * @param {Object} videoRef referencia al <video>
 * @param {string} whepUrl  URL WHEP (ej. http://localhost:8889/cam_principal/whep)
 *                          Si es null/undefined, el hook no hace nada (idle).
 */
export const useWebRTC = (videoRef, whepUrl) => {
  const [status, setStatus] = useState('loading');
  const pcRef = useRef(null);

  const initStream = useCallback(async () => {
    const video = videoRef.current;

    // Idle si no hay URL (el VideoPlayer puede pasar null cuando se usa HLS)
    if (!whepUrl) {
      setStatus('loading');
      return;
    }
    if (!video) {
      setStatus('error');
      return;
    }

    setStatus('loading');

    // Cerrar conexion previa antes de abrir una nueva
    if (pcRef.current) {
      try { pcRef.current.close(); } catch { /* noop */ }
      pcRef.current = null;
    }

    const pc = new RTCPeerConnection({
      // STUN publico de Google (en LAN no se usa, pero no molesta).
      // Si en el futuro se accede desde fuera del LAN, agregar TURN aqui.
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });
    pcRef.current = pc;

    // Solo recibimos (no publicamos camara/mic). MediaMTX manda los tracks
    // de la fuente RTSP en respuesta a estos transceivers.
    pc.addTransceiver('video', { direction: 'recvonly' });
    pc.addTransceiver('audio', { direction: 'recvonly' });

    // ontrack se dispara una vez por cada track (video + audio si hay).
    // Acumulamos en un MediaStream que asignamos a video.srcObject.
    const stream = new MediaStream();
    pc.ontrack = (event) => {
      stream.addTrack(event.track);
      video.srcObject = stream;
    };

    pc.onconnectionstatechange = () => {
      switch (pc.connectionState) {
        case 'connected':
          setStatus('playing');
          break;
        case 'failed':
        case 'disconnected':
        case 'closed':
          setStatus('error');
          break;
        default:
          break;
      }
    };

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // WHEP "trickle ICE off": esperamos a que termine de juntar ICE
      // candidates antes de mandar la offer (asi va completa en el SDP).
      // MediaMTX soporta trickle pero esto es mas simple.
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
        // Timeout de seguridad: si ICE tarda mas de 2s, mandamos lo que haya.
        setTimeout(resolve, 2000);
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
      // El estado pasa a 'playing' cuando connectionState === 'connected'
    } catch (err) {
      console.error(`[useWebRTC] fallo conectar a ${whepUrl}:`, err);
      setStatus('error');
      try { pc.close(); } catch { /* noop */ }
      pcRef.current = null;
    }
  }, [videoRef, whepUrl]);

  useEffect(() => {
    initStream();

    return () => {
      // Cleanup al desmontar o cambiar URL
      if (pcRef.current) {
        try { pcRef.current.close(); } catch { /* noop */ }
        pcRef.current = null;
      }
      const video = videoRef.current;
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
