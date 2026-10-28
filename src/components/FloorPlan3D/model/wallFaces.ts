import type { Side, WallSegment } from './types';

/** Direction a wall face looks toward, as a world axis normal. */
export type FaceDir = 'px' | 'nx' | 'pz' | 'nz';

/** Face key used for the outer face of an exterior wall. */
export const OUTSIDE_FACE = '@outside';

/** BoxGeometry material-group order is px, nx, py, ny, pz, nz. */
export const FACE_MATERIAL_INDEX: Readonly<Record<FaceDir, number>> = { px: 0, nx: 1, pz: 4, nz: 5 };

const OPPOSITE: Readonly<Record<FaceDir, FaceDir>> = { px: 'nx', nx: 'px', pz: 'nz', nz: 'pz' };

export interface WallFaceTarget {
  /** Room id, or `OUTSIDE_FACE` for the outer face of an exterior wall. */
  faceKey: string;
  /** Room the face belongs to; null for the outside face. */
  roomId: string | null;
  dir: FaceDir;
  /** Index into a BoxGeometry material array. */
  materialIndex: number;
}

/** The room interior lies on `side` of the wall centre-line, so the face looks that way. */
function dirForSide(axis: WallSegment['axis'], side: Side): FaceDir | null {
  if (axis === 'x') {
    if (side === 'top') return 'pz';
    if (side === 'bottom') return 'nz';
  } else {
    if (side === 'left') return 'px';
    if (side === 'right') return 'nx';
  }
  return null;
}

/**
 * One entry per room-facing face of a wall, plus the outside face of an
 * exterior wall. Overlapping rooms that claim the same direction resolve
 * deterministically (first room wins); walls with no usable sides return an
 * empty list and render with their base material.
 */
export function wallFaceTargets(wall: WallSegment): WallFaceTarget[] {
  const targets: WallFaceTarget[] = [];
  const usedDirs = new Set<FaceDir>();
  const usedKeys = new Set<string>();

  wall.roomIds.forEach((roomId, index) => {
    const dir = dirForSide(wall.axis, wall.sides[index]);
    if (!dir || usedDirs.has(dir) || usedKeys.has(roomId)) return;
    usedDirs.add(dir);
    usedKeys.add(roomId);
    targets.push({ faceKey: roomId, roomId, dir, materialIndex: FACE_MATERIAL_INDEX[dir] });
  });

  if (wall.exterior && targets.length === 1) {
    const dir = OPPOSITE[targets[0].dir];
    targets.push({ faceKey: OUTSIDE_FACE, roomId: null, dir, materialIndex: FACE_MATERIAL_INDEX[dir] });
  }
  return targets;
}

/** Reverse lookup; null for the top, bottom and jamb faces of the box. */
export function faceFromMaterialIndex(wall: WallSegment, materialIndex: number): WallFaceTarget | null {
  return wallFaceTargets(wall).find((target) => target.materialIndex === materialIndex) ?? null;
}

/** BoxGeometry U runs against the wall direction (a to b) on these faces. */
export function faceUReversed(dir: FaceDir): boolean {
  return dir === 'px' || dir === 'nz';
}

const NORMAL: Readonly<Record<FaceDir, { x: number; z: number }>> = {
  px: { x: 1, z: 0 }, nx: { x: -1, z: 0 }, pz: { x: 0, z: 1 }, nz: { x: 0, z: -1 },
};

export function faceNormal(dir: FaceDir): { x: number; z: number } {
  return NORMAL[dir];
}

/**
 * The room-facing face (or the outside face) of a wall that looks most toward
 * a point. Used when a click lands on a top or jamb face, which belongs to no
 * single room: the face on the viewer's side is the sensible choice.
 */
export function faceTowardPoint(wall: WallSegment, point: { x: number; z: number }): WallFaceTarget | null {
  const centre = { x: (wall.a.x + wall.b.x) / 2, z: (wall.a.z + wall.b.z) / 2 };
  let best: WallFaceTarget | null = null;
  let bestScore = -Infinity;
  for (const target of wallFaceTargets(wall)) {
    const n = NORMAL[target.dir];
    const score = n.x * (point.x - centre.x) + n.z * (point.z - centre.z);
    if (score > bestScore) { best = target; bestScore = score; }
  }
  return best;
}
