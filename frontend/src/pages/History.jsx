import { useState, useEffect } from 'react';
import apiClient from '../services/api';
import AlertCard from '../components/alerts/AlertCard';

const History = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await apiClient.get('/events');
        setEvents(response.data);
      } catch (error) {
        console.error("Error al cargar historial:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, []);

  return (
    <div className="h-screen w-full bg-[#0a0a0a] flex flex-col p-6 overflow-y-auto custom-scrollbar">
      <header className="mb-6 border-b border-gray-800 pb-4">
        <h1 className="text-xl text-gray-100 font-bold uppercase tracking-widest">Historial de Eventos</h1>
        <p className="text-xs text-gray-500 font-mono mt-1">Registro histórico de detecciones del sistema.</p>
      </header>

      {loading ? (
        <div className="text-gray-500 font-mono text-sm">Consultando base de datos...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {events.map((event) => (
            <div key={event.id} className="border border-gray-800 rounded overflow-hidden">
              <AlertCard alert={event} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default History;