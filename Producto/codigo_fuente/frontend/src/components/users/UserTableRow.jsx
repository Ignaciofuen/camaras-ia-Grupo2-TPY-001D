import UserRoleBadge from './UserRoleBadge';
import UserStatusBadge from './UserStatusBadge';
import {
  getLastAccess,
  getUserEmail,
  getUserId,
  getUserName,
  getUsername,
  getUserStatus,
} from './userUtils';

const UserTableRow = ({ user, onEdit, onToggleStatus, onDelete }) => {
  const userId = getUserId(user);
  const status = getUserStatus(user);
  const isActive = status === 'active' || status === 'activo';

  return (
    <tr className="border-t border-gray-800 hover:bg-[#181818]">
      <td className="px-4 py-4">
        <div className="font-medium text-gray-100">{getUserName(user)}</div>
        <div className="mt-1 text-xs text-gray-500">
          @{getUsername(user)} - {getUserEmail(user)}
        </div>
      </td>
      <td className="px-4 py-4">
        <UserRoleBadge user={user} />
      </td>
      <td className="px-4 py-4">
        <UserStatusBadge user={user} />
      </td>
      <td className="px-4 py-4 font-mono text-xs text-gray-500">
        {getLastAccess(user)}
      </td>
      <td className="px-4 py-4">
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => onEdit(user)}
            className="rounded border border-gray-700 px-3 py-1 text-xs text-gray-300 transition-colors hover:border-blue-500 hover:text-blue-300"
          >
            Editar
          </button>
          <button
            type="button"
            onClick={() => onToggleStatus(user)}
            className="rounded border border-gray-700 px-3 py-1 text-xs text-gray-300 transition-colors hover:border-yellow-500 hover:text-yellow-300"
          >
            {isActive ? 'Desactivar' : 'Activar'}
          </button>
          <button
            type="button"
            onClick={() => onDelete(user)}
            disabled={!userId}
            className="rounded border border-gray-700 px-3 py-1 text-xs text-gray-300 transition-colors hover:border-red-500 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Eliminar
          </button>
        </div>
      </td>
    </tr>
  );
};

export default UserTableRow;
