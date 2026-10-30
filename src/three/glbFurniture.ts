import * as THREE from 'three';
import type { FurnitureItem } from '../types';

/**
 * GLB furniture helpers. A model is sized to the item's width x height x depth,
 * stood on the floor with its pivot at the footprint centre, and recoloured by
 * material name:
 *   - a material named `main` (or containing "main") takes the body colour (`item.color`)
 *   - a material named `frame` (or containing "frame") takes the frame colour
 *     (`item.frameColor`, else its own colour)
 *   - a material named `main_frame` (wooden pieces) takes the frame colour if one
 *     is set, otherwise the body colour
 * Models with no such names keep their own colours and get a light tint, so any
 * model works but well-prepared ones are fully recolourable.
 * See public/assets/furniture/README.md for how to prepare a model.
 */

export const MAIN_MATERIAL = /main/i;
export const FRAME_MATERIAL = /frame/i;

export interface GlbLoaderLike {
  load(
    url: string,
    onLoad: (gltf: { scene: THREE.Object3D }) => void,
    onProgress: ((event: unknown) => void) | undefined,
    onError: (error: unknown) => void,
  ): void;
}

/** Scales the model to the item's size (non-uniform) and re-centres it on the floor at the origin. Returns false for an empty model. */
export function fitModelToItem(
  model: THREE.Object3D,
  item: Pick<FurnitureItem, 'width' | 'depth' | 'height' | 'category'>,
  maxStretch = Infinity,
): boolean {
  model.position.set(0, 0, 0);
  model.scale.set(1, 1, 1);
  model.updateMatrixWorld(true);
  const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
  if (!(size.x > 1e-6 && size.y > 1e-6 && size.z > 1e-6)) return false;
  const height = item.height || (item.category === 'seating' ? 0.95 : 0.8);
  const scale = [Math.max(0.05, item.width) / size.x, Math.max(0.02, height) / size.y, Math.max(0.05, item.depth) / size.z];
  // A model that would have to be stretched too far looks wrong: leave it to the procedural piece.
  if (Math.max(...scale) / Math.min(...scale) > maxStretch) return false;
  model.scale.set(scale[0], scale[1], scale[2]);
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const centre = box.getCenter(new THREE.Vector3());
  model.position.set(-centre.x, -box.min.y, -centre.z);
  model.updateMatrixWorld(true);
  return true;
}

function eachMaterial(model: THREE.Object3D, visit: (material: THREE.Material, mesh: THREE.Mesh) => THREE.Material) {
  model.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.castShadow = true;
    child.receiveShadow = true;
    child.material = Array.isArray(child.material) ? child.material.map((m) => visit(m, child)) : visit(child.material, child);
  });
}

const hasColor = (m: THREE.Material): m is THREE.MeshStandardMaterial => 'color' in m && Boolean((m as THREE.MeshStandardMaterial).color);

/**
 * Recolours the model's named materials (clones them, so a cached model is never
 * changed). Returns which names were found, so callers can fall back to a tint.
 */
export function recolorModel(
  model: THREE.Object3D,
  colors: { main?: string; frame?: string },
): { main: boolean; frame: boolean } {
  const found = { main: false, frame: false };
  eachMaterial(model, (material) => {
    const isMain = MAIN_MATERIAL.test(material.name);
    const isFrame = FRAME_MATERIAL.test(material.name);
    if (!(isMain || isFrame) || !hasColor(material)) return material;
    const clone = material.clone();
    // Both words (wooden pieces): the frame colour if set, else the body colour.
    const color = isMain && isFrame ? colors.frame ?? colors.main : isMain ? colors.main : colors.frame;
    if (color) {
      // Multiplying a photographic texture can never lighten it (a black leather sofa stays
      // black), so an explicit colour replaces the texture; the normal and roughness maps
      // keep the fabric or grain relief.
      const standard = clone as THREE.MeshStandardMaterial;
      standard.map = null;
      standard.color.set(color);
    }
    if (isMain) found.main = true;
    if (isFrame) found.frame = true;
    return clone;
  });
  return found;
}

/** Light tint for models without `main`/`frame` materials. */
export function tintModel(model: THREE.Object3D, color: string, amount = 0.22): void {
  const tint = new THREE.Color(color);
  eachMaterial(model, (material) => {
    if (!hasColor(material)) return material;
    const clone = material.clone() as THREE.MeshStandardMaterial;
    clone.color.lerp(tint, amount);
    return clone;
  });
}

/**
 * Applies the item's colours. A model keeps its own look until the user changes
 * something: only an edited body colour (differs from `generatedColor`) or a set
 * frame colour recolours the named materials. Models without `main`/`frame`
 * materials get a light tint of the body colour instead.
 */
export function applyItemColors(model: THREE.Object3D, item: Pick<FurnitureItem, 'color' | 'frameColor' | 'generatedColor'>, fallbackColor = '#b8a58d'): void {
  const bodyEdited = Boolean(item.color && item.generatedColor && item.color.toLowerCase() !== item.generatedColor.toLowerCase());
  const found = recolorModel(model, { main: bodyEdited ? item.color : undefined, frame: item.frameColor });
  if (!found.main && !found.frame) tintModel(model, item.color || fallbackColor);
}

/**
 * Loads, sizes and recolours a GLB for an item. Resolves to the ready model, or
 * `null` on any failure (missing file, bad data, empty model), so the caller keeps
 * its procedural fallback. Never rejects.
 */
export function loadFurnitureModel(
  url: string,
  item: FurnitureItem,
  loader: GlbLoaderLike,
  options: { maxStretch?: number; flip?: boolean } = {},
): Promise<THREE.Object3D | null> {
  return new Promise((resolve) => {
    try {
      loader.load(
        url,
        (gltf) => {
          try {
            const model = gltf.scene;
            // Turn first (a half turn keeps width and depth), then size to the piece.
            model.rotation.set(0, options.flip ? Math.PI : 0, 0);
            if (!fitModelToItem(model, item, options.maxStretch)) return resolve(null);
            applyItemColors(model, item);
            const holder = new THREE.Group();
            holder.add(model);
            resolve(holder);
          } catch {
            resolve(null);
          }
        },
        undefined,
        () => resolve(null),
      );
    } catch {
      resolve(null);
    }
  });
}

/**
 * Wraps a loader so each file is fetched and parsed once. Every load gets its
 * own clone of the scene (sized and recoloured per piece); materials are shared
 * until `recolorModel`/`tintModel` clone the ones they change.
 */
export function createCachedGlbLoader(loader: GlbLoaderLike): GlbLoaderLike {
  const cache = new Map<string, Promise<THREE.Object3D>>();
  return {
    load(url, onLoad, onProgress, onError) {
      let pending = cache.get(url);
      if (!pending) {
        pending = new Promise<THREE.Object3D>((resolve, reject) => {
          loader.load(url, (gltf) => resolve(gltf.scene), onProgress, reject);
        });
        cache.set(url, pending);
        // A failed file is not cached, so a later attempt can retry.
        pending.catch(() => cache.delete(url));
      }
      pending.then((scene) => onLoad({ scene: scene.clone(true) }), onError);
    },
  };
}
