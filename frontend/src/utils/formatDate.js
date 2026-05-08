/**
 * Formatea fecha a formato VMS (YYYY-MM-DD HH:mm:ss)
 */
export const formatDateTime = (date) => {
  if (!date) return '--';

  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '--';

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

/**
 * Formatea solo la hora (HH:mm:ss)
 */
export const formatTime = (date) => {
  if (!date) return '--';

  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '--';

  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');

  return `${hours}:${minutes}:${seconds}`;
};