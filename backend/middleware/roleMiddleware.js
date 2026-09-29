// À utiliser après "protect", qui a déjà chargé req.user
const authorizeAdmin = (req, res, next) => {
  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({ message: 'Accès réservé aux administrateurs.' });
  }
  next();
};

module.exports = { authorizeAdmin };