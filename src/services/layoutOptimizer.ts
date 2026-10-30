import type { FurnitureItem } from '../types';

export interface FurnitureSuggestion extends Partial<FurnitureItem> {
  name: string;
  category: FurnitureItem['category'];
  role?: string;
  form?: string;
  width: number;
  depth: number;
  preferredWall?: 'north' | 'south' | 'east' | 'west' | 'center';
  facing?: 'wall' | 'room' | { focal: string };
  clearance?: number;
  relativeTo?: string;
  relativeSide?: 'north' | 'south' | 'east' | 'west';
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
  doorClearance?: number;
}

export function defaultRoomOpenings(width: number, depth: number): LayoutOpening[] {
  const doorWidth = Math.min(0.9, width * 0.18);
  const doorStart = Math.max(0.3, Math.min(width - doorWidth - 0.3, width * 0.14));
  return [
    { wall: 'south', start: doorStart, end: doorStart + doorWidth, type: 'door' },
    { wall: 'north', start: width * 0.32, end: width * 0.68, type: 'window' },
  ];
}

export function roomDoorClearance(width: number, depth: number): number {
  return Math.min(CLEARANCE, Math.max(0.22, Math.min(width, depth) * 0.08));
}

const CLEARANCE = 0.75;
const ROTATIONS = [0, 90, 180, 270] as const;

export function furnitureFootprint(item: Pick<FurnitureItem, 'x' | 'y' | 'width' | 'depth' | 'rotation'>) {
  const rotated = (item.rotation || 0) % 180 !== 0;
  return { x: item.x, y: item.y, width: rotated ? item.depth : item.width, depth: rotated ? item.width : item.depth };
}

export function rectanglesOverlap(a: { x: number; y: number; width: number; depth: number }, b: { x: number; y: number; width: number; depth: number }) {
  return a.x < b.x + b.width - 1e-6 && a.x + a.width > b.x + 1e-6 && a.y < b.y + b.depth - 1e-6 && a.y + a.depth > b.y + 1e-6;
}

export function hitsOpening(item: { x: number; y: number; width: number; depth: number }, room: LayoutRoom) {
  return (room.openings || []).some((opening) => {
    const openingClearance = opening.type === 'door' ? room.doorClearance ?? CLEARANCE : 0.3;
    const spanStart = opening.wall === 'north' || opening.wall === 'south' ? item.x : item.y;
    const spanEnd = spanStart + (opening.wall === 'north' || opening.wall === 'south' ? item.width : item.depth);
    const wallTouch = opening.wall === 'north' ? item.y < openingClearance
      : opening.wall === 'south' ? item.y + item.depth > room.depth - openingClearance
      : opening.wall === 'west' ? item.x < openingClearance : item.x + item.width > room.width - openingClearance;
    return wallTouch && spanStart < opening.end + openingClearance && spanEnd > opening.start - openingClearance;
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
  const placedRelationships = new Map<string, string>();
  const ordered = suggestions.map((suggestion, index) => ({ suggestion, index })).sort((a, b) => {
    const aDependent = Boolean(a.suggestion.relativeTo), bDependent = Boolean(b.suggestion.relativeTo);
    return Number(aDependent) - Number(bDependent) || a.index - b.index;
  });
  for (const { suggestion, index } of ordered) {
    const width0 = Math.max(0.25, Number(suggestion.width) || 0.8);
    const depth0 = Math.max(0.25, Number(suggestion.depth) || 0.8);
    let best: (FurnitureItem & { score: number }) | null = null;
    let preferredRotation = Number(suggestion.rotation);
    if (!Number.isFinite(preferredRotation)) {
      if (suggestion.preferredWall === 'north') preferredRotation = 0;
      else if (suggestion.preferredWall === 'south') preferredRotation = 180;
      else if (suggestion.preferredWall === 'west') preferredRotation = 90;
      else if (suggestion.preferredWall === 'east') preferredRotation = 270;
    }
    const rotations = ROTATIONS.slice().sort((a, b) => Number(b === preferredRotation) - Number(a === preferredRotation));
    for (const rotation of rotations) {
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
          const isRug = /rug/i.test(suggestion.name);
          const collides = placed.some((other) => {
            if (isRug || /rug/i.test(other.name)) return false;
            return rectanglesOverlap(candidate, furnitureFootprint(other));
          });
          if (collides) continue;
          const clearanceHit = suggestion.category !== 'decor' && placed.some((other) => {
            if (suggestion.relativeTo === other.id) return false;
            if (suggestion.relativeTo && placedRelationships.get(other.id) === suggestion.relativeTo) return false;
            if (other.category === 'decor' || /rug/i.test(other.name)) return false;
            const clearance = Math.max(suggestion.clearance ?? CLEARANCE, other.clearance ?? CLEARANCE);
            return rectanglesOverlap(
              { x: candidate.x - clearance, y: candidate.y - clearance, width: candidate.width + clearance * 2, depth: candidate.depth + clearance * 2 }, furnitureFootprint(other),
            );
          });
          if (clearanceHit) continue;
          const centerDistance = Math.hypot(candidate.x + width / 2 - room.width / 2, candidate.y + depth / 2 - room.depth / 2);
          const anchorDistance = Number.isFinite(suggestion.x) && Number.isFinite(suggestion.y)
            ? Math.hypot(candidate.x - Number(suggestion.x), candidate.y - Number(suggestion.y))
            : 0;
          const related = suggestion.relativeTo ? placed.find((other) => other.id === suggestion.relativeTo) : undefined;
          let relationshipPenalty = 0;
          if (related && suggestion.relativeSide) {
            const target = furnitureFootprint(related);
            const gap = 0.1;
            const targetX = suggestion.relativeSide === 'west' ? target.x - gap - width
              : suggestion.relativeSide === 'east' ? target.x + target.width + gap
              : target.x + (target.width - width) / 2;
            const targetY = suggestion.relativeSide === 'north' ? target.y - gap - depth
              : suggestion.relativeSide === 'south' ? target.y + target.depth + gap
              : target.y + (target.depth - depth) / 2;
            relationshipPenalty = Math.hypot(candidate.x - targetX, candidate.y - targetY);
          }

          // Wall-awareness penalty for orientation: if item is close to a wall, it should face away from it
          let wallFacingPenalty = 0;
          if (candidate.y <= 0.5 && rotation !== 0 && (suggestion.category === 'storage' || suggestion.preferredWall === 'north')) wallFacingPenalty += 15;
          if (room.depth - (candidate.y + depth) <= 0.5 && rotation !== 180 && (suggestion.category === 'storage' || suggestion.preferredWall === 'south')) wallFacingPenalty += 15;
          if (candidate.x <= 0.5 && rotation !== 90 && (suggestion.category === 'storage' || suggestion.preferredWall === 'west')) wallFacingPenalty += 15;
          if (room.width - (candidate.x + width) <= 0.5 && rotation !== 270 && (suggestion.category === 'storage' || suggestion.preferredWall === 'east')) wallFacingPenalty += 15;

          const rotationPenalty = Number.isFinite(preferredRotation) && rotation !== preferredRotation ? 20 : 0;
          const score = relationshipPenalty * 12 + anchorDistance * (related ? 0.15 : 4) + rotationPenalty + wallFacingPenalty + (related ? 0 : wallPenalty(candidate, room, suggestion.preferredWall)) + centerDistance * 0.05 + y * 0.001 + x * 0.0001;
          if (!best || score < best.score) best = { ...candidate, score, rotation, width: width0, depth: depth0 } as FurnitureItem & { score: number };
        }
      }
    }
    if (!best) continue; // Gracefully omit a suggested item that cannot fit.
    const { score: _score, ...item } = best;
    const id = suggestion.id || `f_${index + 1}`;
    placed.push({
      ...item,
      id,
      name: suggestion.name,
      category: suggestion.category,
      role: suggestion.role,
      form: suggestion.form,
      height: suggestion.height,
      material: suggestion.material,
      color: suggestion.color,
      notes: suggestion.notes,
      estimatedPrice: suggestion.estimatedPrice,
      preferredWall: suggestion.preferredWall,
      facing: suggestion.facing,
      clearance: suggestion.clearance,
    });
    if (suggestion.relativeTo) placedRelationships.set(id, suggestion.relativeTo);
  }
  return placed;
}
