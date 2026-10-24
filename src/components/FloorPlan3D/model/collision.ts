import { WALL_THICKNESS } from './constants';
import type { HouseModel, WallSegment } from './types';
import { wallPieces } from './wallPieces';

export interface Collider {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

function colliderFor(wall: WallSegment, s0: number, s1: number): Collider {
  const half = Math.max(WALL_THICKNESS, wall.thickness) / 2;
  if (wall.axis === 'x') {
    return { minX: wall.a.x + s0, maxX: wall.a.x + s1, minZ: wall.a.z - half, maxZ: wall.a.z + half };
  }
  return { minX: wall.a.x - half, maxX: wall.a.x + half, minZ: wall.a.z + s0, maxZ: wall.a.z + s1 };
}

export function buildColliders(model: HouseModel): Collider[] {
  const result: Collider[] = [];
  for (const wall of model.walls) {
    const doorPieces = wallPieces({
      ...wall,
      openings: wall.openings.filter((opening) => opening.kind === 'door'),
    }).map((piece) => ({ s0: piece.s0, s1: piece.s1 }));
    const windowPieces = wall.openings
      .filter((opening) => opening.kind === 'window')
      .map((opening) => ({ s0: opening.start, s1: opening.end }));
    const pieces = [...doorPieces, ...windowPieces];
    for (const piece of pieces) {
      if (piece.s1 > piece.s0) result.push(colliderFor(wall, piece.s0, piece.s1));
    }
  }
  return result;
}

function overlaps(pos: { x: number; z: number }, collider: Collider, radius: number): boolean {
  return pos.x > collider.minX - radius && pos.x < collider.maxX + radius
    && pos.z > collider.minZ - radius && pos.z < collider.maxZ + radius;
}

function resolveAxis(pos: { x: number; z: number }, axis: 'x' | 'z', colliders: Collider[], radius: number): void {
  for (const collider of colliders) {
    if (!overlaps(pos, collider, radius)) continue;
    if (axis === 'x') {
      const left = Math.abs(pos.x - (collider.minX - radius));
      const right = Math.abs(pos.x - (collider.maxX + radius));
      pos.x = left < right ? collider.minX - radius : collider.maxX + radius;
    } else {
      const top = Math.abs(pos.z - (collider.minZ - radius));
      const bottom = Math.abs(pos.z - (collider.maxZ + radius));
      pos.z = top < bottom ? collider.minZ - radius : collider.maxZ + radius;
    }
  }
}

export function moveWithCollision(
  position: { x: number; z: number },
  delta: { x: number; z: number },
  colliders: Collider[],
  radius = 0.25,
  bounds?: HouseModel['bounds'],
): { x: number; z: number } {
  const result = { x: position.x, z: position.z };
  const steps = Math.max(1, Math.ceil(Math.hypot(delta.x, delta.z) / Math.max(radius, 0.01)));
  for (let step = 0; step < steps; step += 1) {
    result.x += delta.x / steps;
    resolveAxis(result, 'x', colliders, radius);
    result.z += delta.z / steps;
    resolveAxis(result, 'z', colliders, radius);
  }
  if (bounds) {
    result.x = Math.max(bounds.minX + 0.3, Math.min(bounds.maxX - 0.3, result.x));
    result.z = Math.max(bounds.minZ + 0.3, Math.min(bounds.maxZ - 0.3, result.z));
  }
  return result;
}
