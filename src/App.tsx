import React, { useState, useEffect } from 'react';
import { SavedProject, User } from './types';
import { getCurrentUser, getStoredUser, logoutApi } from './services/api';
import { NavigationSidebar } from './components/NavigationSidebar';
import { AuthView } from './components/AuthView';
import { Dashboard } from './components/Dashboard';
import { Menu, ArrowLeft, Layers, Box } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<
    'dashboard' | 'floorplan' | 'interior' | 'reconstruction' | '3d-studio' | 'auth'
  >('dashboard');
  const [authInitialMode, setAuthInitialMode] = useState<'login' | 'signup'>('login');
  const [mobileOpen, setMobileOpen] = useState<boolean>(false);

  // Saved projects will be wired up once the projects API lands
  const [projects] = useState<SavedProject[]>([]);

  useEffect(() => {
    let isMounted = true;

    const stored = getStoredUser();
    if (stored) {
      setCurrentUser(stored);
    }

    const initSession = async () => {
      try {
        const user = await getCurrentUser();
        if (isMounted) {
          if (user) {
            setCurrentUser(user);
          } else if (!stored) {
            setCurrentUser(null);
          }
        }
      } catch (err) {
        console.log('[INTERIO Session] Session notice:', err);
      }
    };

    initSession();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleAuthSuccess = (user: User) => {
    setCurrentUser(user);
    setActiveTab('dashboard');
  };

  const handleLogout = async () => {
    await logoutApi();
    setCurrentUser(null);
    setActiveTab('auth');
    setAuthInitialMode('login');
  };

  const openAuthWithMode = (mode: 'login' | 'signup' = 'login') => {
    setAuthInitialMode(mode);
    setActiveTab('auth');
  };

  if (activeTab === 'auth') {
    return (
      <AuthView
        onAuthSuccess={handleAuthSuccess}
        onCancel={() => setActiveTab('dashboard')}
        initialMode={authInitialMode}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#fafaf9] text-stone-900 font-sans antialiased flex flex-col selection:bg-stone-900 selection:text-white">
      <NavigationSidebar
        currentView={activeTab}
        onNavigate={(tab) => {
          setActiveTab(tab as any);
          setMobileOpen(false);
        }}
        user={currentUser}
        onLogout={handleLogout}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        onOpenAuth={openAuthWithMode}
      />

      <div className="flex-1 flex flex-col lg:pl-64 min-w-0">
        <header className="sticky top-0 z-30 h-16 bg-white/80 backdrop-blur-md border-b border-stone-200/70 px-4 sm:px-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 rounded-lg text-stone-600 hover:text-stone-900 hover:bg-stone-100 transition-colors"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('dashboard')}
              className="lg:hidden flex items-center gap-2 text-left cursor-pointer"
              title="Return to Dashboard"
            >
              <div className="w-7 h-7 rounded-lg bg-stone-900 flex items-center justify-center text-white">
                <Layers className="w-4 h-4" />
              </div>
              <span className="font-semibold text-sm tracking-tight text-stone-900">INTERIO</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {activeTab !== 'dashboard' && (
              <button
                type="button"
                onClick={() => setActiveTab('dashboard')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-medium transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Dashboard</span>
              </button>
            )}

            {currentUser ? (
              <div className="flex items-center gap-2 pl-2 sm:border-l sm:border-stone-200">
                <div className="w-7 h-7 rounded-full bg-stone-900 text-white flex items-center justify-center font-medium text-xs">
                  {((currentUser.name || currentUser.email || 'A').trim().charAt(0) || 'A').toUpperCase()}
                </div>
                <span className="hidden md:inline-block text-xs font-medium text-stone-800">
                  {currentUser.name || currentUser.email?.split('@')[0]}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 pl-2 sm:border-l sm:border-stone-200">
                <button
                  type="button"
                  onClick={() => openAuthWithMode('login')}
                  className="px-2.5 py-1.5 text-xs font-medium text-stone-600 hover:text-stone-900 rounded-lg transition-colors"
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => openAuthWithMode('signup')}
                  className="px-3 py-1.5 text-xs font-medium bg-stone-900 hover:bg-stone-800 text-white rounded-lg transition-colors"
                >
                  Sign Up
                </button>
              </div>
            )}
          </div>
        </header>

        <main className="flex-1">
          {activeTab === 'dashboard' && (
            <Dashboard
              user={currentUser}
              projects={projects}
              onNavigateWorkflow={(wf) => setActiveTab(wf)}
              onOpenProject={() => {}}
              onDeleteProject={() => {}}
              onOpen3D={() => setActiveTab('3d-studio')}
              onSelectStylePreset={() => setActiveTab('interior')}
              onOpenAuth={openAuthWithMode}
            />
          )}

          {activeTab !== 'dashboard' && (
            <div className="flex items-center justify-center py-24 text-sm text-stone-400">
              <div className="flex items-center gap-2">
                <Box className="w-4 h-4" />
                <span>This workflow is still under construction.</span>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
