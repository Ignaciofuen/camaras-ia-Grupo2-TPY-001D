const UserHeader = ({ onNewUser, onRefresh, refreshing = false }) => {
  return (
    <header className="mb-6 flex flex-col gap-4 border-b border-gray-800 pb-4 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <h1 className="text-xl font-bold uppercase tracking-widest text-gray-100">
          Gestion de Usuarios
        </h1>
        <p className="mt-1 text-xs font-mono text-gray-500">
          Administracion de cuentas, roles y estado de acceso.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="rounded border border-gray-700 px-4 py-2 text-xs font-bold uppercase tracking-wide text-gray-300 transition-colors hover:border-gray-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {refreshing ? 'Actualizando...' : 'Actualizar'}
        </button>
      </div>
    </header>
  );
};

export default UserHeader;
