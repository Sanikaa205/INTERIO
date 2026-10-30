import { isValidHexColor, isValidRoughness, isValidScale } from '../components/FloorPlan3D/finishes';
import { MATERIAL_CATALOG, getMaterialVariant } from '../components/FloorPlan3D/materialCatalog';
import type {
  ColorSwatch,
  FurnitureItem,
  InteriorDesignResult,
  InteriorFinishes,
  InteriorWallSide,
  SurfaceFinish,
} from '../types';

export type WallScope = InteriorWallSide | 'all';

const WALL_SIDES: readonly InteriorWallSide[] = ['north', 'south', 'east', 'west'];
/** Metres per texture repeat above this is treated as a corrupt value, not a style choice. */
const MAX_SCALE = 20;

const MATERIAL_IDS = new Set<string>(MATERIAL_CATALOG.map((variant) => variant.materialId));

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Cleans one finish. Never throws; returns undefined when nothing usable is
 * left. An unknown (or wrong-surface) variant id is dropped and the finish
 * falls back to its plain material colour.
 */
export function sanitizeSurfaceFinish(value: unknown, surface: 'floor' | 'wall'): SurfaceFinish | undefined {
  if (!isRecord(value)) return undefined;
  const materialId = value.materialId;
  if (typeof materialId !== 'string' || !MATERIAL_IDS.has(materialId)) return undefined;
  const finish: SurfaceFinish = { materialId: materialId as SurfaceFinish['materialId'] };
  if (isValidHexColor(value.color)) finish.color = value.color;
  if (typeof value.variantId === 'string') {
    const variant = MATERIAL_CATALOG.find((v) => v.id === value.variantId);
    if (variant && variant.materialId === materialId && variant.surfaces.includes(surface)) finish.variantId = variant.id;
  }
  if (isValidScale(value.scale) && value.scale <= MAX_SCALE) finish.scale = value.scale;
  if (isValidRoughness(value.roughness)) finish.roughness = value.roughness;
  if (typeof value.rotation === 'number' && Number.isFinite(value.rotation)) finish.rotation = value.rotation;
  return finish;
}

/** Cleans saved/loaded finishes; undefined when there is nothing valid (so old projects stay unchanged). */
export function sanitizeInteriorFinishes(value: unknown): InteriorFinishes | undefined {
  if (!isRecord(value)) return undefined;
  const result: InteriorFinishes = {};
  const floor = sanitizeSurfaceFinish(value.floor, 'floor');
  if (floor) result.floor = floor;
  if (isRecord(value.walls)) {
    const walls: NonNullable<InteriorFinishes['walls']> = {};
    for (const scope of ['all', ...WALL_SIDES] as WallScope[]) {
      const finish = sanitizeSurfaceFinish(value.walls[scope], 'wall');
      if (finish) walls[scope] = finish;
    }
    if (Object.keys(walls).length) result.walls = walls;
  }
  return result.floor || result.walls ? result : undefined;
}

/** Drops invalid edit fields from one piece; other fields are left untouched. */
export function sanitizeFurnitureEdits(item: FurnitureItem): FurnitureItem {
  if (!isRecord(item)) return item;
  const next = { ...item };
  if (next.frameColor !== undefined && !isValidHexColor(next.frameColor)) delete next.frameColor;
  if (next.generatedColor !== undefined && !isValidHexColor(next.generatedColor)) delete next.generatedColor;
  if (next.finishId !== undefined && !MATERIAL_CATALOG.some((variant) => variant.id === next.finishId)) delete next.finishId;
  return next;
}

function sanitizeGeneratedSwatches(value: unknown): InteriorDesignResult['generatedSwatches'] {
  if (!isRecord(value)) return undefined;
  const swatches: NonNullable<InteriorDesignResult['generatedSwatches']> = {};
  if (isValidHexColor(value.wall)) swatches.wall = value.wall;
  if (isValidHexColor(value.flooring)) swatches.flooring = value.flooring;
  return swatches.wall || swatches.flooring ? swatches : undefined;
}

/**
 * Run on every loaded interior project. Old projects (no edit fields) come
 * back unchanged; invalid edit data is dropped. Never throws.
 */
export function sanitizeInteriorEdits<T extends InteriorDesignResult>(data: T): T {
  if (!isRecord(data)) return data;
  const next: T = { ...data };
  const finishes = sanitizeInteriorFinishes(data.finishes);
  if (finishes) next.finishes = finishes;
  else delete next.finishes;
  const generated = sanitizeGeneratedSwatches(data.generatedSwatches);
  if (generated) next.generatedSwatches = generated;
  else delete next.generatedSwatches;
  if (Array.isArray(data.furniture)) next.furniture = data.furniture.map(sanitizeFurnitureEdits);
  return next;
}

/** Finish that applies to a wall: its own, else "all walls", else undefined (use the palette colour). */
export function resolveWallFinish(finishes: InteriorFinishes | undefined, side: InteriorWallSide): SurfaceFinish | undefined {
  return finishes?.walls?.[side] ?? finishes?.walls?.all;
}

/** The plain colour a finish stands for: its own colour, else its variant's base colour. */
export function finishBaseColor(finish: SurfaceFinish): string {
  return finish.color ?? getMaterialVariant(finish.variantId, finish.materialId).color;
}

function swatchHex(palette: ColorSwatch[] | undefined, role: ColorSwatch['role']) {
  return palette?.find((swatch) => swatch.role === role)?.hex;
}

function withSwatch(palette: ColorSwatch[] | undefined, role: 'wall' | 'flooring', hex: string): ColorSwatch[] {
  const list = palette ?? [];
  if (list.some((swatch) => swatch.role === role)) return list.map((swatch) => (swatch.role === role ? { ...swatch, hex } : swatch));
  return [...list, { hex, name: role === 'wall' ? 'Wall' : 'Flooring', role }];
}

/** Remembers the generator's swatches the first time something is edited. */
function withGenerated(data: InteriorDesignResult): InteriorDesignResult['generatedSwatches'] {
  return {
    wall: data.generatedSwatches?.wall ?? swatchHex(data.colorPalette, 'wall'),
    flooring: data.generatedSwatches?.flooring ?? swatchHex(data.colorPalette, 'flooring'),
  };
}

function tidy(data: InteriorDesignResult, finishes: InteriorFinishes): InteriorDesignResult {
  const next = { ...data };
  const clean: InteriorFinishes = {};
  if (finishes.floor) clean.floor = finishes.floor;
  if (finishes.walls && Object.keys(finishes.walls).length) clean.walls = finishes.walls;
  if (clean.floor || clean.walls) next.finishes = clean;
  else delete next.finishes;
  return next;
}

/**
 * Sets (or with `undefined` clears) the floor finish. The palette flooring swatch
 * follows the finish's base colour so the 2D plan and dashboard thumbnail match.
 * An invalid finish leaves the data unchanged.
 */
export function setFloorFinish(data: InteriorDesignResult, finish: SurfaceFinish | undefined): InteriorDesignResult {
  if (!finish) return resetFloor(data);
  const clean = sanitizeSurfaceFinish(finish, 'floor');
  if (!clean) return data;
  const next = tidy({ ...data, generatedSwatches: withGenerated(data) }, { ...data.finishes, floor: clean });
  next.colorPalette = withSwatch(data.colorPalette, 'flooring', finishBaseColor(clean));
  return next;
}

/**
 * Sets (or clears) a wall finish for one side or for all walls. Only "all walls"
 * moves the palette wall swatch, since the 2D plan has a single wall colour.
 */
export function setWallFinish(data: InteriorDesignResult, scope: WallScope, finish: SurfaceFinish | undefined): InteriorDesignResult {
  if (scope !== 'all' && !WALL_SIDES.includes(scope)) return data;
  const clean = finish ? sanitizeSurfaceFinish(finish, 'wall') : undefined;
  if (finish && !clean) return data;
  const walls = { ...data.finishes?.walls };
  if (clean) walls[scope] = clean;
  else delete walls[scope];
  const next = tidy({ ...data, generatedSwatches: withGenerated(data) }, { ...data.finishes, walls: Object.keys(walls).length ? walls : undefined });
  if (scope === 'all') {
    if (clean) next.colorPalette = withSwatch(data.colorPalette, 'wall', finishBaseColor(clean));
    else {
      const generated = next.generatedSwatches?.wall;
      if (generated) next.colorPalette = withSwatch(data.colorPalette, 'wall', generated);
    }
  }
  return next;
}

export function resetFloor(data: InteriorDesignResult): InteriorDesignResult {
  if (!data.finishes?.floor) return data;
  const { floor: _floor, ...rest } = data.finishes;
  const next = tidy({ ...data }, rest);
  const generated = data.generatedSwatches?.flooring;
  if (generated) next.colorPalette = withSwatch(data.colorPalette, 'flooring', generated);
  return next;
}

export function resetWalls(data: InteriorDesignResult): InteriorDesignResult {
  if (!data.finishes?.walls) return data;
  const { walls: _walls, ...rest } = data.finishes;
  const next = tidy({ ...data }, rest);
  const generated = data.generatedSwatches?.wall;
  if (generated) next.colorPalette = withSwatch(data.colorPalette, 'wall', generated);
  return next;
}

export function resetAll(data: InteriorDesignResult): InteriorDesignResult {
  return resetWalls(resetFloor(data));
}
