import { HiArrowTrendingUp, HiArrowTrendingDown } from 'react-icons/hi2';

// trendGoodDirection: 'up' si une hausse est une bonne nouvelle (ex. taux de présence),
// 'down' si une baisse est la bonne nouvelle (aucun cas dans ce projet actuellement, mais prévu pour évoluer)
const KpiCard = ({ label, value, trend, trendGoodDirection = 'up' }) => {
  const hasTrend = trend !== null && trend !== undefined && !Number.isNaN(trend);
  const isPositive = trend > 0;
  const isGood = hasTrend && trend !== 0 && (trendGoodDirection === 'up' ? isPositive : !isPositive);
  const isBad = hasTrend && trend !== 0 && !isGood;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">{label}</p>
      <div className="mt-2 flex items-end justify-between">
        <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</span>
        {hasTrend && trend !== 0 && (
          <span
            className={`flex items-center gap-1 text-xs font-semibold ${
              isGood ? 'text-green-600 dark:text-green-400' : isBad ? 'text-red-600 dark:text-red-400' : 'text-gray-400'
            }`}
          >
            {isPositive ? <HiArrowTrendingUp className="h-4 w-4" /> : <HiArrowTrendingDown className="h-4 w-4" />}
            {Math.abs(trend)} pt{Math.abs(trend) > 1 ? 's' : ''}
          </span>
        )}
        {hasTrend && trend === 0 && <span className="text-xs text-gray-400">stable</span>}
      </div>
    </div>
  );
};

export default KpiCard;