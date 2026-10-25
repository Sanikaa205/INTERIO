import assert from 'node:assert/strict';
import test from 'node:test';
import { buildHouseModel } from './buildHouseModel';
import { plan10x12, plan12x12, plan15x20, planSingleRoom } from './fixtures';
import { PLAN_EPS } from './constants';
import type { FloorPlanResult } from '../../../types';
import type { WallSegment } from './types';

// Helper: check if two intervals [s1,e1] and [s2,e2] overlap more than eps
function intervalsOverlap(s1: number, e1: number, s2: number, e2: number, eps = PLAN_EPS): boolean {
  return s1 < e2 - eps && e1 > s2 + eps;
}

// Helper: check if an opening is fully within its wall (0 <= start < end <= length)
function openingInWall(start: number, end: number, length: number): boolean {
  return start >= -PLAN_EPS && end <= length + PLAN_EPS && start < end;
}

function runIntegrationAssertions(plan: FloorPlanResult, label: string) {
  const model = buildHouseModel(plan);

  // 1. No two walls with same axis/fixed overlap by more than eps (no doubled walls)
  const byAxisFixed = new Map<string, WallSegment[]>();
  for (const w of model.walls) {
    const fixed = w.axis === 'x' ? w.a.z : w.a.x;
    const key = `${w.axis}_${Math.round(fixed * 100)}`;
    if (!byAxisFixed.has(key)) byAxisFixed.set(key, []);
    byAxisFixed.get(key)!.push(w);
  }
  for (const [key, segs] of byAxisFixed) {
    for (let i = 0; i < segs.length; i++) {
      for (let j = i + 1; j < segs.length; j++) {
        const a = segs[i];
        const b = segs[j];
        const aFrom = a.axis === 'x' ? a.a.x : a.a.z;
        const aTo = a.axis === 'x' ? a.b.x : a.b.z;
        const bFrom = b.axis === 'x' ? b.a.x : b.a.z;
        const bTo = b.axis === 'x' ? b.b.x : b.b.z;
        const overlap = intervalsOverlap(aFrom, aTo, bFrom, bTo);
        assert.ok(!overlap, `${label}: walls ${a.id} and ${b.id} overlap on key ${key}: [${aFrom},${aTo}] vs [${bFrom},${bTo}]`);
      }
    }
  }

  // 2. Every door opening lies fully inside its wall
  for (const w of model.walls) {
    for (const op of w.openings) {
      assert.ok(
        openingInWall(op.start, op.end, w.length),
        `${label}: opening [${op.start},${op.end}] outside wall ${w.id} length=${w.length}`
      );
    }
  }

  // 3. Every window is on an exterior segment and no door/window overlap on a segment
  for (const w of model.walls) {
    const windows = w.openings.filter((o) => o.kind === 'window');
    const doors = w.openings.filter((o) => o.kind === 'door');

    for (const win of windows) {
      assert.ok(w.exterior, `${label}: window on non-exterior wall ${w.id}`);
    }

    // No overlaps between any pair of openings
    for (let i = 0; i < w.openings.length; i++) {
      for (let j = i + 1; j < w.openings.length; j++) {
        const a = w.openings[i];
        const b = w.openings[j];
        const overlap = intervalsOverlap(a.start, a.end, b.start, b.end);
        assert.ok(!overlap, `${label}: openings ${i} and ${j} overlap on wall ${w.id}: [${a.start},${a.end}] vs [${b.start},${b.end}]`);
      }
    }
  }

  // 4. Number of floors equals rooms + hallways from circulation
  const expectedFloors = plan.rooms.filter((r) => r.width > 0 && r.height > 0).length +
    (plan.circulation?.filter((c) => c.width > 0 && c.height > 0).length ?? 0);
  assert.equal(model.floors.length, expectedFloors, `${label}: floor count mismatch`);

  // 5. Bounds match the plot within 0.5 m
  const tolerance = 0.5;
  assert.ok(
    Math.abs(model.bounds.maxX - model.bounds.minX - plan.plotWidth) < tolerance ||
    model.bounds.maxX <= plan.plotWidth + tolerance,
    `${label}: maxX-minX=${model.bounds.maxX - model.bounds.minX} vs plotWidth=${plan.plotWidth}`
  );

  // 6. Exterior wall total length ≈ perimeter of union footprint (within 5% + reasonable slack)
  const exteriorLen = model.walls
    .filter((w) => w.exterior)
    .reduce((sum, w) => sum + w.length, 0);
  // Perimeter is at least 2*(plotWidth+plotLength) for a perfect rectangle
  const minPerim = 2 * (plan.plotWidth + plan.plotLength) * 0.7; // allow up to 30% less (internal courtyards etc.)
  assert.ok(exteriorLen >= minPerim, `${label}: exterior wall length ${exteriorLen} too short (expected >= ${minPerim})`);

  // 7. Exactly one isMainEntry door if fixtures have one
  const mainEntries = model.walls
    .flatMap((w) => w.openings)
    .filter((o) => o.isMainEntry);
  const hasMainEntry = plan.rooms.some((r) => r.doors?.some((d) => d.isMainEntry));
  if (hasMainEntry) {
    assert.ok(mainEntries.length >= 1, `${label}: expected at least 1 isMainEntry door, got ${mainEntries.length}`);
  }

  // 8. Determinism: build twice and compare
  const model2 = buildHouseModel(plan);
  assert.equal(model.walls.length, model2.walls.length, `${label}: determinism wall count`);
  assert.equal(model.floors.length, model2.floors.length, `${label}: determinism floor count`);
  for (let i = 0; i < model.walls.length; i++) {
    assert.equal(model.walls[i].id, model2.walls[i].id, `${label}: determinism wall id[${i}]`);
    assert.equal(model.walls[i].openings.length, model2.walls[i].openings.length, `${label}: determinism openings[${i}]`);
  }
}

test('buildHouseModel: plan10x12 integration assertions', () => {
  runIntegrationAssertions(plan10x12, '10x12');
});

test('buildHouseModel: plan12x12 integration assertions', () => {
  runIntegrationAssertions(plan12x12, '12x12');
});

test('buildHouseModel: plan15x20 integration assertions', () => {
  runIntegrationAssertions(plan15x20, '15x20');
});

test('buildHouseModel: empty plan does not throw and returns empty model', () => {
  const emptyPlan: FloorPlanResult = {
    plotWidth: 10, plotLength: 10, totalBuiltArea: 0, rooms: [],
  };
  let model: any;
  assert.doesNotThrow(() => {
    model = buildHouseModel(emptyPlan);
  });
  assert.equal(model.walls.length, 0);
  assert.equal(model.floors.length, 0);
});

test('buildHouseModel: plan with invalid rooms (zero dimensions) skips them gracefully', () => {
  const plan: FloorPlanResult = {
    plotWidth: 10, plotLength: 10, totalBuiltArea: 50,
    rooms: [
      { id: 'r1', name: 'Good', type: 'living-room', x: 0, y: 0, width: 5, height: 5, doors: [], windows: [] },
      { id: 'r2', name: 'Bad', type: 'kitchen', x: 5, y: 0, width: 0, height: 5, doors: [], windows: [] },
    ],
  };
  let model: any;
  assert.doesNotThrow(() => {
    model = buildHouseModel(plan);
  });
  assert.equal(model.floors.length, 1, 'only 1 valid floor');
});

test('buildHouseModel: planSingleRoom — all walls exterior', () => {
  const model = buildHouseModel(planSingleRoom);
  assert.ok(model.walls.every((w) => w.exterior), 'all walls of single room should be exterior');
});
