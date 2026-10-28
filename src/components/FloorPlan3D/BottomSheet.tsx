import React from 'react';
import { Download, Footprints, Moon, Paintbrush, RotateCcw, Sun, Tag, X } from 'lucide-react';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  showCeilings: boolean;
  cutaway: boolean;
  labels: boolean;
  night: boolean;
  mode: 'orbit' | 'walk';
  onCeilings: () => void;
  onCutaway: () => void;
  onLabels: () => void;
  onNight: () => void;
  onReset: () => void;
  onExport: () => void;
  onWalk: () => void;
  onExitWalk: () => void;
  // 2.1 — Design panel toggle for small screens
  editorOpen?: boolean;
  onDesign?: () => void;
}

export const BottomSheet: React.FC<BottomSheetProps> = (props) => {
  if (!props.open) return null;
  const row = 'flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm text-stone-800 hover:bg-stone-100';
  return (
    <div className="absolute inset-0 z-30" onClick={props.onClose}>
      <div className="absolute bottom-0 inset-x-0 max-h-[45%] overflow-auto rounded-t-2xl bg-white p-4 pb-[env(safe-area-inset-bottom)] shadow-lg" onClick={(event) => event.stopPropagation()}>
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-stone-300" />
        <div className="mb-2 flex items-center justify-between font-medium text-stone-900"><span>Controls</span><button className="rounded p-2" onClick={props.onClose} title="Close controls"><X className="h-5 w-5" /></button></div>
        {/* 2.1 — Design button on small screens */}
        {props.onDesign && (
          <button
            id="btn-design-toggle-mobile"
            className={`${row} font-medium ${props.editorOpen ? 'text-cyan-700' : ''}`}
            onClick={props.onDesign}
            aria-pressed={props.editorOpen}
          >
            <Paintbrush className="h-5 w-5" />
            Design {props.editorOpen ? '(open)' : ''}
          </button>
        )}
        <button className={row} onClick={props.mode === 'walk' ? props.onExitWalk : props.onWalk}><Footprints className="h-5 w-5" />{props.mode === 'walk' ? 'Exit walk' : 'Walk'}</button>
        <button className={row} onClick={props.onCutaway} aria-pressed={props.cutaway}>Cutaway {props.cutaway ? 'on' : 'off'}</button>
        <button className={row} onClick={props.onLabels} aria-pressed={props.labels}><Tag className="h-5 w-5" />Labels {props.labels ? 'on' : 'off'}</button>
        <button className={row} onClick={props.onNight} aria-pressed={props.night}>{props.night ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}{props.night ? 'Day' : 'Night'}</button>
        <button className={row} onClick={props.onReset}><RotateCcw className="h-5 w-5" />Reset view</button>
        <button className={row} onClick={props.onExport}><Download className="h-5 w-5" />Export GLB</button>
      </div>
    </div>
  );
};
