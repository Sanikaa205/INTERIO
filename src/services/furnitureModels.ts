import type { FurnitureItem } from '../types';

/**
 * Real (third-party, CC0) furniture models bundled in public/assets/furniture/models.
 * Every file is logged in public/assets/furniture/LICENSES.md. A model replaces the
 * procedural piece only when the piece's name and size suit it; anything else, or any
 * load problem, keeps the procedural model.
 */
export interface RealModel {
  id: string;
  url: string;
  category: FurnitureItem['category'];
  /** Matched against the lower-case item name. */
  match: RegExp;
  /** Largest allowed difference between the width, height and depth scale factors; beyond it the model would look stretched. */
  maxStretch: number;
  /** Turn the model half a turn if it was authored facing away from +Z. */
  flip?: boolean;
}

const BASE = '/assets/furniture/models/';

export const REAL_MODELS: readonly RealModel[] = [
  { id: 'sofa', url: `${BASE}sofa.glb`, category: 'seating', match: /sofa|couch|loveseat|sectional/, maxStretch: 1.7 },
  { id: 'armchair', url: `${BASE}armchair.glb`, category: 'seating', match: /armchair|accent chair|lounge chair|reading chair/, maxStretch: 1.7 },
  { id: 'dining-chair', url: `${BASE}dining-chair.glb`, category: 'seating', match: /dining chair|side chair/, maxStretch: 1.7 },
  { id: 'ottoman', url: `${BASE}ottoman.glb`, category: 'seating', match: /ottoman|pouf|footstool/, maxStretch: 1.7 },
  { id: 'coffee-table', url: `${BASE}coffee-table.glb`, category: 'table', match: /coffee table/, maxStretch: 1.7 },
  { id: 'dining-table', url: `${BASE}dining-table.glb`, category: 'table', match: /dining table|kitchen table/, maxStretch: 1.7 },
  { id: 'nightstand', url: `${BASE}nightstand.glb`, category: 'storage', match: /nightstand|bedside/, maxStretch: 1.7 },
  { id: 'sideboard', url: `${BASE}sideboard.glb`, category: 'storage', match: /sideboard|media console|tv unit|credenza|buffet|media unit/, maxStretch: 2.3 },
  { id: 'bookcase', url: `${BASE}bookcase.glb`, category: 'storage', match: /bookcase|bookshelf|shelving|shelf unit|\bshelf\b/, maxStretch: 1.8 },
];

/** The bundled model that suits this piece, or null (use the procedural model). */
export function findRealModel(item: Pick<FurnitureItem, 'name' | 'category'>): RealModel | null {
  const name = item.name.toLowerCase();
  return REAL_MODELS.find((model) => model.category === item.category && model.match.test(name)) ?? null;
}
