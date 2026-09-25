import { Navigate, Outlet } from 'react-router-dom';
import { getStoredUser } from '../services/api';

const AdminRoute = () => {
  const user = getStoredUser();

  // Pas admin : retour au Dashboard
  if (user?.role !== 'ADMIN') {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
};

export default AdminRoute;