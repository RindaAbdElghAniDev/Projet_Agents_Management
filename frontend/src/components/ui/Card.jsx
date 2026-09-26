const Card = ({ children, className = '', title, actions }) => {
  return (
    <div
      className={`rounded-xl border border-gray-200 bg-white shadow-sm
      dark:border-gray-700 dark:bg-gray-800 ${className}`}
    >
      {(title || actions) && (
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-700">
          {title && (
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
          )}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
};

export default Card;