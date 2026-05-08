/**
 * Estilos visuales según nivel de riesgo
 */
export const getRiskStyles = (level) => {
  const styles = {
    critical: {
      border: 'border-red-600',
      text: 'text-red-500',
      bgTag: 'bg-red-600/20 text-red-400',
    },
    high: {
      border: 'border-orange-500',
      text: 'text-orange-500',
      bgTag: 'bg-orange-500/20 text-orange-400',
    },
    medium: {
      border: 'border-yellow-500',
      text: 'text-yellow-500',
      bgTag: 'bg-yellow-500/20 text-yellow-400',
    },
    low: {
      border: 'border-blue-500',
      text: 'text-blue-500',
      bgTag: 'bg-blue-500/20 text-blue-400',
    },
  };

  return styles[level?.toLowerCase()] ?? styles.high;
};

/**
 * Convierte confidence (0-1) a porcentaje
 */
export const formatConfidence = (confidence) => {
  const value = Number(confidence);

  if (Number.isNaN(value)) return '--';

  return (value * 100).toFixed(0);
};