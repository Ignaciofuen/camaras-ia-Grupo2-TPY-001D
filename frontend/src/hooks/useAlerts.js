import { create } from 'zustand';

/**
 * useAlerts
 *
 * Store global para manejar alertas en toda la app.
 * Se actualiza desde WebSocket u otros servicios externos.
 */
export const useAlerts = create((set) => ({
  // Estado
  alerts: [],
  selectedAlert: null,

  /**
   * Agrega una nueva alerta al inicio.
   * Se limita a 100 para evitar problemas de rendimiento.
   */
  addAlert: (alert) =>
    set((state) => ({
      alerts: [alert, ...state.alerts].slice(0, 100),
    })),

  /**
   * Selecciona una alerta para ver su detalle.
   */
  selectAlert: (alert) =>
    set({
      selectedAlert: alert,
    }),

  /**
   * Limpia todas las alertas y la selección.
   */
  clearAlerts: () =>
    set({
      alerts: [],
      selectedAlert: null,
    }),
}));