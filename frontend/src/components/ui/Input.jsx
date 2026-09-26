import { forwardRef } from 'react';

const Input = forwardRef(
  ({ label, error, id, type = 'text', icon: Icon, className = '', ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={id} className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {label}
          </label>
        )}
        <div className="relative">
          {Icon && (
            <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          )}
          <input
            id={id}
            type={type}
            ref={ref}
            className={`w-full rounded-lg border px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400
              bg-white dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500
              focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
              transition-colors
              ${Icon ? 'pl-9' : ''}
              ${error ? 'border-red-400 focus:ring-red-400' : 'border-gray-300 dark:border-gray-600'}
              ${className}`}
            {...props}
          />
        </div>
        {error && <span className="text-xs text-red-500">{error}</span>}
      </div>
    );
  }
);

Input.displayName = 'Input';
export default Input;