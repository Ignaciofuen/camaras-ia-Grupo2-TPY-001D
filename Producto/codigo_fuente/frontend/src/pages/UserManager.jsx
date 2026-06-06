import { useMemo, useState } from 'react';
import ConfirmDialog from '../components/common/ConfirmDialog';
import UserFilters from '../components/users/UserFilters';
import UserForm from '../components/users/UserForm';
import UserHeader from '../components/users/UserHeader';
import UserStats from '../components/users/UserStats';
import UserTable from '../components/users/UserTable';
import {
  getUserEmail,
  getUserId,
  getUserName,
  getUserRole,
  getUserStatus,
  getUsername,
  normalizeSearch,
} from '../components/users/userUtils';
import { useAuth } from '../auth/useAuth';
import { useUsers } from '../hooks/useUsers';

const isAdminRole = (role) => (
  role === 'administrator' || role === 'admin'
);

const UserManager = () => {
  const { user: currentUser } = useAuth();
  const {
    users,
    stats,
    loading,
    saving,
    error,
    success,
    createUser,
    updateUser,
    deleteUser,
    refresh,
    clearMessages,
  } = useUsers();

  const [selectedUser, setSelectedUser] = useState(null);
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [localError, setLocalError] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const canManageUsers = isAdminRole(currentUser?.role || currentUser?.rol);

  const filteredUsers = useMemo(() => {
    const searchValue = normalizeSearch(query);

    return users.filter((user) => {
      const role = getUserRole(user);
      const matchesRole = roleFilter === 'all' || role === roleFilter;
      const matchesSearch = [
        getUserName(user),
        getUsername(user),
        getUserEmail(user),
      ].some((value) => normalizeSearch(value).includes(searchValue));

      return matchesRole && matchesSearch;
    });
  }, [users, query, roleFilter]);

  const resetSelection = () => {
    setSelectedUser(null);
    setLocalError(null);
    clearMessages();
  };

  const validateUserForm = (payload) => {
    if (!payload.name.trim() || !payload.username.trim() || !payload.email.trim()) {
      return 'Completa nombre, usuario y correo.';
    }

    if (!selectedUser && !payload.temporaryPassword.trim()) {
      return 'Ingresa una clave temporal para crear el usuario.';
    }

    return null;
  };

  const handleSubmit = async (payload) => {
    setLocalError(null);
    clearMessages();

    const validationError = validateUserForm(payload);
    if (validationError) {
      setLocalError(validationError);
      return;
    }

    if (selectedUser) {
      await updateUser(getUserId(selectedUser), payload);
      resetSelection();
      return;
    }

    await createUser(payload);
    resetSelection();
  };

  const handleToggleStatus = async (user) => {
    const userId = getUserId(user);
    const status = getUserStatus(user);
    const nextStatus = status === 'active' || status === 'activo'
      ? 'inactive'
      : 'active';

    await updateUser(userId, {
      ...user,
      status: nextStatus,
    });
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    await deleteUser(getUserId(deleteTarget));

    if (selectedUser && getUserId(selectedUser) === getUserId(deleteTarget)) {
      resetSelection();
    }

    setDeleteTarget(null);
  };

  if (!canManageUsers) {
    return (
      <div className="h-full w-full bg-[#0a0a0a] p-6 text-gray-100">
        <div className="rounded border border-yellow-900 bg-yellow-950/20 px-4 py-3 text-sm text-yellow-300">
          No tienes permisos para gestionar usuarios. Esta seccion requiere rol administrador.
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-y-auto bg-[#0a0a0a] p-4 sm:p-6 text-gray-100">
      <UserHeader
        onNewUser={resetSelection}
        onRefresh={refresh}
        refreshing={loading}
      />

      <UserStats stats={stats} />

      {(localError || error) && (
        <div className="mb-4 rounded border border-red-900 bg-red-950/30 px-4 py-3 text-sm text-red-300">
          {localError || error}
        </div>
      )}

      {success && !localError && !error && (
        <div className="mb-4 rounded border border-green-900 bg-green-950/30 px-4 py-3 text-sm text-green-300">
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-4 sm:gap-6">
        <section className="min-w-0 rounded border border-gray-800 bg-[#121212]">
          <UserFilters
            query={query}
            roleFilter={roleFilter}
            onQueryChange={setQuery}
            onRoleFilterChange={setRoleFilter}
            resultCount={filteredUsers.length}
          />

          <UserTable
            users={filteredUsers}
            loading={loading}
            onEdit={setSelectedUser}
            onToggleStatus={handleToggleStatus}
            onDelete={setDeleteTarget}
          />
        </section>

        <UserForm
          key={selectedUser ? getUserId(selectedUser) : 'new-user'}
          selectedUser={selectedUser}
          saving={saving}
          onSubmit={handleSubmit}
          onCancel={resetSelection}
        />
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Eliminar usuario"
        message={
          deleteTarget
            ? `Eliminar el usuario @${getUsername(deleteTarget)}? Esta accion no se puede deshacer.`
            : null
        }
        confirmLabel="Eliminar"
        danger
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};

export default UserManager;
