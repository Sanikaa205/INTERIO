import assert from 'node:assert/strict';
import test from 'node:test';
import { mergeEdges } from './mergeWalls';
import { roomEdges } from './wallEdges';

function makeRect(id: string, x: number, y: number, w: number, h: number) {
  return { id, name: id, type: 'living-room', x, y, width: w, height: h };
}

test('mergeWalls: two side-by-side rooms share ONE segment on the common edge', () => {
  // Room A: x=0..4, y=0..3
  // Room B: x=4..8, y=0..3 (right side of A = left side of B at x=4)
  const roomA = makeRect('A', 0, 0, 4, 3);
  const roomB = makeRect('B', 4, 0, 4, 3);
  const edges = [...roomEdges(roomA), ...roomEdges(roomB)];
  const walls = mergeEdges(edges);

  // Find the shared wall at x=4 (axis 'z', fixed=4)
  const shared = walls.find((w) => w.axis === 'z' && Math.abs(w.a.x - 4) < 0.01);
  assert.ok(shared, 'shared wall not found');
  assert.equal(shared!.roomIds.length, 2, 'shared wall should have 2 roomIds');
  assert.ok(shared!.roomIds.includes('A'));
  assert.ok(shared!.roomIds.includes('B'));
});

test('mergeWalls: two side-by-side rooms yield 7 unique segments (not 8)', () => {
  const roomA = makeRect('A', 0, 0, 4, 3);
  const roomB = makeRect('B', 4, 0, 4, 3);
  const edges = [...roomEdges(roomA), ...roomEdges(roomB)];
  const walls = mergeEdges(edges);
  assert.equal(walls.length, 7);
});

test('mergeWalls: single room yields 4 segments', () => {
  const room = makeRect('R', 1, 2, 5, 3);
  const walls = mergeEdges(roomEdges(room));
  assert.equal(walls.length, 4);
});

test('mergeWalls: segment ids are deterministic', () => {
  const room = makeRect('R', 0, 0, 4, 3);
  const walls1 = mergeEdges(roomEdges(room));
  const walls2 = mergeEdges(roomEdges(room));
  const ids1 = walls1.map((w) => w.id).sort();
  const ids2 = walls2.map((w) => w.id).sort();
  assert.deepEqual(ids1, ids2);
});

test('mergeWalls: segments have length > 0', () => {
  const roomA = makeRect('A', 0, 0, 4, 3);
  const roomB = makeRect('B', 4, 0, 4, 3);
  const edges = [...roomEdges(roomA), ...roomEdges(roomB)];
  const walls = mergeEdges(edges);
  for (const w of walls) {
    assert.ok(w.length > 0, `wall ${w.id} has zero length`);
  }
});

test('mergeWalls: three rooms in a row yield 10 unique segments', () => {
  // A: 0..4, B: 4..8, C: 8..12, all same y=0..3
  const edges = [
    ...roomEdges(makeRect('A', 0, 0, 4, 3)),
    ...roomEdges(makeRect('B', 4, 0, 4, 3)),
    ...roomEdges(makeRect('C', 8, 0, 4, 3)),
  ];
  const walls = mergeEdges(edges);
  assert.equal(walls.length, 10);
});

test('mergeWalls: wall a is always the smaller coordinate end', () => {
  const room = makeRect('R', 2, 3, 5, 4);
  const walls = mergeEdges(roomEdges(room));
  for (const w of walls) {
    if (w.axis === 'x') {
      assert.ok(w.a.x <= w.b.x, 'x-axis wall: a.x must be <= b.x');
    } else {
      assert.ok(w.a.z <= w.b.z, 'z-axis wall: a.z must be <= b.z');
    }
  }
});
