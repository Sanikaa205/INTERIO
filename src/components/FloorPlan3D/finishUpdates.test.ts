import test from 'node:test';
import assert from 'node:assert/strict';
import type { FloorPlanResult, SurfaceFinish } from '../../types';
import { resetSurfaceFinish, setSurfaceFinish } from './finishUpdates';

const plan: FloorPlanResult = {
  plotWidth: 8, plotLength: 6, totalBuiltArea: 48,
  rooms: [{ id: 'living', name: 'Living', type: 'living-room', x: 0, y: 0, width: 8, height: 6 }],
};
const paint: SurfaceFinish = { materialId: 'paint', color: '#112233', variantId: 'paint-charcoal' };

test('adds and replaces only the targeted finish without mutating the input', () => {
  const first = setSurfaceFinish(plan, { kind: 'room-floor', roomId: 'living' }, paint);
  const second = setSurfaceFinish(first, { kind: 'wall', wallId: 'wall-1' }, { materialId: 'wood' }, ['wall-1']);
  assert.deepEqual(plan.finishes, undefined);
  assert.deepEqual(first.finishes?.rooms?.living?.floor, paint);
  assert.deepEqual(second.finishes?.rooms?.living?.floor, paint);
  assert.deepEqual(second.finishes?.walls?.['wall-1'], { materialId: 'wood' });
});

test('resets only the targeted finish and prunes empty containers', () => {
  const withFinishes = setSurfaceFinish(
    setSurfaceFinish(plan, { kind: 'room-floor', roomId: 'living' }, paint),
    { kind: 'room-ceiling', roomId: 'living' }, { materialId: 'tile' },
  );
  const floorReset = resetSurfaceFinish(withFinishes, { kind: 'room-floor', roomId: 'living' });
  const allReset = resetSurfaceFinish(floorReset, { kind: 'room-ceiling', roomId: 'living' });
  assert.equal(floorReset.finishes?.rooms?.living?.floor, undefined);
  assert.deepEqual(floorReset.finishes?.rooms?.living?.ceiling, { materialId: 'tile' });
  assert.equal(allReset.finishes, undefined);
});

test('ignores unknown room and wall targets', () => {
  assert.equal(setSurfaceFinish(plan, { kind: 'room-floor', roomId: 'missing' }, paint), plan);
  assert.equal(setSurfaceFinish(plan, { kind: 'wall', wallId: 'missing' }, paint, ['wall-1']), plan);
  assert.equal(resetSurfaceFinish(plan, { kind: 'wall', wallId: 'missing' }, ['wall-1']), plan);
});
