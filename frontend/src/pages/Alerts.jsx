import { useState, useCallback } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import AlertSection from '../components/alerts/AlertSection';
import AlertHeader from '../components/alerts/AlertHeader';

const Alerts = () => {
  const [alerts, setAlerts] = useState([]);

  const handleNewAlert = useCallback((newAlert) => {
    setAlerts((prev) => [newAlert, ...prev].slice(0, 200));
  }, []);

  const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws/alerts';
  useWebSocket(wsUrl, handleNewAlert);

  return (
    <div className="flex flex-col h-screen w-full bg-[#0a0a0a]">
      <AlertHeader activeCount={alerts.length} />
      
      {/* Reutilizamos AlertSection pero forzamos que ocupe todo el ancho en esta vista */}
      <main className="flex-1 overflow-hidden flex justify-center p-4">
        <div className="w-full max-w-4xl h-full shadow-2xl border border-gray-800 rounded-lg overflow-hidden">
          <AlertSection alerts={alerts} />
        </div>
      </main>
    </div>
  );
};

export default Alerts;