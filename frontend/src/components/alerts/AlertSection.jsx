import AlertList from './AlertList';

const AlertSection = ({ alerts = [], onAlertClick, onDelete }) => {
  return (
    <aside className="w-full h-full flex flex-col bg-[#121212] border border-gray-800 flex-shrink-0 z-20 shadow-[-4px_0_15px_rgba(0,0,0,0.3)]">
      <div className="h-10 px-4 bg-[#1a1a1a] border-b border-gray-800 flex items-center justify-between shrink-0">
        <h2 className="text-gray-200 text-xs font-bold uppercase tracking-widest flex items-center gap-2">
          <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse" />
          Registro de Eventos
        </h2>

        <div className="text-[10px] font-mono text-gray-500 bg-black px-1.5 py-0.5 rounded border border-gray-800">
          {alerts.length} EVENTOS
        </div>
      </div>

      <div className="px-3 py-2 bg-[#161616] border-b border-gray-800 flex gap-2 shrink-0">
        <input
          type="text"
          placeholder="Filtrar por camara o tipo..."
          className="w-full bg-black border border-gray-700 text-xs text-gray-300 px-2 py-1 rounded placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors font-mono"
          readOnly
        />
      </div>

      <div className="flex-1 overflow-hidden relative bg-[#0a0a0a]">
        <AlertList alerts={alerts} onAlertClick={onAlertClick} onDelete={onDelete} />
      </div>
    </aside>
  );
};

export default AlertSection;
