import { useState, useEffect, useCallback } from 'react';
import apiClient from '../services/api';
import ConfirmDialog from '../components/common/ConfirmDialog';

/**
 * Playback
 * Galería forense con dos pestañas:
 *   - Capturas:    snapshots JPG de YOLO (uno por evento con persona)
 *   - Grabaciones: videos .webm grabados manualmente desde el dashboard
 *
 * Filtros: rango de fechas + cámara.
 * Click en un item -> modal con detalle + opción de descargar a disco.
 */
const Playback = () => {
  // capturas    = snapshots automáticos de YOLO (eventos_deteccion)
  // grabaciones = videos .webm grabados desde el botón REC
  // manuales    = snapshots manuales del botón Snapshot del CameraCard
  const [tab, setTab] = useState('capturas');

  // Filtros comunes
  const today      = new Date().toISOString().slice(0, 10);
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                       .toISOString().slice(0, 10);
  const [desde, setDesde]       = useState(oneWeekAgo);
  const [hasta, setHasta]       = useState(today);
  const [cameraId, setCameraId] = useState('');
  const [cameras, setCameras]   = useState([]);

  // Datos
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    apiClient.get('/camaras').then((r) => setCameras(r.data || [])).catch(() => setCameras([]));
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { limite: 120 };
      if (desde)    params.desde     = `${desde}T00:00:00`;
      if (hasta)    params.hasta     = `${hasta}T23:59:59`;
      if (cameraId) params.camara_id = cameraId;

      // Mapeo de tab → endpoint + filtro
      let url;
      if (tab === 'capturas') {
        url = '/snapshots';
      } else if (tab === 'grabaciones') {
        url = '/grabaciones';
        params.tipo = 'video';      // solo videos, los snapshots manuales van en tab aparte
      } else {  // 'manuales'
        url = '/grabaciones';
        params.tipo = 'snapshot';
      }

      const { data } = await apiClient.get(url, { params });
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('[Playback] error:', err);
      setError(String(err?.message || err));
    } finally {
      setLoading(false);
    }
  }, [tab, desde, hasta, cameraId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="flex flex-col h-screen w-full bg-[#0a0a0a] overflow-hidden">

      {/* Header */}
      <header className="px-6 py-4 border-b border-gray-800 shrink-0">
        <h1 className="text-xl text-gray-100 font-bold uppercase tracking-widest">
          Reproducción Forense
        </h1>
        <p className="text-xs text-gray-500 font-mono mt-1">
          {items.length} {
            tab === 'grabaciones' ? 'grabaciones'
            : tab === 'manuales'    ? 'capturas manuales'
            :                         'capturas (YOLO)'
          } en el rango seleccionado
        </p>
      </header>

      {/* Tabs */}
      <div className="px-6 pt-3 bg-[#0a0a0a] border-b border-gray-800 shrink-0 flex gap-1">
        <Tab active={tab === 'capturas'}    onClick={() => { setTab('capturas'); setSelected(null); }}>Capturas (YOLO)</Tab>
        <Tab active={tab === 'grabaciones'} onClick={() => { setTab('grabaciones'); setSelected(null); }}>Grabaciones</Tab>
        <Tab active={tab === 'manuales'}    onClick={() => { setTab('manuales'); setSelected(null); }}>Capturas Manuales</Tab>
      </div>

      {/* Filtros */}
      <div className="px-6 py-3 bg-[#161616] border-b border-gray-800 flex flex-wrap gap-3 items-end shrink-0">
        <Field label="Desde">
          <input type="date" value={desde} max={hasta || today}
            onChange={(e) => setDesde(e.target.value)} className="input-dark" />
        </Field>
        <Field label="Hasta">
          <input type="date" value={hasta} min={desde || undefined} max={today}
            onChange={(e) => setHasta(e.target.value)} className="input-dark" />
        </Field>
        <Field label="Cámara">
          <select value={cameraId} onChange={(e) => setCameraId(e.target.value)} className="input-dark">
            <option value="">Todas</option>
            {cameras.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </Field>
        <button onClick={fetchData}
          className="ml-auto bg-blue-600 hover:bg-blue-500 text-white text-xs font-mono uppercase tracking-wide px-4 py-1.5 rounded">
          Recargar
        </button>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
        {loading && <Empty>Cargando…</Empty>}
        {error && !loading && <Empty error>Error: {error}</Empty>}
        {!loading && !error && items.length === 0 && (
          <Empty>Sin {tab} para los filtros seleccionados.</Empty>
        )}
        {!loading && !error && items.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
            {items.map((it) => {
              if (tab === 'capturas') {
                return <SnapshotThumb key={it.evento_id} snap={it} onClick={() => setSelected(it)} />;
              }
              if (tab === 'grabaciones') {
                return <RecordingThumb key={`g${it.id}`} rec={it} onClick={() => setSelected(it)} />;
              }
              // 'manuales'
              return <ManualSnapshotThumb key={`m${it.id}`} rec={it} onClick={() => setSelected(it)} />;
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      {selected && tab === 'capturas' && (
        <SnapshotModal
          snap={selected}
          onClose={() => setSelected(null)}
          onDeleted={() => { setSelected(null); fetchData(); }}
        />
      )}
      {selected && tab === 'grabaciones' && (
        <RecordingModal
          rec={selected}
          onClose={() => setSelected(null)}
          onDeleted={() => { setSelected(null); fetchData(); }}
        />
      )}
      {selected && tab === 'manuales' && (
        <ManualSnapshotModal
          rec={selected}
          onClose={() => setSelected(null)}
          onDeleted={() => { setSelected(null); fetchData(); }}
        />
      )}

      <style>{`
        .input-dark { background:#000;border:1px solid #374151;color:#e5e7eb;padding:.25rem .5rem;border-radius:.25rem;font-family:monospace;font-size:.75rem; }
        .input-dark:focus { outline:none;border-color:#3b82f6; }
      `}</style>
    </div>
  );
};

// ---------- subcomponentes ----------

const Tab = ({ active, onClick, children }) => (
  <button onClick={onClick}
    className={`px-4 py-1.5 text-xs font-mono uppercase tracking-wider rounded-t border-b-2 transition-colors ${
      active
        ? 'border-blue-500 text-white bg-[#161616]'
        : 'border-transparent text-gray-500 hover:text-gray-300'
    }`}>
    {children}
  </button>
);

const Field = ({ label, children }) => (
  <div className="flex flex-col gap-1">
    <span className="text-gray-500 text-[10px] font-mono uppercase tracking-wider">{label}</span>
    {children}
  </div>
);

const Empty = ({ error, children }) => (
  <div className={`py-12 text-center font-mono text-sm ${error ? 'text-red-500' : 'text-gray-600'}`}>
    {children}
  </div>
);

const NivelBadge = ({ nivel }) => {
  if (!nivel) return null;
  const map = { alto: 'bg-red-600', medio: 'bg-yellow-500', bajo: 'bg-blue-500' };
  const cls = map[String(nivel).toLowerCase()] || 'bg-gray-500';
  return (
    <span className={`absolute top-1 right-1 ${cls} text-white text-[8px] font-mono uppercase px-1 py-0.5 rounded`}>
      {nivel}
    </span>
  );
};

const SnapshotThumb = ({ snap, onClick }) => (
  <button onClick={onClick} className="group relative aspect-video bg-black border border-gray-800 hover:border-blue-500 overflow-hidden text-left">
    {snap.alerta_id ? (
      <img src={`/alertas/${snap.alerta_id}/snapshot`} alt={snap.camara_nombre}
        className="w-full h-full object-cover transition-transform group-hover:scale-105"
        onError={(e) => { e.target.style.opacity = '0.2'; }} />
    ) : (
      <div className="w-full h-full flex items-center justify-center text-gray-700 font-mono text-[10px]">
        sin alerta
      </div>
    )}
    <BottomLabel cam={snap.camara_nombre} time={snap.capturado_en} />
    <NivelBadge nivel={snap.nivel} />
  </button>
);

const RecordingThumb = ({ rec, onClick }) => (
  <button onClick={onClick} className="group relative aspect-video bg-[#1a1a1a] border border-gray-800 hover:border-blue-500 overflow-hidden text-left flex items-center justify-center">
    {/* Icono play */}
    <svg className="w-12 h-12 text-gray-600 group-hover:text-blue-400" fill="currentColor" viewBox="0 0 24 24">
      <path d="M8 5v14l11-7z" />
    </svg>
    {/* Duración */}
    <span className="absolute top-1 right-1 bg-black/70 text-white text-[9px] font-mono px-1 py-0.5 rounded">
      {fmtDuration(rec.duracion_s)}
    </span>
    <BottomLabel cam={rec.camara_nombre} time={rec.iniciada_en} />
  </button>
);

const BottomLabel = ({ cam, time }) => (
  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-1.5">
    <div className="text-white text-[10px] font-mono uppercase truncate">{cam}</div>
    <div className="text-gray-400 text-[9px] font-mono">{fmtTime(time)}</div>
  </div>
);

const SnapshotModal = ({ snap, onClose, onDeleted }) => {
  const [alertaDetalle, setAlertaDetalle]     = useState(null);
  const [confirmOpen, setConfirmOpen]         = useState(false);
  // Si true -> borra solo la imagen JPG. Si false -> borra evento+alerta en cascada.
  // Default: false (borrar todo, comportamiento "forensic clean" de VMS).
  const [soloSnapshot, setSoloSnapshot]       = useState(false);

  useEffect(() => {
    if (!snap?.alerta_id) return;
    apiClient.get(`/alertas/${snap.alerta_id}`).then((r) => setAlertaDetalle(r.data)).catch(() => {});
  }, [snap?.alerta_id]);

  const handleDelete = async () => {
    setConfirmOpen(false);
    try {
      await apiClient.delete(`/eventos/${snap.evento_id}`, {
        params: { solo_snapshot: soloSnapshot },
      });
      onDeleted && onDeleted();
    } catch (err) {
      alert('No se pudo borrar la captura.');
    }
  };

  return (
    <>
      <ModalShell title={snap.camara_nombre} subtitle={fmtTime(snap.capturado_en)} onClose={onClose}>
        <div className="flex-1 bg-black flex items-center justify-center min-h-[300px]">
          {snap.alerta_id && (
            <img src={`/alertas/${snap.alerta_id}/snapshot`} alt="Captura"
              className="max-w-full max-h-[80vh] object-contain" />
          )}
        </div>
        <div className="w-full md:w-80 border-t md:border-t-0 md:border-l border-gray-800 p-4 overflow-y-auto custom-scrollbar text-xs font-mono space-y-2 flex flex-col">
          <Row label="Personas" value={snap.cantidad_personas ?? '—'} />
          {snap.nivel && <Row label="Nivel" value={String(snap.nivel).toUpperCase()} />}
          {alertaDetalle?.numero_alerta && <Row label="Alerta #" value={alertaDetalle.numero_alerta} />}
          {alertaDetalle?.llava_descripcion && (
            <div>
              <div className="text-gray-500 mb-1">Descripción:</div>
              <p className="text-gray-200 normal-case leading-relaxed">{alertaDetalle.llava_descripcion}</p>
            </div>
          )}
          {alertaDetalle?.llava_acciones && (
            <div>
              <div className="text-gray-500 mb-1">Acciones:</div>
              <p className="text-gray-200 normal-case">{alertaDetalle.llava_acciones}</p>
            </div>
          )}
          <div className="flex-1" />
          <div className="pt-2 border-t border-gray-800 flex gap-2">
            {snap.alerta_id && (
              <a href={`/alertas/${snap.alerta_id}/snapshot`} download
                className="flex-1 text-center px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs uppercase tracking-wide rounded">
                Descargar JPG
              </a>
            )}
            <button onClick={() => setConfirmOpen(true)}
              className="px-3 py-1.5 bg-red-700 hover:bg-red-600 text-white text-xs uppercase tracking-wide rounded">
              Borrar
            </button>
          </div>
        </div>
      </ModalShell>

      <ConfirmDialog
        open={confirmOpen}
        title="¿Borrar esta captura?"
        message={
          soloSnapshot
            ? `Borrar SOLO la imagen del evento del ${fmtTime(snap.capturado_en)} (${snap.camara_nombre}). El evento y la alerta quedarán visibles en /alertas y /historial pero sin foto.`
            : `Borrar el evento del ${fmtTime(snap.capturado_en)} (${snap.camara_nombre}) COMPLETO: imagen + alerta + análisis. No queda rastro. La acción es irreversible.`
        }
        extras={
          <label className="flex items-start gap-2 cursor-pointer p-2 bg-[#0f0f0f] border border-gray-700 rounded">
            <input
              type="checkbox"
              checked={soloSnapshot}
              onChange={(e) => setSoloSnapshot(e.target.checked)}
              className="mt-0.5 accent-blue-500"
            />
            <span className="text-xs text-gray-300">
              <span className="font-bold uppercase tracking-wide">Solo borrar la imagen</span>
              <span className="block text-gray-500 mt-0.5 text-[10px]">
                Conserva el evento, la alerta y el análisis LLaVA. Solo elimina el JPG.
              </span>
            </span>
          </label>
        }
        confirmLabel={soloSnapshot ? 'Borrar imagen' : 'Borrar todo'}
        danger
        onConfirm={handleDelete}
        onCancel={() => { setConfirmOpen(false); setSoloSnapshot(false); }}
      />
    </>
  );
};

const RecordingModal = ({ rec, onClose, onDeleted }) => {
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleDelete = async () => {
    setConfirmOpen(false);
    try {
      await apiClient.delete(`/grabaciones/${rec.id}`);
      onDeleted && onDeleted();
    } catch (err) {
      alert('No se pudo borrar la grabación.');
    }
  };

  return (
    <>
      <ModalShell title={rec.camara_nombre} subtitle={fmtTime(rec.iniciada_en)} onClose={onClose}>
        <div className="flex-1 bg-black flex items-center justify-center min-h-[300px]">
          <video controls autoPlay className="max-w-full max-h-[80vh]">
            <source src={`/grabaciones/${rec.id}/video`} type={rec.content_type || 'video/webm'} />
          </video>
        </div>
        <div className="w-full md:w-80 border-t md:border-t-0 md:border-l border-gray-800 p-4 overflow-y-auto custom-scrollbar text-xs font-mono space-y-2 flex flex-col">
          <Row label="Duración"   value={fmtDuration(rec.duracion_s)} />
          <Row label="Tamaño"     value={rec.tamano_bytes ? `${(rec.tamano_bytes / 1024 / 1024).toFixed(2)} MB` : '—'} />
          <Row label="Formato"    value={rec.content_type || 'video/webm'} />
          <Row label="Iniciada"   value={fmtTime(rec.iniciada_en)} />
          <Row label="Finalizada" value={fmtTime(rec.finalizada_en)} />
          <div className="flex-1" />
          <div className="pt-2 border-t border-gray-800 flex gap-2">
            <a href={`/grabaciones/${rec.id}/video`} download={`${rec.camara_nombre}_${rec.id}.webm`}
              className="flex-1 text-center px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs uppercase tracking-wide rounded">
              Descargar
            </a>
            <button onClick={() => setConfirmOpen(true)}
              className="px-3 py-1.5 bg-red-700 hover:bg-red-600 text-white text-xs uppercase tracking-wide rounded">
              Borrar
            </button>
          </div>
        </div>
      </ModalShell>

      <ConfirmDialog
        open={confirmOpen}
        title="¿Borrar esta grabación?"
        message={`Grabación de ${rec.camara_nombre} del ${fmtTime(rec.iniciada_en)} (${fmtDuration(rec.duracion_s)}). Se borra de la DB y de MinIO. La acción es irreversible.`}
        confirmLabel="Borrar"
        danger
        onConfirm={handleDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
};

const ModalShell = ({ title, subtitle, onClose, children }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4" onClick={onClose}>
    <div className="bg-[#161616] border border-gray-700 rounded-lg shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col"
      onClick={(e) => e.stopPropagation()}>
      <div className="px-4 py-3 border-b border-gray-800 flex justify-between items-center shrink-0">
        <div>
          <div className="text-gray-100 font-bold uppercase tracking-widest text-sm">{title}</div>
          <div className="text-gray-500 text-xs font-mono">{subtitle}</div>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white p-1">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">{children}</div>
    </div>
  </div>
);

const Row = ({ label, value }) => (
  <div><span className="text-gray-500">{label}:</span> <span className="text-gray-200">{value}</span></div>
);

// Thumb para snapshots manuales (img preview en lugar de icono play)
const ManualSnapshotThumb = ({ rec, onClick }) => (
  <button onClick={onClick} className="group relative aspect-video bg-black border border-gray-800 hover:border-blue-500 overflow-hidden text-left">
    <img src={`/grabaciones/${rec.id}/video`} alt={rec.camara_nombre}
      className="w-full h-full object-cover transition-transform group-hover:scale-105"
      onError={(e) => { e.target.style.opacity = '0.2'; }} />
    <span className="absolute top-1 right-1 bg-purple-600/90 text-white text-[8px] font-mono uppercase px-1 py-0.5 rounded">
      MANUAL
    </span>
    <BottomLabel cam={rec.camara_nombre} time={rec.iniciada_en} />
  </button>
);

// Modal para snapshots manuales
const ManualSnapshotModal = ({ rec, onClose, onDeleted }) => {
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleDelete = async () => {
    setConfirmOpen(false);
    try {
      await apiClient.delete(`/grabaciones/${rec.id}`);
      onDeleted && onDeleted();
    } catch (err) {
      alert('No se pudo borrar.');
    }
  };

  return (
    <>
      <ModalShell title={`${rec.camara_nombre} · Snapshot manual`} subtitle={fmtTime(rec.iniciada_en)} onClose={onClose}>
        <div className="flex-1 bg-black flex items-center justify-center min-h-[300px]">
          <img src={`/grabaciones/${rec.id}/video`} alt="Snapshot manual" className="max-w-full max-h-[80vh] object-contain" />
        </div>
        <div className="w-full md:w-80 border-t md:border-t-0 md:border-l border-gray-800 p-4 overflow-y-auto custom-scrollbar text-xs font-mono space-y-2 flex flex-col">
          <Row label="Tipo"     value="Snapshot manual" />
          <Row label="Tamaño"   value={rec.tamano_bytes ? `${(rec.tamano_bytes / 1024).toFixed(1)} KB` : '—'} />
          <Row label="Formato"  value={rec.content_type || 'image/jpeg'} />
          <Row label="Capturado" value={fmtTime(rec.iniciada_en)} />
          <div className="flex-1" />
          <div className="pt-2 border-t border-gray-800 flex gap-2">
            <a href={`/grabaciones/${rec.id}/video`} download={`${rec.camara_nombre}_${rec.id}.jpg`}
              className="flex-1 text-center px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs uppercase tracking-wide rounded">
              Descargar
            </a>
            <button onClick={() => setConfirmOpen(true)}
              className="px-3 py-1.5 bg-red-700 hover:bg-red-600 text-white text-xs uppercase tracking-wide rounded">
              Borrar
            </button>
          </div>
        </div>
      </ModalShell>

      <ConfirmDialog
        open={confirmOpen}
        title="¿Borrar este snapshot manual?"
        message={`Snapshot de ${rec.camara_nombre} del ${fmtTime(rec.iniciada_en)}. Se borra de la DB y MinIO. Irreversible.`}
        confirmLabel="Borrar"
        danger
        onConfirm={handleDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
};

const fmtTime = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('es-AR', { hour12: false });
};

const fmtDuration = (s) => {
  if (s == null) return '—';
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
};

export default Playback;
