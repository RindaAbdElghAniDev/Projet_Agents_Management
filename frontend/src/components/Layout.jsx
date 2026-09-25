import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';

const Layout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  // Ferme le menu mobile automatiquement dès qu'on change de page
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className="app-layout">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="content">
        <Navbar onToggleSidebar={() => setSidebarOpen((open) => !open)} />
        <main className="main">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;