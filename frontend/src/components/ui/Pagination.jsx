import { HiChevronLeft, HiChevronRight } from 'react-icons/hi';

const Pagination = ({ page, totalPages, total, label = 'résultats', onChange }) => (
  <div className="flex flex-col items-center justify-between gap-3 border-t border-gray-100 pt-4 dark:border-gray-700 sm:flex-row">
    <p className="text-sm text-gray-500 dark:text-gray-400">
      Page {page} sur {Math.max(totalPages, 1)} · {total} {label}
    </p>
    <div className="flex gap-2">
      <button
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
      >
        <HiChevronLeft className="h-4 w-4" /> Précédent
      </button>
      <button
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
        className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
      >
        Suivant <HiChevronRight className="h-4 w-4" />
      </button>
    </div>
  </div>
);

export default Pagination;