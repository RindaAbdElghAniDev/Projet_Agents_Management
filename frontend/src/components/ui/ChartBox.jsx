import { useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import { useTheme } from '../../context/ThemeContext';

Chart.register(...registerables);

const ChartBox = ({ type, data, options, title }) => {
  const { theme } = useTheme();
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const gridColor = theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
    const textColor = theme === 'dark' ? '#9ca3af' : '#6b7280';

    // Fusionne les options reçues avec les couleurs adaptées au thème courant
    const mergedOptions = {
      ...options,
      plugins: {
        ...(options?.plugins || {}),
        legend: {
          ...(options?.plugins?.legend || {}),
          labels: { color: textColor, ...(options?.plugins?.legend?.labels || {}) },
        },
      },
      scales: options?.scales
        ? Object.fromEntries(
            Object.entries(options.scales).map(([axis, config]) => [
              axis,
              {
                ...config,
                grid: { color: gridColor, ...(config.grid || {}) },
                ticks: { color: textColor, ...(config.ticks || {}) },
              },
            ])
          )
        : undefined,
    };

    if (chartRef.current) chartRef.current.destroy();
    chartRef.current = new Chart(canvasRef.current, { type, data, options: mergedOptions });

    return () => {
      if (chartRef.current) chartRef.current.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, JSON.stringify(data), JSON.stringify(options), theme]);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <h3 className="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-300">{title}</h3>
      <div className="relative h-64">
        <canvas ref={canvasRef}></canvas>
      </div>
    </div>
  );
};

export default ChartBox;