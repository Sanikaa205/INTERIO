import React from 'react';
import {
  Home,
  Compass,
  Palette,
  ScanLine,
  FolderKanban,
  Box,
  LogOut,
  X,
  Layers,
  LogIn,
  UserPlus,
} from 'lucide-react';
import { User } from '../types';

interface NavigationSidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  user: User | null;
  onLogout: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onOpenAuth: (initialMode?: 'login' | 'signup') => void;
}

export const NavigationSidebar: React.FC<NavigationSidebarProps> = ({
  currentView,
  onNavigate,
  user,
  onLogout,
  mobileOpen,
  onCloseMobile,
  onOpenAuth,
}) => {
  const navItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: Home,
    },
    {
      id: 'floorplan',
      label: 'CAD Floor Plans',
      icon: Compass,
    },
    {
      id: 'interior',
      label: 'Interior Design',
      icon: Palette,
    },
    {
      id: 'reconstruction',
      label: 'Room Renovation',
      icon: ScanLine,
    },
    {
      id: '3d-studio',
      label: '3D Studio',
      icon: Box,
    },
    {
      id: 'saved-projects',
      label: 'Saved Projects',
      icon: FolderKanban,
    },
  ];

  const handleItemClick = (id: string) => {
    if (id === 'saved-projects') {
      onNavigate('dashboard');
      setTimeout(() => {
        const el = document.getElementById('projects-section');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    } else {
      onNavigate(id);
    }
    onCloseMobile();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-stone-900/30 backdrop-blur-xs z-40 lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-[#fafaf9] border-r border-stone-200/70 flex flex-col transition-transform duration-200 ease-out lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 px-5 flex items-center justify-between border-b border-stone-200/60">
          <button
            type="button"
            className="flex items-center gap-2.5 text-left cursor-pointer group"
            onClick={() => handleItemClick('dashboard')}
            title="Return to Dashboard"
          >
            <div className="w-8 h-8 rounded-lg bg-stone-900 flex items-center justify-center text-white transition-opacity group-hover:opacity-90">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <span className="font-semibold text-sm tracking-tight text-stone-900 block leading-none">
                INTERIO
              </span>
              <span className="text-[11px] text-stone-500 font-normal block mt-0.5">
                Architecture & Design
              </span>
            </div>
          </button>

          <button
            onClick={onCloseMobile}
            className="lg:hidden p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation List */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          <div className="px-2.5 pb-2">
            <span className="text-[11px] font-medium text-stone-600 tracking-wider">
              Studio
            </span>
          </div>

          <nav className="space-y-0.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id;
              return (
                <button
                  key={item.id}
                  id={`nav-btn-${item.id}`}
                  onClick={() => handleItemClick(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-colors text-left ${
                    isActive
                      ? 'bg-stone-900 text-white shadow-2xs'
                      : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/50'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? 'text-white' : 'text-stone-400 group-hover:text-stone-600'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer / User Profile & Auth Access */}
        <div className="p-3 border-t border-stone-200/60 bg-[#fafaf9]">
          {user && typeof user === 'object' && (user.name || user.email) ? (
            <div className="flex items-center justify-between gap-2 p-1.5 rounded-xl hover:bg-stone-100/60 transition-colors">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-stone-900 text-white flex items-center justify-center font-medium text-xs shrink-0">
                  {((user.name || user.email || 'A').trim().charAt(0) || 'A').toUpperCase()}
                </div>
                <div className="truncate">
                  <p className="text-xs font-medium text-stone-900 truncate">
                    {user.name || user.email?.split('@')[0] || 'Architect'}
                  </p>
                  <p className="text-[11px] text-stone-600 truncate">
                    {user.email || 'architect@interio.design'}
                  </p>
                </div>
              </div>

              <button
                id="btn-sidebar-logout"
                onClick={onLogout}
                title="Log Out"
                className="p-1.5 text-stone-600 hover:text-stone-900 hover:bg-stone-200/50 rounded-lg transition-colors shrink-0"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="space-y-1.5 p-1">
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  id="btn-sidebar-login"
                  onClick={() => onOpenAuth('login')}
                  className="py-1.5 px-2 bg-white hover:bg-stone-50 text-stone-700 border border-stone-200/90 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5"
                >
                  <LogIn className="w-3.5 h-3.5 text-stone-400" />
                  <span>Sign In</span>
                </button>
                <button
                  id="btn-sidebar-signup"
                  onClick={() => onOpenAuth('signup')}
                  className="py-1.5 px-2 bg-stone-900 hover:bg-stone-800 text-white text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Sign Up</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
