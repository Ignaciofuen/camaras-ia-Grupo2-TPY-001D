import { useCallback, useRef, useState } from 'react';
import api from '../services/api';

export const useRecording = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const cameraNameRef = useRef('camara');
  const cameraIdRef = useRef(null);
  const startedAtRef = useRef(null);

  const downloadFallback = useCallback((blob) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const ts = new Date().toISOString().replace(/[:.]/g, '-');

    link.href = url;
    link.download = `${cameraNameRef.current}_${ts}.webm`;
    document.body.appendChild(link);
    link.click();
    link.remove();

    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, []);

  const start = useCallback((videoEl, cameraName = 'camara', cameraId = null) => {
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
        : videoEl.mozCaptureStream?.();
    } catch (captureError) {
      setError(`captureStream fallo: ${captureError.message}`);
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
    const mimeType = candidates.find((candidate) => (
      typeof MediaRecorder.isTypeSupported === 'function' &&
      MediaRecorder.isTypeSupported(candidate)
    )) || '';

    chunksRef.current = [];

    let recorder;
    try {
      recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    } catch (recorderError) {
      setError(`MediaRecorder fallo: ${recorderError.message}`);
      return;
    }

    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    recorder.onstop = async () => {
      const blob = new Blob(chunksRef.current, {
        type: recorder.mimeType || 'video/webm',
      });
      chunksRef.current = [];
      setIsRecording(false);

      const finishedAt = new Date();
      const startedAt = new Date(startedAtRef.current);
      const durationSeconds = Math.max(1, Math.round((finishedAt - startedAt) / 1000));

      if (!cameraIdRef.current) {
        setError('Falta camara_id para subir');
        downloadFallback(blob);
        return;
      }

      setUploading(true);

      try {
        const formData = new FormData();
        formData.append('camara_id', cameraIdRef.current);
        formData.append('iniciada_en', startedAt.toISOString());
        formData.append('finalizada_en', finishedAt.toISOString());
        formData.append('duracion_s', String(durationSeconds));
        formData.append('content_type', recorder.mimeType || 'video/webm');
        formData.append('archivo', blob, `${cameraNameRef.current}.webm`);

        await api.post('/grabaciones', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      } catch (uploadError) {
        console.error('[useRecording] upload fallo:', uploadError);
        setError(uploadError.message || 'Upload fallo');
        downloadFallback(blob);
      } finally {
        setUploading(false);
      }
    };

    recorder.onerror = (event) => {
      console.error('[useRecording] MediaRecorder error:', event);
      setError('Error de grabacion');
      setIsRecording(false);
    };

    recorderRef.current = recorder;
    cameraNameRef.current = cameraName;
    cameraIdRef.current = cameraId;
    startedAtRef.current = Date.now();

    recorder.start(1000);
    setIsRecording(true);
  }, [downloadFallback, isRecording]);

  const stop = useCallback(() => {
    const recorder = recorderRef.current;

    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }

    recorderRef.current = null;
  }, []);

  return { isRecording, uploading, error, start, stop };
};

export default useRecording;
