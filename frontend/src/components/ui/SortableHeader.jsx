import { HiChevronUp, HiChevronDown, HiSelector } from 'react-icons/hi';

const SortableHeader = ({ label, sortKey, currentSort, onSort }) => {
  const isActive = currentSort.sortBy === sortKey;
  const Icon = isActive ? (currentSort.sortOrder === 'asc' ? HiChevronUp : HiChevronDown) : HiSelector;

  return (
    <th
      scope="col"
      className="cursor-pointer select-none px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
      onClick={() => onSort(sortKey)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <Icon className={`h-3.5 w-3.5 ${isActive ? 'text-primary-600' : 'text-gray-300 dark:text-gray-600'}`} />
      </span>
    </th>
  );
};

export default SortableHeader;