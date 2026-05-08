import api from './api';

export const getAlerts = () => {
  return api.get('/alerts');
};