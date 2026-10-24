import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Combines static geometry into one draw-ready geometry. Callers own the
 * returned geometry; source geometries are disposed after a successful merge.
 */
export function mergeStaticGeometries(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry | null {
  if (geometries.length === 0) return null;
  const merged = mergeGeometries(geometries, false);
  if (!merged) return null;
  geometries.forEach((geometry) => geometry.dispose());
  return merged;
}
