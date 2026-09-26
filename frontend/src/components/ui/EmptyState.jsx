const EmptyState = ({ icon: Icon, title, description, action }) => (
  <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
    {Icon && (
      <div className="rounded-full bg-gray-100 p-4 dark:bg-gray-700">
        <Icon className="h-7 w-7 text-gray-400 dark:text-gray-500" />
      </div>
    )}
    <div>
      <p className="font-medium text-gray-700 dark:text-gray-200">{title}</p>
      {description && <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{description}</p>}
    </div>
    {action}
  </div>
);

export default EmptyState;