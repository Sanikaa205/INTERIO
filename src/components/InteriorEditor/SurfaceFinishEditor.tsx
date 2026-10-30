import React from 'react';
import type { SurfaceFinish } from '../../types';
import { ColorPicker } from '../FloorPlan3D/ColorPicker';
import {
  defaultVariantFor,
  getMaterialVariant,
  materialsForSurface,
  variantsForSurface,
} from '../FloorPlan3D/materialCatalog';

interface SurfaceFinishEditorProps {
  surface: 'floor' | 'wall';
  /** The user's finish for this surface; undefined while the generated look is in use. */
  finish?: SurfaceFinish;
  /** The plain colour shown while there is no finish (the generated palette colour). */
  baseColor: string;
  onChange: (finish: SurfaceFinish) => void;
  onReset: () => void;
  resetLabel: string;
  /** Prefix for element ids, e.g. "floor" or "walls". */
  idPrefix: string;
  children?: React.ReactNode;
}

const heading = 'mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-stone-400';
const focusRing = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-cyan-300';
const chip = (active: boolean) =>
  `min-h-9 rounded-lg border px-2.5 py-1.5 text-xs capitalize transition-colors ${focusRing} ${
    active
      ? 'border-cyan-400 bg-cyan-400/15 text-cyan-200'
      : 'border-stone-700 bg-stone-800/60 text-stone-300 hover:border-stone-500 hover:text-white'
  }`;

/** Material, style, colour/tint, scale and roughness for the floor or a wall. */
export const SurfaceFinishEditor: React.FC<SurfaceFinishEditorProps> = ({
  surface, finish, baseColor, onChange, onReset, resetLabel, idPrefix, children,
}) => {
  const materialId = finish?.materialId ?? 'paint';
  const variant = getMaterialVariant(finish?.variantId, materialId);
  const isTextured = Boolean(variant.mapUrl);
  // Textured finishes use the colour as a tint; white means "no tint".
  const color = finish?.color ?? (finish ? (isTextured ? '#ffffff' : variant.color) : baseColor);
  const scale = finish?.scale ?? variant.defaultScale ?? 1;
  const roughness = finish?.roughness ?? variant.roughness;
  const materials = materialsForSurface(surface);
  if (!materials.includes(materialId)) materials.push(materialId);
  const variants = variantsForSurface(surface).filter((item) => item.materialId === materialId);

  const emit = (patch: Partial<SurfaceFinish>) => {
    const next: SurfaceFinish = { materialId, ...finish, ...patch };
    (Object.keys(next) as (keyof SurfaceFinish)[]).forEach((key) => { if (next[key] === undefined) delete next[key]; });
    onChange(next);
  };
  const pick = (id: SurfaceFinish['materialId'], variantId: string) =>
    onChange({ materialId: id, variantId });

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className={heading}>Material</p>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Material">
          {materials.map((id) => (
            <button
              key={id}
              type="button"
              id={`${idPrefix}-material-${id}`}
              aria-pressed={materialId === id}
              onClick={() => pick(id, defaultVariantFor(id, surface).id)}
              className={chip(materialId === id)}
            >
              {id}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className={heading}>Style</p>
        <div className="grid grid-cols-2 gap-1.5" role="group" aria-label="Style">
          {variants.map((item) => (
            <button
              key={item.id}
              type="button"
              id={`${idPrefix}-variant-${item.id}`}
              aria-pressed={finish?.variantId === item.id}
              aria-label={item.name}
              onClick={() => pick(item.materialId, item.id)}
              className={`flex min-h-11 items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-xs transition-colors ${focusRing} ${
                finish?.variantId === item.id
                  ? 'border-cyan-400 bg-cyan-400/15 text-cyan-200'
                  : 'border-stone-700 bg-stone-800/60 text-stone-300 hover:border-stone-500 hover:text-white'
              }`}
            >
              <span
                className="h-8 w-8 flex-shrink-0 rounded border border-white/20 bg-cover bg-center"
                style={{ backgroundColor: item.color }}
              >
                {item.mapUrl && <img src={item.thumbnailUrl ?? item.mapUrl} alt="" loading="lazy" className="h-full w-full rounded object-cover" />}
              </span>
              <span className="leading-tight">{item.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-stone-400">{isTextured ? 'Tint' : 'Colour'}</p>
          {isTextured && (
            <button
              type="button"
              id={`${idPrefix}-reset-tint`}
              disabled={!finish?.color}
              onClick={() => emit({ color: undefined })}
              className={`rounded-md border border-stone-600 px-2 py-0.5 text-[11px] text-stone-300 hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-40 ${focusRing}`}
            >
              Reset tint
            </button>
          )}
        </div>
        <ColorPicker value={color} onChange={(hex) => emit({ color: hex })} />
      </div>

      {isTextured && (
        <label className="block text-xs text-stone-300" htmlFor={`${idPrefix}-scale`}>
          <span className="font-medium">Texture size</span>
          <span className="ml-1 text-stone-500">({scale.toFixed(2)} m per repeat)</span>
          <input
            id={`${idPrefix}-scale`}
            type="range"
            min={0.1}
            max={3}
            step={0.05}
            value={Math.min(3, Math.max(0.1, scale))}
            onChange={(e) => emit({ scale: Number(e.target.value) })}
            className="mt-1 w-full cursor-pointer accent-cyan-400"
          />
        </label>
      )}

      <label className="block text-xs text-stone-300" htmlFor={`${idPrefix}-roughness`}>
        <span className="font-medium">Shine</span>
        <span className="ml-1 text-stone-500">({roughness <= 0.35 ? 'glossy' : roughness >= 0.75 ? 'matte' : 'satin'})</span>
        <input
          id={`${idPrefix}-roughness`}
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={roughness}
          onChange={(e) => emit({ roughness: Number(e.target.value) })}
          className="mt-1 w-full cursor-pointer accent-cyan-400"
        />
      </label>

      {children}

      <button
        type="button"
        id={`${idPrefix}-reset`}
        onClick={onReset}
        className={`w-full rounded-lg border border-stone-600 px-2 py-2 text-xs font-medium text-stone-300 transition-colors hover:bg-stone-700 hover:text-white ${focusRing}`}
      >
        {resetLabel}
      </button>
    </div>
  );
};
