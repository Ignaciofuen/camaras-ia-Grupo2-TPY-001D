import { useAlerts } from '../hooks/useAlerts';
import AlertSection from '../components/alerts/AlertSection';
import AlertHeader from '../components/alerts/AlertHeader';

/**
 * Alerts
 *
 * Página de registro de eventos.
 * Consume el estado global de alertas (Zustand).
 */
const Alerts = () => {
  const alerts = useAlerts((state) => state.alerts);
  const selectAlert = useAlerts((state) => state.selectAlert);

  return (
    // usa h-full para integrarse con el layout
    <div className="flex flex-col h-full w-full bg-[#0a0a0a]">
      
      <AlertHeader activeCount={alerts.length} />
      
      {/* contenedor principal */}
      <main className="flex-1 overflow-hidden flex justify-center p-4">
        <div className="w-full max-w-4xl h-full shadow-2xl border border-gray-800 rounded-lg overflow-hidden bg-[#1e1e1e]">
          <AlertSection 
            alerts={alerts} 
            onAlertClick={selectAlert} 
          />
        </div>
      </main>
    </div>
  );
};

export default Alerts;