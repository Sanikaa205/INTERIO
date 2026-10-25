import React, { Component, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { ArrowLeft, BookmarkPlus, Home, Paintbrush } from 'lucide-react';
import { FloorPlanResult } from '../../types';
import { buildHouseModel } from './model/buildHouseModel';
import { Floors } from './Floors';
import { Walls } from './Walls';
import { Doors } from './Doors';
import { Windows } from './Windows';
import { Ceilings } from './Ceilings';
import { CameraRig, type CameraRigHandle } from './CameraRig';
import { RoomLabels } from './RoomLabels';
import { Lighting } from './Lighting';
import { Toolbar } from './Toolbar';
import { exportHouseGlb } from './exportGlb';
import { Walkthrough } from './Walkthrough';
import { VirtualJoystick } from './VirtualJoystick';
import { useWalkInput, type WalkInput } from './useWalkInput';
import { useContainerSize } from './useContainerSize';
import { BottomSheet } from './BottomSheet';
import { FallbackNotice } from './FallbackNotice';
import { isWebGLAvailable } from './webgl';
import { RendererDiagnostics } from './RendererDiagnostics';
import type { SelectedSurface } from './finishTypes';
import { resetSurfaceFinish, setSurfaceFinish } from './finishUpdates';
import type { SurfaceFinish } from '../../types';
import { DesignPanel, DesignPanelTrigger } from './DesignPanel';
import { ViewControls } from './ViewControls';

interface FloorPlan3DProps {
  plan: FloorPlanResult;
  title: string;
  onBack: () => void;
  onBackToHome: () => void;
  onSaveProject: () => void;
  onPlanChange: (plan: FloorPlanResult) => void;
}

class CanvasErrorBoundary extends Component<{ children: React.ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError(): { failed: boolean } { return { failed: true }; }
  componentDidCatch(): void { this.props.onError(); }
  render(): React.ReactNode { return this.state.failed ? null : this.props.children; }
}

export const FloorPlan3D: React.FC<FloorPlan3DProps> = ({
  plan,
  title,
  onBack,
  onBackToHome,
  onSaveProject,
  onPlanChange,
}) => {
  const [showCeilings, setShowCeilings] = useState(false);
  const [cutaway, setCutaway] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [night, setNight] = useState(false);
  const [focusedRoomId, setFocusedRoomId] = useState<string | null>(null);
  const [selectedSurface, setSelectedSurface] = useState<SelectedSurface | null>(null);
  const [resetToken, setResetToken] = useState(0);
  const [exportError, setExportError] = useState<string | null>(null);
  const [mode, setMode] = useState<'orbit' | 'walk'>('orbit');
  const [showWalkHint, setShowWalkHint] = useState(false);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [webglFailed, setWebglFailed] = useState(() => !isWebGLAvailable());
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  // 2.1 — "Design" panel visibility; always toggleable, not dependent on 3D click
  const [editorOpen, setEditorOpen] = useState(false);
  const size = useContainerSize(container);
  const isSmall = size.width > 0 && size.width < 820;
  const [contextLost, setContextLost] = useState(false);
  const inputRef = useRef<WalkInput>({ forward: 0, strafe: 0, run: false });
  const orbitSettings = useRef({ ceilings: false, cutaway: false });
  const houseRef = useRef<THREE.Group>(null);
  // 2.4 — Camera rig imperative handle
  const cameraRigRef = useRef<CameraRigHandle>(null);

  // 1.1 — Memoize geometry on geometry inputs only (rooms + plot size), so
  // finish edits (which only change plan.finishes) do not rebuild the model.
  const geometryKey = useMemo(
    () => JSON.stringify({ rooms: plan.rooms, circulation: plan.circulation, plotWidth: plan.plotWidth, plotLength: plan.plotLength }),
    [plan.rooms, plan.circulation, plan.plotWidth, plan.plotLength],
  );
  const model = useMemo(() => buildHouseModel(plan), [geometryKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const wallIds = useMemo(() => model.walls.map((wall) => wall.id), [model]);

  const resetView = () => {
    setFocusedRoomId(null);
    setSelectedSurface(null);
    setResetToken((value) => value + 1);
  };
  const exportGlb = async () => {
    if (!houseRef.current) return;
    try {
      setExportError(null);
      await exportHouseGlb(houseRef.current);
    } catch {
      setExportError('Unable to export the floor plan. Please try again.');
    }
  };
  const changeSelectedFinish = (finish: SurfaceFinish) => {
    if (!selectedSurface) return;
    onPlanChange(setSurfaceFinish(plan, selectedSurface, finish, wallIds));
  };
  const resetSelectedFinish = () => {
    if (!selectedSurface) return;
    onPlanChange(resetSurfaceFinish(plan, selectedSurface, wallIds));
  };
  useWalkInput(inputRef, mode === 'walk');
  const enterWalk = () => {
    orbitSettings.current = { ceilings: showCeilings, cutaway };
    setShowCeilings(true);
    setCutaway(false);
    setShowWalkHint(true);
    setMode('walk');
    // 2.2 — close design panel in walk mode
    setEditorOpen(false);
    window.setTimeout(() => setShowWalkHint(false), 4000);
  };
  const exitWalk = () => {
    setMode('orbit');
    setShowCeilings(orbitSettings.current.ceilings);
    setCutaway(orbitSettings.current.cutaway);
  };
  useEffect(() => {
    if (!container) return;
    const lost = () => {
      setContextLost(true);
      setWebglFailed(true);
    };
    container.addEventListener('webglcontextlost', lost);
    return () => container.removeEventListener('webglcontextlost', lost);
  }, [container]);
  useEffect(() => {
    if (!showCeilings && selectedSurface?.kind === 'room-ceiling') {
      setSelectedSurface(null);
    }
  }, [showCeilings, selectedSurface]);

  // 2.3 — Keep DesignPanel in sync: when a surface is selected in 3D, open the panel
  const handleSelectSurface = (surface: SelectedSurface) => {
    setSelectedSurface(surface);
    if (!editorOpen) setEditorOpen(true);
  };

  return (
    // 2.2 — flex column: canvas flex-1, panel below (docked, not overlapping)
    <div className="relative w-full h-[calc(100vh-5rem)] flex flex-col bg-slate-950 overflow-hidden select-none">
      {/* Top Floating Control Bar */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none z-10">
        {/* Left: Back & Project Title */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            id="btn-fp3d-home"
            onClick={onBackToHome}
            className="px-3 py-1.5 rounded-lg bg-stone-900/90 hover:bg-stone-800 text-stone-200 text-xs font-medium flex items-center gap-1.5 backdrop-blur-md transition-colors border border-stone-800"
            title="Return to Home Dashboard"
          >
            <Home className="w-3.5 h-3.5" />
            <span>Home</span>
          </button>

          <button
            id="btn-fp3d-back"
            onClick={onBack}
            className="px-3 py-1.5 rounded-lg bg-stone-900/90 hover:bg-stone-800 text-stone-200 text-xs font-medium flex items-center gap-1.5 backdrop-blur-md transition-colors border border-stone-800"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </button>

          <div className="px-3 py-1.5 rounded-lg bg-stone-900/90 text-white border border-stone-800 backdrop-blur-md flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <div>
              <p className="text-xs font-medium text-stone-200 leading-none">{title}</p>
              <p className="text-[10px] text-stone-400 mt-0.5">
                Floor Plan ({plan.plotWidth}m × {plan.plotLength}m · {plan.rooms.length} Rooms)
              </p>
            </div>
          </div>
        </div>

        {/* Right: Design button (2.1) + Save */}
        <div className="flex items-center gap-1.5 pointer-events-auto">
          {/* 2.1 — "Design" button always visible in top bar */}
          {!isSmall && (
            <button
              id="btn-design-toggle"
              aria-pressed={editorOpen}
              onClick={() => setEditorOpen((v) => !v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 backdrop-blur-md transition-all border ${
                editorOpen
                  ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                  : 'bg-stone-900/90 hover:bg-stone-800 text-stone-200 border-stone-800'
              }`}
              title={editorOpen ? 'Close Design Panel' : 'Open Design Panel'}
            >
              <Paintbrush className="w-3.5 h-3.5" />
              <span>Design</span>
            </button>
          )}
          <button
            id="btn-fp3d-save"
            onClick={onSaveProject}
            className="px-3 py-1.5 rounded-lg bg-stone-900/90 hover:bg-stone-800 text-stone-200 text-xs font-medium flex items-center gap-1.5 backdrop-blur-md transition-colors border border-stone-800"
            title="Save Project"
          >
            <BookmarkPlus className="w-3.5 h-3.5" />
            <span>Save</span>
          </button>
        </div>
      </div>

      {/* 3D Canvas — flex-1 so it gives space to the panel below */}
      <div ref={setContainer} className="relative w-full flex-1 min-h-[320px] rounded-lg" style={{ touchAction: 'none' }} onDoubleClick={resetView}>
        <Toolbar
          showCeilings={showCeilings}
          cutaway={cutaway}
          labels={showLabels}
          night={night}
          onCeilings={() => setShowCeilings((visible) => !visible)}
          onCutaway={() => setCutaway((visible) => !visible)}
          onLabels={() => setShowLabels((visible) => !visible)}
          onNight={() => setNight((value) => !value)}
          onReset={resetView}
          onExport={exportGlb}
          mode={mode}
          onWalk={enterWalk}
          onExitWalk={exitWalk}
          isSmall={isSmall}
          onOpenControls={() => setControlsOpen(true)}
        />
        <BottomSheet
          open={controlsOpen && isSmall}
          onClose={() => setControlsOpen(false)}
          showCeilings={showCeilings}
          cutaway={cutaway}
          labels={showLabels}
          night={night}
          mode={mode}
          onCeilings={() => setShowCeilings((visible) => !visible)}
          onCutaway={() => setCutaway((visible) => !visible)}
          onLabels={() => setShowLabels((visible) => !visible)}
          onNight={() => setNight((value) => !value)}
          onReset={resetView}
          onExport={exportGlb}
          onWalk={enterWalk}
          onExitWalk={exitWalk}
          // 2.1 — Design button in bottom sheet for small screens
          editorOpen={editorOpen}
          onDesign={() => { setEditorOpen((v) => !v); setControlsOpen(false); }}
        />
        {mode === 'walk' && showWalkHint && <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 rounded-lg bg-stone-900/85 px-4 py-2 text-center text-xs text-white pointer-events-none">WASD to move · drag/mouse to look · Esc to exit</div>}
        {mode === 'walk' && isSmall && <button className="absolute right-3 top-3 z-20 min-h-11 rounded-lg bg-stone-900/90 px-4 text-sm font-medium text-white shadow-lg" onClick={exitWalk}>Exit walk</button>}
        {mode === 'walk' && <VirtualJoystick inputRef={inputRef} />}
        {exportError && <div className="absolute bottom-3 left-3 z-10 rounded bg-red-900/90 px-3 py-1.5 text-xs text-red-100">{exportError}</div>}
        {/* 2.4 — View controls */}
        {mode === 'orbit' && <ViewControls cameraRef={cameraRigRef} />}
        {webglFailed ? <FallbackNotice onBack={onBack} onRetry={() => { setContextLost(false); setWebglFailed(!isWebGLAvailable()); }} /> : <CanvasErrorBoundary onError={() => setWebglFailed(true)}>
        <Canvas frameloop={mode === 'walk' ? 'always' : 'demand'} dpr={[1, Math.min(typeof window === 'undefined' ? 1 : window.devicePixelRatio, isSmall ? 1.5 : 2)]} gl={{ antialias: !isSmall, powerPreference: 'high-performance' }} camera={{ fov: 50 }} onPointerMissed={resetView}>
          <color attach="background" args={[night ? '#07101f' : '#b9d9f2']} />
          <RendererDiagnostics />
          <Lighting model={model} night={night} isSmall={isSmall} />
          <group ref={houseRef} onClick={(event) => event.stopPropagation()}>
            <Floors model={model} finishes={plan.finishes} focusedRoomId={focusedRoomId} selectedSurface={selectedSurface} onFocus={setFocusedRoomId} onSelectSurface={handleSelectSurface} onClearFocus={resetView} />
            <Walls model={model} cutaway={cutaway} finishes={plan.finishes} selectedSurface={selectedSurface} onSelectSurface={handleSelectSurface} />
            <Doors model={model} />
            <Windows model={model} />
            {showCeilings && <Ceilings model={model} finishes={plan.finishes} selectedSurface={selectedSurface} onSelectSurface={handleSelectSurface} />}
          </group>
          {showLabels && <RoomLabels model={model} />}
          <CameraRig ref={cameraRigRef} model={model} focusedRoomId={focusedRoomId} resetToken={resetToken} enabled={mode === 'orbit'} onInteraction={() => {}} />
          {mode === 'walk' && <Walkthrough model={model} inputRef={inputRef} onExit={exitWalk} />}
        </Canvas>
        </CanvasErrorBoundary>}
      </div>

      {/* 2.2 — Docked DesignPanel below canvas (not overlapping, shrinks canvas) */}
      {mode !== 'walk' && (
        editorOpen ? (
          <DesignPanel
            model={model}
            finishes={plan.finishes}
            open={editorOpen}
            selectedSurface={selectedSurface}
            showCeilings={showCeilings}
            onToggle={() => setEditorOpen(false)}
            onSelectSurface={handleSelectSurface}
            onChange={changeSelectedFinish}
            onReset={resetSelectedFinish}
          />
        ) : (
          <DesignPanelTrigger onClick={() => setEditorOpen(true)} />
        )
      )}
    </div>
  );
};
