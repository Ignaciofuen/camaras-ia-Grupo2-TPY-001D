import { useCallback, useEffect, useState } from 'react';
import AlertHeader from '../components/alerts/AlertHeader';
import AlertSection from '../components/alerts/AlertSection';
import ClearAlertsModal from '../components/alerts/ClearAlertsModal';
import { alertService } from '../services/alertService';
import { useSSE } from '../hooks/useSSE';

const Alerts = () => {
  const [alerts, setAlerts] = useState([]);
  const [clearModalOpen, setClearModalOpen] = useState(false);

  useEffect(() => {
    let mounted = true;

    alertService.getAlertas({ limite: 100 })
      .then((items) => {
        if (mounted) setAlerts(items);
      })
      .catch((error) => console.error('[Alerts] error historico:', error));

    return () => {
      mounted = false;
    };
  }, []);

  const handleNewAlert = useCallback((alerta) => {
    setAlerts((current) => {
      const alertNumber = alerta?.alerta_num || alerta?.numero_alerta || alerta?.id;

      if (alertNumber != null) {
        const index = current.findIndex((item) => (
          item?.alerta_num === alertNumber ||
          item?.numero_alerta === alertNumber ||
          item?.id === alertNumber
        ));

        if (index >= 0) {
          const next = [...current];
          next[index] = alerta;
          return next;
        }
      }

      return [alerta, ...current].slice(0, 200);
    });
  }, []);

  const sseUrl = import.meta.env.VITE_SSE_URL || '/alertas/stream';
  useSSE(sseUrl, handleNewAlert);

  const handleDelete = useCallback(async (alertId) => {
    const before = alerts;
    setAlerts((current) => current.filter((alert) => alert.id !== alertId));

    try {
      await alertService.deleteAlerta(alertId);
    } catch (error) {
      console.error('[Alerts] error al borrar:', error);
      setAlerts(before);
      window.alert('No se pudo borrar la alerta.');
    }
  }, [alerts]);

  const handleClearByDate = useCallback(async (fechaYYYYMMDD) => {
    try {
      await alertService.deleteAlertasByDate(fechaYYYYMMDD);
      const fresh = await alertService.getAlertas({ limite: 100 });
      setAlerts(fresh);
    } catch (error) {
      console.error('[Alerts] error al limpiar por fecha:', error);
      window.alert('Error al limpiar las alertas.');
    }
  }, []);

  return (
    <div className="flex flex-col h-full w-full bg-[#0a0a0a]">
      <AlertHeader
        activeCount={alerts.length}
        onClearByDate={() => setClearModalOpen(true)}
      />

      <main className="flex-1 overflow-hidden flex justify-center p-4">
        <div className="w-full max-w-4xl h-full shadow-2xl rounded-lg overflow-hidden bg-[#1e1e1e]">
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
