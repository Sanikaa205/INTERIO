import * as THREE from 'three';
import type { MaterialVariant } from '../components/FloorPlan3D/materialCatalog';

export type RenderQuality = 'high' | 'balanced';

export interface QualitySettings {
  pixelRatio: number;
  shadowMapSize: number;
  /** Window fill lights are cheap (no shadows), so every quality keeps them. */
  anisotropy: number;
}

/** Pixel ratio, shadow-map size and texture filtering for a quality level on a given screen. */
export function qualitySettings(quality: RenderQuality, devicePixelRatio: number, maxAnisotropy = 8): QualitySettings {
  const ratio = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  return quality === 'high'
    ? { pixelRatio: Math.min(ratio, 2), shadowMapSize: 2048, anisotropy: Math.min(8, maxAnisotropy) }
    : { pixelRatio: Math.min(ratio, 1.25), shadowMapSize: 1024, anisotropy: Math.min(4, maxAnisotropy) };
}

/** A sensible first choice: balanced on phones and low-core machines, high otherwise. */
export function defaultQuality(width: number, cores: number | undefined): RenderQuality {
  return width < 768 || (cores !== undefined && cores <= 4) ? 'balanced' : 'high';
}

/**
 * Sun shadow frustum fitted to the room instead of a fixed 40 m box, so the
 * shadow map's resolution lands on the room and shadows stay crisp.
 */
export function shadowFrustum(roomWidth: number, roomLength: number, wallHeight: number) {
  const half = Math.hypot(roomWidth, roomLength) / 2 + 1;
  return { half, near: 0.5, far: Math.max(30, half * 2 + wallHeight * 4) };
}

/** Where the sun sits for a room: same direction as before, distance scaled to the room. */
export function sunPosition(roomWidth: number, roomLength: number, wallHeight: number): THREE.Vector3 {
  const reach = Math.max(roomWidth, roomLength, wallHeight * 2);
  return new THREE.Vector3(reach * 0.9, reach * 1.5 + wallHeight, reach * 0.7);
}

// ---- contact shadows

let blobTexture: THREE.CanvasTexture | null = null;
function getBlobTexture(): THREE.CanvasTexture | null {
  if (blobTexture) return blobTexture;
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const gradient = ctx.createRadialGradient(64, 64, 6, 64, 64, 62);
  gradient.addColorStop(0, 'rgba(0,0,0,0.9)');
  gradient.addColorStop(0.55, 'rgba(0,0,0,0.45)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  blobTexture = new THREE.CanvasTexture(canvas);
  return blobTexture;
}

/** True for pieces that lie flat on the floor (a blob under them would look wrong). */
export function isFlatPiece(item: { name: string; category: string }): boolean {
  return item.category === 'decor' && /rug|carpet|mat/i.test(item.name) || /\brug\b|carpet/i.test(item.name);
}

/**
 * A soft dark blob just above the floor under a piece, so furniture looks
 * grounded even where the real shadow is faint. It is a child of the piece (so
 * it moves and turns with it) and ignores raycasts, so it never steals clicks.
 * Returns null for flat pieces or when canvas is unavailable.
 */
export function createContactShadow(item: { name: string; category: string; width: number; depth: number }): THREE.Mesh | null {
  if (isFlatPiece(item)) return null;
  const map = getBlobTexture();
  if (!map) return null;
  const spread = 1.18;
  const geometry = new THREE.PlaneGeometry(Math.max(0.2, item.width) * spread, Math.max(0.2, item.depth) * spread);
  const material = new THREE.MeshBasicMaterial({ map, transparent: true, opacity: 0.4, depthWrite: false, toneMapped: false });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.016;
  mesh.renderOrder = 1;
  mesh.name = 'contact-shadow';
  mesh.raycast = () => undefined;
  mesh.userData.contactShadow = true;
  return mesh;
}

/** Releases the geometry and material of a piece's contact shadow (the texture is shared and kept). */
export function disposeContactShadow(root: THREE.Object3D): void {
  root.traverse((child) => {
    if (child.userData.contactShadow && child instanceof THREE.Mesh) {
      child.geometry.dispose();
      (child.material as THREE.Material).dispose();
    }
  });
}

// ---- surface materials

const BUMPY = new Set(['wood', 'brick', 'stone', 'plaster', 'wallpaper', 'concrete', 'granite']);
const POLISHED = new Set(['marble', 'tile', 'granite']);

/**
 * Makes a catalogue finish read as a real surface: the texture doubles as a
 * bump map for wood, brick, stone, plaster and the like, and polished materials
 * (marble, tile, granite) pick up more of the room reflection. Roughness comes
 * from the catalogue. Safe to call before the texture has arrived (call again,
 * or use `onTextureLoad`, once `material.map` is set).
 */
export function enhanceSurfaceMaterial(material: THREE.MeshStandardMaterial, variant: MaterialVariant): THREE.MeshStandardMaterial {
  material.envMapIntensity = POLISHED.has(variant.materialId) && variant.roughness < 0.6 ? 1 + (0.6 - variant.roughness) * 2.2 : 0.75;
  if (material.map && BUMPY.has(variant.materialId)) {
    material.bumpMap = material.map;
    material.bumpScale = variant.materialId === 'brick' || variant.materialId === 'stone' ? 1.6 : variant.materialId === 'plaster' ? 0.6 : 0.9;
  }
  material.needsUpdate = true;
  return material;
}
