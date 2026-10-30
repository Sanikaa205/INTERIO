import type { ColorSwatch, FurnitureCategory, FurnitureColorRole } from '../types';
import type { RoomKind } from './styleProfiles';

export type CatalogGroup = 'Seating' | 'Tables' | 'Beds' | 'Storage' | 'Lighting' | 'Decor';
export const CATALOG_GROUPS: readonly CatalogGroup[] = ['Seating', 'Tables', 'Beds', 'Storage', 'Lighting', 'Decor'];

export interface CatalogPiece {
  /** Stable id; new pieces get `add-<id>-<n>`. */
  id: string;
  /**
   * Written into the item's name. It has to hit a specific 3D model in
   * `createFurnitureModel` (by name/category) and a specific 2D shape in
   * `InteriorFloorPlan` (by `form name category`), never the generic fallback;
   * furnitureCatalog.test.ts proves both.
   */
  name: string;
  /** Extra word for the 2D plan when the name alone does not pick its shape (e.g. a nightstand draws as a dresser). */
  form?: string;
  group: CatalogGroup;
  category: FurnitureCategory;
  rooms: readonly RoomKind[];
  width: number;
  depth: number;
  height: number;
  material: string;
  colorRole: FurnitureColorRole;
  /** Used when the design's palette has no swatch for the colour role. */
  fallbackColor: string;
  preferredWall?: 'north' | 'south' | 'east' | 'west' | 'center';
  clearance?: number;
  keywords?: readonly string[];
}

const ALL: readonly RoomKind[] = ['living', 'bedroom', 'dining', 'study'];

export const FURNITURE_CATALOG: readonly CatalogPiece[] = [
  // Seating
  { id: 'sofa', name: 'Sofa', group: 'Seating', category: 'seating', rooms: ['living', 'study'], width: 2.1, depth: 0.95, height: 0.85, material: 'Linen upholstery', colorRole: 'hero', fallbackColor: '#b8b9b4', preferredWall: 'north', clearance: 0.5, keywords: ['couch', 'settee'] },
  { id: 'loveseat', name: 'Loveseat', group: 'Seating', category: 'seating', rooms: ['living', 'bedroom'], width: 1.5, depth: 0.9, height: 0.85, material: 'Linen upholstery', colorRole: 'hero', fallbackColor: '#b8b9b4', preferredWall: 'north', clearance: 0.5, keywords: ['two seater', 'sofa'] },
  { id: 'armchair', name: 'Armchair', group: 'Seating', category: 'seating', rooms: ['living', 'bedroom', 'study'], width: 0.85, depth: 0.85, height: 0.85, material: 'Woven fabric', colorRole: 'accent', fallbackColor: '#c9b8a0', preferredWall: 'center', clearance: 0.4, keywords: ['lounge', 'reading'] },
  { id: 'accent-chair', name: 'Accent chair', group: 'Seating', category: 'seating', rooms: ['living', 'bedroom'], width: 0.7, depth: 0.7, height: 0.82, material: 'Upholstered seat, timber legs', colorRole: 'accent', fallbackColor: '#c9b8a0', preferredWall: 'center', clearance: 0.35 },
  { id: 'dining-chair', name: 'Dining chair', group: 'Seating', category: 'seating', rooms: ['dining'], width: 0.45, depth: 0.5, height: 0.85, material: 'Timber with upholstered seat', colorRole: 'soft', fallbackColor: '#d6d2c9', preferredWall: 'center', clearance: 0.2 },
  { id: 'desk-chair', name: 'Desk chair', group: 'Seating', category: 'seating', rooms: ['study', 'bedroom'], width: 0.55, depth: 0.55, height: 0.9, material: 'Mesh and steel', colorRole: 'neutral', fallbackColor: '#4a4a48', preferredWall: 'center', clearance: 0.3, keywords: ['office'] },
  { id: 'stool', name: 'Stool', group: 'Seating', category: 'seating', rooms: ALL, width: 0.5, depth: 0.5, height: 0.5, material: 'Solid timber', colorRole: 'wood', fallbackColor: '#a98158', preferredWall: 'center', clearance: 0.2 },
  { id: 'ottoman', name: 'Ottoman', group: 'Seating', category: 'seating', rooms: ['living', 'bedroom'], width: 0.6, depth: 0.6, height: 0.42, material: 'Upholstered', colorRole: 'soft', fallbackColor: '#d6d2c9', preferredWall: 'center', clearance: 0.2, keywords: ['pouf', 'footstool'] },

  // Tables
  { id: 'coffee-table', name: 'Coffee table', group: 'Tables', category: 'table', rooms: ['living'], width: 1.1, depth: 0.6, height: 0.43, material: 'Solid timber', colorRole: 'wood', fallbackColor: '#a98158', preferredWall: 'center', clearance: 0.35 },
  { id: 'side-table', name: 'Side table', group: 'Tables', category: 'table', rooms: ['living', 'bedroom', 'study'], width: 0.5, depth: 0.5, height: 0.5, material: 'Timber and metal', colorRole: 'wood', fallbackColor: '#a98158', preferredWall: 'center', clearance: 0.2 },
  { id: 'dining-table', name: 'Dining table', group: 'Tables', category: 'table', rooms: ['dining'], width: 1.6, depth: 0.9, height: 0.76, material: 'Solid timber', colorRole: 'wood', fallbackColor: '#a98158', preferredWall: 'center', clearance: 0.6 },
  { id: 'desk', name: 'Desk', group: 'Tables', category: 'table', rooms: ['study', 'bedroom'], width: 1.3, depth: 0.65, height: 0.75, material: 'Timber top, steel frame', colorRole: 'wood', fallbackColor: '#a98158', preferredWall: 'north', clearance: 0.5, keywords: ['workstation', 'office', 'study'] },
  { id: 'console-table', name: 'Console table', group: 'Tables', category: 'table', rooms: ['living', 'dining'], width: 1.1, depth: 0.35, height: 0.8, material: 'Timber', colorRole: 'wood', fallbackColor: '#a98158', preferredWall: 'south', clearance: 0.3, keywords: ['hallway', 'entry'] },

  // Beds
  { id: 'single-bed', name: 'Single bed', group: 'Beds', category: 'bed', rooms: ['bedroom'], width: 0.95, depth: 2.0, height: 0.9, material: 'Timber frame, mattress', colorRole: 'hero', fallbackColor: '#94a3b8', preferredWall: 'north', clearance: 0.5 },
  { id: 'double-bed', name: 'Double bed', group: 'Beds', category: 'bed', rooms: ['bedroom'], width: 1.45, depth: 2.0, height: 0.95, material: 'Timber frame, mattress', colorRole: 'hero', fallbackColor: '#94a3b8', preferredWall: 'north', clearance: 0.55 },
  { id: 'queen-bed', name: 'Queen bed', group: 'Beds', category: 'bed', rooms: ['bedroom'], width: 1.6, depth: 2.1, height: 1.0, material: 'Upholstered headboard, mattress', colorRole: 'hero', fallbackColor: '#94a3b8', preferredWall: 'north', clearance: 0.6 },
  { id: 'king-bed', name: 'King bed', group: 'Beds', category: 'bed', rooms: ['bedroom'], width: 1.9, depth: 2.15, height: 1.0, material: 'Upholstered headboard, mattress', colorRole: 'hero', fallbackColor: '#94a3b8', preferredWall: 'north', clearance: 0.6 },

  // Storage
  { id: 'wardrobe', name: 'Wardrobe', group: 'Storage', category: 'storage', rooms: ['bedroom'], width: 1.2, depth: 0.6, height: 2.0, material: 'Veneered timber', colorRole: 'wood', fallbackColor: '#a98158', preferredWall: 'west', clearance: 0.7 },
  { id: 'bookcase', name: 'Bookcase', group: 'Storage', category: 'storage', rooms: ['living', 'study', 'bedroom'], width: 0.9, depth: 0.35, height: 1.8, material: 'Timber shelving', colorRole: 'wood', fallbackColor: '#a98158', preferredWall: 'east', clearance: 0.45, keywords: ['bookshelf', 'shelf', 'shelving'] },
  { id: 'media-console', name: 'Media console', group: 'Storage', category: 'storage', rooms: ['living', 'bedroom'], width: 1.6, depth: 0.4, height: 0.5, material: 'Timber with doors', colorRole: 'wood', fallbackColor: '#a98158', preferredWall: 'south', clearance: 0.45, keywords: ['tv', 'tv unit', 'credenza'] },
  { id: 'sideboard', name: 'Sideboard', group: 'Storage', category: 'storage', rooms: ['dining', 'living'], width: 1.4, depth: 0.45, height: 0.8, material: 'Timber with doors', colorRole: 'wood', fallbackColor: '#a98158', preferredWall: 'east', clearance: 0.5, keywords: ['buffet', 'cabinet'] },
  { id: 'dresser', name: 'Dresser', group: 'Storage', category: 'storage', rooms: ['bedroom'], width: 1.0, depth: 0.5, height: 0.85, material: 'Timber drawers', colorRole: 'wood', fallbackColor: '#a98158', preferredWall: 'east', clearance: 0.6, keywords: ['chest of drawers', 'drawers'] },
  { id: 'nightstand', name: 'Nightstand', form: 'dresser', group: 'Storage', category: 'storage', rooms: ['bedroom'], width: 0.45, depth: 0.4, height: 0.5, material: 'Timber drawer', colorRole: 'wood', fallbackColor: '#a98158', preferredWall: 'north', clearance: 0.1, keywords: ['bedside', 'bedside table'] },

  // Lighting
  { id: 'floor-lamp', name: 'Floor lamp', group: 'Lighting', category: 'lighting', rooms: ALL, width: 0.4, depth: 0.4, height: 1.6, material: 'Metal stem, fabric shade', colorRole: 'neutral', fallbackColor: '#403d39', preferredWall: 'east', clearance: 0.1 },
  { id: 'table-lamp', name: 'Accent lamp', group: 'Lighting', category: 'lighting', rooms: ALL, width: 0.3, depth: 0.3, height: 0.5, material: 'Ceramic base, fabric shade', colorRole: 'neutral', fallbackColor: '#403d39', preferredWall: 'center', clearance: 0.1, keywords: ['table lamp', 'desk lamp', 'bedside lamp'] },

  // Decor
  { id: 'rug', name: 'Area rug', form: 'rug', group: 'Decor', category: 'decor', rooms: ALL, width: 2.4, depth: 1.7, height: 0.02, material: 'Wool weave', colorRole: 'soft', fallbackColor: '#d9cbb7', preferredWall: 'center', clearance: 0, keywords: ['carpet', 'mat'] },
  { id: 'large-rug', name: 'Large area rug', form: 'rug', group: 'Decor', category: 'decor', rooms: ['living', 'bedroom', 'dining'], width: 3.0, depth: 2.2, height: 0.02, material: 'Wool weave', colorRole: 'soft', fallbackColor: '#d9cbb7', preferredWall: 'center', clearance: 0, keywords: ['carpet'] },
  { id: 'plant', name: 'Potted plant', group: 'Decor', category: 'decor', rooms: ALL, width: 0.45, depth: 0.45, height: 1.2, material: 'Ceramic pot, foliage', colorRole: 'accent', fallbackColor: '#c6ad8e', preferredWall: 'west', clearance: 0.1, keywords: ['greenery', 'tree', 'planter'] },
];

export function getCatalogPiece(id: string): CatalogPiece | undefined {
  return FURNITURE_CATALOG.find((piece) => piece.id === id);
}

/** Name, group, material and keyword search, optionally limited to a group and/or a room use. Matches every typed word. */
export function searchCatalog(query = '', group?: CatalogGroup | 'All', room?: RoomKind): CatalogPiece[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return FURNITURE_CATALOG.filter((piece) => {
    if (group && group !== 'All' && piece.group !== group) return false;
    if (room && !piece.rooms.includes(room)) return false;
    const haystack = `${piece.name} ${piece.group} ${piece.material} ${(piece.keywords || []).join(' ')}`.toLowerCase();
    return words.every((word) => haystack.includes(word));
  });
}

/** Starting body colour for a new piece: the design's own palette tone for its colour role. */
export function catalogColor(piece: CatalogPiece, palette: ColorSwatch[] | undefined): string {
  const role = ({ hero: 'secondary', soft: 'wall', wood: 'flooring', accent: 'accent', neutral: undefined } as const)[piece.colorRole];
  return (role && palette?.find((swatch) => swatch.role === role)?.hex) || piece.fallbackColor;
}

/**
 * Rotation (2D plan degrees, clockwise) that puts a piece's back against `wall`.
 * A piece's front is its local +y, so rotation 0 faces south (back to the
 * north wall); the plan's rotate(90) turns the front to face west.
 */
export function facingRotation(wall: CatalogPiece['preferredWall']): 0 | 90 | 180 | 270 {
  return wall === 'south' ? 180 : wall === 'west' ? 270 : wall === 'east' ? 90 : 0;
}
