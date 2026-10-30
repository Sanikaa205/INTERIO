import * as THREE from 'three';
import { createFinishMaterial } from '../components/FloorPlan3D/materials';
import type { MaterialVariant } from '../components/FloorPlan3D/materialCatalog';
import { enhanceSurfaceMaterial } from './interiorRealism';

export type WallSide = 'north' | 'south' | 'east' | 'west';
export type InteriorOpening = { wall: WallSide; start: number; end: number; type: 'door' | 'window' };
/** An editable surface of the room shell. Stored in `mesh.userData.surface`. */
export type SurfaceId = 'floor' | `wall:${WallSide}`;

export const WALL_SIDES: readonly WallSide[] = ['north', 'south', 'west', 'east'];

const WALL_NORMALS: Record<WallSide, [number, number, number]> = {
  north: [0, 0, -1],
  south: [0, 0, 1],
  east: [1, 0, 0],
  west: [-1, 0, 0],
};

export function isSurfaceId(value: unknown): value is SurfaceId {
  return value === 'floor' || (typeof value === 'string' && value.startsWith('wall:') && WALL_SIDES.includes(value.slice(5) as WallSide));
}

/**
 * Rewrites a box's UVs so one UV unit is one metre in the world, measured
 * along the face (width/height of the wall, x/z of the floor). Pieces on either
 * side of a door or window therefore continue the same pattern, and nothing
 * stretches. `centre` is the mesh position (shell boxes are never rotated).
 * Materials that use these UVs must set `texture.repeat = 1 / metresPerRepeat`,
 * which `createSurfaceMaterial` does.
 */
export function applyWorldUvs(geometry: THREE.BufferGeometry, centre: THREE.Vector3): void {
  const position = geometry.getAttribute('position');
  const normal = geometry.getAttribute('normal');
  const uv = geometry.getAttribute('uv');
  if (!position || !normal || !uv) return;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i) + centre.x;
    const y = position.getY(i) + centre.y;
    const z = position.getZ(i) + centre.z;
    const nx = normal.getX(i);
    const ny = normal.getY(i);
    const nz = normal.getZ(i);
    if (Math.abs(nx) > 0.5) uv.setXY(i, nx > 0 ? -z : z, y);
    else if (Math.abs(nz) > 0.5) uv.setXY(i, nz > 0 ? x : -x, y);
    else uv.setXY(i, x, ny > 0 ? -z : z);
  }
  uv.needsUpdate = true;
}

/**
 * Material for one shell surface. A variant without a texture is a plain
 * paint; a textured variant shows `color` until the image arrives and keeps it
 * if the image is missing (see createFinishMaterial). Geometry from
 * `buildInteriorShell` has metre UVs, so one repeat equals `scale` metres.
 */
export function createSurfaceMaterial(
  variant: MaterialVariant,
  options: { color?: string; roughness?: number; scale?: number; onTextureLoad?: () => void } = {},
): THREE.MeshStandardMaterial {
  let material: THREE.MeshStandardMaterial | undefined;
  material = createFinishMaterial(variant, {
    width: 1,
    height: 1,
    ...options,
    onTextureLoad: () => {
      if (material) enhanceSurfaceMaterial(material, variant);
      options.onTextureLoad?.();
    },
  });
  return enhanceSurfaceMaterial(material, variant);
}

/** Floor finish: one repeat equals `scale` metres across the room (the floor's UVs span the room). */
export function createFloorFinishMaterial(
  variant: MaterialVariant,
  options: { width: number; depth: number; color?: string; roughness?: number; scale?: number; onTextureLoad?: () => void },
): THREE.MeshStandardMaterial {
  let material: THREE.MeshStandardMaterial | undefined;
  material = createFinishMaterial(variant, {
    width: options.width,
    height: options.depth,
    color: options.color,
    roughness: options.roughness,
    scale: options.scale,
    onTextureLoad: () => {
      if (material) enhanceSurfaceMaterial(material, variant);
      options.onTextureLoad?.();
    },
  });
  return enhanceSurfaceMaterial(material, variant);
}

/** The floor mesh, tagged so it can be found and edited. Its UVs span 0..1 over the room. */
export function createInteriorFloor(
  material: THREE.Material,
  size: { width: number; depth: number },
  geometry?: THREE.BufferGeometry,
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry ?? new THREE.PlaneGeometry(size.width, size.depth), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(0, 0.01, 0);
  mesh.receiveShadow = true;
  mesh.userData.surface = 'floor' satisfies SurfaceId;
  return mesh;
}

function addBox(
  parent: THREE.Object3D,
  w: number,
  d: number,
  h: number,
  x: number,
  y: number,
  z: number,
  mat: THREE.Material,
  surface?: SurfaceId,
): THREE.Mesh {
  const geo = new THREE.BoxGeometry(w, h, d);
  if (surface) applyWorldUvs(geo, new THREE.Vector3(x, y, z));
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  if (surface) mesh.userData.surface = surface;
  parent.add(mesh);
  return mesh;
}

export interface InteriorShell {
  /** Each wall with its openings, frames and glass, for the camera cut-away. */
  groups: Record<WallSide, THREE.Group>;
  /** The one material each wall's solid pieces share. Frames/glass/doors are not in here. */
  wallMaterials: Record<WallSide, THREE.MeshStandardMaterial>;
  /** Wall materials with their outward normal, for the camera-facing fade. */
  faces: Array<{ normal: THREE.Vector3; material: THREE.MeshStandardMaterial }>;
}

export interface InteriorShellOptions {
  width: number;
  depth: number;
  height: number;
  thickness: number;
  /** Cloned once per wall so each wall owns its material. */
  wallMaterial: THREE.MeshStandardMaterial;
  /** Optional per-wall material (already owned by that wall). Wins over `wallMaterial`. */
  materialFor?: (side: WallSide) => THREE.MeshStandardMaterial | undefined;
  openings: InteriorOpening[];
}

/**
 * Four solid walls with door/window openings. Every wall body piece is tagged
 * `userData.surface = 'wall:<side>'` and has metre UVs; frames, glass, doors
 * and trim are untagged and keep their own materials.
 */
export function buildInteriorShell(parent: THREE.Object3D, options: InteriorShellOptions): InteriorShell {
  const { width, depth, height, thickness, openings } = options;
  const groups = {} as Record<WallSide, THREE.Group>;
  const wallMaterials = {} as Record<WallSide, THREE.MeshStandardMaterial>;
  const faces: InteriorShell['faces'] = [];
  const walls = [
    { side: 'north' as const, length: width, centerX: 0, centerZ: -depth / 2, horizontal: true },
    { side: 'south' as const, length: width, centerX: 0, centerZ: depth / 2, horizontal: true },
    { side: 'west' as const, length: depth, centerX: -width / 2, centerZ: 0, horizontal: false },
    { side: 'east' as const, length: depth, centerX: width / 2, centerZ: 0, horizontal: false },
  ];
  const frameMaterial = new THREE.MeshStandardMaterial({ color: '#755d45', roughness: 0.58 });
  const glassMaterial = new THREE.MeshStandardMaterial({ color: '#8fd3e8', roughness: 0.18, metalness: 0.22, transparent: true, opacity: 0.62 });
  const doorMaterial = new THREE.MeshStandardMaterial({ color: '#9a7654', roughness: 0.7 });

  for (const wall of walls) {
    const group = new THREE.Group();
    const wallFaceMaterial = options.materialFor?.(wall.side) ?? options.wallMaterial.clone();
    const surface: SurfaceId = `wall:${wall.side}`;
    group.name = `${wall.side}-wall`;
    groups[wall.side] = group;
    wallMaterials[wall.side] = wallFaceMaterial;
    parent.add(group);
    faces.push({ normal: new THREE.Vector3(...WALL_NORMALS[wall.side]), material: wallFaceMaterial });

    const sideOpenings = openings
      .filter((opening) => opening.wall === wall.side)
      .map((opening) => ({ ...opening, start: Math.max(0, Math.min(wall.length, opening.start)), end: Math.max(0, Math.min(wall.length, opening.end)) }))
      .filter((opening) => opening.end - opening.start > 0.15)
      .sort((a, b) => a.start - b.start);
    const origin = -wall.length / 2;
    const center = (start: number, end: number) => origin + (start + end) / 2;
    const piece = (span: number, h: number, x: number, y: number, z: number, mat: THREE.Material, tag?: SurfaceId) =>
      addBox(group, wall.horizontal ? span : thickness, wall.horizontal ? thickness : span, h, x, y, z, mat, tag);
    const addSpan = (start: number, end: number, bottom: number, top: number) => {
      if (end <= start || top <= bottom) return;
      const span = end - start;
      const x = wall.horizontal ? center(start, end) : wall.centerX;
      const z = wall.horizontal ? wall.centerZ : center(start, end);
      piece(span, top - bottom, x, (top + bottom) / 2, z, wallFaceMaterial, surface);
    };
    let cursor = 0;
    for (const opening of sideOpenings) {
      const start = Math.max(cursor, opening.start);
      const end = Math.max(start, opening.end);
      addSpan(cursor, start, 0, height);
      const mid = center(start, end);
      const x = wall.horizontal ? mid : wall.centerX;
      const z = wall.horizontal ? wall.centerZ : mid;
      if (opening.type === 'window') {
        const sill = Math.min(0.92, height * 0.34);
        const head = Math.min(height - 0.08, 2.18);
        addSpan(start, end, 0, sill);
        addSpan(start, end, head, height);
        const paneDepth = thickness * 0.38;
        const pane = addBox(group, wall.horizontal ? end - start : paneDepth, wall.horizontal ? paneDepth : end - start, Math.max(0.1, head - sill), x, (sill + head) / 2, z, glassMaterial);
        pane.castShadow = false;
        const frameWidth = 0.045;
        for (const offset of [start, end]) {
          const fx = wall.horizontal ? origin + offset : wall.centerX;
          const fz = wall.horizontal ? wall.centerZ : origin + offset;
          addBox(group, wall.horizontal ? frameWidth : thickness * 0.55, wall.horizontal ? thickness * 0.55 : frameWidth, head - sill + 0.08, fx, (sill + head) / 2, fz, frameMaterial);
        }
        addBox(group, wall.horizontal ? end - start : thickness * 0.55, wall.horizontal ? thickness * 0.55 : end - start, frameWidth, x, sill, z, frameMaterial);
      } else {
        const doorHeight = Math.min(2.08, height - 0.12);
        addSpan(start, end, doorHeight, height);
        const leaf = addBox(group, wall.horizontal ? end - start - 0.05 : 0.045, wall.horizontal ? 0.045 : end - start - 0.05, doorHeight - 0.04, x, (doorHeight - 0.04) / 2, z, doorMaterial);
        leaf.castShadow = false;
        for (const offset of [start, end]) {
          const fx = wall.horizontal ? origin + offset : wall.centerX;
          const fz = wall.horizontal ? wall.centerZ : origin + offset;
          addBox(group, wall.horizontal ? 0.055 : thickness * 0.55, wall.horizontal ? thickness * 0.55 : 0.055, doorHeight, fx, doorHeight / 2, fz, frameMaterial);
        }
      }
      cursor = Math.max(cursor, end);
    }
    addSpan(cursor, wall.length, 0, height);
  }
  return { groups, wallMaterials, faces };
}

/**
 * Selection overlay for a floor or wall: a bright outline plus a faint fill.
 * It is a separate object, so the real material is never tinted, and it is
 * flagged `exportHidden` so snapshot export can hide it.
 */
export function createSurfaceHighlight(
  surface: SurfaceId,
  room: { width: number; depth: number; height: number; thickness: number },
): THREE.Group {
  let size: THREE.Vector3;
  const position = new THREE.Vector3();
  if (surface === 'floor') {
    size = new THREE.Vector3(room.width, 0.02, room.depth);
    position.set(0, 0.03, 0);
  } else {
    const side = surface.slice(5) as WallSide;
    const horizontal = side === 'north' || side === 'south';
    size = new THREE.Vector3(horizontal ? room.width : room.thickness, room.height, horizontal ? room.thickness : room.depth);
    position.set(side === 'west' ? -room.width / 2 : side === 'east' ? room.width / 2 : 0, room.height / 2, side === 'north' ? -room.depth / 2 : side === 'south' ? room.depth / 2 : 0);
  }
  const box = new THREE.BoxGeometry(size.x, size.y, size.z);
  const outline = new THREE.LineSegments(new THREE.EdgesGeometry(box), new THREE.LineBasicMaterial({ color: 0x2f80ed, depthTest: false, transparent: true }));
  const fill = new THREE.Mesh(box, new THREE.MeshBasicMaterial({
    color: 0x2f80ed, transparent: true, opacity: 0.14, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  }));
  outline.renderOrder = 999;
  fill.renderOrder = 998;
  const group = new THREE.Group();
  group.add(fill, outline);
  group.position.copy(position);
  group.name = 'surface-highlight';
  group.userData.exportHidden = true;
  group.userData.highlightFor = surface;
  return group;
}
