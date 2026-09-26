import { forwardRef } from 'react';

const Select = forwardRef(({ label, error, id, children, className = '', ...props }, ref) => {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </label>
      )}
      <select
        id={id}
        ref={ref}
        className={`rounded-lg border px-3 py-2 text-sm text-gray-900 bg-white
          dark:bg-gray-800 dark:text-gray-100
          focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
          transition-colors
          ${error ? 'border-red-400 focus:ring-red-400' : 'border-gray-300 dark:border-gray-600'}
          ${className}`}
        {...props}
      >
        {children}
      </select>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
});

Select.displayName = 'Select';
export default Select;