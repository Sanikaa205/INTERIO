import assert from 'node:assert/strict';
import test from 'node:test';

// server.ts starts listening on import unless this is set.
process.env.INTERIO_NO_LISTEN = '1';

const R = (name: string, type: string, minSize: number) => ({ name, type, minSize });

// FloorPlanWorkflow.tsx's default room list, exactly as the UI sends it
// (coarse types: 'living', 'bedroom', 'kitchen', 'bathroom').
const UI_DEFAULT_PROGRAM = [
  R('Living Room', 'living', 24), R('Master Bedroom', 'bedroom', 18), R('Guest Bedroom', 'bedroom', 14),
  R('Kitchen & Dining', 'kitchen', 16), R('Master Bathroom', 'bathroom', 6), R('Powder Room', 'bathroom', 4),
];
// Larger program with the generator's own fine-grained types.
const LARGE_PROGRAM = [
  R('Living Room', 'living-room', 20), R('Kitchen', 'kitchen', 12),
  R('Master Bedroom', 'master-bedroom', 16), R('Bedroom 2', 'bedroom', 12), R('Bedroom 3', 'bedroom', 12),
  R('Bathroom', 'bathroom', 5), R('Master Bath', 'bathroom', 5),
];

async function assertValidPlan(w: number, l: number, rooms: any[], seed = '') {
  const { generateAlgorithmicFloorPlan, maxAspectForType, countUnreachableRooms } = await import('../../server.ts');
  const plan: any = generateAlgorithmicFloorPlan(w, l, rooms, '', seed);

  // The legacy fallback is off by default, so a null grow `best` surfaces as a constraint error.
  assert.equal(plan.constraintError, undefined, `${w}x${l} seed '${seed}': grow-by-attachment rejected every candidate: ${plan.constraintError}`);
  assert.ok(plan.rooms.length >= rooms.length);
  for (const room of plan.rooms) {
    const aspect = Math.max(room.width, room.height) / Math.min(room.width, room.height);
    assert.ok(aspect <= maxAspectForType(room.type) * 1.08, `${w}x${l}: ${room.name} ${room.width}x${room.height} exceeds its aspect cap`);
    assert.ok(room.doors?.length > 0, `${w}x${l}: ${room.name} has no door`);
  }
  assert.equal(countUnreachableRooms(plan.rooms, plan.circulation, w, l), 0, `${w}x${l}: unreachable rooms`);
  return plan;
}

for (const [w, l] of [[10, 12], [12, 12], [12, 15], [14, 16], [15, 20]]) {
  test(`${w}x${l} plot: the UI default program yields a valid plan`, () => assertValidPlan(w, l, UI_DEFAULT_PROGRAM));
}
test('12x15 and 14x16 plots: the larger program yields a valid plan', async () => {
  await assertValidPlan(12, 15, LARGE_PROGRAM);
  await assertValidPlan(14, 16, LARGE_PROGRAM);
});

test('12x12 plot: valid plans across several variation seeds (none returns a 422)', async () => {
  for (const seed of ['a', 'b', 'c', 'regenerate-1']) {
    await assertValidPlan(12, 12, UI_DEFAULT_PROGRAM, seed);
    await assertValidPlan(12, 12, LARGE_PROGRAM, seed);
  }
});

test("UI room types are normalised: 'living' and the master 'bedroom' reach the generator as living-room / master-bedroom", async () => {
  const plan = await assertValidPlan(14, 16, UI_DEFAULT_PROGRAM);
  const types = plan.rooms.map((r: any) => r.type);
  assert.ok(types.includes('living-room'));
  assert.ok(types.includes('master-bedroom'));
  assert.ok(types.includes('powder-room'));
});

test('a plot that is too small returns a specific 422 message with a minimum plot size', async () => {
  const { generateAlgorithmicFloorPlan } = await import('../../server.ts');
  const plan: any = generateAlgorithmicFloorPlan(8, 8, LARGE_PROGRAM, '', '');
  assert.match(plan.constraintError, /8m × 8m/);
  assert.match(plan.constraintError, /had no position|rooms could not be packed|unreachable|no legal door/);
  assert.match(plan.constraintError, /about \d+m × \d+m|reduce the room count/);
});
