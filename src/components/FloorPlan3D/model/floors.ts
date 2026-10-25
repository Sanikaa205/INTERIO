import type { RoomType } from '../../../types';
import type { FloorPoly } from './types';
import type { PlanRect } from './wallEdges';

/**
 * Distinct, warm-tone floor colours keyed by room type.
 * Each type has a visually distinct colour to help the user identify rooms.
 */
export const FLOOR_COLORS: Record<RoomType | string, string> = {
  'living-room':    '#d4c5b0', // warm sand
  'master-bedroom': '#b8c4d4', // soft blue-grey
  'bedroom':        '#c4b8d4', // soft lavender
  'kitchen':        '#c8d4b8', // sage green
  'dining-room':    '#d4cbb8', // warm cream
  'bathroom':       '#b8d4d0', // cool teal-grey
  'powder-room':    '#c0d4d4', // light teal
  'hallway':        '#c8c8c8', // neutral grey
  'balcony':        '#c4d4b8', // light green
  'office':         '#d4c4c4', // dusty rose
  'laundry':        '#c4c8d0', // slate blue
  'utility':        '#ccc8c4', // warm grey
};

const NEUTRAL_FLOOR = '#d0cbc4'; // neutral fallback

function isValidHex(c: string | undefined): c is string {
  return typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c);
}

/**
 * Builds floor polygons from a list of plan rects.
 * One FloorPoly per rect.
 * Color priority: room.color (if valid #rrggbb) → type color → neutral.
 */
export function buildFloors(rects: PlanRect[], roomColorMap?: Map<string, string>): FloorPoly[] {
  return rects.map((r) => {
    // roomColorMap supplies the original FloorPlanRoom.color (only if valid hex)
    const roomColor = roomColorMap?.get(r.id);
    const typeColor = FLOOR_COLORS[r.type] ?? NEUTRAL_FLOOR;
    const color = isValidHex(roomColor) ? roomColor : typeColor;

    return {
      roomId: r.id,
      name: r.name,
      type: r.type as RoomType,
      x: r.x,
      z: r.y,           // plan y → world z
      width: r.width,
      depth: r.height,  // plan height → world depth (along z)
      color,
    };
  });
}
