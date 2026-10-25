import test from 'node:test';
import assert from 'node:assert/strict';
import { fitCamera } from './cameraFit';

const bounds = { minX: 0, maxX: 10, minZ: 0, maxZ: 12 };

test('targets the footprint centre and has a bounded distance', () => {
  const fit = fitCamera(bounds, 50, 1);
  assert.deepEqual(fit.target, [5, 1.4, 6]);
  assert.equal(fit.minDistance, 2);
  assert.equal(fit.maxDistance > fit.minDistance, true);
});

test('portrait aspect requires a larger camera distance', () => {
  assert.ok(fitCamera(bounds, 50, 0.5).maxDistance > fitCamera(bounds, 50, 1.5).maxDistance);
});

test('larger footprints require a larger camera distance', () => {
  const small = fitCamera(bounds, 50, 1);
  const large = fitCamera({ minX: 0, maxX: 15, minZ: 0, maxZ: 20 }, 50, 1);
  assert.ok(large.maxDistance > small.maxDistance);
});
