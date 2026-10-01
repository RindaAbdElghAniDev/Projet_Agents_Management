const notFound = (req, res) => {
  res.status(404).json({ message: `Route introuvable : ${req.method} ${req.originalUrl}` });
};

const errorHandler = (err, req, res, next) => {
  process.stdout.write('\n========== ERREUR ==========\n');
  process.stdout.write('Message : ' + String(err.message) + '\n');
  process.stdout.write('Code    : ' + String(err.code) + '\n');
  process.stdout.write('Stack   :\n' + String(err.stack) + '\n');
  process.stdout.write('=============================\n\n');

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'JSON invalide dans la requête.' });
  }
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ message: 'Cette valeur existe déjà.' });
  }

  // Erreurs métier signalées par les contrôleurs via createError(message, statusCode)
  // (ex. 400, 403, 404, 409, 422, 502, 503) : on renvoie le statut prévu
  // au lieu de tout retomber en 500. Le message vient du code applicatif, il est donc diffusable.
  if (Number.isInteger(err.statusCode) && err.statusCode >= 400 && err.statusCode <= 599) {
    return res.status(err.statusCode).json({ message: err.message });
  }

  // Aucune information exploitable : on masque le détail technique (pas de fuite d'internals).
  res.status(500).json({ message: 'Erreur interne du serveur.' });
};

module.exports = { notFound, errorHandler };