// Date du jour au format AAAA-MM-JJ (heure locale)
export const getToday = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// "08:30:00" -> "08:30"
export const formatTime = (time) => (time ? time.slice(0, 5) : '-');

// "2026-09-21T08:15:30.000Z" -> "21/09/2026 08:15"
export const formatDateTime = (value) => {
  const d = new Date(value);
  return d.toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};