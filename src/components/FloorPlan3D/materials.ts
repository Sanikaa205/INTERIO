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
 * 1.4 — Each image is loaded once per URL. Tiled variants (repeat/offset) are
 * clones that share the loaded image, so different surfaces never share tiling
 * state. Materials only attach a map once it is usable (an unloaded map
 * renders black).
 */
interface SourceEntry {
  texture: THREE.Texture;
  state: 'loading' | 'loaded' | 'failed';
  waiting: Array<() => void>;
}

const sourceCache = new Map<string, SourceEntry>();
const tiledCache = new Map<string, THREE.Texture>();

function loadSource(url: string): SourceEntry {
  let entry = sourceCache.get(url);
  if (entry) return entry;
  const created: SourceEntry = { texture: new THREE.Texture(), state: 'loading', waiting: [] };
  const settle = (state: 'loaded' | 'failed') => {
    created.state = state;
    created.waiting.splice(0).forEach((fn) => fn());
  };
  created.texture = new THREE.TextureLoader().load(
    url,
    () => settle('loaded'),
    undefined,
    () => {
      console.warn(`[materials] Failed to load texture: ${url}`);
      settle('failed');
    },
  );
  sourceCache.set(url, created);
  entry = created;
  return entry;
}

interface Tiling {
  repeatX: number;
  repeatY: number;
  offsetX: number;
  offsetY: number;
}

/** Calls `onReady` with the tiled texture once loaded, or `null` if the file is missing. */
function withTexture(url: string, tiling: Tiling, onReady: (texture: THREE.Texture | null) => void): void {
  const source = loadSource(url);
  const ready = () => {
    if (source.state === 'failed') {
      onReady(null);
      return;
    }
    const key = [url, tiling.repeatX, tiling.repeatY, tiling.offsetX, tiling.offsetY].map((v) => (typeof v === 'number' ? v.toFixed(4) : v)).join(':');
    let texture = tiledCache.get(key);
    if (!texture) {
      texture = source.texture.clone();
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(tiling.repeatX, tiling.repeatY);
      texture.offset.set(tiling.offsetX, tiling.offsetY);
      texture.needsUpdate = true; // a clone must be re-uploaded
      tiledCache.set(key, texture);
    }
    onReady(texture);
  };
  if (source.state === 'loading') source.waiting.push(ready);
  else ready();
}

/** Materials disposed before their texture arrived; they must not be revived. */
const disposed = new WeakSet<THREE.Material>();

export interface FinishMaterialOptions {
  /** Physical dimensions in metres, used to make texture tiling predictable. */
  width: number;
  height: number;
  /** Metres represented by one texture repeat. Defaults to one metre. */
  scale?: number;
  /**
   * Where the surface starts, in metres, so neighbouring pieces of one face
   * continue the same pattern. Callers work out the sign for faces
   * whose U axis runs against the wall direction.
   */
  offsetX?: number;
  offsetY?: number;
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
  // Textured finishes treat `color` as a tint, so without one the texture shows
  // its true colour; the variant colour only stands in until the map loads.
  const material = new THREE.MeshStandardMaterial({
    color: options.color ?? variant.color,
    roughness: options.roughness ?? variant.roughness,
  });
  if (!variant.mapUrl) return material;
  material.addEventListener('dispose', () => disposed.add(material));

  const requested = options.scale ?? variant.defaultScale;
  const metresPerRepeat = Number.isFinite(requested) && (requested ?? 0) > 0 ? requested! : 1;
  // The fallback colour stays visible until the map is ready; a missing file
  // simply keeps the fallback colour.
  withTexture(
    variant.mapUrl,
    {
      repeatX: Math.max(options.width, 0.01) / metresPerRepeat,
      repeatY: Math.max(options.height, 0.01) / metresPerRepeat,
      offsetX: (options.offsetX ?? 0) / metresPerRepeat,
      offsetY: (options.offsetY ?? 0) / metresPerRepeat,
    },
    (texture) => {
      if (!texture || disposed.has(material)) return;
      material.map = texture;
      if (!options.color) material.color.set('#ffffff');
      material.needsUpdate = true;
      options.onTextureLoad?.();
    },
  );
  return material;
}

export function disposeMaterials(materials: Materials): void {
  Object.values(materials).forEach((material) => material.dispose());
}
