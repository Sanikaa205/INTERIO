import test from 'node:test';
import assert from 'node:assert/strict';
import { wallPieces } from './wallPieces';
import type { WallSegment } from './types';
import { WALL_HEIGHT } from './constants';

const wall = (openings: WallSegment['openings']): WallSegment => ({
  id: 'w', a: { x: 0, z: 0 }, b: { x: 10, z: 0 }, axis: 'x', length: 10,
  thickness: 0.15, exterior: true, roomIds: ['r'], sides: ['top'], openings,
});
const door = (start: number, end: number) => ({
  kind: 'door' as const, start, end, sill: 0, head: 2.05, roomId: 'r',
});
const window = (start: number, end: number) => ({
  kind: 'window' as const, start, end, sill: 0.9, head: 2.1, roomId: 'r',
});

test('splits one door into full pieces and a lintel', () => {
  const pieces = wallPieces(wall([door(2, 3)]));
  assert.equal(pieces.length, 3);
  assert.equal(pieces.filter((p) => p.y1 === WALL_HEIGHT).length, 3);
});

test('adds sill and lintel around a window', () => {
  const pieces = wallPieces(wall([window(2, 3)]));
  assert.equal(pieces.length, 4);
  assert.ok(pieces.some((p) => p.y1 === 0.9));
});

test('handles multiple doors and ignores invalid overlap', () => {
  const pieces = wallPieces(wall([door(1, 2), door(4, 5), door(1.5, 3)]));
  assert.equal(pieces.length, 5);
  assert.ok(pieces.every((p) => p.s1 > p.s0 && p.y1 > p.y0));
});

test('piece area equals wall area minus opening area', () => {
  const openings = [door(2, 3), window(5, 7)];
  const area = wallPieces(wall(openings)).reduce((sum, p) => sum + (p.s1 - p.s0) * (p.y1 - p.y0), 0);
  assert.equal(area, 10 * WALL_HEIGHT - 1 * 2.05 - 2 * (2.1 - 0.9));
});
