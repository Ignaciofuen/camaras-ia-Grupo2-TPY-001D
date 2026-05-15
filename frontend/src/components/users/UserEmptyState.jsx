const UserEmptyState = ({ text = 'Sin usuarios para los filtros seleccionados.' }) => {
  return (
    <tr>
      <td className="px-4 py-8 text-center font-mono text-xs text-gray-500" colSpan="5">
        {text}
      </td>
    </tr>
  );
};

export default UserEmptyState;
