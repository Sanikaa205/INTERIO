import { WALL_HEIGHT } from './constants';
import type { WallSegment } from './types';

export interface Piece {
  s0: number;
  s1: number;
  y0: number;
  y1: number;
}

export function wallPieces(wall: WallSegment, wallHeight = WALL_HEIGHT): Piece[] {
  const openings = wall.openings
    .map((opening) => ({
      ...opening,
      start: Math.max(0, Math.min(wall.length, opening.start)),
      end: Math.max(0, Math.min(wall.length, opening.end)),
    }))
    .filter((opening) => opening.end > opening.start)
    .sort((a, b) => a.start - b.start);

  const valid: typeof openings = [];
  let cursor = 0;
  for (const opening of openings) {
    if (opening.start < cursor) continue;
    valid.push(opening);
    cursor = opening.end;
  }

  const pieces: Piece[] = [];
  let position = 0;
  for (const opening of valid) {
    if (opening.start > position) pieces.push({ s0: position, s1: opening.start, y0: 0, y1: wallHeight });
    if (opening.sill > 0) pieces.push({ s0: opening.start, s1: opening.end, y0: 0, y1: Math.min(opening.sill, wallHeight) });
    if (opening.head < wallHeight) pieces.push({ s0: opening.start, s1: opening.end, y0: Math.max(0, opening.head), y1: wallHeight });
    position = opening.end;
  }
  if (position < wall.length) pieces.push({ s0: position, s1: wall.length, y0: 0, y1: wallHeight });
  return pieces.filter((piece) => piece.s1 > piece.s0 && piece.y1 > piece.y0);
}
