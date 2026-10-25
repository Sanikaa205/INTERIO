import assert from 'node:assert/strict';
import test from 'node:test';
import { buildFloors, FLOOR_COLORS } from './floors';
import type { PlanRect } from './wallEdges';

function makeRect(id: string, type: string, x: number, y: number, w: number, h: number): PlanRect {
  return { id, name: `${id}-name`, type, x, y, width: w, height: h };
}

test('floors: one floor per rect', () => {
  const rects = [
    makeRect('r1', 'living-room', 0, 0, 5, 4),
    makeRect('r2', 'kitchen', 5, 0, 3, 4),
    makeRect('circ-0', 'hallway', 0, 4, 8, 2),
  ];
  const floors = buildFloors(rects);
  assert.equal(floors.length, 3);
});

test('floors: colours are assigned by type', () => {
  const rects = [
    makeRect('r1', 'living-room', 0, 0, 5, 4),
    makeRect('r2', 'kitchen', 5, 0, 3, 4),
    makeRect('r3', 'bathroom', 0, 4, 3, 3),
    makeRect('r4', 'hallway', 3, 4, 5, 3),
  ];
  const floors = buildFloors(rects);
  const byId = new Map(floors.map((f) => [f.roomId, f]));

  assert.equal(byId.get('r1')!.color, FLOOR_COLORS['living-room']);
  assert.equal(byId.get('r2')!.color, FLOOR_COLORS['kitchen']);
  assert.equal(byId.get('r3')!.color, FLOOR_COLORS['bathroom']);
  assert.equal(byId.get('r4')!.color, FLOOR_COLORS['hallway']);
});

test('floors: living-room and kitchen colours differ', () => {
  assert.notEqual(FLOOR_COLORS['living-room'], FLOOR_COLORS['kitchen']);
});

test('floors: all defined room type colours are distinct from hallway', () => {
  const hallway = FLOOR_COLORS['hallway'];
  const others = ['living-room', 'master-bedroom', 'bedroom', 'kitchen', 'dining-room', 'bathroom'];
  for (const t of others) {
    assert.notEqual(FLOOR_COLORS[t], hallway, `${t} color should differ from hallway`);
  }
});

test('floors: valid #rrggbb room color overrides type color', () => {
  const rects = [makeRect('r1', 'living-room', 0, 0, 5, 4)];
  const colorMap = new Map([['r1', '#aabbcc']]);
  const floors = buildFloors(rects, colorMap);
  assert.equal(floors[0].color, '#aabbcc');
});

test('floors: invalid room color falls back to type color', () => {
  const rects = [makeRect('r1', 'kitchen', 0, 0, 5, 4)];
  const colorMap = new Map([['r1', 'not-a-color']]);
  const floors = buildFloors(rects, colorMap);
  assert.equal(floors[0].color, FLOOR_COLORS['kitchen']);
});

test('floors: unknown room type falls back to neutral colour (not undefined/null)', () => {
  const rects = [makeRect('r1', 'unknown-type', 0, 0, 5, 4)];
  const floors = buildFloors(rects);
  assert.ok(typeof floors[0].color === 'string' && floors[0].color.startsWith('#'), 'should have a hex color');
});

test('floors: plan y maps to world z (depth)', () => {
  const rect = makeRect('r1', 'bedroom', 3, 7, 4, 5);
  const floors = buildFloors([rect]);
  assert.equal(floors[0].x, 3);
  assert.equal(floors[0].z, 7);    // plan y → world z
  assert.equal(floors[0].width, 4);
  assert.equal(floors[0].depth, 5); // plan height → world depth
});
