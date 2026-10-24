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

test('grow-by-attachment yields a rule-abiding plan for the standard layout (no legacy fallback)', async () => {
  const { generateAlgorithmicFloorPlan, maxAspectForType, countUnreachableRooms } = await import('../../server.ts');
  const plan: any = generateAlgorithmicFloorPlan(14, 16, STANDARD_LAYOUT, '', '');

  // The legacy fallback is disabled by default, so a null grow `best` surfaces as a constraint error.
  assert.equal(plan.constraintError, undefined, `grow-by-attachment rejected every candidate: ${plan.constraintError}`);
  assert.ok(plan.rooms.length >= STANDARD_LAYOUT.length);

  for (const room of plan.rooms) {
    const aspect = Math.max(room.width, room.height) / Math.min(room.width, room.height);
    assert.ok(aspect <= maxAspectForType(room.type) * 1.08, `${room.name} ${room.width}x${room.height} exceeds its aspect cap`);
    assert.ok(room.doors?.length > 0, `${room.name} has no door`);
  }
  assert.equal(countUnreachableRooms(plan.rooms, plan.circulation, 14, 16), 0);
});
