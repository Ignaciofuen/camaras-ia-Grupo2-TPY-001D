import { useState, useRef, useCallback } from 'react';

/**
 * useRecording
 *
 * Hook para grabar el contenido de un <video> usando MediaRecorder +
 * captureStream(). Al stop SUBE el blob al backend (POST /grabaciones)
 * para que quede en MinIO y aparezca en la pestaña Playback.
 *
 * NO descarga el archivo a la PC del operador — eso se hace despues desde
 * Playback con el botón "Descargar".
 *
 * Uso:
 *   const { isRecording, start, stop, uploading } = useRecording();
 *   start(videoElement, "Camara_Sonoff", camaraIdUuid);
 *   stop();   // upload al backend, NO download local
 */
export const useRecording = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [uploading, setUploading]     = useState(false);
  const [error, setError]             = useState(null);

  const recorderRef   = useRef(null);
  const chunksRef     = useRef([]);
  const camNameRef    = useRef('camara');
  const camIdRef      = useRef(null);
  const startedAtRef  = useRef(null);

  /** Inicia grabacion sobre un <video>. camaraId es el UUID de la DB. */
  const start = useCallback((videoEl, camName = 'camara', camaraId = null) => {
    if (!videoEl) {
      setError('No hay video');
      return;
    }
    if (isRecording) return;

    setError(null);

    let stream;
    try {
      stream = videoEl.captureStream
        ? videoEl.captureStream()
        : videoEl.mozCaptureStream && videoEl.mozCaptureStream();
    } catch (e) {
      setError(`captureStream falló: ${e.message}`);
      return;
    }
    if (!stream) {
      setError('captureStream no soportado en este navegador');
      return;
    }

    const candidates = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=h264,opus',
      'video/webm',
      'video/mp4',
    ];
    const mimeType = candidates.find((m) =>
      typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported(m)
    ) || '';

    chunksRef.current = [];
    let recorder;
    try {
      recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    } catch (e) {
      setError(`MediaRecorder falló: ${e.message}`);
      return;
    }

    recorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
    };

    recorder.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'video/webm' });
      chunksRef.current = [];
      setIsRecording(false);

      const finishedAt = new Date();
      const startedAt  = new Date(startedAtRef.current);
      const durSec     = Math.max(1, Math.round((finishedAt - startedAt) / 1000));

      if (!camIdRef.current) {
        console.warn('[useRecording] sin camara_id (uuid). No se sube al server.');
        setError('Falta camara_id para subir');
        return;
      }

      // Subir al backend
      setUploading(true);
      try {
        const form = new FormData();
        form.append('camara_id', camIdRef.current);
        form.append('iniciada_en', startedAt.toISOString());
        form.append('finalizada_en', finishedAt.toISOString());
        form.append('duracion_s', String(durSec));
        form.append('content_type', recorder.mimeType || 'video/webm');
        form.append('archivo', blob, `${camNameRef.current}.webm`);

        const resp = await fetch('/grabaciones', { method: 'POST', body: form });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        console.log('[useRecording] grabacion subida:', data);
      } catch (e) {
        console.error('[useRecording] upload falló:', e);
        setError(`Upload falló: ${e.message}`);
        // Fallback: descargar local para que el user no pierda la grabacion
        const url = URL.createObjectURL(blob);
        const a   = document.createElement('a');
        const ts  = new Date().toISOString().replace(/[:.]/g, '-');
        a.href     = url;
        a.download = `${camNameRef.current}_${ts}.webm`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } finally {
        setUploading(false);
      }
    };

    recorder.onerror = (ev) => {
      console.error('[useRecording] error MediaRecorder:', ev);
      setError('Error de grabación');
      setIsRecording(false);
    };

    recorderRef.current  = recorder;
    camNameRef.current   = camName;
    camIdRef.current     = camaraId;
    startedAtRef.current = Date.now();

    recorder.start(1000);
    setIsRecording(true);
  }, [isRecording]);

  const stop = useCallback(() => {
    const r = recorderRef.current;
    if (r && r.state !== 'inactive') {
      r.stop();
    }
    recorderRef.current = null;
  }, []);

  return { isRecording, uploading, error, start, stop };
};

export default useRecording;
