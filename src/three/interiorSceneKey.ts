import type { InteriorDesignResult } from '../types';
import { defaultRoomOpenings } from '../services/layoutOptimizer';

type SceneInput = Pick<InteriorDesignResult, 'roomWidth' | 'roomLength' | 'style' | 'openings' | 'furniture'>;

/** Openings the 3D shell is built from: the saved ones, else the default door and window. */
export function resolveInteriorOpenings(data: Pick<InteriorDesignResult, 'openings'>, width: number, length: number) {
  return data.openings?.length ? data.openings : defaultRoomOpenings(width, length);
}

/**
 * Fingerprint of everything that needs the 3D scene to be rebuilt: room size,
 * style, openings and the furniture list (ids, kinds and sizes). Colours and
 * positions are deliberately left out; those update the existing scene in place,
 * so the camera, selection and gizmo survive an edit.
 */
export function interiorSceneKey(data: SceneInput | null | undefined): string {
  if (!data) return 'none';
  const openings = resolveInteriorOpenings(data, data.roomWidth, data.roomLength);
  return JSON.stringify([
    data.roomWidth,
    data.roomLength,
    data.style,
    openings.map((o) => [o.wall, o.start, o.end, o.type]),
    (data.furniture || []).map((f) => [f.id, f.name, f.category, f.width, f.depth, f.height, f.assetUrl ?? null]),
  ]);
}
