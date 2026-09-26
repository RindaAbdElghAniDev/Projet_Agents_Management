import { NavLink } from 'react-router-dom';
import {
  HiOutlineViewGrid,
  HiOutlineUsers,
  HiOutlineOfficeBuilding,
  HiOutlineClipboardCheck,
  HiOutlineCalendar,
  HiOutlineDocumentText,
} from 'react-icons/hi';
import { useAuth } from '../context/AuthContext';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: HiOutlineViewGrid, adminOnly: false },
  { to: '/agents', label: 'Agents', icon: HiOutlineUsers, adminOnly: true },
  { to: '/departments', label: 'Départements', icon: HiOutlineOfficeBuilding, adminOnly: true },
  {
    to: '/attendance',
    label: 'Présences',
    agentLabel: 'Mes présences',
    icon: HiOutlineClipboardCheck,
    adminOnly: false,
  },
  { to: '/leaves', label: 'Congés', agentLabel: 'Mes congés', icon: HiOutlineCalendar, adminOnly: false },
  { to: '/logs', label: 'Logs', icon: HiOutlineDocumentText, adminOnly: true },
];

const Sidebar = ({ isOpen, onClose }) => {
  const { isAdmin } = useAuth();

  return (
    <>
      {isOpen && <div className="fixed inset-0 z-30 bg-gray-900/40 lg:hidden" onClick={onClose}></div>}

      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 transform bg-gray-900 text-gray-300 transition-transform duration-200 ease-out
          lg:static lg:translate-x-0
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex h-16 items-center gap-2 px-5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600 text-sm font-bold text-white">
            AM
          </span>
          <span className="text-lg font-semibold text-white">AMS</span>
        </div>

        <nav className="mt-2 flex flex-col gap-1 px-3">
          {NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin).map(({ to, label, agentLabel, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive ? 'bg-primary-600 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`
              }
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              {isAdmin || !agentLabel ? label : agentLabel}
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  );
};

export default Sidebar;