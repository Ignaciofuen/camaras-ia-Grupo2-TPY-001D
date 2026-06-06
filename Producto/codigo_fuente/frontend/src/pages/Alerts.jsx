import { useState, useEffect, useCallback } from 'react';
import { useSSE } from '../hooks/useSSE';
import { alertService } from '../services/alertService';
import AlertSection from '../components/alerts/AlertSection';
import AlertHeader from '../components/alerts/AlertHeader';
import ClearAlertsModal from '../components/alerts/ClearAlertsModal';

/**
 * Alerts
 * - Al montar, trae el historico (REST /alertas)
 * - Se mantiene actualizado con SSE (/alertas/stream)
 * - Soporta borrar alertas individuales (X) y borrar todas por fecha (modal)
 */
const Alerts = () => {
  const [alerts, setAlerts] = useState([]);
  const [clearModalOpen, setClearModalOpen] = useState(false);

  // Carga inicial del historico
  useEffect(() => {
    alertService.getAlertas({ limite: 100 })
      .then((items) => setAlerts(items))
      .catch((err) => console.error('[Alerts] error historico:', err));
  }, []);

  // Dedup por alerta_num: el backend manda 2 publicaciones por alerta:
  //   1) tipo="yolo"     → provisional ("Persona detectada (analizando...)")
  //   2) tipo="analisis" → enriquecida (descripcion de LLaVA)
  const handleNewAlert = useCallback((alerta) => {
    setAlerts((prev) => {
      const num = alerta?.alerta_num;
      if (num != null) {
        const idx = prev.findIndex((a) => a?.alerta_num === num);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = alerta;
          return next;
        }
      }
      return [alerta, ...prev].slice(0, 200);
    });
  }, []);

  const sseUrl = import.meta.env.VITE_SSE_URL || '/alertas/stream';
  useSSE(sseUrl, handleNewAlert);

  // Borrar individual: optimistic update + rollback si falla
  const handleDelete = useCallback(async (alertId) => {
    const before = alerts;
    setAlerts((prev) => prev.filter((a) => a.id !== alertId));
    try {
      await alertService.deleteAlerta(alertId);
    } catch (err) {
      console.error('[Alerts] error al borrar:', err);
      setAlerts(before);  // rollback
      alert('No se pudo borrar la alerta. Reintentá.');
    }
  }, [alerts]);

  // Borrar todas las de una fecha
  const handleClearByDate = useCallback(async (fechaYYYYMMDD) => {
    try {
      await alertService.deleteAlertasByDate(fechaYYYYMMDD);
      // Refrescar historico
      const fresh = await alertService.getAlertas({ limite: 100 });
      setAlerts(fresh);
    } catch (err) {
      console.error('[Alerts] error al limpiar por fecha:', err);
      alert('Error al limpiar las alertas. Revisá la consola.');
    }
  }, []);

  return (
    <div className="flex flex-col h-full w-full bg-[#0a0a0a]">
      <AlertHeader
        activeCount={alerts.length}
        onClearByDate={() => setClearModalOpen(true)}
      />

      <main className="flex-1 overflow-hidden flex justify-center p-2 sm:p-4">
        <div className="w-full max-w-4xl h-full shadow-2xl border border-gray-800 rounded-lg overflow-hidden">
          <AlertSection alerts={alerts} onDelete={handleDelete} />
        </div>
      </main>

      <ClearAlertsModal
        open={clearModalOpen}
        onClose={() => setClearModalOpen(false)}
        onConfirm={handleClearByDate}
      />
    </div>
  );
};

export default Alerts;
