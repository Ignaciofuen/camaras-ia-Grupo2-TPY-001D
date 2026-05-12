import { create } from 'zustand';

/**
 * useAlerts
 * Store global para la gestión del estado de alertas de seguridad.
 * Diseñado para ser actualizado por servicios de WebSocket externos.
 */
export const useAlerts = create((set) => ({
  // Estado inicial
  alerts: [],
  selectedAlert: null,

  /**
   * Agrega una nueva alerta a la lista global.
   * Mantiene un límite de 100 elementos para optimizar el rendimiento del DOM 
   * y el consumo de memoria en sesiones de monitoreo prolongadas.
   * @param {Object} alert - Objeto de alerta proveniente del WebSocket o API.
   */
  addAlert: (alert) => set((state) => ({
    alerts: [alert, ...state.alerts].slice(0, 100)
  })),

  /**
   * Establece una alerta específica como seleccionada para su inspección detallada.
   * @param {Object} alert - El objeto de alerta seleccionado.
   */
  selectAlert: (alert) => set({
    selectedAlert: alert
  }),

  /**
   * Reinicia el estado de alertas y limpia la selección actual.
   */
  clearAlerts: () => set({
    alerts: [],
    selectedAlert: null
  })
}));