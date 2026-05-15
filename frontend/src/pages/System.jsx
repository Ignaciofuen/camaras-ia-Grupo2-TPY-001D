import { useEffect, useState } from 'react';
import { systemService } from '../services/systemService';

const statusLabel = (estado) => {
  const normalized = String(estado || '').toLowerCase();
  const labels = {
    online: 'Online',
    ok: 'OK',
    degradada: 'Degradada',
    degradado: 'Degradado',
    offline: 'Offline',
  };

  return labels[normalized] || estado || '--';
};

const statusClass = (estado) => {
  const normalized = String(estado || '').toLowerCase();

  if (normalized === 'online' || normalized === 'ok') {
    return 'bg-green-600/20 text-green-400';
  }

  if (normalized === 'degradada' || normalized === 'degradado') {
    return 'bg-yellow-600/20 text-yellow-400';
  }

  if (normalized === 'offline') {
    return 'bg-red-600/20 text-red-400';
  }

  return 'bg-gray-600/20 text-gray-400';
};

const formatTime = (iso) => {
  if (!iso) return '--';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleString('es-CL', { hour12: false });
};

const Kpi = ({ label, value, color }) => {
  const colorMap = {
    green: 'text-green-400',
    orange: 'text-orange-400',
    blue: 'text-blue-400',
    purple: 'text-purple-400',
    red: 'text-red-400',
    gray: 'text-gray-200',
  };

  return (
    <div className="bg-[#161616] border border-gray-800 p-5 rounded">
      <h3 className="text-xs text-gray-500 uppercase tracking-widest mb-2">{label}</h3>
      <div className={`text-2xl font-bold font-mono ${colorMap[color] || colorMap.gray}`}>
        {value}
      </div>
    </div>
  );
};

const System = () => {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchMetrics = async () => {
      try {
        const metrics = await systemService.getMetrics();

        if (!cancelled) {
          setData(metrics);
          setError(null);
        }
      } catch (fetchError) {
        if (!cancelled) {
          setError(fetchError.message || 'No se pudo obtener telemetria');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    queueMicrotask(fetchMetrics);
    const intervalId = window.setInterval(fetchMetrics, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  if (loading && !data) {
    return (
      <div className="h-full w-full bg-[#0a0a0a] p-8 text-gray-500 font-mono">
        Obteniendo telemetria...
      </div>
    );
  }

  const camaras = data?.camaras || [];
  const servicios = data?.servicios || [];
  const camarasOnline = data?.totales?.camaras_online ?? 0;
  const camarasTotal = data?.totales?.camaras_total ?? camaras.length;
  const yoloAvg = data?.totales?.latencia_yolo_ms_avg;
  const llavaAvg = data?.totales?.latencia_llava_s_avg;
  const anyOffline = servicios.some((service) => service.estado === 'offline');
  const anyDegraded = servicios.some((service) => (
    service.estado === 'degradado' || service.estado === 'degradada'
  ));

  return (
    <div className="h-full w-full bg-[#0a0a0a] p-8 overflow-auto">
      <h1 className="text-xl text-gray-100 font-bold uppercase tracking-widest mb-6 border-b border-gray-800 pb-2">
        Estado del Sistema
      </h1>

      {error && (
        <div className="mb-4 p-3 bg-red-900/30 border border-red-700/50 rounded text-red-200 text-sm font-mono">
          Error: {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Kpi
          label="Camaras activas"
          value={`${camarasOnline} / ${camarasTotal}`}
          color={camarasOnline === camarasTotal && camarasTotal > 0 ? 'green' : 'orange'}
        />
        <Kpi
          label="Latencia YOLO"
          value={yoloAvg != null ? `${yoloAvg} ms` : '-- ms'}
          color="blue"
        />
        <Kpi
          label="Latencia LLaVA"
          value={llavaAvg != null ? `${Number(llavaAvg).toFixed(1)} s` : '-- s'}
          color="purple"
        />
        <Kpi
          label="Sistema"
          value={anyOffline || anyDegraded ? 'Degradado' : 'OK'}
          color={anyOffline ? 'red' : anyDegraded ? 'orange' : 'green'}
        />
      </div>

      <section className="mb-8">
        <h2 className="text-sm text-gray-400 font-mono uppercase tracking-widest mb-3">
          Camaras
        </h2>

        <div className="bg-[#161616] border border-gray-800 rounded overflow-hidden">
          <table className="w-full text-xs font-mono">
            <thead className="bg-[#1e1e1e]">
              <tr>
                <th className="text-left text-gray-500 uppercase tracking-wider px-4 py-2 text-[10px]">Camara</th>
                <th className="text-left text-gray-500 uppercase tracking-wider px-4 py-2 text-[10px]">Estado</th>
                <th className="text-left text-gray-500 uppercase tracking-wider px-4 py-2 text-[10px]">Ultima conexion</th>
                <th className="text-left text-gray-500 uppercase tracking-wider px-4 py-2 text-[10px]">Latencia YOLO</th>
                <th className="text-left text-gray-500 uppercase tracking-wider px-4 py-2 text-[10px]">Ultimo evento</th>
              </tr>
            </thead>
            <tbody>
              {camaras.map((camera) => (
                <tr key={camera.componente || camera.id || camera.nombre} className="border-t border-gray-800">
                  <td className="px-4 py-2 text-gray-200">{camera.componente || camera.nombre}</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] uppercase tracking-wider ${statusClass(camera.estado)}`}>
                      {statusLabel(camera.estado)}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-gray-400">{formatTime(camera.visto_en)}</td>
                  <td className="px-4 py-2 text-gray-200">
                    {camera.ultima_latencia_yolo_ms != null ? `${camera.ultima_latencia_yolo_ms} ms` : '--'}
                  </td>
                  <td className="px-4 py-2 text-gray-400">{formatTime(camera.ultimo_evento_en)}</td>
                </tr>
              ))}

              {camaras.length === 0 && (
                <tr>
                  <td colSpan="5" className="text-gray-600 py-4 text-center">
                    Sin camaras configuradas
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default System;
