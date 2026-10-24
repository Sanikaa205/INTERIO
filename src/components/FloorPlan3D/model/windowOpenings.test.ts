import assert from 'node:assert/strict';
import test from 'node:test';
import { applyWindows } from './windowOpenings';
import { applyDoors } from './doorOpenings';
import { mergeEdges } from './mergeWalls';
import { markExterior } from './exterior';
import { roomEdges } from './wallEdges';
import { WINDOW_SILL, WINDOW_HEAD } from './constants';
import type { FloorPlanRoom } from '../../../types';

function buildWalls(rooms: FloorPlanRoom[]) {
  const rects = rooms.map((r) => ({ id: r.id, name: r.name, type: r.type, x: r.x, y: r.y, width: r.width, height: r.height }));
  const edges = rects.flatMap(roomEdges);
  return markExterior(mergeEdges(edges));
}

// --- Test: window positions for each of the 4 sides ---

test('windowOpenings: top window world position is correct', () => {
  const room: FloorPlanRoom = {
    id: 'R', name: 'Room', type: 'living-room',
    x: 0, y: 0, width: 6, height: 4,
    doors: [{ side: 'bottom', offset: 2.55, width: 0.9, swing: 'in' }],
    windows: [{ side: 'top', offset: 2.55, width: 1.5 }],
  };
  const walls = applyDoors(buildWalls([room]), [room]);
  const { walls: result } = applyWindows(walls, [room]);
  const topWall = result.find((w) => w.axis === 'x' && Math.abs(w.a.z - 0) < 0.01);
  assert.ok(topWall, 'top wall not found');
  const win = topWall!.openings.find((o) => o.kind === 'window');
  assert.ok(win, 'top window not found');
  // World: top wall at z=0, window at x=[0+2.55, 0+4.05] → segment-relative start=2.55
  assert.ok(Math.abs(win!.start - 2.55) < 0.15, `win.start should be ~2.55, got ${win!.start}`);
});

test('windowOpenings: left window world position is correct', () => {
  const room: FloorPlanRoom = {
    id: 'R', name: 'Room', type: 'living-room',
    x: 2, y: 1, width: 5, height: 6,
    doors: [{ side: 'bottom', offset: 2.05, width: 0.9, swing: 'in' }],
    windows: [{ side: 'left', offset: 2.55, width: 1.2 }],
  };
  const walls = applyDoors(buildWalls([room]), [room]);
  const { walls: result } = applyWindows(walls, [room]);
  const leftWall = result.find((w) => w.axis === 'z' && Math.abs(w.a.x - 2) < 0.01);
  assert.ok(leftWall, 'left wall not found');
  const win = leftWall!.openings.find((o) => o.kind === 'window');
  assert.ok(win, 'left window not found');
  // left wall at x=2 (axis z), window at z=[1+2.55, 1+3.75] → segment-relative start=2.55
  assert.ok(Math.abs(win!.start - 2.55) < 0.15, `win.start should be ~2.55, got ${win!.start}`);
});

// --- Test: window on interior wall is skipped ---

test('windowOpenings: window on an interior wall is skipped', () => {
  const roomA: FloorPlanRoom = {
    id: 'A', name: 'A', type: 'living-room',
    x: 0, y: 0, width: 4, height: 3,
    doors: [{ side: 'right', offset: 1.05, width: 0.9, swing: 'in' }],
    // Window on the shared right wall (interior)
    windows: [{ side: 'right', offset: 1.0, width: 1.2 }],
  };
  const roomB: FloorPlanRoom = {
    id: 'B', name: 'B', type: 'bedroom',
    x: 4, y: 0, width: 4, height: 3,
    doors: [{ side: 'left', offset: 1.05, width: 0.9, swing: 'in' }],
    windows: [],
  };
  const walls = applyDoors(buildWalls([roomA, roomB]), [roomA, roomB]);
  const { walls: result, skipped } = applyWindows(walls, [roomA, roomB]);

  const skippedWindow = skipped.find((s) => s.roomId === 'A' && s.reason === 'not-exterior');
  assert.ok(skippedWindow, 'window on interior wall should be in skipped list');

  // The shared wall should have NO window opening
  const sharedWall = result.find((w) => w.axis === 'z' && Math.abs(w.a.x - 4) < 0.01);
  assert.ok(sharedWall);
  const windows = sharedWall!.openings.filter((o) => o.kind === 'window');
  assert.equal(windows.length, 0, 'interior wall should have no windows');
});

// --- Test: window overlapping a door is skipped ---

test('windowOpenings: window overlapping a door is skipped', () => {
  // Room with door on top (offset=2.05) and window also on top (offset=2.0 — overlaps)
  const room: FloorPlanRoom = {
    id: 'R', name: 'Room', type: 'living-room',
    x: 0, y: 0, width: 6, height: 4,
    doors: [{ side: 'top', offset: 2.05, width: 0.9, swing: 'in' }],
    windows: [{ side: 'top', offset: 2.05, width: 1.2 }], // overlaps door
  };
  const walls = applyDoors(buildWalls([room]), [room]);
  const { skipped } = applyWindows(walls, [room]);

  const overlapped = skipped.find((s) => s.reason === 'overlaps-door');
  assert.ok(overlapped, 'overlapping window should be skipped');
});

// --- Test: rooms without windows get none ---

test('windowOpenings: rooms without windows array get no windows', () => {
  const room: FloorPlanRoom = {
    id: 'R', name: 'Room', type: 'bathroom',
    x: 0, y: 0, width: 3, height: 3,
    doors: [{ side: 'bottom', offset: 1.05, width: 0.8, swing: 'in' }],
    windows: [],
  };
  const walls = applyDoors(buildWalls([room]), [room]);
  const { walls: result } = applyWindows(walls, [room]);
  const allWindows = result.flatMap((w) => w.openings.filter((o) => o.kind === 'window'));
  assert.equal(allWindows.length, 0, 'no windows expected for room with empty windows array');
});

// --- Test: window has correct sill and head ---

test('windowOpenings: window has WINDOW_SILL and WINDOW_HEAD', () => {
  const room: FloorPlanRoom = {
    id: 'R', name: 'Room', type: 'living-room',
    x: 0, y: 0, width: 6, height: 4,
    doors: [{ side: 'bottom', offset: 2.55, width: 0.9, swing: 'in' }],
    windows: [{ side: 'top', offset: 2.55, width: 1.5 }],
  };
  const walls = applyDoors(buildWalls([room]), [room]);
  const { walls: result } = applyWindows(walls, [room]);
  const win = result.flatMap((w) => w.openings).find((o) => o.kind === 'window');
  assert.ok(win, 'window not found');
  assert.ok(Math.abs(win!.sill - WINDOW_SILL) < 0.001, `sill should be WINDOW_SILL, got ${win!.sill}`);
  assert.ok(Math.abs(win!.head - WINDOW_HEAD) < 0.001, `head should be WINDOW_HEAD, got ${win!.head}`);
});

// --- Test: right and bottom windows ---

test('windowOpenings: right and bottom window positions are correct', () => {
  const room: FloorPlanRoom = {
    id: 'R', name: 'Room', type: 'living-room',
    x: 1, y: 2, width: 5, height: 4,
    doors: [{ side: 'top', offset: 2.05, width: 0.9, swing: 'in' }],
    windows: [
      { side: 'right', offset: 1.55, width: 1.2 },
      { side: 'bottom', offset: 2.05, width: 1.5 },
    ],
  };
  const walls = applyDoors(buildWalls([room]), [room]);
  const { walls: result } = applyWindows(walls, [room]);

  const rightWall = result.find((w) => w.axis === 'z' && Math.abs(w.a.x - 6) < 0.01);
  assert.ok(rightWall, 'right wall not found');
  const rightWin = rightWall!.openings.find((o) => o.kind === 'window');
  assert.ok(rightWin, 'right window not found');
  // right wall at x=6 (axis z), window at z=[2+1.55, 2+2.75] → seg-relative start=1.55
  assert.ok(Math.abs(rightWin!.start - 1.55) < 0.15, `right win.start should be ~1.55, got ${rightWin!.start}`);

  const bottomWall = result.find((w) => w.axis === 'x' && Math.abs(w.a.z - 6) < 0.01);
  assert.ok(bottomWall, 'bottom wall not found');
  const bottomWin = bottomWall!.openings.find((o) => o.kind === 'window');
  assert.ok(bottomWin, 'bottom window not found');
  // bottom wall at z=6 (axis x), window at x=[1+2.05, 1+3.55] → seg-relative start=2.05
  assert.ok(Math.abs(bottomWin!.start - 2.05) < 0.15, `bottom win.start should be ~2.05, got ${bottomWin!.start}`);
});
