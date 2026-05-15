import PropTypes from 'prop-types';

const getAlertId = (alert) => (
  alert.id || alert.uuid || alert.alerta_id || alert.alerta_num || alert.numero_alerta
);

const getTimestamp = (alert) => (
  alert.timestamp ||
  alert.createdAt ||
  alert.creada_en ||
  alert.capturado_en ||
  alert.fecha ||
  alert.ts
);

const getRiskLevel = (alert) => (
  alert.riskLevel ||
  alert.nivel ||
  alert.severidad ||
  'alta'
);

const getLabel = (alert) => (
  alert.label ||
  alert.tipo ||
  alert.titulo ||
  alert.llava_descripcion ||
  alert.descripcion ||
  'Alerta'
);

const getCameraName = (alert) => (
  alert.cameraName ||
  alert.cameraId ||
  alert.camara_nombre ||
  alert.camara ||
  alert.camara_id ||
  'Sin camara'
);

const getConfidence = (alert) => {
  const value = alert.confidence ?? alert.confianza ?? alert.score ?? null;
  if (value == null) return null;
  return value <= 1 ? Math.round(value * 100) : Math.round(value);
};

const getRiskStyles = (level) => {
  const normalized = String(level || '').toLowerCase();
  const styles = {
    critica: { border: 'border-red-600', text: 'text-red-500', bgTag: 'bg-red-600/20 text-red-400' },
    critical: { border: 'border-red-600', text: 'text-red-500', bgTag: 'bg-red-600/20 text-red-400' },
    alta: { border: 'border-orange-500', text: 'text-orange-500', bgTag: 'bg-orange-500/20 text-orange-400' },
    high: { border: 'border-orange-500', text: 'text-orange-500', bgTag: 'bg-orange-500/20 text-orange-400' },
    media: { border: 'border-yellow-500', text: 'text-yellow-500', bgTag: 'bg-yellow-500/20 text-yellow-400' },
    medium: { border: 'border-yellow-500', text: 'text-yellow-500', bgTag: 'bg-yellow-500/20 text-yellow-400' },
    baja: { border: 'border-blue-500', text: 'text-blue-500', bgTag: 'bg-blue-500/20 text-blue-400' },
    low: { border: 'border-blue-500', text: 'text-blue-500', bgTag: 'bg-blue-500/20 text-blue-400' },
  };

  return styles[normalized] || styles.alta;
};

const formatTime = (timestamp) => {
  if (!timestamp) return '--:--:--';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '--:--:--';

  return date.toLocaleTimeString('es-ES', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

const AlertCard = ({ alert, onClick, onDelete }) => {
  if (!alert) return null;

  const alertId = getAlertId(alert);
  const riskLevel = getRiskLevel(alert);
  const riskStyles = getRiskStyles(riskLevel);
  const confidence = getConfidence(alert);

  return (
    <div
      onClick={onClick}
      className={`flex flex-col bg-[#1e1e1e] border-l-4 ${riskStyles.border} hover:bg-[#252526] transition-colors p-2.5 cursor-pointer group shadow-sm`}
    >
      <div className="flex justify-between items-start mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`font-bold text-xs uppercase tracking-wider ${riskStyles.text} truncate max-w-[180px]`}>
            {getLabel(alert)}
          </span>

          <div className="flex items-center gap-1">
            <span className={`text-[8px] font-mono uppercase px-1 py-0.5 rounded ${riskStyles.bgTag}`}>
              {riskLevel}
            </span>

            {confidence != null && (
              <span className="text-gray-400 text-[9px] font-mono bg-black px-1 py-0.5 rounded border border-gray-700">
                {confidence}%
              </span>
            )}
          </div>
        </div>

        <span className="text-gray-500 text-[10px] font-mono group-hover:text-gray-300 transition-colors shrink-0">
          {formatTime(getTimestamp(alert))}
        </span>
      </div>

      <div className="flex justify-between items-end mt-0.5">
        <div className="flex items-center gap-1 text-gray-400 text-[10px] font-mono uppercase tracking-wide min-w-0">
          <svg className="w-3 h-3 opacity-70 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <span className="truncate max-w-[180px]">CAM: {getCameraName(alert)}</span>
        </div>

        {onDelete && alertId && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onDelete(alertId);
            }}
            className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-300 transition-all p-1 bg-black/50 hover:bg-red-950/60 rounded border border-transparent hover:border-red-700"
            title="Borrar alerta"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};

AlertCard.propTypes = {
  alert: PropTypes.object.isRequired,
  onClick: PropTypes.func,
  onDelete: PropTypes.func,
};

export default AlertCard;
