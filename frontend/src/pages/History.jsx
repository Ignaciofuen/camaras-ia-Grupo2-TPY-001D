import { useCallback, useEffect, useState } from 'react';
import AlertCard from '../components/alerts/AlertCard';
import { alertService } from '../services/alertService';
import { cameraService } from '../services/cameraService';

const getInitialDates = () => {
  const today = new Date().toISOString().slice(0, 10);
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  return { today, oneWeekAgo };
};

const FilterField = ({ label, children }) => (
  <div className="flex flex-col gap-1">
    <span className="text-gray-500 text-[10px] font-mono uppercase tracking-wider">
      {label}
    </span>
    {children}
  </div>
);

const History = () => {
  const [{ today, oneWeekAgo }] = useState(getInitialDates);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [desde, setDesde] = useState(oneWeekAgo);
  const [hasta, setHasta] = useState(today);
  const [cameraId, setCameraId] = useState('');
  const [severidad, setSeveridad] = useState('');
  const [cameras, setCameras] = useState([]);

  useEffect(() => {
    cameraService.getCameras()
      .then(setCameras)
      .catch(() => setCameras([]));
  }, []);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const filtros = { limite: 200 };
      if (desde) filtros.desde = `${desde}T00:00:00`;
      if (hasta) filtros.hasta = `${hasta}T23:59:59`;
      if (cameraId) filtros.camara_id = cameraId;
      if (severidad) filtros.severidad = severidad;

      const data = await alertService.getAlertas(filtros);
      setItems(data);
    } catch (fetchError) {
      console.error('[History] fetch error:', fetchError);
      setError(fetchError.message || 'Error al consultar historial');
    } finally {
      setLoading(false);
    }
  }, [cameraId, desde, hasta, severidad]);

  useEffect(() => {
    queueMicrotask(fetchHistory);
  }, [fetchHistory]);

  return (
    <div className="h-full w-full bg-[#0a0a0a] flex flex-col overflow-hidden">
      <header className="px-6 py-4 border-b border-gray-800 shrink-0">
        <h1 className="text-xl text-gray-100 font-bold uppercase tracking-widest">
          Historial de Eventos
        </h1>
        <p className="text-xs text-gray-500 font-mono mt-1">
          {items.length} resultados - registro historico de detecciones
        </p>
      </header>

      <div className="px-6 py-3 bg-[#161616] border-b border-gray-800 flex flex-wrap gap-3 items-end shrink-0">
        <FilterField label="Desde">
          <input
            type="date"
            value={desde}
            max={hasta || today}
            onChange={(event) => setDesde(event.target.value)}
            className="bg-black border border-gray-700 text-gray-200 px-2 py-1 rounded font-mono text-xs focus:outline-none focus:border-blue-500"
          />
        </FilterField>

        <FilterField label="Hasta">
          <input
            type="date"
            value={hasta}
            min={desde || undefined}
            max={today}
            onChange={(event) => setHasta(event.target.value)}
            className="bg-black border border-gray-700 text-gray-200 px-2 py-1 rounded font-mono text-xs focus:outline-none focus:border-blue-500"
          />
        </FilterField>

        <FilterField label="Camara">
          <select
            value={cameraId}
            onChange={(event) => setCameraId(event.target.value)}
            className="bg-black border border-gray-700 text-gray-200 px-2 py-1 rounded font-mono text-xs focus:outline-none focus:border-blue-500"
          >
            <option value="">Todas</option>
            {cameras.map((camera) => (
              <option key={camera.id || camera.uuid || camera.nombre} value={camera.id || camera.uuid}>
                {camera.nombre || camera.name}
              </option>
            ))}
          </select>
        </FilterField>

        <FilterField label="Severidad">
          <select
            value={severidad}
            onChange={(event) => setSeveridad(event.target.value)}
            className="bg-black border border-gray-700 text-gray-200 px-2 py-1 rounded font-mono text-xs focus:outline-none focus:border-blue-500"
          >
            <option value="">Todas</option>
            <option value="critica">Critica</option>
            <option value="alta">Alta</option>
            <option value="media">Media</option>
            <option value="baja">Baja</option>
          </select>
        </FilterField>

        <button
          type="button"
          onClick={fetchHistory}
          className="ml-auto bg-blue-600 hover:bg-blue-500 text-white text-xs font-mono uppercase tracking-wide px-4 py-1.5 rounded"
        >
          Recargar
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
        {loading && (
          <div className="text-gray-500 font-mono text-sm py-12 text-center">
            Consultando base de datos...
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
            {items.map((event) => (
              <AlertCard
                key={event.id || event.numero_alerta || event.alerta_num}
                alert={event}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default History;
