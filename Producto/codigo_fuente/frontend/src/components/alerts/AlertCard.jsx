import { useState } from 'react';

/**
 * AlertCard
 * Tarjeta de una alerta individual.
 *
 * Comportamiento:
 *   - Click sobre la tarjeta -> expande mostrando detalle completo (descripcion,
 *     acciones, snapshot, etc).
 *   - X arriba a la derecha -> elimina la alerta (callback onDelete).
 *
 * Acepta dos schemas:
 *   - Backend SSE (espanol):  camara, nivel, descripcion, ts, personas, zona, alerta_num, sospechoso
 *   - Backend REST historico: titulo, camara_nombre, llava_nivel, llava_descripcion,
 *                             llava_acciones, llava_sospechoso, disparada_en, id, numero_alerta,
 *                             cantidad_personas, etc.
 *   - Mock antiguo (ingles):  label, cameraId, timestamp, confidence, riskLevel
 *
 * @param {Object} props.alert
 * @param {Function} props.onDelete  callback(alertId) cuando se hace click en X
 */
const AlertCard = ({ alert, onDelete }) => {
  const [expanded, setExpanded] = useState(false);

  if (!alert) return null;

  // ---- Mapeo schema flexible ----
  const camara      = alert.camara      ?? alert.camara_nombre ?? alert.cameraId   ?? '—';
  const nivel       = alert.nivel       ?? alert.llava_nivel    ?? alert.riskLevel ?? 'medio';
  const descripcion = alert.descripcion ?? alert.llava_descripcion ?? alert.label  ?? alert.titulo ?? 'Detección';
  const acciones    = alert.acciones    ?? alert.llava_acciones ?? null;
  const personas    = alert.personas    ?? alert.llava_personas ?? alert.cantidad_personas;
  const zona        = alert.zona        ?? alert.contexto_zona;
  const sospechoso  = alert.sospechoso  ?? alert.llava_sospechoso;
  const mensaje     = alert.mensaje;
  const alertaNum   = alert.alerta_num  ?? alert.numero_alerta;
  const alertId     = alert.id          ?? null;
  const snapshotKey = alert.snapshot_key;

  // Timestamp
  const tsSeconds = typeof alert.ts === 'number' ? alert.ts : null;
  const tsIso     = alert.timestamp || alert.disparada_en || alert.capturado_en;
  const dateObj   = tsSeconds ? new Date(tsSeconds * 1000)
                  : tsIso     ? new Date(tsIso)
                  : null;
  const timeString = dateObj && !isNaN(dateObj.getTime())
    ? dateObj.toLocaleTimeString('es-AR', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '--:--:--';
  const dateString = dateObj && !isNaN(dateObj.getTime())
    ? dateObj.toLocaleDateString('es-AR')
    : '';

  // Estilos por nivel
  const getStyles = (lvl) => {
    const map = {
      alto:     { border: 'border-red-600',    text: 'text-red-500',    tag: 'bg-red-600/20 text-red-400'    },
      critical: { border: 'border-red-600',    text: 'text-red-500',    tag: 'bg-red-600/20 text-red-400'    },
      high:     { border: 'border-orange-500', text: 'text-orange-500', tag: 'bg-orange-500/20 text-orange-400' },
      medio:    { border: 'border-yellow-500', text: 'text-yellow-500', tag: 'bg-yellow-500/20 text-yellow-400' },
      medium:   { border: 'border-yellow-500', text: 'text-yellow-500', tag: 'bg-yellow-500/20 text-yellow-400' },
      bajo:     { border: 'border-blue-500',   text: 'text-blue-500',   tag: 'bg-blue-500/20 text-blue-400'   },
      low:      { border: 'border-blue-500',   text: 'text-blue-500',   tag: 'bg-blue-500/20 text-blue-400'   },
    };
    return map[String(lvl || '').toLowerCase()] || map.medio;
  };
  const s = getStyles(nivel);

  // Click handler: toggle expansion (pero no propagar al delete)
  const handleCardClick = () => setExpanded((v) => !v);

  const handleDeleteClick = (e) => {
    e.stopPropagation();  // no expandir si el user clickea la X
    if (!alertId) {
      console.warn('[AlertCard] no se puede borrar sin id (alerta solo en SSE)');
      return;
    }
    if (onDelete) onDelete(alertId);
  };

  return (
    <div
      onClick={handleCardClick}
      className={`flex flex-col bg-[#1e1e1e] border-l-4 ${s.border} hover:bg-[#252526] transition-colors p-2.5 cursor-pointer group shadow-sm`}
    >
      {/* Cabecera */}
      <div className="flex justify-between items-start mb-1.5">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className={`font-bold text-xs uppercase tracking-wider ${s.text} truncate`}>
            {descripcion}
          </span>
          <span className={`text-[8px] font-mono uppercase px-1 py-0.5 rounded shrink-0 ${s.tag}`}>
            {String(nivel)}
          </span>
          {sospechoso && (
            <span className="text-[8px] font-mono uppercase px-1 py-0.5 rounded bg-red-600/30 text-red-300 shrink-0">
              sosp
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0 ml-2">
          <span className="text-gray-500 text-[10px] font-mono group-hover:text-gray-300 transition-colors">
            {timeString}
          </span>
          {/* X eliminar */}
          {alertId && (
            <button
              onClick={handleDeleteClick}
              className="text-gray-600 hover:text-red-500 transition-colors p-0.5"
              title="Eliminar alerta"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Footer compacto (siempre visible) */}
      <div className="flex justify-between items-end mt-0.5 text-gray-400 text-[10px] font-mono uppercase tracking-wide">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <svg className="w-3 h-3 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <span className="truncate max-w-[110px]">{camara}</span>
          </div>
          {zona && <span className="opacity-70">· {zona}</span>}
          {personas !== undefined && personas !== null && <span className="opacity-70">· {personas}p</span>}
          {alertaNum && <span className="opacity-50">#{alertaNum}</span>}
        </div>
      </div>

      {/* Panel expandido: detalle completo */}
      {expanded && (
        <div className="mt-2 pt-2 border-t border-gray-700 space-y-1.5 text-[11px] font-mono text-gray-300">
          {dateString && (
            <div>
              <span className="text-gray-500">Fecha:</span> {dateString} {timeString}
            </div>
          )}
          {mensaje && (
            <div>
              <span className="text-gray-500">Mensaje:</span> {mensaje}
            </div>
          )}
          {acciones && (
            <div>
              <span className="text-gray-500">Acciones:</span> {acciones}
            </div>
          )}
          {descripcion && descripcion !== 'Detección' && (
            <div>
              <span className="text-gray-500">Descripción:</span>
              <p className="mt-1 text-gray-200 leading-relaxed normal-case">{descripcion}</p>
            </div>
          )}
          {alertId && (
            <div>
              <span className="text-gray-500">Snapshot:</span>
              <img
                src={`/alertas/${alertId}/snapshot`}
                alt="Snapshot del evento"
                className="mt-1 max-h-48 border border-gray-700 cursor-zoom-in"
                onError={(e) => { e.target.style.display = 'none'; }}
                onClick={(e) => {
                  // Click en la imagen -> abre el JPG en una pestaña aparte
                  // para verlo en tamaño completo.
                  e.stopPropagation();
                  window.open(e.target.src, '_blank');
                }}
              />
            </div>
          )}
          {alertId && (
            <div className="text-[9px] text-gray-600">ID: {alertId}</div>
          )}
        </div>
      )}
    </div>
  );
};

export default AlertCard;
