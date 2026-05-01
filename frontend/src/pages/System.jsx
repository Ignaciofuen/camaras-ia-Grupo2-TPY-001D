import { useState, useEffect } from 'react';
import apiClient from '../services/api';

const System = () => {
  const [statusData, setStatusData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSystemStatus = async () => {
      try {
        const response = await apiClient.get('/system/status');
        setStatusData(response.data);
      } catch (error) {
        console.error("Error al obtener estado del sistema:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSystemStatus();
    // En producción, podrías usar un setInterval aquí para refrescar cada 10s
  }, []);

  if (loading) {
    return <div className="p-6 text-gray-500 font-mono">Obteniendo telemetría...</div>;
  }

  return (
    <div className="h-screen w-full bg-[#0a0a0a] p-8 overflow-auto">
      <h1 className="text-xl text-gray-100 font-bold uppercase tracking-widest mb-6 border-b border-gray-800 pb-2">
        Estado del Sistema
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Métrica: Backend */}
        <div className="bg-[#161616] border border-gray-800 p-5 rounded">
          <h3 className="text-xs text-gray-500 uppercase tracking-widest mb-2">Servicio Core</h3>
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${statusData?.backend === 'online' ? 'bg-green-500' : 'bg-red-600'}`} />
            <span className="text-xl text-gray-200 font-mono capitalize">
              {statusData?.backend || 'Desconocido'}
            </span>
          </div>
        </div>

        {/* Métrica: Cámaras */}
        <div className="bg-[#161616] border border-gray-800 p-5 rounded">
          <h3 className="text-xs text-gray-500 uppercase tracking-widest mb-2">Cámaras Activas</h3>
          <div className="text-2xl text-blue-400 font-bold font-mono">
            {statusData?.activeCameras || 0} <span className="text-sm text-gray-500">/ {statusData?.totalCameras || 0}</span>
          </div>
        </div>

        {/* Métrica: Latencia */}
        <div className="bg-[#161616] border border-gray-800 p-5 rounded">
          <h3 className="text-xs text-gray-500 uppercase tracking-widest mb-2">Latencia Promedio (IA)</h3>
          <div className="text-2xl text-orange-400 font-bold font-mono">
            {statusData?.latencyMs || '--'} <span className="text-sm text-gray-500">ms</span>
          </div>
        </div>

      </div>
    </div>
  );
};

export default System;