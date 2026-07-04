import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { 
  Home, 
  Calendar, 
  ListTodo, 
  Users, 
  CalendarDays, 
  BellRing, 
  LogOut, 
  Menu, 
  X, 
  CalendarCheck
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getNavLinks = () => {
    if (!user) return [];
    
    switch (user.role) {
      case 'PATIENT':
        return [
          { name: 'Dashboard', path: '/patient', icon: Home },
          { name: 'Book Appointment', path: '/patient/book', icon: Calendar },
        ];
      case 'DOCTOR':
        return [
          { name: 'Daily Queue', path: '/doctor', icon: ListTodo },
          { name: 'Declare Leaves', path: '/doctor/leaves', icon: CalendarDays },
        ];
      case 'ADMIN':
        return [
          { name: 'Doctors CRUD', path: '/admin', icon: Users },
          { name: 'Leaves & Conflicts', path: '/admin/leaves', icon: CalendarDays },
          { name: 'Dead Letters', path: '/admin/dead-letters', icon: BellRing },
        ];
      default:
        return [];
    }
  };

  const navLinks = getNavLinks();

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950 text-surface-800 dark:text-surface-100 flex flex-col md:flex-row">
      {/* Mobile Top Navbar */}
      <header className="md:hidden flex items-center justify-between px-6 py-4 bg-white/70 dark:bg-surface-900/60 backdrop-blur-md border-b border-surface-200 dark:border-surface-800 sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🏥</span>
          <span className="font-bold text-lg text-primary-700 dark:text-primary-400">HealthConnect</span>
        </div>
        <button 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-1 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-md transition-colors"
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </header>

      {/* Sidebar - Desktop & Mobile overlay */}
      <aside className={`
        fixed inset-0 z-40 transform bg-white dark:bg-surface-900 border-r border-surface-200 dark:border-surface-800 w-64 md:w-68 flex flex-col justify-between p-6 transition-transform duration-300 md:translate-x-0 md:static md:inset-auto md:transform-none
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex flex-col gap-8">
          {/* Brand header */}
          <div className="hidden md:flex items-center gap-3">
            <span className="text-3xl">🏥</span>
            <div className="flex flex-col">
              <span className="font-bold text-lg leading-tight text-primary-700 dark:text-primary-400">HealthConnect</span>
              <span className="text-xs text-surface-500 font-medium">Care Management</span>
            </div>
          </div>

          {/* User Profile Info Card */}
          {user && (
            <div className="flex items-center gap-3 p-3 bg-surface-100 dark:bg-surface-800/50 rounded-xl">
              <div className="w-10 h-10 bg-primary-500 rounded-full flex items-center justify-center text-white font-bold shadow-sm">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-semibold text-sm truncate">{user.name}</span>
                <span className="text-[10px] uppercase font-bold tracking-wider text-primary-600 dark:text-primary-400 mt-0.5">
                  {user.role}
                </span>
              </div>
            </div>
          )}

          {/* Sidebar Nav Links */}
          <nav className="flex flex-col gap-1.5">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = location.pathname === link.path;
              return (
                <button
                  key={link.path}
                  onClick={() => {
                    navigate(link.path);
                    setMobileMenuOpen(false);
                  }}
                  className={`
                    w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200
                    ${isActive 
                      ? 'bg-primary-50 dark:bg-primary-950/40 text-primary-700 dark:text-primary-400 shadow-sm border-l-4 border-primary-600 dark:border-primary-500' 
                      : 'text-surface-600 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-800/40 hover:text-surface-800 dark:hover:text-surface-100'}
                  `}
                >
                  <Icon size={18} />
                  <span>{link.name}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Sidebar Action Items */}
        <div className="flex flex-col gap-4">
          {user && (user.role === 'PATIENT' || user.role === 'DOCTOR') && (
            <button
              onClick={() => {
                window.location.href = 'http://localhost:3000/auth/google/connect';
              }}
              className="w-full flex items-center gap-2 justify-center px-4 py-2.5 bg-white dark:bg-surface-850 hover:bg-surface-50 dark:hover:bg-surface-800 text-surface-700 dark:text-surface-300 border border-surface-200 dark:border-surface-800 rounded-lg text-xs font-semibold shadow-sm transition-all duration-200"
            >
              <CalendarCheck size={16} className="text-red-500" />
              <span>Connect Google Calendar</span>
            </button>
          )}

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 hover:text-red-750 transition-all duration-200"
          >
            <LogOut size={18} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-6 md:p-10 max-h-screen overflow-y-auto w-full">
        <div className="max-w-6xl mx-auto">
          {children}
        </div>
      </main>

      {/* Mobile Menu Backdrop */}
      {mobileMenuOpen && (
        <div 
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-30 bg-black/30 dark:bg-black/50 backdrop-blur-xs md:hidden"
        />
      )}
    </div>
  );
};

export default Layout;
