import test from 'node:test';
import assert from 'node:assert/strict';
import { focusFor } from './roomFocus';

test('focus targets the room centre', () => {
  const result = focusFor({ center: { x: 4, z: 6 }, width: 4, depth: 5 }, 50, 1);
  assert.deepEqual(result.target, [4, 0.4, 6]);
});

test('larger rooms need a greater focus distance', () => {
  const small = focusFor({ center: { x: 0, z: 0 }, width: 2, depth: 2 }, 50, 1);
  const large = focusFor({ center: { x: 0, z: 0 }, width: 8, depth: 6 }, 50, 1);
  assert.ok(large.maxDistance > small.maxDistance);
});
