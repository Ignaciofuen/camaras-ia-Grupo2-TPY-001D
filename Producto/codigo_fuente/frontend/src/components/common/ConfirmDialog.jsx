/**
 * ConfirmDialog
 *
 * Modal de confirmación reusable. Reemplaza el `confirm()` nativo del
 * browser por algo que respeta el estilo del VMS.
 *
 * Uso:
 *   const [open, setOpen] = useState(false);
 *   ...
 *   <ConfirmDialog
 *     open={open}
 *     title="¿Borrar grabación?"
 *     message="Esta acción es irreversible."
 *     confirmLabel="Borrar"
 *     danger
 *     onConfirm={async () => { await apiDelete(); setOpen(false); }}
 *     onCancel={() => setOpen(false)}
 *   />
 *
 * Props:
 *   open          boolean
 *   title         string
 *   message       string (puede ser ReactNode)
 *   confirmLabel  string (default 'Confirmar')
 *   cancelLabel   string (default 'Cancelar')
 *   danger        boolean -> botón rojo (para acciones destructivas)
 *   onConfirm     async function
 *   onCancel      function
 */
const ConfirmDialog = ({
  open,
  title       = '¿Estás seguro?',
  message     = null,
  confirmLabel = 'Confirmar',
  cancelLabel  = 'Cancelar',
  danger       = false,
  /** ReactNode opcional, se renderiza ENTRE message y los botones. Útil para
   *  meter checkboxes / selects de configuración del borrado. */
  extras       = null,
  onConfirm,
  onCancel,
}) => {
  if (!open) return null;

  const confirmCls = danger
    ? 'bg-red-700 hover:bg-red-600 text-white'
    : 'bg-blue-600 hover:bg-blue-500 text-white';

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
      onClick={onCancel}
    >
      <div
        className="bg-[#1e1e1e] border border-gray-700 rounded-lg shadow-2xl max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-gray-100 font-bold uppercase tracking-widest text-base mb-3 flex items-center gap-2">
          {danger && (
            <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          )}
          {title}
        </h2>

        {message && (
          <div className="text-gray-300 text-sm mb-3">
            {message}
          </div>
        )}

        {extras && (
          <div className="mb-4">{extras}</div>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-1.5 bg-[#2d2d30] hover:bg-[#3a3a3d] text-gray-200 rounded text-xs font-mono uppercase tracking-wide transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-1.5 rounded text-xs font-mono uppercase tracking-wide transition-colors ${confirmCls}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
