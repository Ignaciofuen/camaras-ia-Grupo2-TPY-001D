import { roleOptions } from './userUtils';

const UserFilters = ({
  query,
  roleFilter,
  onQueryChange,
  onRoleFilterChange,
  resultCount,
}) => {
  return (
    <div className="flex flex-col gap-3 border-b border-gray-800 p-4 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-200">
          Cuentas Registradas
        </h2>
        <p className="mt-1 text-xs font-mono text-gray-500">
          {resultCount} resultado(s)
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Buscar usuario..."
          className="w-full rounded border border-gray-700 bg-[#1a1a1a] px-3 py-2 text-sm text-gray-200 outline-none transition-colors placeholder:text-gray-600 focus:border-blue-500 sm:w-64"
        />
        <select
          value={roleFilter}
          onChange={(event) => onRoleFilterChange(event.target.value)}
          className="rounded border border-gray-700 bg-[#1a1a1a] px-3 py-2 text-sm text-gray-200 outline-none transition-colors focus:border-blue-500"
        >
          <option value="all">Todos los roles</option>
          {roleOptions.map((role) => (
            <option key={role.value} value={role.value}>
              {role.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default UserFilters;
