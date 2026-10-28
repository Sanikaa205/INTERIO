/**
 * Built-in finishes available to the floor-plan editor.
 *
 * Variant IDs are persisted in project data, so they are intentionally stable
 * identifiers rather than filenames or user-provided URLs. Never rename or
 * remove one; add new variants instead.
 */
import type { FinishMaterialId } from '../../types';

export type BuiltInMaterialId = FinishMaterialId;
export type CatalogSurface = 'floor' | 'wall' | 'ceiling';

export interface MaterialVariant {
  id: string;
  materialId: BuiltInMaterialId;
  /** Group heading shown in the editor, e.g. "Wood" or "Wallpaper". */
  category: string;
  name: string;
  /** Surfaces this variant is offered for. */
  surfaces: readonly CatalogSurface[];
  /** Fallback colour, shown until the texture loads (and as the paint colour). */
  color: string;
  roughness: number;
  /** A public path for an optional repeatable base-colour texture. */
  mapUrl?: string;
  /** Metres covered by one texture repeat; defaults to 1. */
  defaultScale?: number;
  /** Optional small preview image; the texture itself is used when absent. */
  thumbnailUrl?: string;
}

const M = '/assets/materials/';
const FLOOR: readonly CatalogSurface[] = ['floor'];
const FLOOR_WALL: readonly CatalogSurface[] = ['floor', 'wall'];
const WALL: readonly CatalogSurface[] = ['wall'];
const ALL: readonly CatalogSurface[] = ['floor', 'wall', 'ceiling'];

export const MATERIAL_CATALOG: readonly MaterialVariant[] = [
  // Paint: flat colour with a finish (matte / satin / gloss).
  { id: 'paint-warm-white', materialId: 'paint', category: 'Paint', name: 'Warm White Paint', surfaces: ALL, color: '#e7e1d8', roughness: 0.8 },
  { id: 'paint-sage', materialId: 'paint', category: 'Paint', name: 'Sage Paint', surfaces: ALL, color: '#b9c5b1', roughness: 0.82 },
  { id: 'paint-charcoal', materialId: 'paint', category: 'Paint', name: 'Charcoal Paint', surfaces: ALL, color: '#53504b', roughness: 0.78 },
  { id: 'paint-matte-white', materialId: 'paint', category: 'Paint', name: 'Matte White', surfaces: ALL, color: '#f2efe9', roughness: 0.95 },
  { id: 'paint-satin-white', materialId: 'paint', category: 'Paint', name: 'Satin White', surfaces: ALL, color: '#f2efe9', roughness: 0.55 },
  { id: 'paint-gloss-white', materialId: 'paint', category: 'Paint', name: 'Gloss White', surfaces: ALL, color: '#f2efe9', roughness: 0.2 },

  // Wood
  { id: 'wood-light-oak', materialId: 'wood', category: 'Wood', name: 'Light Oak', surfaces: FLOOR_WALL, color: '#b98c5d', roughness: 0.57, mapUrl: `${M}light-oak.svg` },
  { id: 'wood-walnut', materialId: 'wood', category: 'Wood', name: 'Walnut', surfaces: FLOOR, color: '#6b4429', roughness: 0.55, mapUrl: `${M}walnut.jpg`, defaultScale: 0.8 },
  { id: 'wood-dark-walnut', materialId: 'wood', category: 'Wood', name: 'Dark Walnut', surfaces: FLOOR, color: '#33201a', roughness: 0.5, mapUrl: `${M}dark-walnut.jpg`, defaultScale: 0.8 },
  { id: 'wood-grey-oak', materialId: 'wood', category: 'Wood', name: 'Grey-washed Oak', surfaces: FLOOR, color: '#a19d95', roughness: 0.62, mapUrl: `${M}grey-oak.jpg`, defaultScale: 0.8 },
  { id: 'wood-maple', materialId: 'wood', category: 'Wood', name: 'Maple', surfaces: FLOOR, color: '#dcb77f', roughness: 0.55, mapUrl: `${M}maple.jpg`, defaultScale: 0.8 },
  { id: 'wood-slat-panel', materialId: 'wood', category: 'Wood slat panelling', name: 'Slat Panelling', surfaces: WALL, color: '#8a6240', roughness: 0.65, mapUrl: `${M}slat-panel.jpg`, defaultScale: 0.72 },

  // Tile
  { id: 'tile-white-matte', materialId: 'tile', category: 'Tile', name: 'White Matte Tile', surfaces: FLOOR_WALL, color: '#e8e5de', roughness: 0.62, mapUrl: `${M}white-tile.svg` },
  { id: 'tile-grey', materialId: 'tile', category: 'Tile', name: 'Grey Tile', surfaces: FLOOR_WALL, color: '#9a9c9d', roughness: 0.5, mapUrl: `${M}grey-tile.jpg`, defaultScale: 1.2 },
  { id: 'tile-beige', materialId: 'tile', category: 'Tile', name: 'Beige Tile', surfaces: FLOOR_WALL, color: '#d8c8a8', roughness: 0.5, mapUrl: `${M}beige-tile.jpg`, defaultScale: 1.2 },
  { id: 'tile-black', materialId: 'tile', category: 'Tile', name: 'Black Tile', surfaces: FLOOR_WALL, color: '#26272a', roughness: 0.35, mapUrl: `${M}black-tile.jpg`, defaultScale: 1.2 },
  { id: 'tile-terracotta', materialId: 'tile', category: 'Tile', name: 'Terracotta Tile', surfaces: FLOOR, color: '#b5683f', roughness: 0.75, mapUrl: `${M}terracotta-tile.jpg`, defaultScale: 0.9 },

  // Marble
  { id: 'marble-carrara', materialId: 'marble', category: 'Marble', name: 'Carrara Marble', surfaces: FLOOR_WALL, color: '#deded9', roughness: 0.38, mapUrl: `${M}carrara-marble.svg` },
  { id: 'marble-calacatta', materialId: 'marble', category: 'Marble', name: 'Calacatta Marble', surfaces: FLOOR_WALL, color: '#f4f2ee', roughness: 0.25, mapUrl: `${M}calacatta-marble.jpg`, defaultScale: 1.2 },
  { id: 'marble-nero-marquina', materialId: 'marble', category: 'Marble', name: 'Nero Marquina', surfaces: FLOOR_WALL, color: '#16171a', roughness: 0.22, mapUrl: `${M}nero-marquina.jpg`, defaultScale: 1.2 },

  // Granite and concrete
  { id: 'granite-black', materialId: 'granite', category: 'Granite', name: 'Black Granite', surfaces: FLOOR, color: '#2a2b2f', roughness: 0.3, mapUrl: `${M}black-granite.jpg`, defaultScale: 0.8 },
  { id: 'granite-grey', materialId: 'granite', category: 'Granite', name: 'Grey Granite', surfaces: FLOOR, color: '#9a9ca0', roughness: 0.32, mapUrl: `${M}grey-granite.jpg`, defaultScale: 0.8 },
  { id: 'concrete-polished', materialId: 'concrete', category: 'Concrete', name: 'Polished Concrete', surfaces: FLOOR_WALL, color: '#a9a8a3', roughness: 0.45, mapUrl: `${M}polished-concrete.jpg`, defaultScale: 1.5 },

  // Wall-only: masonry, wallpaper, plaster
  { id: 'brick-red', materialId: 'brick', category: 'Brick', name: 'Red Brick', surfaces: WALL, color: '#a2452f', roughness: 0.9, mapUrl: `${M}red-brick.jpg`, defaultScale: 0.8 },
  { id: 'brick-whitewashed', materialId: 'brick', category: 'Brick', name: 'Whitewashed Brick', surfaces: WALL, color: '#e6e1d8', roughness: 0.88, mapUrl: `${M}whitewashed-brick.jpg`, defaultScale: 0.8 },
  { id: 'stone-stacked', materialId: 'stone', category: 'Stone', name: 'Stacked Stone', surfaces: WALL, color: '#8c867a', roughness: 0.95, mapUrl: `${M}stacked-stone.jpg`, defaultScale: 0.8 },
  { id: 'wallpaper-stripe', materialId: 'wallpaper', category: 'Wallpaper', name: 'Stripe Wallpaper', surfaces: WALL, color: '#d9d9c8', roughness: 0.85, mapUrl: `${M}wallpaper-stripe.jpg`, defaultScale: 0.5 },
  { id: 'wallpaper-geometric', materialId: 'wallpaper', category: 'Wallpaper', name: 'Geometric Wallpaper', surfaces: WALL, color: '#c4c8c8', roughness: 0.85, mapUrl: `${M}wallpaper-geometric.jpg`, defaultScale: 0.6 },
  { id: 'wallpaper-damask', materialId: 'wallpaper', category: 'Wallpaper', name: 'Damask Wallpaper', surfaces: WALL, color: '#cdbf9e', roughness: 0.85, mapUrl: `${M}wallpaper-damask.jpg`, defaultScale: 0.7 },
  { id: 'plaster-venetian', materialId: 'plaster', category: 'Plaster', name: 'Venetian Plaster', surfaces: ['wall', 'ceiling'], color: '#d9d0c1', roughness: 0.6, mapUrl: `${M}venetian-plaster.jpg`, defaultScale: 1.2 },
] as const;

export const DEFAULT_VARIANT_BY_MATERIAL: Readonly<Record<BuiltInMaterialId, string>> = {
  paint: 'paint-warm-white',
  tile: 'tile-white-matte',
  marble: 'marble-carrara',
  wood: 'wood-light-oak',
  granite: 'granite-black',
  concrete: 'concrete-polished',
  brick: 'brick-red',
  stone: 'stone-stacked',
  wallpaper: 'wallpaper-stripe',
  plaster: 'plaster-venetian',
};

/** Order in which materials appear in the editor. */
export const MATERIAL_ORDER: readonly BuiltInMaterialId[] = [
  'paint', 'wood', 'tile', 'marble', 'granite', 'concrete', 'brick', 'stone', 'wallpaper', 'plaster',
];

export function getMaterialVariant(variantId: string | undefined, materialId: BuiltInMaterialId = 'paint'): MaterialVariant {
  const matched = MATERIAL_CATALOG.find((variant) => variant.id === variantId && variant.materialId === materialId);
  if (matched) return matched;
  const fallbackId = DEFAULT_VARIANT_BY_MATERIAL[materialId];
  return MATERIAL_CATALOG.find((variant) => variant.id === fallbackId) ?? MATERIAL_CATALOG[0];
}

export function variantsForSurface(surface: CatalogSurface): MaterialVariant[] {
  return MATERIAL_CATALOG.filter((variant) => variant.surfaces.includes(surface));
}

export function materialsForSurface(surface: CatalogSurface): BuiltInMaterialId[] {
  const offered = new Set(variantsForSurface(surface).map((variant) => variant.materialId));
  return MATERIAL_ORDER.filter((id) => offered.has(id));
}

/** First variant of a material offered for the surface (falls back to the material default). */
export function defaultVariantFor(materialId: BuiltInMaterialId, surface: CatalogSurface): MaterialVariant {
  const preferred = getMaterialVariant(undefined, materialId);
  if (preferred.surfaces.includes(surface)) return preferred;
  return variantsForSurface(surface).find((variant) => variant.materialId === materialId) ?? preferred;
}
