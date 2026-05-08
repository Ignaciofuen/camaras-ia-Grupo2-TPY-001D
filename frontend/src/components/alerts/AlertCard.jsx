import PropTypes from 'prop-types';

/**
 * AlertCard
 *
 * Tarjeta visual de una alerta individual.
 * Solo muestra datos, no maneja lógica.
 */
const AlertCard = ({ alert, onClick }) => {
  if (!alert) return null;

  const timeString = new Date(alert.timestamp).toLocaleTimeString('es-ES', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  const confidencePercent = (alert.confidence * 100).toFixed(0);

  // estilos según nivel de riesgo
  const getRiskStyles = (level) => {
    const styles = {
      critical: { border: 'border-red-600', text: 'text-red-500', bgTag: 'bg-red-600/20 text-red-400' },
      high: { border: 'border-orange-500', text: 'text-orange-500', bgTag: 'bg-orange-500/20 text-orange-400' },
      medium: { border: 'border-yellow-500', text: 'text-yellow-500', bgTag: 'bg-yellow-500/20 text-yellow-400' },
      low: { border: 'border-blue-500', text: 'text-blue-500', bgTag: 'bg-blue-500/20 text-blue-400' }
    };
    return styles[level?.toLowerCase()] || styles.high;
  };

  const riskStyles = getRiskStyles(alert.riskLevel);

  return (
    <div 
      onClick={onClick}
      className={`flex flex-col bg-[#1e1e1e] border-l-4 ${riskStyles.border} hover:bg-[#252526] transition-colors p-2.5 cursor-pointer group shadow-sm`}
    >
      {/* cabecera */}
      <div className="flex justify-between items-start mb-1.5">
        <div className="flex items-center gap-2">
          <span className={`font-bold text-xs uppercase tracking-wider ${riskStyles.text} truncate max-w-[120px]`}>
            {alert.label}
          </span>

          <div className="flex items-center gap-1">
            {alert.riskLevel && (
              <span className={`text-[8px] font-mono uppercase px-1 py-0.5 rounded ${riskStyles.bgTag}`}>
                {alert.riskLevel}
              </span>
            )}

            <span className="text-gray-400 text-[9px] font-mono bg-black px-1 py-0.5 rounded border border-gray-700">
              {confidencePercent}%
            </span>
          </div>
        </div>

        <span className="text-gray-500 text-[10px] font-mono group-hover:text-gray-300 transition-colors shrink-0">
          {timeString}
        </span>
      </div>
      
      {/* footer */}
      <div className="flex justify-between items-end mt-0.5">
        <div className="flex items-center gap-1 text-gray-400 text-[10px] font-mono uppercase tracking-wide">
          <svg className="w-3 h-3 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <span className="truncate max-w-[150px]">CAM: {alert.cameraId}</span>
        </div>
        
        {/* acción secundaria */}
        <button 
          className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-white transition-all p-1 bg-black/50 hover:bg-black rounded border border-transparent hover:border-gray-600"
          title="Ver snapshot"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
        </button>
      </div>
    </div>
  );
};

AlertCard.propTypes = {
  alert: PropTypes.object.isRequired,
  onClick: PropTypes.func,
};

export default AlertCard;