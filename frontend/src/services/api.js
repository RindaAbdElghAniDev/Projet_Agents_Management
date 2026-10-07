import axios from 'axios';

// Instance Axios avec l'URL de base du backend
const api = axios.create({
  baseURL: 'http://localhost:5000/api',
});

// ---------- Gestion de la session (localStorage) ----------
export const saveSession = (token, user) => {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
};

export const clearSession = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
};

export const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem('user'));
  } catch {
    return null;
  }
};

// ---------- Message métier : compte sans fiche agent ----------
// Fragment unique émis par le middleware requireAgentProfile (backend).
// Permet de rediriger vers /complete-agent-profile sans impacter les autres 403.
export const MISSING_AGENT_PROFILE = 'Veuillez compléter votre profil';

// ---------- Interceptor de requête : ajoute le token ----------
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ---------- Interceptor de réponse : gestion des erreurs ----------
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url || '';
    const isAuthForm = url.includes('/auth/login') || url.includes('/auth/register');

    // Token expiré ou invalide sur une page privée : on déconnecte
    if (error.response?.status === 401 && !isAuthForm) {
      clearSession();
      window.location.href = '/login';
    }

    // SEC-11 : compte connecté SANS fiche agent -> on redirige vers la complétion.
    // Cible volontairement un fragment UNIQUE du message pour ne pas capter les autres
    // 403 (rôle insuffisant, compte désactivé, ressource interdite) : ils restent inchangés.
    if (
      error.response?.status === 403 &&
      error.response?.data?.message?.includes(MISSING_AGENT_PROFILE) &&
      // garde 1 : ne pas boucler si l'on est déjà sur la page de complétion
      window.location.pathname !== '/complete-agent-profile' &&
      // garde 2 : sur le POST lui-même, afficher l'erreur dans la page plutôt que rediriger
      !url.startsWith('/agents/me')
    ) {
      window.location.href = '/complete-agent-profile';
      return Promise.reject(error);
    }

    // Message lisible pour les pages : celui du backend, sinon un message par défaut
    error.message =
      error.response?.data?.message || 'Impossible de contacter le serveur';

    return Promise.reject(error);
  }
);

export default api;
