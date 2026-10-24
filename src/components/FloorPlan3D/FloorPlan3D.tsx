import React, { useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { ArrowLeft, BookmarkPlus, Home, Layers } from 'lucide-react';
import { FloorPlanResult } from '../../types';
import { buildHouseModel } from './model/buildHouseModel';
import { Floors } from './Floors';
import { Walls } from './Walls';
import { Doors } from './Doors';
import { Windows } from './Windows';
import { Ceilings } from './Ceilings';
import { WALL_HEIGHT } from './model/constants';

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
  const model = useMemo(() => buildHouseModel(plan), [plan]);
  const center = [(model.bounds.minX + model.bounds.maxX) / 2, 0, (model.bounds.minZ + model.bounds.maxZ) / 2] as [number, number, number];
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
            id="btn-fp3d-ceiling"
            onClick={() => setShowCeilings((visible) => !visible)}
            className="px-3 py-1.5 rounded-lg bg-stone-900/90 hover:bg-stone-800 text-stone-200 text-xs font-medium flex items-center gap-1.5 backdrop-blur-md transition-colors border border-stone-800"
            title="Toggle ceiling"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Ceiling</span>
          </button>
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
      <div className="w-full h-full rounded-lg">
        <Canvas camera={{ position: [model.plotWidth, WALL_HEIGHT * 2.5, model.plotDepth], fov: 50 }}>
          <ambientLight intensity={0.65} />
          <directionalLight position={[model.plotWidth, WALL_HEIGHT * 3, model.plotDepth]} intensity={1.2} />
          <Floors model={model} />
          <Walls model={model} />
          <Doors model={model} />
          <Windows model={model} />
          {showCeilings && <Ceilings model={model} />}
          <OrbitControls target={center} makeDefault />
        </Canvas>
      </div>
    </div>
  );
};
