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
      this.es = new EventSource(url, { withCredentials: true });

      this.es.onopen = (event) => {
        callbacks.onOpen?.(event);
      };

      this.es.onerror = (event) => {
        callbacks.onError?.(event);
      };

      this.es.addEventListener('hello', (event) => {
        if (!callbacks.onHello) return;

        try {
          callbacks.onHello(JSON.parse(event.data));
        } catch {
          callbacks.onHello(event.data);
        }
      });

      this.es.addEventListener('alerta', (event) => {
        if (!callbacks.onAlerta) return;

        try {
          callbacks.onAlerta(JSON.parse(event.data));
        } catch (error) {
          console.error('[SSE] alerta payload invalido:', error);
        }
      });

      this.es.addEventListener('error', (event) => {
        if (!callbacks.onServerError || !event.data) return;

        try {
          callbacks.onServerError(JSON.parse(event.data));
        } catch {
          callbacks.onServerError(event.data);
        }
      });
    } catch (error) {
      callbacks.onError?.(error);
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
