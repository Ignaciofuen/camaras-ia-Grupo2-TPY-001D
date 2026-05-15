import { useState, useEffect } from 'react';
import apiClient from '../services/api';

/**
 * Settings
 * Configuración del sistema. La sección principal hoy es "Credenciales RTSP":
 * permite editar el usuario y la pass que el detector + MediaMTX usan para
 * conectarse a cada cámara. Antes vivian en .env, ahora en la DB (migration 008).
 */
const Settings = () => {
  const [cameras, setCameras]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [savingId, setSavingId]     = useState(null);
  const [reloading, setReloading]   = useState(false);
  const [reloadDone, setReloadDone] = useState(false);
  const [reloadMsg, setReloadMsg]   = useState('');

  // Editables locales por camara_id: { usuario_rtsp, password_rtsp, dirty }
  const [edits, setEdits] = useState({});

  const fetchCameras = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await apiClient.get('/camaras');
      setCameras(data || []);
      // Inicializar el estado de edición con los valores actuales
      const init = {};
      (data || []).forEach((c) => {
        init[c.id] = {
          usuario_rtsp:  c.usuario_rtsp  || '',
          password_rtsp: '',  // las passes no las exponemos en GET; queda vacío hasta que el user escriba
          dirty: false,
        };
      });
      setEdits(init);
    } catch (err) {
      setError(String(err?.message || err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCameras(); }, []);

  const updateField = (camId, field, value) => {
    setEdits((prev) => ({
      ...prev,
      [camId]: { ...prev[camId], [field]: value, dirty: true },
    }));
  };

  const saveCredentials = async (camId) => {
    const e = edits[camId];
    if (!e) return;
    setSavingId(camId);
    try {
      const body = {};
      if (e.usuario_rtsp)  body.usuario_rtsp  = e.usuario_rtsp;
      if (e.password_rtsp) body.password_rtsp = e.password_rtsp;
      if (Object.keys(body).length === 0) {
        alert('Nada que guardar.');
        return;
      }
      await apiClient.patch(`/camaras/${camId}/credenciales`, body);
      setEdits((prev) => ({
        ...prev,
        [camId]: { ...prev[camId], password_rtsp: '', dirty: false },
      }));
      // No mostramos alert: el botón "Reiniciar cámaras" se habilita y guía
      // al usuario a aplicar el cambio efectivamente.
      setReloadDone(false);
    } catch (err) {
      console.error('[Settings] save error:', err);
      alert(`Error: ${err?.response?.data?.detail || err.message}`);
    } finally {
      setSavingId(null);
    }
  };

  /** Pide al backend que recargue MediaMTX con las credenciales nuevas. */
  const reloadCamaras = async () => {
    setReloading(true);
    setReloadMsg('Aplicando credenciales nuevas en MediaMTX…');
    try {
      const { data } = await apiClient.post('/sistema/reload-camaras');
      if (data?.ok) {
        setReloadMsg(`Listo. ${data.reloaded.length} cámara(s) recargadas.`);
      } else {
        const detail = (data?.errors || []).map((e) => `${e.camara}: ${e.error}`).join(' · ');
        setReloadMsg(`Algunos errores: ${detail || 'ver consola'}`);
      }
      setReloadDone(true);
      // Esperar 1.5s para que el user vea el mensaje, después refrescar
      setTimeout(() => {
        setReloading(false);
        window.location.reload();
      }, 1500);
    } catch (err) {
      console.error('[Settings] reload error:', err);
      setReloadMsg(`Error: ${err?.response?.data?.detail || err.message}. ¿MediaMTX está corriendo con API habilitada (puerto 9997)?`);
      // No cerrar overlay: dejar que el user lea
      setTimeout(() => setReloading(false), 3500);
    }
  };

  return (
    <div className="h-screen w-full bg-[#0a0a0a] flex flex-col overflow-hidden">

      <header className="px-6 py-4 border-b border-gray-800 shrink-0 flex items-center justify-between">
        <h1 className="text-xl text-gray-100 font-bold uppercase tracking-widest">
          Configuración del Sistema
        </h1>
        <button
          onClick={reloadCamaras}
          disabled={reloading}
          className={`px-4 py-2 rounded text-xs font-mono uppercase tracking-wide transition-colors ${
            reloading
              ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
              : 'bg-emerald-600 hover:bg-emerald-500 text-white'
          }`}
          title="Aplica las credenciales nuevas a MediaMTX sin reiniciar procesos"
        >
          {reloading ? 'Reiniciando…' : 'Reiniciar cámaras'}
        </button>
      </header>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">

        <section>
          <h2 className="text-sm text-gray-400 font-mono uppercase tracking-widest mb-3">
            Credenciales RTSP
          </h2>

          {loading && <div className="text-gray-500 font-mono text-sm">Cargando…</div>}
          {error && <div className="text-red-500 font-mono text-sm">Error: {error}</div>}

          {!loading && !error && cameras.map((c) => {
            const e   = edits[c.id] || { usuario_rtsp: '', password_rtsp: '', dirty: false };
            const saving = savingId === c.id;
            return (
              <div key={c.id} className="bg-[#161616] border border-gray-800 rounded p-4 mb-3 max-w-3xl">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-gray-100 font-bold uppercase tracking-wider">{c.nombre}</div>
                    <div className="text-gray-500 text-[10px] font-mono">
                      MAC: {c.direccion_mac} · IP: {c.ip_actual || c.ip_respaldo}
                    </div>
                  </div>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded uppercase tracking-wider ${
                    c.estado_salud === 'online'
                      ? 'bg-green-600/20 text-green-400'
                      : 'bg-gray-600/20 text-gray-400'
                  }`}>
                    {c.estado_salud || '—'}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Field label="Usuario RTSP">
                    <input
                      type="text"
                      value={e.usuario_rtsp}
                      onChange={(ev) => updateField(c.id, 'usuario_rtsp', ev.target.value)}
                      placeholder="ej. admin, rtsp"
                      className="input-dark w-full"
                    />
                  </Field>

                  <Field label="Contraseña RTSP">
                    <input
                      type="password"
                      value={e.password_rtsp}
                      onChange={(ev) => updateField(c.id, 'password_rtsp', ev.target.value)}
                      placeholder="(dejar vacío para no cambiar)"
                      className="input-dark w-full"
                      autoComplete="new-password"
                    />
                  </Field>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={() => saveCredentials(c.id)}
                    disabled={!e.dirty || saving}
                    className={`px-4 py-1.5 rounded text-xs font-mono uppercase tracking-wide transition-colors ${
                      e.dirty && !saving
                        ? 'bg-blue-600 hover:bg-blue-500 text-white'
                        : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    {saving ? 'Guardando…' : 'Guardar credenciales'}
                  </button>
                  {e.dirty && (
                    <span className="text-yellow-400 text-[10px] font-mono uppercase">
                      cambios sin guardar
                    </span>
                  )}
                </div>
              </div>
            );
          })}

        </section>

      </div>

      {/* Overlay de loading mientras se recarga MediaMTX */}
      {reloading && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/85 backdrop-blur-sm">
          <div className="bg-[#1e1e1e] border border-gray-700 rounded-lg shadow-2xl px-8 py-10 max-w-md w-full text-center">
            {!reloadDone ? (
              <>
                <div className="w-10 h-10 mx-auto mb-4 border-2 border-gray-600 border-t-emerald-400 rounded-full animate-spin" />
                <div className="text-emerald-300 font-mono text-sm uppercase tracking-wider">
                  Reiniciando cámaras
                </div>
              </>
            ) : (
              <>
                <svg className="w-10 h-10 mx-auto mb-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                </svg>
                <div className="text-emerald-300 font-mono text-sm uppercase tracking-wider mb-1">
                  Listo
                </div>
              </>
            )}
            <div className="text-gray-300 text-xs font-mono mt-3 normal-case">
              {reloadMsg}
            </div>
            {reloadDone && (
              <div className="text-gray-500 text-[10px] font-mono mt-3 normal-case">
                Recargando la página…
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        .input-dark { background:#000;border:1px solid #374151;color:#e5e7eb;padding:.4rem .6rem;border-radius:.25rem;font-family:monospace;font-size:.8rem; }
        .input-dark:focus { outline:none;border-color:#3b82f6; }
      `}</style>
    </div>
  );
};

const Field = ({ label, children }) => (
  <div className="flex flex-col gap-1">
    <span className="text-gray-500 text-[10px] font-mono uppercase tracking-wider">{label}</span>
    {children}
  </div>
);

export default Settings;
