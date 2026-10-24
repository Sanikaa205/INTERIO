import React, { useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { ArrowLeft, BookmarkPlus, Home } from 'lucide-react';
import { FloorPlanResult } from '../../types';
import { buildHouseModel } from './model/buildHouseModel';
import { Floors } from './Floors';
import { Walls } from './Walls';
import { Doors } from './Doors';
import { Windows } from './Windows';
import { Ceilings } from './Ceilings';
import { CameraRig } from './CameraRig';
import { RoomLabels } from './RoomLabels';
import { Lighting } from './Lighting';
import { Toolbar } from './Toolbar';
import { exportHouseGlb } from './exportGlb';
import { Walkthrough } from './Walkthrough';
import { VirtualJoystick } from './VirtualJoystick';
import { useWalkInput, type WalkInput } from './useWalkInput';

interface FloorPlan3DProps {
  plan: FloorPlanResult;
  title: string;
  onBack: () => void;
  onBackToHome: () => void;
  onSaveProject: () => void;
}

export const FloorPlan3D: React.FC<FloorPlan3DProps> = ({
  plan,
  title,
  onBack,
  onBackToHome,
  onSaveProject,
}) => {
  const [showCeilings, setShowCeilings] = useState(false);
  const [cutaway, setCutaway] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [night, setNight] = useState(false);
  const [focusedRoomId, setFocusedRoomId] = useState<string | null>(null);
  const [resetToken, setResetToken] = useState(0);
  const [exportError, setExportError] = useState<string | null>(null);
  const [mode, setMode] = useState<'orbit' | 'walk'>('orbit');
  const [showWalkHint, setShowWalkHint] = useState(false);
  const inputRef = useRef<WalkInput>({ forward: 0, strafe: 0, run: false });
  const orbitSettings = useRef({ ceilings: false, cutaway: false });
  const houseRef = useRef<THREE.Group>(null);
  const model = useMemo(() => buildHouseModel(plan), [plan]);
  const resetView = () => {
    setFocusedRoomId(null);
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
  useWalkInput(inputRef, mode === 'walk');
  const enterWalk = () => {
    orbitSettings.current = { ceilings: showCeilings, cutaway };
    setShowCeilings(true);
    setCutaway(false);
    setShowWalkHint(true);
    setMode('walk');
    window.setTimeout(() => setShowWalkHint(false), 4000);
  };
  const exitWalk = () => {
    setMode('orbit');
    setShowCeilings(orbitSettings.current.ceilings);
    setCutaway(orbitSettings.current.cutaway);
  };
  return (
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

        {/* Right: Save */}
        <div className="flex items-center gap-1.5 pointer-events-auto">
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

      {/* 3D Canvas */}
      <div className="relative w-full h-full rounded-lg">
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
        />
        {mode === 'walk' && showWalkHint && <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 rounded-lg bg-stone-900/85 px-4 py-2 text-center text-xs text-white pointer-events-none">WASD to move · drag/mouse to look · Esc to exit</div>}
        {mode === 'walk' && <VirtualJoystick inputRef={inputRef} />}
        {exportError && <div className="absolute bottom-3 left-3 z-10 rounded bg-red-900/90 px-3 py-1.5 text-xs text-red-100">{exportError}</div>}
        <Canvas camera={{ fov: 50 }} onPointerMissed={resetView}>
          <color attach="background" args={[night ? '#07101f' : '#b9d9f2']} />
          <Lighting model={model} night={night} />
          <group ref={houseRef} onClick={(event) => event.stopPropagation()}>
            <Floors model={model} focusedRoomId={focusedRoomId} onFocus={setFocusedRoomId} onClearFocus={resetView} />
            <Walls model={model} cutaway={cutaway} />
            <Doors model={model} />
            <Windows model={model} />
            {showCeilings && <Ceilings model={model} />}
          </group>
          {showLabels && <RoomLabels model={model} />}
          <CameraRig model={model} focusedRoomId={focusedRoomId} resetToken={resetToken} enabled={mode === 'orbit'} />
          {mode === 'walk' && <Walkthrough model={model} inputRef={inputRef} onExit={exitWalk} />}
        </Canvas>
      </div>
    </div>
  );
};
