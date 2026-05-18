import { getUserStatus, statusLabels } from './userUtils';

const getStatusClass = (status) => {
  const classes = {
    active: 'bg-green-500',
    activo: 'bg-green-500',
    inactive: 'bg-gray-600',
    inactivo: 'bg-gray-600',
    suspended: 'bg-yellow-500',
    suspendido: 'bg-yellow-500',
  };

  return classes[status] || classes.inactive;
};

const UserStatusBadge = ({ user }) => {
  const status = getUserStatus(user);

  return (
    <span className="inline-flex items-center gap-2 text-xs text-gray-300">
      <span className={`h-2 w-2 rounded-full ${getStatusClass(status)}`} />
      {statusLabels[status] || status}
    </span>
  );
};

export default UserStatusBadge;
