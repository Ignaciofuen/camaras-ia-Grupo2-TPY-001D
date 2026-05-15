import { useCallback, useEffect, useState } from 'react';
import { systemService } from '../services/systemService';

export const useSystemStatus = () => {
  const [status, setStatus] = useState('connecting');
  const [latency, setLatency] = useState('--ms');
  const [version, setVersion] = useState('v1.0.4');

  const checkSystemHealth = useCallback(async () => {
    const startedAt = performance.now();

    try {
      const health = await systemService.getHealth();
      const currentLatency = Math.round(performance.now() - startedAt);

      setLatency(`${currentLatency}ms`);

      if (health?.version) {
        setVersion(health.version);
      }

      if (health?.status === 'ok') {
        setStatus(currentLatency < 150 ? 'optimal' : 'degraded');
      } else {
        setStatus('critical');
      }
    } catch {
      setStatus('offline');
      setLatency('--ms');
    }
  }, []);

  useEffect(() => {
    queueMicrotask(checkSystemHealth);
    const intervalId = window.setInterval(checkSystemHealth, 10000);
    return () => window.clearInterval(intervalId);
  }, [checkSystemHealth]);

  return { status, latency, version };
};
