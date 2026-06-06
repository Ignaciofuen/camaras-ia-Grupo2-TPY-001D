import { useState, useEffect } from 'react';
import apiClient from '../services/api';

/**
 * System
 *
 * Panel de telemetria del sistema. Consume /sistema/metricas que devuelve:
 *   - servicios (postgres, redis, minio, ollama, yolo, llava, detector, api)
 *   - camaras (estado y ultimo evento)
 *   - totales (cantidad camaras online + latencias YOLO/LLaVA promedio)
 *
 * Refresca cada 5s.
 */
const System = () => {
  const [data, setData]       = useState(null);
  const [error, setError]     = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetch = async () => {
      try {
        const resp = await apiClient.get('/sistema/metricas');
        if (!cancelled) {
          setData(resp.data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(String(err?.message || err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetch();
    const id = setInterval(fetch, 5000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  if (loading && !data) {
    return (
      <div className="h-screen w-full bg-[#0a0a0a] p-8 text-gray-500 font-mono">
        Obteniendo telemetría…
      </div>
    );
  }

  const camarasOnline = data?.totales?.camaras_online ?? 0;
  const camarasTotal  = data?.totales?.camaras_total  ?? 0;
  const yoloAvg       = data?.totales?.latencia_yolo_ms_avg;
  const llavaAvg      = data?.totales?.latencia_llava_s_avg;

  return (
    <div className="h-full w-full bg-[#0a0a0a] p-4 sm:p-6 lg:p-8 overflow-auto">
      <h1 className="text-lg sm:text-xl text-gray-100 font-bold uppercase tracking-widest mb-6 border-b border-gray-800 pb-2">
        Estado del Sistema
      </h1>

      {error && (
        <div className="mb-4 p-3 bg-red-900/30 border border-red-700/50 rounded text-red-200 text-sm font-mono">
          Error: {error}
        </div>
      )}

      {/* KPIs principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Kpi
          label="Cámaras activas"
          value={`${camarasOnline} / ${camarasTotal}`}
          color={camarasOnline === camarasTotal && camarasTotal > 0 ? 'green' : 'orange'}
        />
        <Kpi
          label="Latencia YOLO (promedio)"
          value={yoloAvg != null ? `${yoloAvg} ms` : '— ms'}
          color="blue"
        />
        <Kpi
          label="Latencia LLaVA (promedio)"
          value={llavaAvg != null ? `${llavaAvg.toFixed(1)} s` : '— s'}
          color="purple"
        />
        {/* KPI genérico de salud del sistema (sin revelar conteo de servicios) */}
        <Kpi
          label="Sistema"
          value={(() => {
            const svs = data?.servicios || [];
            if (svs.length === 0) return 'Sin datos';
            const anyOffline = svs.some(s => s.estado === 'offline');
            const anyDegraded = svs.some(s => s.estado === 'degradado' || s.estado === 'degradada');
            if (anyOffline) return 'Degradado';
            if (anyDegraded) return 'Degradado';
            return 'OK';
          })()}
          color={(() => {
            const svs = data?.servicios || [];
            if (svs.some(s => s.estado === 'offline')) return 'red';
            if (svs.some(s => s.estado === 'degradado' || s.estado === 'degradada')) return 'orange';
            return 'green';
          })()}
        />
      </div>

      {/* Cámaras (detalle) — solo monitoreo, edición se hace en /settings */}
      <Section title="Cámaras">
        <Table headers={['Cámara', 'Estado', 'Última conexión', 'Última latencia YOLO', 'Último evento']}>
          {(data?.camaras || []).map((c) => (
            <tr key={c.componente} className="border-t border-gray-800">
              <Td>{c.componente}</Td>
              <Td><EstadoBadge estado={c.estado} /></Td>
              <Td className="text-gray-400">{fmtTime(c.visto_en)} {c.segundos_sin_reporte != null && <span className="opacity-60">({c.segundos_sin_reporte}s)</span>}</Td>
              <Td>{c.ultima_latencia_yolo_ms != null ? `${c.ultima_latencia_yolo_ms} ms` : '—'}</Td>
              <Td className="text-gray-400">{fmtTime(c.ultimo_evento_en)}</Td>
            </tr>
          ))}
          {(data?.camaras || []).length === 0 && (
            <tr><td colSpan={5} className="text-gray-600 py-4 text-center">Sin cámaras configuradas</td></tr>
          )}
        </Table>
      </Section>

      {/* NOTA SEG: NO mostramos el listado detallado de servicios (postgres,
          redis, minio, ollama, yolo, llava, etc.) por superficie de ataque.
          Si en el futuro hay un rol admin con auth, se puede agregar acá
          detrás de ese gate. Por ahora solo se ve el KPI agregado arriba. */}
    </div>
  );
};

// ---------- Subcomponentes ----------

const Kpi = ({ label, value, color }) => {
  const map = {
    green:  'text-green-400',
    orange: 'text-orange-400',
    blue:   'text-blue-400',
    purple: 'text-purple-400',
    red:    'text-red-400',
  };
  return (
    <div className="bg-[#161616] border border-gray-800 p-5 rounded">
      <h3 className="text-xs text-gray-500 uppercase tracking-widest mb-2">{label}</h3>
      <div className={`text-2xl font-bold font-mono ${map[color] || 'text-gray-200'}`}>
        {value}
      </div>
    </div>
  );
};

const Section = ({ title, children }) => (
  <div className="mb-8">
    <h2 className="text-sm text-gray-400 font-mono uppercase tracking-widest mb-3">{title}</h2>
    {children}
  </div>
);

const Table = ({ headers, children }) => (
  <div className="bg-[#161616] border border-gray-800 rounded overflow-hidden">
    <div className="overflow-x-auto">
      <table className="w-full text-xs font-mono min-w-[500px]">
        <thead className="bg-[#1e1e1e]">
          <tr>
            {headers.map((h) => (
              <th key={h} className="text-left text-gray-500 uppercase tracking-wider px-4 py-2 text-[10px]">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  </div>
);

const Td = ({ children, className = '' }) => (
  <td className={`px-4 py-2 text-gray-200 ${className}`}>{children}</td>
);

const EstadoBadge = ({ estado }) => {
  const map = {
    online:    { bg: 'bg-green-600/20',  text: 'text-green-400',  label: 'Online'    },
    degradada: { bg: 'bg-yellow-600/20', text: 'text-yellow-400', label: 'Degradada' },
    degradado: { bg: 'bg-yellow-600/20', text: 'text-yellow-400', label: 'Degradado' },
    offline:   { bg: 'bg-red-600/20',    text: 'text-red-400',    label: 'Offline'   },
  };
  const s = map[String(estado || '').toLowerCase()] || { bg: 'bg-gray-600/20', text: 'text-gray-400', label: estado || '—' };
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] uppercase tracking-wider ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  );
};

const fmtTime = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('es-AR', { hour12: false });
};

export default System;
