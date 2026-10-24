import React from 'react';
import { Download, Layers, Moon, RotateCcw, Sun, Tag } from 'lucide-react';

interface ToolbarProps {
  showCeilings: boolean;
  cutaway: boolean;
  labels: boolean;
  night: boolean;
  onCeilings: () => void;
  onCutaway: () => void;
  onLabels: () => void;
  onNight: () => void;
  onReset: () => void;
  onExport: () => void;
}

const buttonClass = 'px-2.5 py-1.5 rounded-lg bg-stone-900/90 hover:bg-stone-800 text-stone-200 text-xs font-medium flex items-center gap-1.5 backdrop-blur-md transition-colors border border-stone-800';

export const Toolbar: React.FC<ToolbarProps> = (props) => (
  <div className="absolute top-2 left-2 right-2 flex flex-wrap gap-1.5 justify-end pointer-events-auto z-10">
    <button className={buttonClass} onClick={props.onCeilings} aria-pressed={props.showCeilings} title="Toggle ceiling"><Layers className="w-3.5 h-3.5" />Ceiling</button>
    <button className={buttonClass} onClick={props.onCutaway} aria-pressed={props.cutaway} title="Toggle cutaway">Cutaway</button>
    <button className={buttonClass} onClick={props.onLabels} aria-pressed={props.labels} title="Toggle room labels"><Tag className="w-3.5 h-3.5" />Labels</button>
    <button className={buttonClass} onClick={props.onNight} aria-pressed={props.night} title="Toggle day and night">{props.night ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />} {props.night ? 'Day' : 'Night'}</button>
    <button className={buttonClass} onClick={props.onReset} title="Reset view"><RotateCcw className="w-3.5 h-3.5" />Reset</button>
    <button className={buttonClass} onClick={props.onExport} title="Export GLB"><Download className="w-3.5 h-3.5" />Export GLB</button>
  </div>
);
