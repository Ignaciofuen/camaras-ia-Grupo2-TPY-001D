import { getUserRole, roleLabels } from './userUtils';

const getRoleClass = (role) => {
  const classes = {
    administrator: 'border-blue-500/40 text-blue-300 bg-blue-500/10',
    admin: 'border-blue-500/40 text-blue-300 bg-blue-500/10',
    operator: 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10',
    operador: 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10',
    viewer: 'border-gray-500/40 text-gray-300 bg-gray-500/10',
    visualizador: 'border-gray-500/40 text-gray-300 bg-gray-500/10',
  };

  return classes[role] || classes.viewer;
};

const UserRoleBadge = ({ user }) => {
  const role = getUserRole(user);

  return (
    <span className={`inline-flex rounded border px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${getRoleClass(role)}`}>
      {roleLabels[role] || role}
    </span>
  );
};

export default UserRoleBadge;
