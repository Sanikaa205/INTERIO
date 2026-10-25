import React, { useMemo } from 'react';
import type { SurfaceFinish } from '../../types';
import { getRoomFinishOverride, getWallFinishOverride } from './finishes';
import type { SelectedSurface } from './finishTypes';
import { DEFAULT_VARIANT_BY_MATERIAL, getMaterialVariant, MATERIAL_CATALOG, type BuiltInMaterialId } from './materialCatalog';

interface FinishEditorProps {
  finishes: unknown;
  selectedSurface: SelectedSurface | null;
  isSmall: boolean;
  onChange: (finish: SurfaceFinish) => void;
  onReset: () => void;
  onClearSelection: () => void;
}

const MATERIALS: readonly BuiltInMaterialId[] = ['paint', 'tile', 'marble', 'wood'];
const SWATCHES = ['#f5f1ea', '#ded4c3', '#b9c5b1', '#9ba9b8', '#765640', '#4f5355'];

function selectedFinish(finishes: unknown, surface: SelectedSurface | null): SurfaceFinish | undefined {
  if (!surface) return undefined;
  return surface.kind === 'wall'
    ? getWallFinishOverride(finishes, surface.wallId)
    : getRoomFinishOverride(finishes, surface.roomId, surface.kind === 'room-floor' ? 'floor' : 'ceiling');
}

function surfaceLabel(surface: SelectedSurface): string {
  if (surface.kind === 'room-floor') return 'Room floor';
  if (surface.kind === 'room-ceiling') return 'Room ceiling';
  return 'Wall segment';
}

export const FinishEditor: React.FC<FinishEditorProps> = ({ finishes, selectedSurface, isSmall, onChange, onReset, onClearSelection }) => {
  const value = useMemo(() => selectedFinish(finishes, selectedSurface), [finishes, selectedSurface]);
  if (!selectedSurface) return null;

  const materialId = value?.materialId ?? 'paint';
  const variant = getMaterialVariant(value?.variantId, materialId);
  const color = value?.color ?? variant.color;
  const scale = value?.scale ?? 1;
  const variants = MATERIAL_CATALOG.filter((item) => item.materialId === materialId);
  const isTextured = Boolean(variant.mapUrl);
  const update = (patch: Partial<SurfaceFinish>) => onChange({
    materialId,
    variantId: variant.id,
    ...value,
    ...patch,
  });
  const panelWidth = isSmall ? 'left-3 right-3 bottom-3 max-h-[calc(100%-7rem)]' : 'right-4 top-16 w-72 max-h-[calc(100%-5rem)]';

  return (
    <aside aria-label="Finish editor" className={`absolute z-20 overflow-y-auto rounded-xl border border-stone-700 bg-stone-950/95 p-3 text-stone-100 shadow-2xl backdrop-blur-md ${panelWidth}`}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Finish editor</h2>
          <p className="text-xs text-stone-400">{surfaceLabel(selectedSurface)}</p>
        </div>
        <button type="button" onClick={onClearSelection} className="rounded p-1 text-stone-400 hover:bg-stone-800 hover:text-white" aria-label="Close finish editor">×</button>
      </div>

      <fieldset className="mb-3">
        <legend className="mb-1.5 text-xs font-medium text-stone-300">Material</legend>
        <div className="grid grid-cols-2 gap-1.5">
          {MATERIALS.map((item) => (
            <button key={item} type="button" onClick={() => update({ materialId: item, variantId: DEFAULT_VARIANT_BY_MATERIAL[item] })} className={`rounded-md border px-2 py-1.5 text-xs capitalize transition-colors ${materialId === item ? 'border-cyan-300 bg-cyan-300/15 text-cyan-100' : 'border-stone-700 bg-stone-900 text-stone-300 hover:border-stone-500'}`}>
              {item}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="mb-3">
        <legend className="mb-1.5 text-xs font-medium text-stone-300">Variant</legend>
        <div className="grid gap-1.5">
          {variants.map((item) => (
            <button key={item.id} type="button" onClick={() => update({ materialId: item.materialId, variantId: item.id, color: undefined, roughness: undefined })} className={`flex items-center gap-2 rounded-md border px-2 py-1.5 text-left text-xs transition-colors ${variant.id === item.id ? 'border-cyan-300 bg-cyan-300/15 text-cyan-100' : 'border-stone-700 bg-stone-900 text-stone-300 hover:border-stone-500'}`}>
              <span className="h-4 w-4 rounded-sm border border-white/20" style={{ backgroundColor: item.color }} aria-hidden="true" />
              {item.name}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="mb-3">
        <legend className="mb-1.5 text-xs font-medium text-stone-300">Colour</legend>
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="finish-color">Custom finish colour</label>
          <input id="finish-color" aria-label="Custom finish colour" type="color" value={color} onChange={(event) => update({ color: event.target.value })} className="h-8 w-10 cursor-pointer rounded border border-stone-600 bg-transparent p-0.5" />
          <div className="flex flex-1 flex-wrap gap-1">
            {SWATCHES.map((swatch) => <button key={swatch} type="button" aria-label={`Use ${swatch}`} title={swatch} onClick={() => update({ color: swatch })} className={`h-5 w-5 rounded-full border ${color.toLowerCase() === swatch ? 'border-cyan-300 ring-1 ring-cyan-300' : 'border-white/30'}`} style={{ backgroundColor: swatch }} />)}
          </div>
        </div>
      </fieldset>

      {isTextured && <label className="mb-3 block text-xs font-medium text-stone-300" htmlFor="finish-scale">
        Texture scale (metres per repeat)
        <input id="finish-scale" aria-label="Texture scale in metres per repeat" type="number" min="0.1" step="0.1" value={scale} onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isFinite(next) && next > 0) update({ scale: next });
        }} className="mt-1 w-full rounded-md border border-stone-700 bg-stone-900 px-2 py-1.5 text-sm text-white outline-none focus:border-cyan-300" />
      </label>}

      <button type="button" onClick={onReset} className="w-full rounded-md border border-stone-600 px-2 py-1.5 text-xs font-medium text-stone-200 transition-colors hover:bg-stone-800">Reset surface</button>
    </aside>
  );
};
