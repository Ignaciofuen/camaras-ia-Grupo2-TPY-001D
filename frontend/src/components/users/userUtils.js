export const getUserId = (user) => user?.id || user?.uuid || user?.usuario_id;

export const getUserName = (user) => (
  user?.name || user?.nombre || user?.fullName || 'Sin nombre'
);

export const getUsername = (user) => (
  user?.username || user?.usuario || user?.nombre_usuario || 'sin_usuario'
);

export const getUserEmail = (user) => (
  user?.email || user?.correo || user?.mail || 'sin_correo'
);

export const getUserRole = (user) => (
  user?.role || user?.rol || 'operator'
);

export const getUserStatus = (user) => (
  user?.status || user?.estado || 'active'
);

export const getLastAccess = (user) => (
  user?.lastAccess || user?.last_access || user?.ultimo_acceso || 'Sin registro'
);

export const roleLabels = {
  administrator: 'Administrador',
  admin: 'Administrador',
  operator: 'Operador',
  operador: 'Operador',
  viewer: 'Visualizador',
  visualizador: 'Visualizador',
};

export const statusLabels = {
  active: 'Activo',
  activo: 'Activo',
  inactive: 'Inactivo',
  inactivo: 'Inactivo',
  suspended: 'Suspendido',
  suspendido: 'Suspendido',
};

export const roleOptions = [
  { value: 'administrator', label: 'Administrador' },
  { value: 'operator', label: 'Operador' },
  { value: 'viewer', label: 'Visualizador' },
];

export const statusOptions = [
  { value: 'active', label: 'Activo' },
  { value: 'inactive', label: 'Inactivo' },
  { value: 'suspended', label: 'Suspendido' },
];

export const normalizeSearch = (value) => String(value || '').toLowerCase().trim();
