import assert from 'node:assert/strict';
import test from 'node:test';
import { markExterior } from './exterior';
import { mergeEdges } from './mergeWalls';
import { roomEdges } from './wallEdges';
import { WALL_THICKNESS } from './constants';

function makeRect(id: string, x: number, y: number, w: number, h: number) {
  return { id, name: id, type: 'living-room', x, y, width: w, height: h };
}

test('exterior: single room — all 4 walls are exterior', () => {
  const room = makeRect('R', 0, 0, 5, 4);
  const walls = markExterior(mergeEdges(roomEdges(room)));
  assert.equal(walls.length, 4);
  assert.ok(walls.every((w) => w.exterior), 'all walls should be exterior');
});

test('exterior: two adjacent rooms — shared wall is interior, 6 are exterior', () => {
  const edges = [
    ...roomEdges(makeRect('A', 0, 0, 4, 3)),
    ...roomEdges(makeRect('B', 4, 0, 4, 3)),
  ];
  const walls = markExterior(mergeEdges(edges));
  const interior = walls.filter((w) => !w.exterior);
  const exterior = walls.filter((w) => w.exterior);
  assert.equal(interior.length, 1, 'should be exactly 1 interior wall');
  assert.equal(exterior.length, 6, 'should be exactly 6 exterior walls');
});

test('exterior: interior wall has normal thickness, exterior wall is 1.5x', () => {
  const edges = [
    ...roomEdges(makeRect('A', 0, 0, 4, 3)),
    ...roomEdges(makeRect('B', 4, 0, 4, 3)),
  ];
  const walls = markExterior(mergeEdges(edges));
  for (const w of walls) {
    if (w.exterior) {
      assert.ok(Math.abs(w.thickness - WALL_THICKNESS * 1.5) < 0.001, `exterior thickness should be 1.5x, got ${w.thickness}`);
    } else {
      assert.ok(Math.abs(w.thickness - WALL_THICKNESS) < 0.001, `interior thickness should be WALL_THICKNESS, got ${w.thickness}`);
    }
  }
});

test('exterior: L-shaped footprint — inner corner walls are exterior', () => {
  // Build an L-shape: two rooms sharing a bottom/top edge
  // Room A: 0..4, 0..3
  // Room B: 0..2, 3..6 (only half the width)
  // This creates an inner corner at (2,3)
  const edges = [
    ...roomEdges(makeRect('A', 0, 0, 4, 3)),
    ...roomEdges(makeRect('B', 0, 3, 2, 3)),
  ];
  const walls = markExterior(mergeEdges(edges));

  // The shared edge is on the bottom of A / top of B, but only for x=0..2
  // The right portion of A's bottom (x=2..4) is exterior (no room below it)
  const sharedWall = walls.find((w) =>
    w.axis === 'x' &&
    Math.abs(w.a.z - 3) < 0.01 &&
    Math.abs(w.a.x - 0) < 0.01 &&
    Math.abs(w.b.x - 2) < 0.01
  );
  assert.ok(sharedWall, 'shared wall segment at z=3, x=0..2 should exist');
  assert.equal(sharedWall!.exterior, false, 'shared portion should be interior');

  // The x=2..4 portion of z=3 should be exterior (only A touches it)
  const exteriorPortion = walls.find((w) =>
    w.axis === 'x' &&
    Math.abs(w.a.z - 3) < 0.01 &&
    Math.abs(w.a.x - 2) < 0.01
  );
  assert.ok(exteriorPortion, 'exterior wall portion at z=3, x=2..4 should exist');
  assert.equal(exteriorPortion!.exterior, true, 'inner corner portion should be exterior');
});
