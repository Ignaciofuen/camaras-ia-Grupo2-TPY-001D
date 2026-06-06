import { useState, useEffect, useCallback } from 'react';
import { alertService } from '../services/alertService';
import apiClient from '../services/api';
import AlertCard from '../components/alerts/AlertCard';
import ConfirmDialog from '../components/common/ConfirmDialog';

/**
 * History
 * Historial de eventos persistidos en la DB (tabla `alertas`).
 *
 * Filtros disponibles:
 *   - Fecha "desde" / "hasta"
 *   - Cámara
 *   - Severidad/nivel
 *
 * Reusa el componente AlertCard (con click para expandir + snapshot embebido).
 * NOTA: aca NO hay X individual ni botón limpiar porque el histórico es
 * solo lectura — eso vive en /alertas (la pagina /Alerts).
 */
const History = () => {
  const [items, setItems]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);

  // Filtros
  const today        = new Date().toISOString().slice(0, 10);
  const oneWeekAgo   = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                         .toISOString().slice(0, 10);
  const [desde, setDesde]       = useState(oneWeekAgo);
  const [hasta, setHasta]       = useState(today);
  const [cameraId, setCameraId] = useState('');
  const [severidad, setSeveridad] = useState('');

  // Lista de cámaras para el dropdown
  const [cameras, setCameras] = useState([]);
  useEffect(() => {
    apiClient.get('/camaras')
      .then((r) => setCameras(r.data || []))
      .catch(() => setCameras([]));
  }, []);

  // Carga del historico al montar y cuando cambian filtros
  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filtros = { limite: 200 };
      if (desde)     filtros.desde     = `${desde}T00:00:00`;
      if (hasta)     filtros.hasta     = `${hasta}T23:59:59`;
      if (cameraId)  filtros.camara_id = cameraId;
      if (severidad) filtros.severidad = severidad;
      const data = await alertService.getAlertas(filtros);
      setItems(data);
    } catch (err) {
      console.error('[History] fetch error:', err);
      setError(String(err?.message || err));
    } finally {
      setLoading(false);
    }
  }, [desde, hasta, cameraId, severidad]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  // Borrar item del historial (preserva la alerta en /alertas)
  const [toDelete, setToDelete] = useState(null);
  const handleDeleteHistoryItem = async () => {
    if (!toDelete) return;
    const item = toDelete;
    setToDelete(null);
    try {
      await apiClient.delete(`/eventos/${item.evento_id}`, {
        params: { preservar_alerta: true },
      });
      // Optimistic: lo saco del listado
      setItems((prev) => prev.filter((x) => x.evento_id !== item.evento_id));
    } catch (err) {
      console.error('[History] error al borrar:', err);
      alert(`Error: ${err?.response?.data?.detail || err.message}`);
    }
  };

  return (
    <div className="h-full w-full bg-[#0a0a0a] flex flex-col overflow-hidden">

      {/* Header */}
      <header className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-800 shrink-0">
        <h1 className="text-lg sm:text-xl text-gray-100 font-bold uppercase tracking-widest">
          Historial de Eventos
        </h1>
        <p className="text-xs text-gray-500 font-mono mt-1">
          {items.length} resultados — registro histórico de detecciones
        </p>
      </header>

      {/* Filtros */}
      <div className="px-4 sm:px-6 py-3 bg-[#161616] border-b border-gray-800 flex flex-wrap gap-2 sm:gap-3 items-end shrink-0">
        <FilterField label="Desde">
          <input
            type="date"
            value={desde}
            max={hasta || today}
            onChange={(e) => setDesde(e.target.value)}
            className="bg-black border border-gray-700 text-gray-200 px-2 py-1 rounded font-mono text-xs focus:outline-none focus:border-blue-500"
          />
        </FilterField>

        <FilterField label="Hasta">
          <input
            type="date"
            value={hasta}
            min={desde || undefined}
            max={today}
            onChange={(e) => setHasta(e.target.value)}
            className="bg-black border border-gray-700 text-gray-200 px-2 py-1 rounded font-mono text-xs focus:outline-none focus:border-blue-500"
          />
        </FilterField>

        <FilterField label="Cámara">
          <select
            value={cameraId}
            onChange={(e) => setCameraId(e.target.value)}
            className="bg-black border border-gray-700 text-gray-200 px-2 py-1 rounded font-mono text-xs focus:outline-none focus:border-blue-500"
          >
            <option value="">Todas</option>
            {cameras.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
        </FilterField>

        <FilterField label="Severidad">
          <select
            value={severidad}
            onChange={(e) => setSeveridad(e.target.value)}
            className="bg-black border border-gray-700 text-gray-200 px-2 py-1 rounded font-mono text-xs focus:outline-none focus:border-blue-500"
          >
            <option value="">Todas</option>
            <option value="critica">Crítica</option>
            <option value="alta">Alta</option>
            <option value="media">Media</option>
            <option value="baja">Baja</option>
          </select>
        </FilterField>

        <button
          onClick={fetchHistory}
          className="ml-auto bg-blue-600 hover:bg-blue-500 text-white text-xs font-mono uppercase tracking-wide px-4 py-1.5 rounded"
        >
          Recargar
        </button>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
        {loading && (
          <div className="text-gray-500 font-mono text-sm py-12 text-center">
            Consultando base de datos…
          </div>
        )}
        {error && !loading && (
          <div className="text-red-500 font-mono text-sm py-12 text-center">
            Error: {error}
          </div>
        )}
        {!loading && !error && items.length === 0 && (
          <div className="text-gray-600 font-mono text-sm py-12 text-center">
            Sin eventos para los filtros seleccionados.
          </div>
        )}
        {!loading && !error && items.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
            {items.map((ev) => (
              <div key={ev.id ?? ev.numero_alerta} className="relative group">
                <AlertCard alert={ev} />
                {/* X para eliminar del HISTORIAL (preserva la alerta en /alertas) */}
                {ev.evento_id && (
                  <button
                    onClick={() => setToDelete(ev)}
                    title="Eliminar del historial (preserva la alerta)"
                    className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity bg-red-700/80 hover:bg-red-600 text-white p-1 rounded"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!toDelete}
        title="¿Borrar del historial?"
        message={
          toDelete
            ? `Borrar el evento del ${new Date(toDelete.disparada_en || toDelete.capturado_en).toLocaleString('es-AR')} (${toDelete.camara_nombre}). La ALERTA seguirá visible en /alertas. Solo se borra la captura, las detecciones y el análisis. Irreversible.`
            : ''
        }
        confirmLabel="Borrar"
        danger
        onConfirm={handleDeleteHistoryItem}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
};

const FilterField = ({ label, children }) => (
  <div className="flex flex-col gap-1">
    <span className="text-gray-500 text-[10px] font-mono uppercase tracking-wider">
      {label}
    </span>
    {children}
  </div>
);

export default History;
