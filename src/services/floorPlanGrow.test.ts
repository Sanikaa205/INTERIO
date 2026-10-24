import assert from 'node:assert/strict';
import test from 'node:test';

// server.ts starts listening on import unless this is set.
process.env.INTERIO_NO_LISTEN = '1';

const R = (name: string, type: string, minSize: number) => ({ name, type, minSize });
const STANDARD_LAYOUT = [
  R('Living Room', 'living-room', 20), R('Kitchen', 'kitchen', 12),
  R('Master Bedroom', 'master-bedroom', 16), R('Bedroom 2', 'bedroom', 12), R('Bedroom 3', 'bedroom', 12),
  R('Bathroom', 'bathroom', 5), R('Master Bath', 'bathroom', 5),
];
// What fits a 10x12 plot: the standard layout needs ~97 m2 of rooms on 107 m2 of net plot.
const COMPACT_LAYOUT = [
  R('Living Room', 'living-room', 20), R('Kitchen', 'kitchen', 12),
  R('Master Bedroom', 'master-bedroom', 16), R('Bathroom', 'bathroom', 5),
];

async function assertValidPlan(w: number, l: number, rooms: any[]) {
  const { generateAlgorithmicFloorPlan, maxAspectForType, countUnreachableRooms } = await import('../../server.ts');
  const plan: any = generateAlgorithmicFloorPlan(w, l, rooms, '', '');

  // The legacy fallback is off by default, so a null grow `best` surfaces as a constraint error.
  assert.equal(plan.constraintError, undefined, `${w}x${l}: grow-by-attachment rejected every candidate: ${plan.constraintError}`);
  assert.ok(plan.rooms.length >= rooms.length);
  for (const room of plan.rooms) {
    const aspect = Math.max(room.width, room.height) / Math.min(room.width, room.height);
    assert.ok(aspect <= maxAspectForType(room.type) * 1.08, `${w}x${l}: ${room.name} ${room.width}x${room.height} exceeds its aspect cap`);
    assert.ok(room.doors?.length > 0, `${w}x${l}: ${room.name} has no door`);
  }
  assert.equal(countUnreachableRooms(plan.rooms, plan.circulation, w, l), 0, `${w}x${l}: unreachable rooms`);
}

test('10x12 plot: compact program yields a valid plan', () => assertValidPlan(10, 12, COMPACT_LAYOUT));
test('12x12 plot: standard layout yields a valid plan', () => assertValidPlan(12, 12, STANDARD_LAYOUT));
test('12x15 plot: standard layout yields a valid plan', () => assertValidPlan(12, 15, STANDARD_LAYOUT));
test('14x16 plot: standard layout yields a valid plan', () => assertValidPlan(14, 16, STANDARD_LAYOUT));

test('10x12 plot: standard layout is too big and says why, with a minimum plot size', async () => {
  const { generateAlgorithmicFloorPlan } = await import('../../server.ts');
  const plan: any = generateAlgorithmicFloorPlan(10, 12, STANDARD_LAYOUT, '', '');
  assert.match(plan.constraintError, /10m × 12m/);
  assert.match(plan.constraintError, /Master Bedroom|Bedroom|Bathroom/);
  assert.match(plan.constraintError, /about 1[2-9]m × 1[2-9]m/);
});
