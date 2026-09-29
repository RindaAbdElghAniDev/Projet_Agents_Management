const { GoogleGenerativeAI } = require('@google/generative-ai');

const buildPrompt = (data) => `Tu es un assistant RH senior. Voici un objet JSON contenant des statistiques agrégées d'une entreprise pour la période demandée (aucune donnée personnelle) :

${JSON.stringify(data, null, 2)}

Rédige un résumé de 3 à 4 phrases maximum, en français, dans un ton professionnel et factuel, destiné à un responsable RH qui consulte son tableau de bord.
Utilise uniquement les chiffres fournis ci-dessus, n'en invente aucun.
Si "attendanceRateTrend" est positif, mentionne une amélioration ; s'il est négatif, mentionne une baisse ; s'il est null, ne parle pas de tendance.
Si "departmentBreakdown" contient des taux de présence ("attendanceRate" non nul), tu peux citer le département le plus performant et/ou le moins performant sur ce critère, sans jamais mentionner de nom d'agent.
Termine sur une phrase concernant le niveau des demandes de congé ("pendingLeaves" et "leaveApprovalRate").
Réponds uniquement avec le paragraphe, sans titre, sans liste à puces, sans guillemets.`;

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const MAX_ATTEMPTS = 2;
const RETRY_DELAY_MS = 1500;

// Génère un résumé RH à partir de statistiques déjà calculées par le backend.
// `data` ne doit contenir QUE des agrégats (jamais de PII) : c'est la responsabilité de l'appelant.
const generateInsights = async (data) => {
  if (!process.env.GEMINI_API_KEY) {
    throw createError("Le service d'analyse IA n'est pas configuré", 503);
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite' });

  let lastError;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const result = await model.generateContent(buildPrompt(data));
      const text = result.response.text().trim();

      if (!text) {
        throw createError("L'IA n'a renvoyé aucun résultat", 502);
      }

      return text;
    } catch (error) {
      lastError = error;

      // Erreur métier déjà typée (ex: pas de résultat) : inutile de réessayer
      if (error.statusCode) throw error;

      const isOverloaded = error.message?.includes('503') || error.message?.includes('high demand');
      console.error(`Erreur Gemini (tentative ${attempt}/${MAX_ATTEMPTS}) :`, error.message);

      // Si c'est une vraie surcharge et qu'il reste des tentatives, on patiente puis on réessaie
      if (isOverloaded && attempt < MAX_ATTEMPTS) {
        await sleep(RETRY_DELAY_MS);
        continue;
      }

      throw createError("Le service d'analyse IA est momentanément indisponible", 502);
    }
  }

  throw createError("Le service d'analyse IA est momentanément indisponible", 502);
};

module.exports = { generateInsights };