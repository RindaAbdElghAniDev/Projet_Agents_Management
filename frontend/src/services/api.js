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

    // Message lisible pour les pages : celui du backend, sinon un message par défaut
    error.message =
      error.response?.data?.message || 'Impossible de contacter le serveur';

    return Promise.reject(error);
  }
);

export default api;