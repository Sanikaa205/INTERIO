import React from 'react';
import { Maximize2, Minus, Plus, ArrowDown } from 'lucide-react';
import type { CameraRigHandle } from './CameraRig';

interface ViewControlsProps {
  cameraRef: React.RefObject<CameraRigHandle | null>;
}

const btn = 'flex h-8 w-8 items-center justify-center rounded-lg bg-stone-900/90 border border-stone-700 text-stone-300 hover:bg-stone-700 hover:text-white transition-colors backdrop-blur-md';

/**
 * 2.4 — Small floating cluster of view controls: Fit, Top-down, Zoom ±.
 * Wheel/pinch/pan already work via OrbitControls; these are supplementary.
 */
export const ViewControls: React.FC<ViewControlsProps> = ({ cameraRef }) => (
  <div className="absolute bottom-3 right-3 z-10 flex flex-col gap-1 pointer-events-auto">
    <button
      id="btn-view-fit"
      className={btn}
      title="Fit view"
      aria-label="Fit view"
      onClick={() => cameraRef.current?.fit()}
    >
      <Maximize2 className="h-3.5 w-3.5" />
    </button>
    <button
      id="btn-view-top"
      className={btn}
      title="Top-down view"
      aria-label="Top-down view"
      onClick={() => cameraRef.current?.topDown()}
    >
      <ArrowDown className="h-3.5 w-3.5" />
    </button>
    <button
      id="btn-view-zoomin"
      className={btn}
      title="Zoom in"
      aria-label="Zoom in"
      onClick={() => cameraRef.current?.zoomIn()}
    >
      <Plus className="h-3.5 w-3.5" />
    </button>
    <button
      id="btn-view-zoomout"
      className={btn}
      title="Zoom out"
      aria-label="Zoom out"
      onClick={() => cameraRef.current?.zoomOut()}
    >
      <Minus className="h-3.5 w-3.5" />
    </button>
  </div>
);
