import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import VideoPlayer from '../components/camera/VideoPlayer';
import apiClient from '../services/api';

const Playback = () => {
  const [searchParams] = useSearchParams();
  const cameraId = searchParams.get('camera'); // Ej: /playback?camera=cam_01
  
  const [streamUrl, setStreamUrl] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPlaybackStream = async () => {
      if (!cameraId) {
        setLoading(false);
        return;
      }

      try {
        // Asume un endpoint que devuelve la URL M3U8 para una cámara específica en modo grabación
        const response = await apiClient.get(`/playback/stream?camera=${cameraId}`);
        setStreamUrl(response.data.url);
      } catch (error) {
        console.error("Error al obtener stream de playback:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPlaybackStream();
  }, [cameraId]);

  return (
    <div className="flex flex-col h-screen w-full bg-black p-6">
      <h1 className="text-lg text-gray-200 font-bold uppercase tracking-widest mb-4">
        Reproducción Forense {cameraId && `- ${cameraId}`}
      </h1>
      
      <div className="flex-1 border border-gray-800 bg-[#0a0a0a] rounded overflow-hidden relative">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center text-gray-500 font-mono text-sm">
            Inicializando motor de reproducción...
          </div>
        ) : streamUrl ? (
          <VideoPlayer streamUrl={streamUrl} />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-gray-600 font-mono uppercase">
            Seleccione una fuente de video válida
          </div>
        )}
      </div>
    </div>
  );
};

export default Playback;