/**
 * Built-in finishes available to the floor-plan editor.
 *
 * Variant IDs are persisted in project data, so they are intentionally stable
 * identifiers rather than filenames or user-provided URLs.
 */
export type BuiltInMaterialId = 'paint' | 'tile' | 'marble' | 'wood';

export interface MaterialVariant {
  id: string;
  materialId: BuiltInMaterialId;
  name: string;
  color: string;
  roughness: number;
  /** A public path for an optional repeatable base-colour texture. */
  mapUrl?: string;
}

export const MATERIAL_CATALOG: readonly MaterialVariant[] = [
  { id: 'paint-warm-white', materialId: 'paint', name: 'Warm White Paint', color: '#e7e1d8', roughness: 0.8 },
  { id: 'paint-sage', materialId: 'paint', name: 'Sage Paint', color: '#b9c5b1', roughness: 0.82 },
  { id: 'paint-charcoal', materialId: 'paint', name: 'Charcoal Paint', color: '#53504b', roughness: 0.78 },
  { id: 'tile-white-matte', materialId: 'tile', name: 'White Matte Tile', color: '#e8e5de', roughness: 0.62, mapUrl: '/assets/materials/white-tile.svg' },
  { id: 'marble-carrara', materialId: 'marble', name: 'Carrara Marble', color: '#deded9', roughness: 0.38, mapUrl: '/assets/materials/carrara-marble.svg' },
  { id: 'wood-light-oak', materialId: 'wood', name: 'Light Oak', color: '#b98c5d', roughness: 0.57, mapUrl: '/assets/materials/light-oak.svg' },
] as const;

export const DEFAULT_VARIANT_BY_MATERIAL: Readonly<Record<BuiltInMaterialId, string>> = {
  paint: 'paint-warm-white',
  tile: 'tile-white-matte',
  marble: 'marble-carrara',
  wood: 'wood-light-oak',
};

export function getMaterialVariant(variantId: string | undefined, materialId: BuiltInMaterialId = 'paint'): MaterialVariant {
  const matched = MATERIAL_CATALOG.find((variant) => variant.id === variantId && variant.materialId === materialId);
  if (matched) return matched;
  const fallbackId = DEFAULT_VARIANT_BY_MATERIAL[materialId];
  return MATERIAL_CATALOG.find((variant) => variant.id === fallbackId) ?? MATERIAL_CATALOG[0];
}
