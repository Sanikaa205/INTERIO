import React, { useState } from 'react';
import {
  Compass,
  Palette,
  ScanLine,
  FolderKanban,
  Box,
  Trash2,
  ExternalLink,
  Search,
  Calendar,
  ArrowRight,
  X,
} from 'lucide-react';
import {
  SavedProject,
  User,
  WorkflowType,
  DesignStyle,
  FloorPlanResult,
  InteriorDesignResult,
  ReconstructionData,
} from '../types';

interface DashboardProps {
  user: User | null;
  projects: SavedProject[];
  onNavigateWorkflow: (workflow: 'floorplan' | 'interior' | 'reconstruction') => void;
  onOpenProject: (project: SavedProject) => void;
  onDeleteProject: (projectId: string) => void;
  onOpen3D: () => void;
  onSelectStylePreset?: (style: DesignStyle) => void;
  onOpenAuth?: (mode: 'login' | 'signup') => void;
}

// Curated Architectural Moods (Houzz / Architectural Digest style)
const CURATED_STYLES: {
  id: DesignStyle;
  name: string;
  subtitle: string;
  tag: string;
  image: string;
  description: string;
}[] = [
  {
    id: 'japandi',
    name: 'Japandi Organic Calm',
    subtitle: 'Wabi-sabi balance & light timber',
    tag: 'Trending 2026',
    image: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=800&q=80',
    description: 'Subtle tactile limewash, low-profile oak furniture, and harmonic ambient daylighting.',
  },
  {
    id: 'scandinavian',
    name: 'Nordic Scandinavian',
    subtitle: 'Airy brightness & cozy textiles',
    tag: 'Aspirational',
    image: 'https://images.unsplash.com/photo-1598928506311-c55ded91a20c?auto=format&fit=crop&w=800&q=80',
    description: 'Blonde birch woodwork, bouclé lounge chairs, and warm minimalist neutrals.',
  },
  {
    id: 'modern',
    name: 'Modern Architectural',
    subtitle: 'Geometric lines & clean contrast',
    tag: 'Luxury Modern',
    image: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=800&q=80',
    description: 'Floor-to-ceiling panoramic glass, monolithic stone islands, and architectural recessed lighting.',
  },
  {
    id: 'industrial',
    name: 'Urban Loft Atelier',
    subtitle: 'Patinated leather & matte steel',
    tag: 'Metropolitan',
    image: 'https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=800&q=80',
    description: 'Warm reclaimed brickwork, matte black iron mullions, and cognac leather accent seating.',
  },
];

export const Dashboard: React.FC<DashboardProps> = ({
  user,
  projects,
  onNavigateWorkflow,
  onOpenProject,
  onDeleteProject,
  onOpen3D,
  onSelectStylePreset,
  onOpenAuth,
}) => {
  const [activeFilter, setActiveFilter] = useState<'all' | WorkflowType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [projectToDelete, setProjectToDelete] = useState<SavedProject | null>(null);

  // Filter projects
  const filteredProjects = projects.filter((p) => {
    const matchesFilter = activeFilter === 'all' || p.type === activeFilter;
    const matchesSearch =
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const getBadgeStyle = (type: WorkflowType) => {
    switch (type) {
      case 'floorplan':
        return 'bg-blue-50 text-blue-800 border-blue-200/80';
      case 'interior':
        return 'bg-amber-50 text-amber-800 border-amber-200/80';
      case 'renovation':
        return 'bg-purple-50 text-purple-800 border-purple-200/80';
    }
  };

  const getBadgeLabel = (type: WorkflowType) => {
    switch (type) {
      case 'floorplan':
        return 'CAD Floor Plan';
      case 'interior':
        return 'Interior Curation';
      case 'renovation':
        return 'Room Renovation';
    }
  };

  // Render a miniature top-down blueprint SVG from the project's own saved
  // geometry (room rectangles or furniture layout) instead of a stock photo.
  const renderProjectThumbnail = (project: SavedProject) => {
    if (project.type === 'floorplan') {
      const plan = project.data as FloorPlanResult;
      const w = plan.plotWidth || 10;
      const l = plan.plotLength || 10;

      return (
        <svg
          viewBox={`-0.4 -0.4 ${w + 0.8} ${l + 0.8}`}
          preserveAspectRatio="xMidYMid slice"
          className="w-full h-full"
        >
          <rect x={0} y={0} width={w} height={l} fill="#fafaf9" stroke="#d6d3d1" strokeWidth={0.12} />
          {plan.rooms?.map((room) => (
            <rect
              key={room.id}
              x={room.x}
              y={room.y}
              width={room.width}
              height={room.height}
              fill={room.color || '#a8a29e'}
              fillOpacity={0.4}
              stroke={room.color || '#78716c'}
              strokeWidth={0.06}
            />
          ))}
        </svg>
      );
    }

    // Interior or renovation projects: draw the room + furniture footprint.
    const interiorData: InteriorDesignResult | undefined =
      project.type === 'interior'
        ? (project.data as InteriorDesignResult)
        : (project.data as ReconstructionData).renovationDesign;

    const dims = (project.data as ReconstructionData).estimatedDimensions;
    const w = interiorData?.roomWidth || dims?.width || 6;
    const l = interiorData?.roomLength || dims?.length || 7;
    const wallColor = interiorData?.colorPalette?.find((c) => c.role === 'wall')?.hex || '#f5f5f4';
    const floorColor = interiorData?.colorPalette?.find((c) => c.role === 'flooring')?.hex || '#e7e5e4';

    return (
      <svg
        viewBox={`-0.3 -0.3 ${w + 0.6} ${l + 0.6}`}
        preserveAspectRatio="xMidYMid slice"
        className="w-full h-full"
      >
        <rect x={-0.3} y={-0.3} width={w + 0.6} height={l + 0.6} fill={wallColor} />
        <rect x={0} y={0} width={w} height={l} fill={floorColor} />
        {interiorData?.furniture?.map((item) => (
          <rect
            key={item.id}
            x={item.x}
            y={item.y}
            width={item.width}
            height={item.depth}
            rx={0.05}
            fill={item.color || '#78716c'}
            transform={
              item.rotation
                ? `rotate(${item.rotation}, ${item.x + item.width / 2}, ${item.y + item.depth / 2})`
                : undefined
            }
          />
        ))}
        {!interiorData && (
          <rect
            x={0.4}
            y={0.4}
            width={Math.max(0.1, w - 0.8)}
            height={Math.max(0.1, l - 0.8)}
            fill="none"
            stroke="#a8a29e"
            strokeDasharray="0.15,0.1"
            strokeWidth={0.08}
          />
        )}
      </svg>
    );
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 space-y-12">
      {/* 1. HERO SECTION - Single calm focal point */}
      <div className="relative rounded-2xl overflow-hidden bg-stone-900 aspect-[2/1] sm:aspect-[2.4/1] max-h-[380px] flex items-end">
        <img
          src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=2000&q=85"
          alt="Modern Architectural Interior"
          className="absolute inset-0 w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-stone-950/85 via-stone-950/40 to-transparent" />

        <div className="relative z-10 p-6 sm:p-10 max-w-2xl text-white">
          <p className="text-xs font-medium text-stone-300 tracking-wider mb-2">
            Architectural Studio
          </p>
          <h1 className="text-2xl sm:text-4xl font-semibold tracking-tight leading-tight mb-2">
            Design spaces with clarity and precision.
          </h1>
          <p className="text-xs sm:text-sm text-stone-300 leading-relaxed mb-6 font-light max-w-xl">
            {user && user.name ? `Welcome back, ${user.name}. ` : ''}
            Plan 2D CAD floor layouts, curate interior palettes, and renovate existing spaces in interactive 3D.
          </p>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              id="btn-hero-workflow-floorplan"
              onClick={() => onNavigateWorkflow('floorplan')}
              className="px-4 py-2 bg-white hover:bg-stone-100 text-stone-900 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Compass className="w-3.5 h-3.5" />
              <span>New Floor Plan</span>
            </button>

            <button
              id="btn-hero-workflow-interior"
              onClick={() => onNavigateWorkflow('interior')}
              className="px-4 py-2 bg-white/15 hover:bg-white/25 backdrop-blur-sm text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Palette className="w-3.5 h-3.5" />
              <span>Interior Design</span>
            </button>

            <button
              id="btn-hero-open-3d"
              onClick={onOpen3D}
              className="px-3.5 py-2 bg-black/40 hover:bg-black/60 border border-white/20 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Box className="w-3.5 h-3.5" />
              <span>3D Studio</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. PRIMARY WORKFLOWS - Clean 3-Card Grid */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-stone-900 tracking-tight">
            Workflows
          </h2>
          <p className="text-xs text-stone-500">
            Select a specialized tool to begin designing.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Floor Plan */}
          <div
            id="card-workflow-floorplan"
            onClick={() => onNavigateWorkflow('floorplan')}
            className="group bg-white rounded-2xl border border-stone-200/80 hover:border-stone-400 transition-all duration-200 cursor-pointer overflow-hidden flex flex-col justify-between"
          >
            <div className="aspect-[16/10] overflow-hidden bg-stone-100">
              <img
                src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80"
                alt="Empty Plot CAD Blueprint"
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-102"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="p-5 flex-1 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-semibold text-stone-900 mb-1">
                  CAD Floor Plans
                </h3>
                <p className="text-xs text-stone-500 leading-relaxed">
                  Generate non-overlapping 2D layouts from plot dimensions and room specifications.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between text-xs font-medium text-stone-900">
                <span>Start Blueprint</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>
          </div>

          {/* Card 2: Interior */}
          <div
            id="card-workflow-interior"
            onClick={() => onNavigateWorkflow('interior')}
            className="group bg-white rounded-2xl border border-stone-200/80 hover:border-stone-400 transition-all duration-200 cursor-pointer overflow-hidden flex flex-col justify-between"
          >
            <div className="aspect-[16/10] overflow-hidden bg-stone-100">
              <img
                src="https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=800&q=80"
                alt="Interior Design Curation"
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-102"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="p-5 flex-1 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-semibold text-stone-900 mb-1">
                  Interior Design
                </h3>
                <p className="text-xs text-stone-500 leading-relaxed">
                  Curate harmonic 5-color palettes, furniture layouts, and ambient lighting strategies.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between text-xs font-medium text-stone-900">
                <span>Curate Style</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>
          </div>

          {/* Card 3: Renovation */}
          <div
            id="card-workflow-reconstruction"
            onClick={() => onNavigateWorkflow('reconstruction')}
            className="group bg-white rounded-2xl border border-stone-200/80 hover:border-stone-400 transition-all duration-200 cursor-pointer overflow-hidden flex flex-col justify-between"
          >
            <div className="aspect-[16/10] overflow-hidden bg-stone-100">
              <img
                src="https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?auto=format&fit=crop&w=800&q=80"
                alt="Room Renovation"
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-102"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="p-5 flex-1 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-semibold text-stone-900 mb-1">
                  Room Renovation
                </h3>
                <p className="text-xs text-stone-500 leading-relaxed">
                  Upload a photo, adjust 4 corner markers for perspective, and receive renovation specs.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between text-xs font-medium text-stone-900">
                <span>Renovate Space</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. CURATED AESTHETICS - Consistent 4-column grid */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-stone-900 tracking-tight">
            Curated Aesthetics
          </h2>
          <p className="text-xs text-stone-500">
            Select a design style to pre-populate your interior proposal.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {CURATED_STYLES.map((style) => (
            <div
              key={style.id}
              onClick={() => {
                if (onSelectStylePreset) {
                  onSelectStylePreset(style.id);
                }
                onNavigateWorkflow('interior');
              }}
              className="group bg-white rounded-2xl overflow-hidden border border-stone-200/80 hover:border-stone-400 transition-all duration-200 cursor-pointer flex flex-col justify-between"
            >
              <div className="aspect-[4/3] overflow-hidden bg-stone-100">
                <img
                  src={style.image}
                  alt={style.name}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-102"
                  referrerPolicy="no-referrer"
                />
              </div>

              <div className="p-4 flex-1 flex flex-col justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-stone-900">
                    {style.name}
                  </h4>
                  <p className="text-[11px] text-stone-500 mt-0.5 font-normal">
                    {style.subtitle}
                  </p>
                  <p className="text-xs text-stone-500 mt-2 line-clamp-2 leading-relaxed">
                    {style.description}
                  </p>
                </div>

                <div className="mt-3 pt-2.5 border-t border-stone-100 flex items-center justify-between text-xs font-medium text-stone-900">
                  <span>Select style</span>
                  <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 4. SAVED PROJECTS PORTFOLIO */}
      <section id="projects-section" className="space-y-4 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-stone-900 tracking-tight">
              Projects
            </h2>
            <p className="text-xs text-stone-500">
              {projects.length === 1 ? '1 saved project' : `${projects.length} saved projects`}
            </p>
          </div>

          {/* Search & Filter Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search projects..."
                className="pl-8 pr-3 py-1.5 bg-white border border-stone-200 rounded-lg text-xs text-stone-800 placeholder:text-stone-400 focus:border-stone-900 outline-hidden w-44 sm:w-56 transition-colors"
              />
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center p-0.5 bg-stone-100 rounded-lg text-xs font-medium">
              {(['all', 'floorplan', 'interior', 'renovation'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setActiveFilter(filter)}
                  className={`px-2.5 py-1 rounded-md capitalize transition-colors ${
                    activeFilter === filter
                      ? 'bg-white text-stone-900 shadow-2xs font-semibold'
                      : 'text-stone-500 hover:text-stone-900'
                  }`}
                >
                  {filter === 'all' ? 'All' : filter}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Projects Grid */}
        {filteredProjects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProjects.map((project) => (
              <div
                key={project.id}
                className="bg-white rounded-2xl border border-stone-200/80 hover:border-stone-400 transition-all duration-200 flex flex-col justify-between overflow-hidden group"
              >
                {/* Visual Thumbnail: real SVG blueprint from the project's own data */}
                <div className="relative aspect-[16/9] overflow-hidden bg-stone-100">
                  <div className="w-full h-full transition-transform duration-300 group-hover:scale-102">
                    {renderProjectThumbnail(project)}
                  </div>
                  <div className="absolute top-2.5 left-2.5">
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-white/90 backdrop-blur-xs text-stone-800 border border-stone-200/60 shadow-2xs">
                      {getBadgeLabel(project.type)}
                    </span>
                  </div>

                  <div className="absolute bottom-2 right-2.5 text-[10px] text-white/90 flex items-center gap-1 font-medium drop-shadow-xs">
                    <Calendar className="w-3 h-3" />
                    {new Date(project.createdAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </div>
                </div>

                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-stone-900">
                      {project.title}
                    </h4>

                    <p className="text-xs text-stone-500 mt-1 line-clamp-2 leading-relaxed">
                      {project.description || 'Architectural project.'}
                    </p>
                  </div>

                  {/* Project Actions */}
                  <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between">
                    <button
                      onClick={() => onOpenProject(project)}
                      className="text-xs font-medium text-stone-900 hover:text-stone-600 inline-flex items-center gap-1 transition-colors"
                    >
                      <span>Open in 3D</span>
                      <ExternalLink className="w-3 h-3 text-stone-400" />
                    </button>

                    <button
                      onClick={() => setProjectToDelete(project)}
                      className="p-1 text-stone-400 hover:text-stone-700 rounded-md transition-colors"
                      title="Delete Project"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Clean Empty State */
          <div className="rounded-2xl border border-dashed border-stone-200 bg-white p-10 text-center space-y-3">
            <div className="w-12 h-12 rounded-xl bg-stone-100 flex items-center justify-center mx-auto text-stone-500">
              <FolderKanban className="w-6 h-6" />
            </div>
            <div className="max-w-sm mx-auto">
              <h4 className="text-sm font-semibold text-stone-900">
                No saved projects
              </h4>
              <p className="text-xs text-stone-500 mt-0.5 leading-relaxed">
                Generate a CAD floor plan, curate an interior layout, or renovate a room to save your progress here.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => onNavigateWorkflow('floorplan')}
                className="px-3.5 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
              >
                <Compass className="w-3.5 h-3.5" />
                <span>Create Floor Plan</span>
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Delete Confirmation Modal */}
      {projectToDelete && (
        <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-stone-200 max-w-sm w-full p-6 shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-stone-900">
                Delete Project?
              </h3>
              <button
                onClick={() => setProjectToDelete(null)}
                className="p-1 rounded-md text-stone-400 hover:text-stone-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-stone-500 leading-relaxed">
              Are you sure you want to delete <span className="font-medium text-stone-800">"{projectToDelete.title}"</span>?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setProjectToDelete(null)}
                className="px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onDeleteProject(projectToDelete.id);
                  setProjectToDelete(null);
                }}
                className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
