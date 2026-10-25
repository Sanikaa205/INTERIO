import * as THREE from 'three';
import type { MaterialVariant } from './materialCatalog';

export interface Materials {
  wall: THREE.MeshStandardMaterial;
  exteriorWall: THREE.MeshStandardMaterial;
  ceiling: THREE.MeshStandardMaterial;
  door: THREE.MeshStandardMaterial;
  mainDoor: THREE.MeshStandardMaterial;
  frame: THREE.MeshStandardMaterial;
  glass: THREE.MeshStandardMaterial;
}

export function makeMaterials(): Materials {
  return {
    wall: new THREE.MeshStandardMaterial({ color: '#e7e1d8', roughness: 0.8 }),
    exteriorWall: new THREE.MeshStandardMaterial({ color: '#d6d0c7', roughness: 0.85 }),
    ceiling: new THREE.MeshStandardMaterial({ color: '#f4f1ec', side: THREE.BackSide }),
    door: new THREE.MeshStandardMaterial({ color: '#8a6244', roughness: 0.65 }),
    mainDoor: new THREE.MeshStandardMaterial({ color: '#4e3424', roughness: 0.7 }),
    frame: new THREE.MeshStandardMaterial({ color: '#b18a63', roughness: 0.6 }),
    glass: new THREE.MeshStandardMaterial({ color: '#8fc7dc', transparent: true, opacity: 0.25, roughness: 0.05, depthWrite: false }),
  };
}

export function floorMaterial(color: string): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
}

/**
 * 1.4 — Texture cache keyed by URL + tiling so different repeats on the same
 * image don't share state, and each entry can register independent load callbacks.
 */
const textureCache = new Map<string, THREE.Texture>();

/**
 * 1.4 — Per-cache-key list of pending `invalidate` callbacks waiting for the
 * texture to finish loading. Cleared once the texture's `onLoad` fires.
 */
const pendingInvalidators = new Map<string, Array<() => void>>();

function getTexture(url: string, repeatX: number, repeatY: number, onLoad?: () => void): THREE.Texture {
  // Repeat belongs to Texture rather than Material. Cache by its resolved
  // tiling too, so a finish applied to one surface cannot alter another.
  const cacheKey = `${url}:${repeatX.toFixed(4)}:${repeatY.toFixed(4)}`;
  const cached = textureCache.get(cacheKey);
  if (cached) {
    // 1.4 — Texture already loaded; call invalidate immediately if provided.
    // (image.complete is not always available in Three.js, so we check userData)
    if (onLoad && cached.userData?.loaded) {
      onLoad();
    } else if (onLoad) {
      // Still loading — queue the callback.
      const queue = pendingInvalidators.get(cacheKey) ?? [];
      queue.push(onLoad);
      pendingInvalidators.set(cacheKey, queue);
    }
    return cached;
  }

  // 1.4 — Load with onLoad/onError callbacks; fall back gracefully on error.
  const texture = new THREE.TextureLoader().load(
    url,
    // onLoad:
    (tex) => {
      tex.userData.loaded = true;
      // Drain all queued invalidators.
      const queue = pendingInvalidators.get(cacheKey) ?? [];
      queue.forEach((fn) => fn());
      pendingInvalidators.delete(cacheKey);
    },
    // onProgress: (unused)
    undefined,
    // onError: texture failed to load — log a warning; the fallback colour
    // already set on the material will remain visible.
    () => {
      console.warn(`[materials] Failed to load texture: ${url}`);
      // Mark as loaded so future callers don't keep queuing.
      texture.userData.loaded = true;
      const queue = pendingInvalidators.get(cacheKey) ?? [];
      queue.forEach((fn) => fn());
      pendingInvalidators.delete(cacheKey);
    },
  );
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  textureCache.set(cacheKey, texture);

  if (onLoad) {
    const queue = pendingInvalidators.get(cacheKey) ?? [];
    queue.push(onLoad);
    pendingInvalidators.set(cacheKey, queue);
  }

  return texture;
}

export interface FinishMaterialOptions {
  /** Physical dimensions in metres, used to make texture tiling predictable. */
  width: number;
  height: number;
  /** Metres represented by one texture repeat. Defaults to one metre. */
  scale?: number;
  color?: string;
  roughness?: number;
  /**
   * 1.4 — Called once when the texture finishes loading (or immediately if it
   * is already cached). Callers should use this to call `invalidate()` so the
   * demand frameloop re-renders after the texture arrives.
   */
  onTextureLoad?: () => void;
}

/**
 * Produces a material instance for a single editable surface. Callers own and
 * dispose the material; texture maps are cached and intentionally shared.
 *
 * 1.4: The `fallback colour` is always set so surfaces look correct while
 * the texture image is still downloading.
 */
export function createFinishMaterial(variant: MaterialVariant, options: FinishMaterialOptions): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    color: options.color ?? variant.color,
    roughness: options.roughness ?? variant.roughness,
  });
  if (!variant.mapUrl) return material;

  const metresPerRepeat = Number.isFinite(options.scale) && (options.scale ?? 0) > 0 ? options.scale! : 1;
  const texture = getTexture(
    variant.mapUrl,
    Math.max(options.width, 0.01) / metresPerRepeat,
    Math.max(options.height, 0.01) / metresPerRepeat,
    options.onTextureLoad,
  );
  material.map = texture;
  material.needsUpdate = true;
  return material;
}

export function disposeMaterials(materials: Materials): void {
  Object.values(materials).forEach((material) => material.dispose());
}
