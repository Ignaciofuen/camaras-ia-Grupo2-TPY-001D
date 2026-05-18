import { useState, useEffect } from 'react';

/**
 * Toast — notificación flotante reutilizable.
 *
 * Escucha el evento global `app:toast` y muestra el mensaje durante ~4s
 * arriba a la derecha. Cualquier parte del código puede dispararlo:
 *
 *   window.dispatchEvent(new CustomEvent('app:toast', {
 *     detail: { type: 'error', message: 'Texto…', duration: 4000 }
 *   }));
 *
 * Tipos soportados: 'error' (rojo), 'warn' (amarillo), 'success' (verde),
 * 'info' (azul, default).
 *
 * El interceptor de axios en services/api.js dispara automáticamente este
 * toast cuando recibe 403 (permisos insuficientes).
 */
const TYPE_STYLES = {
  error:   { border: 'border-red-700/70',    bg: 'bg-red-950/95',    text: 'text-red-200',    icon: '⚠' },
  warn:    { border: 'border-yellow-700/70', bg: 'bg-yellow-950/95', text: 'text-yellow-200', icon: '⚠' },
  success: { border: 'border-green-700/70',  bg: 'bg-green-950/95',  text: 'text-green-200',  icon: '✓' },
  info:    { border: 'border-blue-700/70',   bg: 'bg-blue-950/95',   text: 'text-blue-200',   icon: 'ℹ' },
};

const Toast = () => {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    let counter = 0;
    const handler = (event) => {
      const detail = event.detail || {};
      const id     = `t-${Date.now()}-${counter++}`;
      const item   = {
        id,
        type:     detail.type    || 'info',
        message:  detail.message || '',
        duration: detail.duration ?? 4000,
      };
      setToasts((prev) => [...prev, item]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, item.duration);
    };
    window.addEventListener('app:toast', handler);
    return () => window.removeEventListener('app:toast', handler);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-6 right-6 z-[100] flex flex-col gap-2 max-w-md">
      {toasts.map((t) => {
        const s = TYPE_STYLES[t.type] || TYPE_STYLES.info;
        return (
          <div
            key={t.id}
            className={`flex items-start gap-3 ${s.bg} border ${s.border} ${s.text} rounded-lg px-4 py-3 shadow-2xl font-mono text-sm backdrop-blur-sm animate-[slideIn_.2s_ease-out]`}
          >
            <span className="text-base leading-tight">{s.icon}</span>
            <span className="flex-1 leading-snug">{t.message}</span>
            <button
              onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
              className="text-current opacity-50 hover:opacity-100 transition-opacity text-xs"
              title="Cerrar"
            >
              ✕
            </button>
          </div>
        );
      })}
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(20px); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </div>
  );
};

/** Helper para disparar toast desde cualquier componente. */
export const showToast = (message, type = 'info', duration = 4000) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('app:toast', {
    detail: { type, message, duration },
  }));
};

export default Toast;
