import UserEmptyState from './UserEmptyState';
import UserTableRow from './UserTableRow';

const UserTable = ({
  users,
  loading,
  onEdit,
  onToggleStatus,
  onDelete,
}) => {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse text-left text-sm">
        <thead className="bg-[#181818] text-[10px] uppercase tracking-widest text-gray-500">
          <tr>
            <th className="px-4 py-3 font-medium">Usuario</th>
            <th className="px-4 py-3 font-medium">Rol</th>
            <th className="px-4 py-3 font-medium">Estado</th>
            <th className="px-4 py-3 font-medium">Ultimo Acceso</th>
            <th className="px-4 py-3 text-right font-medium">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {loading && <UserEmptyState text="Cargando usuarios..." />}
          {!loading && users.length === 0 && <UserEmptyState />}
          {!loading && users.map((user) => (
            <UserTableRow
              key={user.id || user.uuid || user.usuario_id}
              user={user}
              onEdit={onEdit}
              onToggleStatus={onToggleStatus}
              onDelete={onDelete}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default UserTable;
