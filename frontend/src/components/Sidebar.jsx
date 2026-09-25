import { NavLink } from 'react-router-dom';
import { getStoredUser } from '../services/api';

const Sidebar = ({ isOpen, onClose }) => {
  const user = getStoredUser();
  const isAdmin = user?.role === 'ADMIN';

  return (
    <>
      {/* Fond sombre affiché derrière le menu, seulement sur mobile quand il est ouvert */}
      {isOpen && <div className="sidebar-overlay" onClick={onClose}></div>}

      <aside className={`sidebar ${isOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-brand">AMS</div>
        <nav>
          <NavLink to="/dashboard">Dashboard</NavLink>
          {isAdmin && <NavLink to="/agents">Agents</NavLink>}
          {isAdmin && <NavLink to="/departments">Départements</NavLink>}
          <NavLink to="/attendance">{isAdmin ? 'Présences' : 'Mes présences'}</NavLink>
          <NavLink to="/leaves">{isAdmin ? 'Congés' : 'Mes congés'}</NavLink>
          {isAdmin && <NavLink to="/logs">Logs</NavLink>}
        </nav>
      </aside>
    </>
  );
};

export default Sidebar;