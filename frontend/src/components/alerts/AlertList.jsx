import PropTypes from 'prop-types';
import AlertCard from './AlertCard';

const getAlertKey = (alert) => (
  alert.id || alert.uuid || alert.alerta_id || alert.alerta_num || alert.numero_alerta
);

const AlertList = ({ alerts = [], onAlertClick, onDelete }) => {
  if (!alerts || alerts.length === 0) {
    return (
      <div className="flex flex-col w-full h-full items-center justify-center bg-[#0a0a0a] p-4 text-center">
        <svg className="w-8 h-8 text-gray-700 opacity-50 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        <span className="text-gray-600 font-mono text-[10px] tracking-widest uppercase">
          REGISTRO VACIO
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto custom-scrollbar p-1 space-y-1">
      {alerts.map((alert) => (
        <AlertCard
          key={getAlertKey(alert)}
          alert={alert}
          onClick={() => onAlertClick?.(alert)}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
};

AlertList.propTypes = {
  alerts: PropTypes.array,
  onAlertClick: PropTypes.func,
  onDelete: PropTypes.func,
};

export default AlertList;
