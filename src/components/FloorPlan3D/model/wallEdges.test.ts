import assert from 'node:assert/strict';
import test from 'node:test';
import { roomEdges, roomsFromPlan } from './wallEdges';
import { planSingleRoom, planWithHallway } from './fixtures';

test('wallEdges: a 4×3 room at (1,2) yields 4 correct edges', () => {
  const rect = { id: 'test', name: 'Test', type: 'living-room', x: 1, y: 2, width: 4, height: 3 };
  const edges = roomEdges(rect);
  assert.equal(edges.length, 4);

  const top = edges.find((e) => e.side === 'top')!;
  assert.equal(top.axis, 'x');
  assert.equal(top.fixed, 2);   // plan y = world z = 2
  assert.equal(top.from, 1);   // plan x = world x = 1
  assert.equal(top.to, 5);     // plan x+w = 1+4 = 5

  const bottom = edges.find((e) => e.side === 'bottom')!;
  assert.equal(bottom.axis, 'x');
  assert.equal(bottom.fixed, 5);  // y + h = 2+3 = 5
  assert.equal(bottom.from, 1);
  assert.equal(bottom.to, 5);

  const left = edges.find((e) => e.side === 'left')!;
  assert.equal(left.axis, 'z');
  assert.equal(left.fixed, 1);  // plan x = world x = 1
  assert.equal(left.from, 2);  // plan y = world z = 2
  assert.equal(left.to, 5);    // plan y+h = 5

  const right = edges.find((e) => e.side === 'right')!;
  assert.equal(right.axis, 'z');
  assert.equal(right.fixed, 5);  // x+w = 1+4 = 5
  assert.equal(right.from, 2);
  assert.equal(right.to, 5);
});

test('wallEdges: roomEdges assigns correct roomId', () => {
  const rect = { id: 'myroom', name: 'Test', type: 'kitchen', x: 0, y: 0, width: 5, height: 5 };
  const edges = roomEdges(rect);
  assert.ok(edges.every((e) => e.roomId === 'myroom'));
});

test('wallEdges: roomsFromPlan includes rooms from plan', () => {
  const rects = roomsFromPlan(planSingleRoom);
  assert.equal(rects.length, 1);
  assert.equal(rects[0].id, 'r1');
});

test('wallEdges: roomsFromPlan includes circulation hallways with circ- prefix', () => {
  const rects = roomsFromPlan(planWithHallway);
  const hall = rects.find((r) => r.id === 'circ-0');
  assert.ok(hall, 'circulation hallway not found');
  assert.equal(hall!.type, 'hallway');
  assert.equal(hall!.x, 0);
  assert.equal(hall!.y, 5);
  assert.equal(hall!.width, 10);
  assert.equal(hall!.height, 2);
});

test('wallEdges: roomsFromPlan skips rooms with zero or negative dimensions', () => {
  const plan = {
    plotWidth: 10, plotLength: 10, totalBuiltArea: 50,
    rooms: [
      { id: 'r1', name: 'Good', type: 'living-room' as const, x: 0, y: 0, width: 5, height: 5, doors: [], windows: [] },
      { id: 'r2', name: 'Bad', type: 'kitchen' as const, x: 5, y: 0, width: 0, height: 5, doors: [], windows: [] },
      { id: 'r3', name: 'BadNeg', type: 'bedroom' as const, x: 5, y: 0, width: -1, height: 5, doors: [], windows: [] },
    ],
  };
  const rects = roomsFromPlan(plan);
  assert.equal(rects.length, 1);
  assert.equal(rects[0].id, 'r1');
});
