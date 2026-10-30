import type { FurnitureItem } from '../types';
import { furnitureFootprint } from '../services/layoutOptimizer';

/**
 * Where a furniture item sits in the 3D scene, derived from the same data (and
 * the same `furnitureFootprint`) the 2D plan draws from.
 *
 * Conventions, so the two views cannot drift apart:
 * - 2D: x runs east (right), y runs south (down); `x`/`y` are the top-left of
 *   the axis-aligned footprint. The piece is drawn with its front towards +y
 *   and turned by SVG `rotate(rotation)`, which is clockwise on screen.
 * - 3D: the room is centred on the origin, x east and z south; a model's front
 *   is its local +z. three.js `rotation.y` is counter-clockwise seen from
 *   above, so the 3D angle is the 2D angle negated.
 */
export interface FurnitureTransform3D {
  /** Centre of the footprint in scene metres. */
  x: number;
  z: number;
  /** Radians for `object.rotation.y`. */
  rotationY: number;
}

export function furnitureTransform3D(
  item: Pick<FurnitureItem, 'x' | 'y' | 'width' | 'depth' | 'rotation'>,
  room: { width: number; depth: number },
): FurnitureTransform3D {
  const footprint = furnitureFootprint(item);
  return {
    x: footprint.x + footprint.width / 2 - room.width / 2,
    z: footprint.y + footprint.depth / 2 - room.depth / 2,
    rotationY: rotationToRadians(item.rotation),
  };
}

/** 2D plan degrees (clockwise) to three.js `rotation.y` radians. */
export function rotationToRadians(degrees: number | undefined): number {
  const value = (Number(degrees) || 0) * Math.PI / 180;
  return value === 0 ? 0 : -value;
}

/** three.js `rotation.y` radians back to 2D plan degrees in [0, 360). */
export function rotationFromRadians(radians: number): number {
  const degrees = -(radians * 180) / Math.PI;
  return ((degrees % 360) + 360) % 360;
}

/** Scene position back to the item's top-left `x`/`y` for a given (rotated) size. */
export function itemPositionFromScene(
  scene: { x: number; z: number },
  footprint: { width: number; depth: number },
  room: { width: number; depth: number },
): { x: number; y: number } {
  return { x: scene.x + room.width / 2 - footprint.width / 2, y: scene.z + room.depth / 2 - footprint.depth / 2 };
}
