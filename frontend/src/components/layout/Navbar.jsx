import { useWebSocket } from '../../hooks/useWebSocket';

const WS_STATUS_MAP = {
  connected: { label: 'En línea', cls: 'connected' },
  disconnected: { label: 'Desconectado', cls: 'disconnected' },
};

export default function Navbar({ pageTitle }) {
  const { status } = useWebSocket();
  const { label, cls } = WS_STATUS_MAP[status] ?? { label: status, cls: 'unknown' };

  return (
    <header className="navbar">
      <div className="navbar-left">
        <h1 className="navbar-page-title">{pageTitle}</h1>
      </div>

      <div className="navbar-right">
        <div className={`ws-indicator ws-${cls}`}>
          <span className="ws-dot" />
          <span className="ws-label">{label}</span>
        </div>

        <div className="navbar-clock">
          <Clock />
        </div>
      </div>
    </header>
  );
}

function Clock() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <span className="clock-display">
      {time.toLocaleTimeString('es-CL', { hour12: false })}
    </span>
  );
}

import { useState, useEffect } from 'react';