export { alertService as default, alertService } from './alertService';

export const getAlerts = async () => {
  const { alertService } = await import('./alertService');
  return alertService.getAlertas();
};
