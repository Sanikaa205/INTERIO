import { isValidHexColor } from '../components/FloorPlan3D/finishes';
import { MATERIAL_CATALOG } from '../components/FloorPlan3D/materialCatalog';
import type { FurnitureItem } from '../types';

/** Remembers the generator's colour the first time a piece is recoloured, so "reset" can restore it. */
function withGenerated(item: FurnitureItem): FurnitureItem {
  return item.generatedColor || !item.color ? item : { ...item, generatedColor: item.color };
}

/** Body / upholstery colour. An invalid colour changes nothing. */
export function setBodyColor(item: FurnitureItem, hex: string): FurnitureItem {
  if (!isValidHexColor(hex)) return item;
  return { ...withGenerated(item), color: hex };
}

/** Frame / wood colour (legs, frames). `undefined` clears it. */
export function setFrameColor(item: FurnitureItem, hex: string | undefined): FurnitureItem {
  if (hex === undefined) {
    const { frameColor: _frameColor, ...rest } = item;
    return rest;
  }
  return isValidHexColor(hex) ? { ...item, frameColor: hex } : item;
}

/** Wood variant for the frame parts. `undefined` clears it; unknown ids change nothing. */
export function setFrameFinish(item: FurnitureItem, finishId: string | undefined): FurnitureItem {
  if (finishId === undefined) {
    const { finishId: _finishId, ...rest } = item;
    return rest;
  }
  return MATERIAL_CATALOG.some((variant) => variant.id === finishId) ? { ...item, finishId } : item;
}

export function isRecoloured(item: FurnitureItem): boolean {
  return Boolean(item.frameColor || item.finishId || (item.generatedColor && item.generatedColor !== item.color));
}

/** Back to the generated look: body colour restored, frame colour and finish cleared. */
export function resetFurnitureColors(item: FurnitureItem): FurnitureItem {
  const { frameColor: _frame, finishId: _finish, generatedColor, ...rest } = item;
  return generatedColor ? { ...rest, color: generatedColor } : rest;
}
