import type { FurnitureItem, InteriorDesignResult } from '../types';
import { defaultRoomOpenings, furnitureFootprint, hitsOpening, rectanglesOverlap, type LayoutOpening } from './layoutOptimizer';
import { catalogColor, facingRotation, type CatalogPiece } from './furnitureCatalog';
import { formatPriceRange, getBudgetTier, priceRange, totalPriceRange } from './budgetTiers';

export interface FreeSpot {
  x: number;
  y: number;
  rotation: 0 | 90 | 180 | 270;
  /** Fits, but closer to its neighbours than the piece's preferred clearance. */
  tight: boolean;
}

export interface PlacementRoom {
  width: number;
  depth: number;
  openings?: LayoutOpening[];
}

export interface PlacementPiece {
  name: string;
  category: string;
  width: number;
  depth: number;
  preferredWall?: 'north' | 'south' | 'east' | 'west' | 'center';
  clearance?: number;
  /** Direction to try first (degrees); defaults to facing away from the preferred wall. */
  rotation?: number;
}

const GRID = 0.1;
const TIGHT_GAP = 0.05;
const DEFAULT_GAP = 0.3;
const ROTATIONS = [0, 90, 180, 270] as const;

const isRug = (piece: { name: string }) => /rug|carpet/i.test(piece.name);
// Rugs and decor sit on or under other pieces, so they never block placement.
const isFlat = (piece: { name: string }) => isRug(piece);

function search(existing: FurnitureItem[], room: PlacementRoom, piece: PlacementPiece, gap: number): FreeSpot | null {
  const openings = room.openings?.length ? room.openings : defaultRoomOpenings(room.width, room.depth);
  const layoutRoom = { width: room.width, depth: room.depth, openings };
  const flat = isFlat(piece);
  const preferred = Number.isFinite(piece.rotation) ? (((Number(piece.rotation) % 360) + 360) % 360) : undefined;
  const facing = preferred ?? facingRotation(piece.preferredWall);
  let best: (FreeSpot & { score: number }) | null = null;
  for (const rotation of ROTATIONS) {
    const rotated = rotation % 180 !== 0;
    const width = rotated ? piece.depth : piece.width;
    const depth = rotated ? piece.width : piece.depth;
    if (width > room.width + 1e-6 || depth > room.depth + 1e-6) continue;
    for (let y = 0; y <= room.depth - depth + 1e-6; y += GRID) {
      for (let x = 0; x <= room.width - width + 1e-6; x += GRID) {
        const candidate = { x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100, width, depth };
        if (!flat && hitsOpening(candidate, layoutRoom)) continue;
        if (!flat) {
          const padded = { x: candidate.x - gap, y: candidate.y - gap, width: width + gap * 2, depth: depth + gap * 2 };
          const blocked = existing.some((other) => !isFlat(other) && rectanglesOverlap(padded, furnitureFootprint(other)));
          if (blocked) continue;
        }
        const wallDistance = {
          west: candidate.x,
          east: room.width - candidate.x - width,
          north: candidate.y,
          south: room.depth - candidate.y - depth,
        };
        const wall = piece.preferredWall;
        const wallPenalty = !wall || wall === 'center' ? 0 : wallDistance[wall] * 8;
        const centreDistance = Math.hypot(candidate.x + width / 2 - room.width / 2, candidate.y + depth / 2 - room.depth / 2);
        // Flat items (rugs) and "centre" pieces like to be central; wall pieces hug their wall.
        const centrePull = !wall || wall === 'center' || flat ? centreDistance * 2 : centreDistance * 0.05;
        const rotationPenalty = rotation === facing ? 0 : 3;
        const score = wallPenalty + centrePull + rotationPenalty + candidate.y * 0.001 + candidate.x * 0.0001;
        if (!best || score < best.score) best = { x: candidate.x, y: candidate.y, rotation, tight: false, score };
      }
    }
  }
  if (!best) return null;
  const { score: _score, ...spot } = best;
  return spot;
}

/**
 * A free place for a new piece: inside the room, clear of other pieces (plus
 * their clearance) and of door swings and window sills, preferring its wall and
 * facing into the room. Falls back to a tighter fit before giving up. Returns
 * `null` when nothing fits. `x`/`y` are the footprint's top-left, like furniture items.
 */
export function findFreeSpot(existing: FurnitureItem[], room: PlacementRoom, piece: PlacementPiece, openings?: LayoutOpening[]): FreeSpot | null {
  const withOpenings = { ...room, openings: openings ?? room.openings };
  const gap = Math.max(0.1, piece.clearance ?? DEFAULT_GAP);
  const roomy = search(existing, withOpenings, piece, gap);
  if (roomy) return roomy;
  const tight = search(existing, withOpenings, piece, TIGHT_GAP);
  return tight ? { ...tight, tight: true } : null;
}

function uniqueId(base: string, existing: FurnitureItem[]) {
  const taken = new Set(existing.map((item) => item.id));
  let n = 1;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

function roomOf(data: InteriorDesignResult): PlacementRoom {
  return { width: data.roomWidth, depth: data.roomLength, openings: data.openings };
}

/** Per-piece price text from the design's budget tier, e.g. "$770–$1,485". */
export function estimatedPriceFor(category: string, budget: string): string {
  return formatPriceRange(priceRange(category, getBudgetTier(budget)));
}

/** Keeps the "estimated total" in step when pieces are added or removed. */
export function withFurniture(data: InteriorDesignResult, furniture: FurnitureItem[]): InteriorDesignResult {
  const next = { ...data, furniture };
  if (data.estimatedTotal !== undefined && furniture.length !== data.furniture.length) {
    const tier = getBudgetTier(data.budget);
    next.estimatedTotal = `${formatPriceRange(totalPriceRange(furniture, tier))} ${tier.gradeLabel}`;
  }
  return next;
}

export interface AddResult {
  item: FurnitureItem;
  tight: boolean;
}

/** A new catalogue piece placed at a free spot, or `null` when the room has no space for it. */
export function createCatalogItem(data: InteriorDesignResult, piece: CatalogPiece): AddResult | null {
  const spot = findFreeSpot(data.furniture || [], roomOf(data), piece);
  if (!spot) return null;
  const color = catalogColor(piece, data.colorPalette);
  const item: FurnitureItem = {
    id: uniqueId(`add-${piece.id}`, data.furniture || []),
    name: piece.name,
    category: piece.category,
    ...(piece.form ? { form: piece.form } : {}),
    x: spot.x,
    y: spot.y,
    width: piece.width,
    depth: piece.depth,
    height: piece.height,
    rotation: spot.rotation,
    material: piece.material,
    color,
    generatedColor: color,
    colorRole: piece.colorRole,
    estimatedPrice: estimatedPriceFor(piece.category, data.budget),
    ...(piece.preferredWall ? { preferredWall: piece.preferredWall } : {}),
    ...(piece.clearance !== undefined ? { clearance: piece.clearance } : {}),
  };
  return { item, tight: spot.tight };
}

/** A copy of a piece (colours and all) at a free spot next to the room's other furniture, or `null`. */
export function createDuplicate(data: InteriorDesignResult, source: FurnitureItem): AddResult | null {
  const others = data.furniture || [];
  const spot = findFreeSpot(others, roomOf(data), { ...source, rotation: source.rotation });
  if (!spot) return null;
  const base = source.id.replace(/-\d+$/, '');
  return {
    item: { ...source, id: uniqueId(`${base}-copy`, others), x: spot.x, y: spot.y, rotation: spot.rotation },
    tight: spot.tight,
  };
}
