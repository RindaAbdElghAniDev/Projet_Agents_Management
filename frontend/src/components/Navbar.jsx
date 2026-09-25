import { useNavigate } from 'react-router-dom';
import api, { clearSession, getStoredUser } from '../services/api';

const Navbar = ({ onToggleSidebar }) => {
  const navigate = useNavigate();
  const user = getStoredUser();

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (err) {
      console.error(err.message);
    } finally {
      clearSession();
      navigate('/login');
    }
  };

  return (
    <header className="navbar">
      <div className="navbar-left">
        <button className="menu-toggle" onClick={onToggleSidebar} aria-label="Ouvrir le menu">
          ☰
        </button>
        <span className="navbar-title">Agent Management System</span>
      </div>
      <div className="navbar-user">
        <span>
          {user?.name} <small className="role-badge">{user?.role}</small>
        </span>
        <button className="btn btn-danger btn-auto" onClick={handleLogout}>
          Déconnexion
        </button>
      </div>
    </header>
  );
};

export default Navbar;