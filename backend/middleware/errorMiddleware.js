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

  res.status(500).json({ message: 'Erreur interne du serveur.' });
};

module.exports = { notFound, errorHandler };