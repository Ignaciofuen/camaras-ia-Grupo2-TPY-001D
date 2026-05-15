const UserStats = ({ stats }) => {
  const items = [
    { label: 'Total', value: stats.total, color: 'text-gray-100' },
    { label: 'Activos', value: stats.active, color: 'text-green-400' },
    { label: 'Inactivos', value: stats.inactive, color: 'text-gray-400' },
    { label: 'Admins', value: stats.admins, color: 'text-blue-300' },
  ];

  return (
    <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="rounded border border-gray-800 bg-[#161616] p-4">
          <span className="text-[10px] font-mono uppercase tracking-widest text-gray-500">
            {item.label}
          </span>
          <div className={`mt-2 text-2xl font-bold ${item.color}`}>
            {item.value}
          </div>
        </div>
      ))}
    </section>
  );
};

export default UserStats;
