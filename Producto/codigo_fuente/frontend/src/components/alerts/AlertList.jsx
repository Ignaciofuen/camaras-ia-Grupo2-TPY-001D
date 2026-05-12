import AlertCard from './AlertCard';

/**
 * AlertList
 * Renderiza una lista virtualizable de alertas.
 *
 * Recibe `alerts` por props desde AlertSection. NO usa el store global
 * (esa decisión la toma el componente padre — Dashboard / Alerts).
 *
 * @param {Object} props
 * @param {Array}  props.alerts
 */
const AlertList = ({ alerts = [], onDelete }) => {
  if (!alerts || alerts.length === 0) {
    return (
      <div className="flex flex-col w-full h-full items-center justify-center bg-[#0a0a0a] p-4 text-center">
        <svg className="w-8 h-8 text-gray-700 opacity-50 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        <span className="text-gray-600 font-mono text-[10px] tracking-widest uppercase">
          Registro de eventos vacio
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto custom-scrollbar p-1 space-y-1">
      {alerts.map((alert, idx) => (
        <AlertCard
          key={alert.id ?? alert.alerta_num ?? idx}
          alert={alert}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
};

export default AlertList;
