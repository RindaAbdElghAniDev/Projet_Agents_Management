import { Navigate, Outlet } from 'react-router-dom';

const ProtectedRoute = () => {
  const token = localStorage.getItem('token');

  // Pas de token : on renvoie vers la page de connexion
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // Token présent : on affiche la page demandée
  return <Outlet />;
};

export default ProtectedRoute;