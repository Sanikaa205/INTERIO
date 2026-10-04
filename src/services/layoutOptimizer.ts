import type { FurnitureItem } from '../types';

export interface FurnitureSuggestion extends Partial<FurnitureItem> {
  name: string;
  category: FurnitureItem['category'];
  width: number;
  depth: number;
  preferredWall?: 'north' | 'south' | 'east' | 'west' | 'center';
}

export interface LayoutOpening {
  wall: 'north' | 'south' | 'east' | 'west';
  start: number;
  end: number;
  type: 'door' | 'window';
}

export interface LayoutRoom {
  width: number;
  depth: number;
  openings?: LayoutOpening[];
}

const CLEARANCE = 0.75;
const ROTATIONS = [0, 90, 180, 270] as const;

function footprint(item: Pick<FurnitureItem, 'x' | 'y' | 'width' | 'depth' | 'rotation'>) {
  const rotated = (item.rotation || 0) % 180 !== 0;
  return { x: item.x, y: item.y, width: rotated ? item.depth : item.width, depth: rotated ? item.width : item.depth };
}

function rectanglesOverlap(a: { x: number; y: number; width: number; depth: number }, b: { x: number; y: number; width: number; depth: number }) {
  return a.x < b.x + b.width - 1e-6 && a.x + a.width > b.x + 1e-6 && a.y < b.y + b.depth - 1e-6 && a.y + a.depth > b.y + 1e-6;
}

function hitsOpening(item: { x: number; y: number; width: number; depth: number }, room: LayoutRoom) {
  return (room.openings || []).some((opening) => {
    const spanStart = opening.wall === 'north' || opening.wall === 'south' ? item.x : item.y;
    const spanEnd = spanStart + (opening.wall === 'north' || opening.wall === 'south' ? item.width : item.depth);
    const wallTouch = opening.wall === 'north' ? item.y < CLEARANCE
      : opening.wall === 'south' ? item.y + item.depth > room.depth - CLEARANCE
      : opening.wall === 'west' ? item.x < CLEARANCE : item.x + item.width > room.width - CLEARANCE;
    return wallTouch && spanStart < opening.end + (opening.type === 'door' ? CLEARANCE : 0.3) && spanEnd > opening.start - (opening.type === 'door' ? CLEARANCE : 0.3);
  });
}

function wallPenalty(item: { x: number; y: number; width: number; depth: number }, room: LayoutRoom, preferred?: FurnitureSuggestion['preferredWall']) {
  if (!preferred || preferred === 'center') return 0;
  const distances = {
    west: item.x,
    east: room.width - item.x - item.width,
    north: item.y,
    south: room.depth - item.y - item.depth,
  };
  return distances[preferred] > 0.5 ? 10 : 0;
}

export function optimizeFurnitureLayout(suggestions: FurnitureSuggestion[], room: LayoutRoom): FurnitureItem[] {
  if (!(room.width > 0 && room.depth > 0)) throw new Error('Room dimensions must be greater than zero.');
  const placed: FurnitureItem[] = [];
  for (const [index, suggestion] of suggestions.entries()) {
    const width0 = Math.max(0.25, Number(suggestion.width) || 0.8);
    const depth0 = Math.max(0.25, Number(suggestion.depth) || 0.8);
    let best: (FurnitureItem & { score: number }) | null = null;
    for (const rotation of ROTATIONS) {
      const rotated = rotation % 180 !== 0;
      const width = rotated ? depth0 : width0;
      const depth = rotated ? width0 : depth0;
      if (width > room.width || depth > room.depth) continue;
      // Stable 10cm grid search; score favors the requested wall, avoids openings,
      // and keeps circulation routes between furniture pieces.
      for (let y = 0; y <= room.depth - depth + 1e-6; y += 0.1) {
        for (let x = 0; x <= room.width - width + 1e-6; x += 0.1) {
          const candidate = { x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100, width, depth };
          if (hitsOpening(candidate, room)) continue;
          if (placed.some((other) => rectanglesOverlap(candidate, footprint(other)))) continue;
          const clearanceHit = suggestion.category !== 'decor' && placed.some((other) => other.category !== 'decor' && rectanglesOverlap(
            { x: candidate.x - CLEARANCE, y: candidate.y - CLEARANCE, width: candidate.width + CLEARANCE * 2, depth: candidate.depth + CLEARANCE * 2 }, footprint(other),
          ));
          if (clearanceHit) continue;
          const centerDistance = Math.hypot(candidate.x + width / 2 - room.width / 2, candidate.y + depth / 2 - room.depth / 2);
          const score = wallPenalty(candidate, room, suggestion.preferredWall) + centerDistance * 0.05 + y * 0.001 + x * 0.0001 + rotation * 0.00001;
          if (!best || score < best.score) best = { ...candidate, score, rotation, width: width0, depth: depth0 } as FurnitureItem & { score: number };
        }
      }
    }
    if (!best) continue; // Gracefully omit a suggested item that cannot fit.
    const { score: _score, ...item } = best;
    placed.push({ ...item, id: suggestion.id || `f_${index + 1}`, name: suggestion.name, category: suggestion.category, height: suggestion.height, material: suggestion.material, color: suggestion.color, notes: suggestion.notes, estimatedPrice: suggestion.estimatedPrice, preferredWall: suggestion.preferredWall });
  }
  return placed;
}
