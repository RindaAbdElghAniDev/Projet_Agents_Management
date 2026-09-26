import api from '../services/api';

export const downloadFile = async (url, params, filename) => {
  try {
    const res = await api.get(url, { params, responseType: 'blob' });
    const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
  } catch (err) {
    // Avec responseType "blob", une erreur du backend arrive aussi sous forme de Blob :
    // on la relit comme du texte pour retrouver le vrai message JSON envoyé par errorMiddleware.
    let message = 'Export impossible';
    if (err.response?.data instanceof Blob) {
      try {
        const text = await err.response.data.text();
        message = JSON.parse(text).message || message;
      } catch {
        // corps illisible : message par défaut conservé
      }
    } else if (err.message) {
      message = err.message;
    }
    throw new Error(message);
  }
};