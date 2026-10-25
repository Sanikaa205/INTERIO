import type { WallSegment } from './types';
import { WALL_THICKNESS } from './constants';

/**
 * Marks wall segments as exterior or interior.
 *
 * A segment is EXTERIOR if exactly one room touches it (roomIds.length === 1).
 * This correctly handles L-shaped footprints and yard pockets.
 *
 * Exterior walls get thickness = WALL_THICKNESS * 1.5 (thicker than interior walls).
 * Decision: 1.5× exterior wall thickness matches typical construction practice
 * where exterior bearing walls are thicker than interior partition walls.
 */
export function markExterior(walls: WallSegment[]): WallSegment[] {
  return walls.map((w) => {
    const exterior = w.roomIds.length === 1;
    return {
      ...w,
      exterior,
      thickness: exterior ? WALL_THICKNESS * 1.5 : WALL_THICKNESS,
    };
  });
}
