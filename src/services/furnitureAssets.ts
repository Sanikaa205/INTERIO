import type { FurnitureCategory } from '../types';

export interface FurnitureAsset { id: string; label: string; categories: FurnitureCategory[]; keywords: string[]; url: string; }

// Local GLB library. Unknown/missing matches retain the existing procedural Three.js fallback.
export const FURNITURE_ASSETS: FurnitureAsset[] = [
  { id: 'sofa', label: 'Sofa', categories: ['seating'], keywords: ['sofa', 'couch', 'settee'], url: '/assets/furniture/sofa.glb' },
  { id: 'chair', label: 'Chair', categories: ['seating'], keywords: ['chair', 'armchair', 'stool'], url: '/assets/furniture/chair.glb' },
  { id: 'bed', label: 'Bed', categories: ['bed'], keywords: ['bed', 'mattress'], url: '/assets/furniture/bed.glb' },
  { id: 'table', label: 'Table', categories: ['table'], keywords: ['table', 'desk', 'dining'], url: '/assets/furniture/table.glb' },
  { id: 'storage', label: 'Storage', categories: ['storage'], keywords: ['cabinet', 'shelf', 'dresser', 'bookcase', 'wardrobe', 'storage'], url: '/assets/furniture/storage.glb' },
  { id: 'lamp', label: 'Lamp', categories: ['lighting'], keywords: ['lamp', 'light', 'floor lamp'], url: '/assets/furniture/lamp.glb' },
];

export function matchFurnitureAsset(item: { name: string; category: FurnitureCategory }): FurnitureAsset | null {
  const name = item.name.toLowerCase();
  return FURNITURE_ASSETS.find((asset) => asset.keywords.some((word) => name.includes(word)))
    || FURNITURE_ASSETS.find((asset) => asset.categories.includes(item.category))
    || null;
}
