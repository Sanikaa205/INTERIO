import React, { useState, useEffect } from 'react';
import { FloorPlanResult, SavedProject, User, WorkflowType } from './types';
import {
  getCurrentUser,
  getStoredUser,
  fetchProjectsApi,
  saveProjectApi,
  deleteProjectApi,
  logoutApi,
} from './services/api';
import { NavigationSidebar } from './components/NavigationSidebar';
import { AuthView } from './components/AuthView';
import { Dashboard } from './components/Dashboard';
import { FloorPlanWorkflow } from './components/FloorPlanWorkflow';
import { Menu, ArrowLeft, Layers, Box, Check, X } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<
    'dashboard' | 'floorplan' | 'interior' | 'reconstruction' | '3d-studio' | 'auth'
  >('dashboard');
  const [authInitialMode, setAuthInitialMode] = useState<'login' | 'signup'>('login');
  const [mobileOpen, setMobileOpen] = useState<boolean>(false);

  const [projects, setProjects] = useState<SavedProject[]>([]);
  const [loadingProjects, setLoadingProjects] = useState<boolean>(false);

  // Active 3D Visualization Payload (rendered once the 3D Studio lands)
  const [active3DData, setActive3DData] = useState<FloorPlanResult | null>(null);
  const [active3DType, setActive3DType] = useState<'floorplan' | 'interior' | 'renovation'>('floorplan');
  const [active3DTitle, setActive3DTitle] = useState<string>('Parametric Design Studio');

  // Save Project Modal State
  const [saveModalOpen, setSaveModalOpen] = useState<boolean>(false);
  const [pendingSaveData, setPendingSaveData] = useState<{
    data: any;
    type: WorkflowType;
    defaultTitle: string;
  } | null>(null);
  const [saveTitle, setSaveTitle] = useState<string>('');
  const [saveDescription, setSaveDescription] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccessToast, setSaveSuccessToast] = useState<string | null>(null);

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
      } finally {
        if (isMounted) {
          loadProjects();
        }
      }
    };

    initSession();
    return () => {
      isMounted = false;
    };
  }, []);

  const loadProjects = async () => {
    setLoadingProjects(true);
    try {
      const projs = await fetchProjectsApi();
      setProjects(projs);
    } catch (err) {
      console.log('[INTERIO Projects] Project notice:', err);
    } finally {
      setLoadingProjects(false);
    }
  };

  const handleAuthSuccess = (user: User) => {
    setCurrentUser(user);
    setActiveTab('dashboard');
    loadProjects();
  };

  const handleDeleteProject = async (projectId: string) => {
    try {
      await deleteProjectApi(projectId);
      setProjects(projects.filter((p) => p.id !== projectId));
    } catch (err) {
      console.error('Failed to delete project', err);
    }
  };

  const handleViewFloorPlan3D = (result: FloorPlanResult) => {
    setActive3DData(result);
    setActive3DType('floorplan');
    setActive3DTitle(result.architecturalStyle || 'Floor Plan Blueprint');
    setActiveTab('3d-studio');
  };

  const triggerSaveFloorPlan = (result: FloorPlanResult) => {
    setPendingSaveData({
      data: result,
      type: 'floorplan',
      defaultTitle: `${result.plotWidth}x${result.plotLength}m ${result.architecturalStyle || 'Floor Plan'}`,
    });
    setSaveTitle(`${result.plotWidth}x${result.plotLength}m ${result.architecturalStyle || 'Floor Plan'}`);
    setSaveDescription(result.designNotes || `${result.rooms.length} room architectural layout.`);
    setSaveModalOpen(true);
  };

  const handleConfirmSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingSaveData) return;

    setIsSaving(true);
    try {
      const saved = await saveProjectApi({
        title: saveTitle.trim() || pendingSaveData.defaultTitle,
        type: pendingSaveData.type,
        description: saveDescription,
        data: pendingSaveData.data,
      });

      setProjects([saved, ...projects]);
      setSaveModalOpen(false);
      setSaveSuccessToast(`Saved "${saved.title}" successfully!`);
      setTimeout(() => setSaveSuccessToast(null), 3000);
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Failed to save project');
    } finally {
      setIsSaving(false);
    }
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
              onOpenProject={() => setActiveTab('3d-studio')}
              onDeleteProject={handleDeleteProject}
              onOpen3D={() => setActiveTab('3d-studio')}
              onSelectStylePreset={() => setActiveTab('interior')}
              onOpenAuth={openAuthWithMode}
            />
          )}

          {activeTab === 'floorplan' && (
            <FloorPlanWorkflow
              onView3D={handleViewFloorPlan3D}
              onSaveProject={triggerSaveFloorPlan}
              onBackToHome={() => setActiveTab('dashboard')}
            />
          )}

          {(activeTab === 'interior' || activeTab === 'reconstruction' || activeTab === '3d-studio') && (
            <div className="flex items-center justify-center py-24 text-sm text-stone-400">
              <div className="flex items-center gap-2">
                <Box className="w-4 h-4" />
                <span>This workflow is still under construction.</span>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Save Project Modal */}
      {saveModalOpen && (
        <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-stone-200/90 max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-stone-900">Save to Portfolio</h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Save your parameters, layout coordinates, and design notes.
                </p>
              </div>
              <button
                onClick={() => setSaveModalOpen(false)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmSave} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">Project Title</label>
                <input
                  type="text"
                  required
                  value={saveTitle}
                  onChange={(e) => setSaveTitle(e.target.value)}
                  placeholder="e.g. Modern Coastal Villa"
                  className="w-full px-3 py-2 bg-stone-50/50 border border-stone-200 rounded-lg text-xs font-medium text-stone-900 focus:bg-white focus:border-stone-900 outline-hidden transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">
                  Description / Design Notes
                </label>
                <textarea
                  rows={3}
                  value={saveDescription}
                  onChange={(e) => setSaveDescription(e.target.value)}
                  placeholder="Optional architectural or finish notes..."
                  className="w-full px-3 py-2 bg-stone-50/50 border border-stone-200 rounded-lg text-xs text-stone-900 focus:bg-white focus:border-stone-900 outline-hidden resize-none transition-colors"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSaveModalOpen(false)}
                  className="px-3.5 py-2 text-xs font-medium text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 text-xs font-medium text-white bg-stone-900 hover:bg-stone-800 disabled:bg-stone-300 rounded-lg transition-colors flex items-center gap-1.5"
                >
                  {isSaving ? 'Saving...' : 'Save Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Global Success Toast */}
      {saveSuccessToast && (
        <div className="fixed bottom-6 right-6 bg-stone-900 text-white px-4 py-2.5 rounded-full text-xs font-medium shadow-lg flex items-center gap-2 z-50">
          <Check className="w-3.5 h-3.5 text-emerald-400" />
          <span>{saveSuccessToast}</span>
        </div>
      )}
    </div>
  );
}
