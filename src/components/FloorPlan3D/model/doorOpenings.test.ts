import assert from 'node:assert/strict';
import test from 'node:test';
import { applyDoors, openingToWorldInterval } from './doorOpenings';
import { mergeEdges } from './mergeWalls';
import { markExterior } from './exterior';
import { DOOR_HEIGHT } from './constants';
import { roomEdges, roomsFromPlan } from './wallEdges';
import type { FloorPlanRoom } from '../../../types';

function makeRoom(
  id: string,
  x: number, y: number, w: number, h: number,
  doorSide: 'top' | 'bottom' | 'left' | 'right',
  doorOffset?: number,
  doorWidth = 0.9,
  isMainEntry = false,
): FloorPlanRoom {
  return {
    id, name: id, type: 'living-room',
    x, y, width: w, height: h,
    doors: [{ side: doorSide, offset: doorOffset ?? (w - doorWidth) / 2, width: doorWidth, swing: 'in', isMainEntry }],
    windows: [],
  };
}

function buildWalls(rooms: FloorPlanRoom[]) {
  const rects = rooms.map((r) => ({ id: r.id, name: r.name, type: r.type, x: r.x, y: r.y, width: r.width, height: r.height }));
  const edges = rects.flatMap(roomEdges);
  return markExterior(mergeEdges(edges));
}

// --- Test: door on shared wall appears once ---

test('doorOpenings: door on shared wall appears exactly once (deduplication)', () => {
  // Room A and B share a wall at x=4 (right of A = left of B)
  // Both rooms have a door on that shared wall
  const roomA = makeRoom('A', 0, 0, 4, 3, 'right', 1.05);
  const roomB = makeRoom('B', 4, 0, 4, 3, 'left', 1.05);
  const walls = buildWalls([roomA, roomB]);
  const result = applyDoors(walls, [roomA, roomB]);

  const sharedWall = result.find((w) => w.axis === 'z' && Math.abs(w.a.x - 4) < 0.01);
  assert.ok(sharedWall, 'shared wall not found');
  const doors = sharedWall!.openings.filter((o) => o.kind === 'door');
  assert.equal(doors.length, 1, `expected 1 door on shared wall, got ${doors.length}`);
});

// --- Test: door positions for all 4 sides ---

test('doorOpenings: bottom door world position is correct', () => {
  // Room at x=0, y=0, w=5, h=4. Bottom door at offset=2.05, width=0.9
  // World: bottom wall at z=4, door at x=[2.05, 2.95]
  const room = makeRoom('R', 0, 0, 5, 4, 'bottom', 2.05, 0.9);
  const walls = buildWalls([room]);
  const result = applyDoors(walls, [room]);

  const bottomWall = result.find((w) => w.axis === 'x' && Math.abs(w.a.z - 4) < 0.01);
  assert.ok(bottomWall, 'bottom wall not found');
  assert.ok(bottomWall!.openings.length > 0, 'bottom wall should have a door');
  const door = bottomWall!.openings[0];
  // start from wall a.x=0, door at world x=2.05 → segment-relative start=2.05
  assert.ok(Math.abs(door.start - 2.05) < 0.1, `door.start should be ~2.05, got ${door.start}`);
  assert.ok(Math.abs(door.end - 2.95) < 0.1, `door.end should be ~2.95, got ${door.end}`);
});

test('doorOpenings: top door world position is correct', () => {
  // Room at x=1, y=2, w=6, h=4. Top wall at z=2. Door offset=2.55, width=0.9
  // World: top wall at z=2, door at x=[1+2.55, 1+2.55+0.9] = [3.55, 4.45]
  const room = makeRoom('R', 1, 2, 6, 4, 'top', 2.55, 0.9);
  const walls = buildWalls([room]);
  const result = applyDoors(walls, [room]);

  const topWall = result.find((w) => w.axis === 'x' && Math.abs(w.a.z - 2) < 0.01);
  assert.ok(topWall, 'top wall not found');
  assert.ok(topWall!.openings.length > 0, 'top wall should have a door');
  const door = topWall!.openings[0];
  // segment a.x = 1, door world start = 3.55 → relative = 2.55
  assert.ok(Math.abs(door.start - 2.55) < 0.15, `door.start should be ~2.55, got ${door.start}`);
});

test('doorOpenings: left door world position is correct', () => {
  // Room at x=3, y=1, w=4, h=5. Left wall at x=3. Door offset=2.05, width=0.9
  // World: left wall at x=3 (axis z), door at z=[1+2.05, 1+2.95] = [3.05, 3.95]
  const room = makeRoom('R', 3, 1, 4, 5, 'left', 2.05, 0.9);
  const walls = buildWalls([room]);
  const result = applyDoors(walls, [room]);

  const leftWall = result.find((w) => w.axis === 'z' && Math.abs(w.a.x - 3) < 0.01);
  assert.ok(leftWall, 'left wall not found');
  assert.ok(leftWall!.openings.length > 0, 'left wall should have a door');
  const door = leftWall!.openings[0];
  // segment a.z = 1, door world start = 3.05 → relative = 2.05
  assert.ok(Math.abs(door.start - 2.05) < 0.15, `door.start should be ~2.05, got ${door.start}`);
});

test('doorOpenings: right door world position is correct', () => {
  // Room at x=0, y=0, w=4, h=6. Right wall at x=4 (axis z). Door offset=2.55, width=0.9
  // World: right wall at x=4, door at z=[0+2.55, 0+3.45] = [2.55, 3.45]
  const room = makeRoom('R', 0, 0, 4, 6, 'right', 2.55, 0.9);
  const walls = buildWalls([room]);
  const result = applyDoors(walls, [room]);

  const rightWall = result.find((w) => w.axis === 'z' && Math.abs(w.a.x - 4) < 0.01);
  assert.ok(rightWall, 'right wall not found');
  assert.ok(rightWall!.openings.length > 0, 'right wall should have a door');
  const door = rightWall!.openings[0];
  assert.ok(Math.abs(door.start - 2.55) < 0.15, `door.start should be ~2.55, got ${door.start}`);
});

// --- Test: isMainEntry flag preserved ---

test('doorOpenings: isMainEntry flag is preserved on the opening', () => {
  const room: FloorPlanRoom = {
    id: 'Main', name: 'Main', type: 'living-room',
    x: 0, y: 0, width: 6, height: 5,
    doors: [{ side: 'bottom', offset: 2.55, width: 0.9, swing: 'in', isMainEntry: true }],
    windows: [],
  };
  const walls = buildWalls([room]);
  const result = applyDoors(walls, [room]);
  const allOpenings = result.flatMap((w) => w.openings);
  const mainEntry = allOpenings.find((o) => o.isMainEntry);
  assert.ok(mainEntry, 'main entry opening not found');
  assert.equal(mainEntry!.kind, 'door');
});

// --- Test: sill=0, head=DOOR_HEIGHT for doors ---
test('doorOpenings: door has sill=0 and head=DOOR_HEIGHT', () => {
  const room = makeRoom('R', 0, 0, 5, 4, 'bottom', 2.05);
  const walls = buildWalls([room]);
  const result = applyDoors(walls, [room]);
  const door = result.flatMap((w) => w.openings).find((o) => o.kind === 'door');
  assert.ok(door, 'no door opening found');
  assert.equal(door!.sill, 0);
  assert.ok(Math.abs(door!.head - DOOR_HEIGHT) < 0.001);
});

// --- Test: openingToWorldInterval helper ---
test('doorOpenings: openingToWorldInterval returns correct values for each side', () => {
  const room = { id: 'R', x: 2, y: 3, width: 6, height: 4 };

  const top = openingToWorldInterval(room, 'top', 2.55, 0.9);
  assert.ok(top);
  assert.equal(top!.axis, 'x');
  assert.ok(Math.abs(top!.wallFixed - 3) < 0.01, `top wallFixed should be 3 (plan y), got ${top!.wallFixed}`);
  assert.ok(Math.abs(top!.wStart - (2 + 2.55)) < 0.1);

  const left = openingToWorldInterval(room, 'left', 1.55, 0.9);
  assert.ok(left);
  assert.equal(left!.axis, 'z');
  assert.ok(Math.abs(left!.wallFixed - 2) < 0.01, `left wallFixed should be 2 (plan x), got ${left!.wallFixed}`);
  assert.ok(Math.abs(left!.wStart - (3 + 1.55)) < 0.1);
});
