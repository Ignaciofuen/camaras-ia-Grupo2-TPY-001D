import { useState } from 'react';

/**
 * ClearAlertsModal
 *
 * Modal de confirmacion para borrar todas las alertas de UNA fecha
 * especifica. Pide confirmacion explicita antes de mandar el DELETE.
 *
 * Props:
 *   - open:    boolean, si el modal esta visible
 *   - onClose: callback cuando el user cancela / cierra
 *   - onConfirm: callback(fechaYYYYMMDD) cuando el user confirma
 */
const ClearAlertsModal = ({ open, onClose, onConfirm }) => {
  const today = new Date().toISOString().slice(0, 10);
  const [fecha, setFecha] = useState(today);
  const [confirmed, setConfirmed] = useState(false);

  if (!open) return null;

  const handleConfirm = () => {
    if (!confirmed) {
      setConfirmed(true);
      return;
    }
    onConfirm(fecha);
    setConfirmed(false);
    onClose();
  };

  const handleCancel = () => {
    setConfirmed(false);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={handleCancel}
    >
      <div
        className="bg-[#1e1e1e] border border-red-700/40 rounded-lg shadow-2xl w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-gray-100 font-bold uppercase tracking-widest text-base mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          Limpiar alertas
        </h2>

        <p className="text-gray-300 text-sm mb-4">
          Esto va a borrar <strong className="text-red-400">todas las alertas</strong> del día seleccionado.
          La acción es <strong>irreversible</strong>.
        </p>

        <label className="block text-gray-400 text-xs font-mono uppercase tracking-wider mb-2">
          Fecha a borrar
        </label>
        <input
          type="date"
          value={fecha}
          max={today}
          onChange={(e) => { setFecha(e.target.value); setConfirmed(false); }}
          className="w-full bg-black border border-gray-700 text-gray-200 px-3 py-2 rounded font-mono text-sm focus:outline-none focus:border-red-500"
        />

        {confirmed && (
          <div className="mt-4 p-3 bg-red-900/30 border border-red-700/50 rounded text-red-200 text-sm">
            ¿Seguro? Click otra vez en "Borrar" para confirmar.
          </div>
        )}

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={handleCancel}
            className="px-4 py-1.5 bg-[#2d2d30] hover:bg-[#3a3a3d] text-gray-200 rounded text-xs font-mono uppercase tracking-wide transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            className={`px-4 py-1.5 rounded text-xs font-mono uppercase tracking-wide transition-colors ${
              confirmed
                ? 'bg-red-700 hover:bg-red-600 text-white'
                : 'bg-red-900/60 hover:bg-red-800/80 text-red-200'
            }`}
          >
            {confirmed ? 'Confirmar borrado' : 'Borrar'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ClearAlertsModal;
