/**
 * sse.js
 * Wrapper para EventSource (Server-Sent Events).
 *
 * El backend FastAPI expone GET /alertas/stream con tres tipos de evento:
 *   - "hello"   → handshake al conectar
 *   - "alerta"  → cada vez que el detector publica una alerta nueva
 *   - "error"   → si Redis se cae o el stream falla
 *
 * EventSource ya reconecta solo si el server cierra; este wrapper
 * solo agrega API consistente con el viejo WebSocketService.
 */
export class SSEService {
  constructor() {
    this.es = null;
    this.url = null;
  }

  connect(url, callbacks = {}) {
    this.url = url;

    if (this.es) {
      this.es.close();
    }

    try {
      this.es = new EventSource(url);

      this.es.onopen = (event) => {
        if (callbacks.onOpen) callbacks.onOpen(event);
      };

      this.es.onerror = (event) => {
        if (callbacks.onError) callbacks.onError(event);
      };

      // Evento "hello": confirma que estamos suscriptos al canal
      this.es.addEventListener('hello', (event) => {
        if (callbacks.onHello) {
          try { callbacks.onHello(JSON.parse(event.data)); }
          catch { callbacks.onHello(event.data); }
        }
      });

      // Evento "alerta": cada nueva alerta publicada por el detector
      this.es.addEventListener('alerta', (event) => {
        if (callbacks.onAlerta) {
          try { callbacks.onAlerta(JSON.parse(event.data)); }
          catch (e) { console.error('[SSE] alerta payload inválido:', e); }
        }
      });

      // Evento "error" del propio backend (no de la red)
      this.es.addEventListener('error', (event) => {
        if (callbacks.onServerError && event.data) {
          try { callbacks.onServerError(JSON.parse(event.data)); }
          catch { /* ignore */ }
        }
      });
    } catch (error) {
      if (callbacks.onError) callbacks.onError(error);
    }
  }

  disconnect() {
    if (this.es) {
      this.es.close();
      this.es = null;
    }
  }

  get readyState() {
    return this.es ? this.es.readyState : EventSource.CLOSED;
  }
}

export default SSEService;
