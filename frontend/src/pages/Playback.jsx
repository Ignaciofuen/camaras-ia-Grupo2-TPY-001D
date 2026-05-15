import { useCallback, useEffect, useState } from 'react';
import ConfirmDialog from '../components/common/ConfirmDialog';
import api from '../services/api';
import { cameraService } from '../services/cameraService';

const getInitialDates = () => {
  const today = new Date().toISOString().slice(0, 10);
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  return { today, oneWeekAgo };
};

const formatTime = (iso) => {
  if (!iso) return '--';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleString('es-CL', { hour12: false });
};

const formatDuration = (seconds) => {
  if (seconds == null) return '--';
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
};

const Field = ({ label, children }) => (
  <div className="flex flex-col gap-1">
    <span className="text-gray-500 text-[10px] font-mono uppercase tracking-wider">
      {label}
    </span>
    {children}
  </div>
);

const Empty = ({ children, error = false }) => (
  <div className={`py-12 text-center font-mono text-sm ${error ? 'text-red-500' : 'text-gray-600'}`}>
    {children}
  </div>
);

const TabButton = ({ active, children, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`px-4 py-1.5 text-xs font-mono uppercase tracking-wider rounded-t border-b-2 transition-colors ${
      active
        ? 'border-blue-500 text-white bg-[#161616]'
        : 'border-transparent text-gray-500 hover:text-gray-300'
    }`}
  >
    {children}
  </button>
);

const SnapshotThumb = ({ item, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="group relative aspect-video bg-black border border-gray-800 hover:border-blue-500 overflow-hidden text-left"
  >
    {item.alerta_id ? (
      <img
        src={`/alertas/${item.alerta_id}/snapshot`}
        alt={item.camara_nombre || 'Captura'}
        className="w-full h-full object-cover transition-transform group-hover:scale-105"
        onError={(event) => {
          event.currentTarget.style.opacity = '0.2';
        }}
      />
    ) : (
      <div className="w-full h-full flex items-center justify-center text-gray-700 font-mono text-[10px]">
        sin alerta
      </div>
    )}
    <BottomLabel camera={item.camara_nombre} time={item.capturado_en} />
  </button>
);

const RecordingThumb = ({ item, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="group relative aspect-video bg-[#1a1a1a] border border-gray-800 hover:border-blue-500 overflow-hidden text-left flex items-center justify-center"
  >
    <svg className="w-12 h-12 text-gray-600 group-hover:text-blue-400" fill="currentColor" viewBox="0 0 24 24">
      <path d="M8 5v14l11-7z" />
    </svg>
    <span className="absolute top-1 right-1 bg-black/70 text-white text-[9px] font-mono px-1 py-0.5 rounded">
      {formatDuration(item.duracion_s)}
    </span>
    <BottomLabel camera={item.camara_nombre} time={item.iniciada_en} />
  </button>
);

const BottomLabel = ({ camera, time }) => (
  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-1.5">
    <div className="text-white text-[10px] font-mono uppercase truncate">
      {camera || 'Camara'}
    </div>
    <div className="text-gray-400 text-[9px] font-mono">{formatTime(time)}</div>
  </div>
);

const MediaModal = ({ tab, item, onClose, onDelete }) => {
  if (!item) return null;

  const isRecording = tab === 'grabaciones';
  const title = item.camara_nombre || 'Evidencia';
  const subtitle = formatTime(item.capturado_en || item.iniciada_en);
  const mediaUrl = isRecording
    ? `/grabaciones/${item.id}/video`
    : `/alertas/${item.alerta_id}/snapshot`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#161616] border border-gray-700 rounded-lg shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-gray-800 flex justify-between items-center shrink-0">
          <div>
            <div className="text-gray-100 font-bold uppercase tracking-widest text-sm">{title}</div>
            <div className="text-gray-500 text-xs font-mono">{subtitle}</div>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          <div className="flex-1 bg-black flex items-center justify-center min-h-[300px]">
            {isRecording ? (
              <video controls autoPlay className="max-w-full max-h-[80vh]">
                <source src={mediaUrl} type={item.content_type || 'video/webm'} />
              </video>
            ) : (
              <img src={mediaUrl} alt="Captura" className="max-w-full max-h-[80vh] object-contain" />
            )}
          </div>

          <div className="w-full md:w-80 border-t md:border-t-0 md:border-l border-gray-800 p-4 text-xs font-mono space-y-2 flex flex-col">
            <div><span className="text-gray-500">Camara:</span> <span className="text-gray-200">{title}</span></div>
            {isRecording && (
              <>
                <div><span className="text-gray-500">Duracion:</span> <span className="text-gray-200">{formatDuration(item.duracion_s)}</span></div>
                <div><span className="text-gray-500">Formato:</span> <span className="text-gray-200">{item.content_type || 'video/webm'}</span></div>
              </>
            )}
            {!isRecording && (
              <>
                <div><span className="text-gray-500">Personas:</span> <span className="text-gray-200">{item.cantidad_personas ?? '--'}</span></div>
                <div><span className="text-gray-500">Nivel:</span> <span className="text-gray-200">{item.nivel || '--'}</span></div>
              </>
            )}
            <div className="flex-1" />
            <div className="pt-2 border-t border-gray-800 flex gap-2">
              <a
                href={mediaUrl}
                download
                className="flex-1 text-center px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs uppercase tracking-wide rounded"
              >
                Descargar
              </a>
              <button
                type="button"
                onClick={onDelete}
                className="px-3 py-1.5 bg-red-700 hover:bg-red-600 text-white text-xs uppercase tracking-wide rounded"
              >
                Borrar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Playback = () => {
  const [{ today, oneWeekAgo }] = useState(getInitialDates);
  const [tab, setTab] = useState('capturas');
  const [desde, setDesde] = useState(oneWeekAgo);
  const [hasta, setHasta] = useState(today);
  const [cameraId, setCameraId] = useState('');
  const [cameras, setCameras] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    cameraService.getCameras()
      .then(setCameras)
      .catch(() => setCameras([]));
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = { limite: 120 };
      if (desde) params.desde = `${desde}T00:00:00`;
      if (hasta) params.hasta = `${hasta}T23:59:59`;
      if (cameraId) params.camara_id = cameraId;

      const url = tab === 'grabaciones' ? '/grabaciones' : '/snapshots';
      const { data } = await api.get(url, { params });
      setItems(Array.isArray(data) ? data : []);
    } catch (fetchError) {
      setError(fetchError.message || 'No se pudo cargar evidencia');
    } finally {
      setLoading(false);
    }
  }, [cameraId, desde, hasta, tab]);

  useEffect(() => {
    queueMicrotask(fetchData);
  }, [fetchData]);

  const handleDelete = async () => {
    if (!selected) return;

    const endpoint = tab === 'grabaciones'
      ? `/grabaciones/${selected.id}`
      : `/eventos/${selected.evento_id}`;

    await api.delete(endpoint);
    setConfirmDelete(false);
    setSelected(null);
    fetchData();
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#0a0a0a] overflow-hidden">
      <header className="px-6 py-4 border-b border-gray-800 shrink-0">
        <h1 className="text-xl text-gray-100 font-bold uppercase tracking-widest">
          Reproduccion Forense
        </h1>
        <p className="text-xs text-gray-500 font-mono mt-1">
          {items.length} {tab === 'grabaciones' ? 'grabaciones' : 'capturas'} en el rango seleccionado
        </p>
      </header>

      <div className="px-6 pt-3 bg-[#0a0a0a] border-b border-gray-800 shrink-0 flex gap-1">
        <TabButton active={tab === 'capturas'} onClick={() => { setTab('capturas'); setSelected(null); }}>
          Capturas
        </TabButton>
        <TabButton active={tab === 'grabaciones'} onClick={() => { setTab('grabaciones'); setSelected(null); }}>
          Grabaciones
        </TabButton>
      </div>

      <div className="px-6 py-3 bg-[#161616] border-b border-gray-800 flex flex-wrap gap-3 items-end shrink-0">
        <Field label="Desde">
          <input type="date" value={desde} max={hasta || today} onChange={(event) => setDesde(event.target.value)} className="bg-black border border-gray-700 text-gray-200 px-2 py-1 rounded font-mono text-xs focus:outline-none focus:border-blue-500" />
        </Field>
        <Field label="Hasta">
          <input type="date" value={hasta} min={desde || undefined} max={today} onChange={(event) => setHasta(event.target.value)} className="bg-black border border-gray-700 text-gray-200 px-2 py-1 rounded font-mono text-xs focus:outline-none focus:border-blue-500" />
        </Field>
        <Field label="Camara">
          <select value={cameraId} onChange={(event) => setCameraId(event.target.value)} className="bg-black border border-gray-700 text-gray-200 px-2 py-1 rounded font-mono text-xs focus:outline-none focus:border-blue-500">
            <option value="">Todas</option>
            {cameras.map((camera) => (
              <option key={camera.id || camera.uuid || camera.nombre} value={camera.id || camera.uuid}>
                {camera.nombre || camera.name}
              </option>
            ))}
          </select>
        </Field>
        <button type="button" onClick={fetchData} className="ml-auto bg-blue-600 hover:bg-blue-500 text-white text-xs font-mono uppercase tracking-wide px-4 py-1.5 rounded">
          Recargar
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
        {loading && <Empty>Cargando...</Empty>}
        {error && !loading && <Empty error>Error: {error}</Empty>}
        {!loading && !error && items.length === 0 && <Empty>Sin evidencia para los filtros seleccionados.</Empty>}
        {!loading && !error && items.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
            {items.map((item) => (
              tab === 'grabaciones'
                ? <RecordingThumb key={item.id} item={item} onClick={() => setSelected(item)} />
                : <SnapshotThumb key={item.evento_id || item.alerta_id} item={item} onClick={() => setSelected(item)} />
            ))}
          </div>
        )}
      </div>

      <MediaModal
        tab={tab}
        item={selected}
        onClose={() => setSelected(null)}
        onDelete={() => setConfirmDelete(true)}
      />

      <ConfirmDialog
        open={confirmDelete}
        title="Borrar evidencia"
        message="Esta accion eliminara la evidencia seleccionada del backend."
        confirmLabel="Borrar"
        danger
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
};

export default Playback;
