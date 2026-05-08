/**
 * WebSocketService
 *
 * Wrapper simple para manejar WebSocket sin ensuciar los hooks.
 * Aquí se controla:
 * - conexión
 * - eventos
 * - reconexión automática
 */
export class WebSocketService {
  constructor() {
    this.ws = null;
    this.url = null;
    this.callbacks = {};
    
    // control de reconexión
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 3000;

    this.reconnectTimer = null;

    // sirve para no reconectar cuando cerramos manualmente
    this.intentionalDisconnect = false; 
  }

  /**
   * conecta al servidor WS
   */
  connect(url, callbacks = {}) {
    this.url = url;
    this.callbacks = callbacks;
    this.intentionalDisconnect = false;

    // si ya había conexión, la cerramos primero
    if (this.ws) {
      this.ws.close();
    }

    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = (event) => {
        this.reconnectAttempts = 0;
        if (this.callbacks.onOpen) this.callbacks.onOpen(event);
      };

      this.ws.onmessage = (event) => {
        if (this.callbacks.onMessage) {
          try {
            // intentamos parsear JSON automáticamente
            const data = JSON.parse(event.data);
            this.callbacks.onMessage(data, event);
          } catch {
            // si no es JSON, lo pasamos tal cual
            this.callbacks.onMessage(event.data, event);
          }
        }
      };

      this.ws.onerror = (event) => {
        if (this.callbacks.onError) this.callbacks.onError(event);
      };

      this.ws.onclose = (event) => {
        if (this.callbacks.onClose) this.callbacks.onClose(event);
        this.handleReconnect();
      };

    } catch (error) {
      if (this.callbacks.onError) this.callbacks.onError(error);
      this.handleReconnect();
    }
  }

  /**
   * lógica simple de reconexión
   */
  handleReconnect() {
    // si se cerró manualmente, no reconectar
    if (this.intentionalDisconnect) return;

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;

      console.warn(
        `[WebSocket] reconectando... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`
      );

      this.reconnectTimer = setTimeout(() => {
        this.connect(this.url, this.callbacks);
      }, this.reconnectDelay);

    } else {
      console.error('[WebSocket] no se pudo reconectar');
    }
  }

  /**
   * cierre manual (cuando React desmonta)
   */
  disconnect() {
    this.intentionalDisconnect = true;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * enviar datos al servidor
   */
  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const payload =
        typeof data === 'string' ? data : JSON.stringify(data);

      this.ws.send(payload);
    } else {
      console.warn('[WebSocketService] sin conexión activa');
    }
  }
}