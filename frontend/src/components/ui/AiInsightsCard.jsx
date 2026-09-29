import { useState } from 'react';
import toast from 'react-hot-toast';
import { HiSparkles, HiOutlineRefresh } from 'react-icons/hi';
import api from '../../services/api';

const AiInsightsCard = ({ period }) => {
  const [insight, setInsight] = useState('');
  const [generatedAt, setGeneratedAt] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/dashboard/ai-insights', { params: { period } });
      setInsight(res.data.insight);
      setGeneratedAt(res.data.generatedAt);
    } catch (err) {
      if (err.response?.status === 422) {
        setError('Pas assez de données pour générer une analyse pour le moment.');
      } else {
        setError(err.message || "Le service d'analyse IA est momentanément indisponible.");
      }
      toast.error('Analyse IA impossible pour le moment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800 lg:col-span-2">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
          <HiSparkles className="h-4 w-4 text-primary-600" />
          AI Insights
        </h3>
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? (
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <HiOutlineRefresh className="h-3.5 w-3.5" />
          )}
          {insight ? 'Régénérer' : "Générer l'analyse"}
        </button>
      </div>

      {loading && (
        <div className="space-y-2">
          <div className="h-3 w-full animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-3 w-11/12 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-3 w-4/5 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        </div>
      )}

      {!loading && error && <p className="text-sm text-amber-600 dark:text-amber-400">{error}</p>}

      {!loading && !error && insight && (
        <>
          <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">{insight}</p>
          {generatedAt && (
            <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
              Générée le {new Date(generatedAt).toLocaleString('fr-FR')}
            </p>
          )}
        </>
      )}

      {!loading && !error && !insight && (
        <p className="text-sm text-gray-400 dark:text-gray-500">
          Clique sur « Générer l'analyse » pour obtenir un résumé automatique de la situation RH actuelle.
        </p>
      )}
    </div>
  );
};

export default AiInsightsCard;