import { useState } from 'react';
import {
  getUserEmail,
  getUserName,
  getUserRole,
  getUserStatus,
  getUsername,
  roleOptions,
  statusOptions,
} from './userUtils';

const initialForm = {
  name: '',
  username: '',
  email: '',
  role: 'visualizador',
  status: 'active',
  temporaryPassword: '',
};

const getInitialForm = (selectedUser) => {
  if (!selectedUser) return initialForm;

  return {
    name: getUserName(selectedUser),
    username: getUsername(selectedUser),
    email: getUserEmail(selectedUser),
    role: getUserRole(selectedUser),
    status: getUserStatus(selectedUser),
    temporaryPassword: '',
  };
};

const UserForm = ({ selectedUser, saving, onSubmit, onCancel, isSelf }) => {
  const [form, setForm] = useState(() => getInitialForm(selectedUser));
  const isEditing = Boolean(selectedUser);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    onSubmit(form);
  };

  return (
    <aside className="rounded border border-gray-800 bg-[#121212]">
      <div className="border-b border-gray-800 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-200">
          {isEditing ? 'Editar Usuario' : 'Crear Usuario'}
        </h2>
        <p className="mt-1 text-xs font-mono text-gray-500">
          {isEditing ? 'Actualiza datos y permisos.' : 'Registra una cuenta nueva.'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-4">
        <label className="flex flex-col gap-1 text-xs font-mono uppercase tracking-wider text-gray-500">
          Nombre
          <input
            name="name"
            type="text"
            value={form.name}
            onChange={handleChange}
            className="rounded border border-gray-700 bg-[#1a1a1a] px-3 py-2 text-sm normal-case tracking-normal text-gray-200 outline-none transition-colors focus:border-blue-500"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs font-mono uppercase tracking-wider text-gray-500">
          Usuario
          <input
            name="username"
            type="text"
            value={form.username}
            onChange={handleChange}
            className="rounded border border-gray-700 bg-[#1a1a1a] px-3 py-2 text-sm normal-case tracking-normal text-gray-200 outline-none transition-colors focus:border-blue-500"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs font-mono uppercase tracking-wider text-gray-500">
          Correo
          <input
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            className="rounded border border-gray-700 bg-[#1a1a1a] px-3 py-2 text-sm normal-case tracking-normal text-gray-200 outline-none transition-colors focus:border-blue-500"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs font-mono uppercase tracking-wider text-gray-500">
          Rol
          <select
            name="role"
            value={form.role}
            onChange={handleChange}
            disabled={isSelf}
            title={isSelf ? "No puedes cambiar tu propio rol" : ""}
            className="rounded border border-gray-700 bg-[#1a1a1a] px-3 py-2 text-sm normal-case tracking-normal text-gray-200 outline-none transition-colors focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {roleOptions.map((role) => (
              <option key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs font-mono uppercase tracking-wider text-gray-500">
          Estado
          <select
            name="status"
            value={form.status}
            onChange={handleChange}
            className="rounded border border-gray-700 bg-[#1a1a1a] px-3 py-2 text-sm normal-case tracking-normal text-gray-200 outline-none transition-colors focus:border-blue-500"
          >
            {statusOptions.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs font-mono uppercase tracking-wider text-gray-500">
          Clave temporal
          <input
            name="temporaryPassword"
            type="password"
            value={form.temporaryPassword}
            onChange={handleChange}
            placeholder={isEditing ? 'Opcional al editar' : 'Requerida al crear'}
            className="rounded border border-gray-700 bg-[#1a1a1a] px-3 py-2 text-sm normal-case tracking-normal text-gray-200 outline-none transition-colors placeholder:text-gray-600 focus:border-blue-500"
          />
        </label>

        <div className="mt-2 flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 rounded bg-blue-600 px-4 py-2 text-xs font-bold uppercase tracking-wide text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? 'Guardando...' : isEditing ? 'Guardar' : 'Crear'}
          </button>
          {isEditing && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded border border-gray-700 px-4 py-2 text-xs font-bold uppercase tracking-wide text-gray-300 transition-colors hover:border-gray-500 hover:text-white"
            >
              Cancelar
            </button>
          )}
        </div>
      </form>
    </aside>
  );
};

export default UserForm;
