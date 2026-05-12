/**
 * WebSocketService
 * Envoltorio (wrapper) para la API nativa de WebSocket.
 * Maneja la instanciación y el enrutamiento de eventos.
 */
export class WebSocketService {
  constructor() {
    this.ws = null;
    this.url = null;
  }

  /**
   * Inicia la conexión WebSocket
   * @param {string} url - URL del servidor (ej. ws://localhost:8000/ws)
   * @param {Object} callbacks - Funciones manejadoras de eventos
   */
  connect(url, callbacks = {}) {
    this.url = url;
    
    // Cierre preventivo si ya existía una conexión activa en esta instancia
    if (this.ws) {
      this.ws.close();
    }

    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = (event) => {
        if (callbacks.onOpen) callbacks.onOpen(event);
      };

      this.ws.onmessage = (event) => {
        if (callbacks.onMessage) {
          try {
            // Intentamos parsear a JSON por defecto (útil para YOLO/FastAPI)
            const data = JSON.parse(event.data);
            callbacks.onMessage(data, event);
          } catch (e) {
            // Fallback si es un mensaje de texto simple
            callbacks.onMessage(event.data, event);
          }
        }
      };

      this.ws.onerror = (event) => {
        if (callbacks.onError) callbacks.onError(event);
      };

      this.ws.onclose = (event) => {
        if (callbacks.onClose) callbacks.onClose(event);
      };

    } catch (error) {
      if (callbacks.onError) callbacks.onError(error);
    }
  }

  /**
   * Cierra la conexión de forma limpia
   */
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Envía datos al servidor
   * @param {Object|string} data - Payload a enviar
   */
  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const payload = typeof data === 'string' ? data : JSON.stringify(data);
      this.ws.send(payload);
    } else {
      console.warn('[WebSocketService] Intento de envío sin conexión activa.');
    }
  }
}