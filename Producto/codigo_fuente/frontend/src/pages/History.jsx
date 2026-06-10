import { useState, useEffect, useCallback } from 'react';
import { alertService } from '../services/alertService';
import apiClient from '../services/api';
import AlertCard from '../components/alerts/AlertCard';
import ConfirmDialog from '../components/common/ConfirmDialog';

/**
 * History
 * Historial de eventos persistidos en la DB (tabla `alertas`).
 *
 * Descarga individual: icono en cada card → genera un .html con imagen + datos.
 * Descarga completa:   botón "Descargar" junto a "Recargar" → un .html con
 *                      todas las alertas visibles (imágenes en base64).
 */

/* ─────────────────────── helpers de descarga ─────────────────────── */

const fetchSnapshotBase64 = async (alertaId) => {
  try {
    const resp = await apiClient.get(`/alertas/${alertaId}/snapshot`, {
      responseType: 'blob',
    });
    return await new Promise((res) => {
      const reader = new FileReader();
      reader.onloadend = () => res(reader.result);
      reader.readAsDataURL(resp.data);
    });
  } catch {
    return null;
  }
};

const severidadColor = (s) =>
  ({ critica: '#dc2626', alta: '#ef4444', media: '#f97316', baja: '#22c55e' }[s] || '#6b7280');

const generarHTMLAlerta = (ev, imgBase64) => {
  const fecha   = new Date(ev.disparada_en || ev.capturado_en).toLocaleString('es-AR', {
    hour12: false,
  });
  // El badge principal es el nivel evaluado por la IA (llava_nivel),
  // igual que lo muestra la AlertCard. La severidad técnica va en la tabla.
  const nivel = ev.llava_nivel || ev.severidad || '—';
  const sc    = severidadColor(nivel);
  return `
<article style="margin-bottom:48px">
  <h2 style="color:#fff;margin:0 0 4px;font-size:18px">${ev.titulo || 'Alerta sin título'}</h2>
  <span style="background:${sc}22;color:${sc};padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;text-transform:uppercase">${nivel}</span>
  &nbsp;
  <span style="color:#888;font-size:12px">#${ev.numero_alerta || '?'}</span>
  <table style="margin-top:12px;border-collapse:collapse;width:100%">
    <tr><td style="color:#888;font-size:11px;padding:4px 8px 4px 0;white-space:nowrap">FECHA</td><td style="color:#ddd;font-size:13px">${fecha}</td></tr>
    <tr><td style="color:#888;font-size:11px;padding:4px 8px 4px 0">CÁMARA</td><td style="color:#ddd;font-size:13px">${ev.camara_nombre || '—'}</td></tr>
    <tr><td style="color:#888;font-size:11px;padding:4px 8px 4px 0">NIVEL IA</td><td style="color:#ddd;font-size:13px">${ev.llava_nivel || '—'}</td></tr>
    ${ev.llava_acciones ? `<tr><td style="color:#888;font-size:11px;padding:4px 8px 4px 0;vertical-align:top">ACCIONES</td><td style="color:#ddd;font-size:13px">${ev.llava_acciones}</td></tr>` : ''}
    ${ev.llava_descripcion ? `<tr><td style="color:#888;font-size:11px;padding:4px 8px 4px 0;vertical-align:top">DESCRIPCIÓN</td><td style="color:#ddd;font-size:13px">${ev.llava_descripcion}</td></tr>` : ''}
  </table>
  ${imgBase64 ? `<div style="margin-top:14px"><img src="${imgBase64}" alt="snapshot" style="max-width:100%;border:1px solid #2a2a2a;border-radius:6px"/></div>` : '<p style="color:#555;font-size:12px;margin-top:12px">Sin snapshot disponible.</p>'}
</article>`;
};

const envolverHTML = (titulo, subtitulo, cuerpo) => `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>${titulo}</title>
<style>
  *{box-sizing:border-box}
  body{font-family:'Segoe UI',Arial,sans-serif;background:#0a0a0a;color:#e5e5e5;padding:40px;max-width:880px;margin:0 auto}
  h1{color:#fff;font-size:22px;letter-spacing:.08em;text-transform:uppercase;border-bottom:1px solid #222;padding-bottom:10px;margin-bottom:6px}
  p.sub{color:#555;font-size:12px;margin:0 0 36px}
  hr{border:none;border-top:1px solid #1e1e1e;margin:48px 0}
  footer{color:#333;font-size:11px;margin-top:60px;border-top:1px solid #111;padding-top:12px}
</style>
</head>
<body>
<h1>${titulo}</h1>
<p class="sub">${subtitulo}</p>
${cuerpo}
<footer>Generado por Cámaras-IA &middot; ${new Date().toLocaleString('es-AR', { hour12: false })}</footer>
</body>
</html>`;

const descargarBlob = (contenido, nombreArchivo, tipo = 'text/html;charset=utf-8') => {
  const blob = new Blob([contenido], { type: tipo });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/* ─────────────────────── componente principal ─────────────────────── */

const History = () => {
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const today      = new Date().toISOString().slice(0, 10);
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [desde,     setDesde]     = useState(oneWeekAgo);
  const [hasta,     setHasta]     = useState(today);
  const [cameraId,  setCameraId]  = useState('');
  const [severidad, setSeveridad] = useState('');
  const [cameras,   setCameras]   = useState([]);

  // Estado de descarga del historial completo
  const [descargando,     setDescargando]     = useState(false);
  // Estado de descarga individual (id de alerta en proceso)
  const [descargandoId,   setDescargandoId]   = useState(null);

  useEffect(() => {
    apiClient.get('/camaras')
      .then((r) => setCameras(r.data || []))
      .catch(() => setCameras([]));
  }, []);

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
      setError(String(err?.message || err));
    } finally {
      setLoading(false);
    }
  }, [desde, hasta, cameraId, severidad]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  /* ── Descarga individual ── */
  const handleDescargarAlerta = async (ev) => {
    if (descargandoId) return;
    setDescargandoId(ev.id ?? ev.numero_alerta);
    try {
      const imgBase64 = ev.id ? await fetchSnapshotBase64(ev.id) : null;
      const cuerpo    = generarHTMLAlerta(ev, imgBase64);
      const fecha     = new Date(ev.disparada_en || ev.capturado_en)
                          .toLocaleString('es-AR', { hour12: false });
      const html      = envolverHTML(
        `Alerta #${ev.numero_alerta} — ${ev.camara_nombre}`,
        `${fecha} · Nivel IA: ${ev.llava_nivel || ev.severidad || '—'}`,
        cuerpo,
      );
      descargarBlob(
        html,
        `alerta_${ev.numero_alerta}_${(ev.camara_nombre || 'cam').replace(/\s/g, '_')}.html`,
      );
    } finally {
      setDescargandoId(null);
    }
  };

  /* ── Descarga historial completo ── */
  const handleDescargarHistorial = async () => {
    if (descargando || items.length === 0) return;
    setDescargando(true);
    try {
      // Fetch snapshots en lotes de 5 para no saturar el servidor
      const BATCH = 5;
      const conImg = [];
      for (let i = 0; i < items.length; i += BATCH) {
        const lote = items.slice(i, i + BATCH);
        const resueltos = await Promise.all(
          lote.map(async (ev) => ({
            ...ev,
            imgBase64: ev.id ? await fetchSnapshotBase64(ev.id) : null,
          })),
        );
        conImg.push(...resueltos);
      }

      const cuerpo = conImg
        .map((ev) => generarHTMLAlerta(ev, ev.imgBase64))
        .join('<hr>');

      const html = envolverHTML(
        'Historial de Eventos',
        `${items.length} alertas · filtros: ${desde} → ${hasta}`,
        cuerpo,
      );
      descargarBlob(html, `historial_${new Date().toISOString().slice(0, 10)}.html`);
    } finally {
      setDescargando(false);
    }
  };

  /* ── Borrar del historial ── */
  const [toDelete, setToDelete] = useState(null);
  const handleDeleteHistoryItem = async () => {
    if (!toDelete) return;
    const item = toDelete;
    setToDelete(null);
    try {
      await apiClient.delete(`/eventos/${item.evento_id}`, {
        params: { preservar_alerta: true },
      });
      setItems((prev) => prev.filter((x) => x.evento_id !== item.evento_id));
    } catch (err) {
      alert(`Error: ${err?.response?.data?.detail || err.message}`);
    }
  };

  /* ── Render ── */
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

        {/* Acciones globales */}
        <div className="ml-auto flex gap-2">
          {/* Descargar historial completo */}
          <button
            onClick={handleDescargarHistorial}
            disabled={descargando || items.length === 0}
            title="Descargar historial completo (HTML con imágenes)"
            className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-mono uppercase tracking-wide px-3 py-1.5 rounded transition-colors"
          >
            {descargando ? (
              <>
                <SpinnerIcon />
                Generando…
              </>
            ) : (
              <>
                <DownloadIcon />
                Descargar
              </>
            )}
          </button>

          <button
            onClick={fetchHistory}
            className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-mono uppercase tracking-wide px-4 py-1.5 rounded transition-colors"
          >
            Recargar
          </button>
        </div>
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

                {/* Botones que aparecen al hover */}
                <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {/* Descargar alerta individual */}
                  <button
                    onClick={() => handleDescargarAlerta(ev)}
                    disabled={descargandoId === (ev.id ?? ev.numero_alerta)}
                    title="Descargar esta alerta (imagen + descripción)"
                    className="bg-emerald-700/90 hover:bg-emerald-600 disabled:opacity-50 text-white p-1 rounded transition-colors"
                  >
                    {descargandoId === (ev.id ?? ev.numero_alerta)
                      ? <SpinnerIcon className="w-3 h-3" />
                      : <DownloadIcon className="w-3 h-3" />
                    }
                  </button>

                  {/* Eliminar del historial */}
                  {ev.evento_id && (
                    <button
                      onClick={() => setToDelete(ev)}
                      title="Eliminar del historial (preserva la alerta)"
                      className="bg-red-700/80 hover:bg-red-600 text-white p-1 rounded transition-colors"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
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

/* ─────────────────────── subcomponentes ─────────────────────── */

const FilterField = ({ label, children }) => (
  <div className="flex flex-col gap-1">
    <span className="text-gray-500 text-[10px] font-mono uppercase tracking-wider">
      {label}
    </span>
    {children}
  </div>
);

const DownloadIcon = ({ className = 'w-3 h-3' }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
      d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
  </svg>
);

const SpinnerIcon = ({ className = 'w-3 h-3' }) => (
  <svg className={`${className} animate-spin`} fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor"
      d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
  </svg>
);

export default History;
