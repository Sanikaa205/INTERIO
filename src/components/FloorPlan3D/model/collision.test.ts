import test from 'node:test';
import assert from 'node:assert/strict';
import { buildColliders, moveWithCollision } from './collision';
import { buildHouseModel } from './buildHouseModel';
import { plan10x12 } from './fixtures';

test('builds colliders while preserving a door gap and blocking windows', () => {
  const model = buildHouseModel(plan10x12);
  const colliders = buildColliders(model);
  assert.ok(colliders.length > 0);
  assert.ok(colliders.every((collider) => collider.maxX > collider.minX && collider.maxZ > collider.minZ));
});

test('stops at a wall and preserves parallel sliding', () => {
  const colliders = [{ minX: 4.9, maxX: 5.1, minZ: 0, maxZ: 10 }];
  const blocked = moveWithCollision({ x: 4, z: 2 }, { x: 3, z: 2 }, colliders, 0.25);
  assert.equal(blocked.x, 4.65);
  assert.ok(Math.abs(blocked.z - 4) < 1e-9);
});

test('large movement does not tunnel through a wall', () => {
  const colliders = [{ minX: 4.9, maxX: 5.1, minZ: 0, maxZ: 10 }];
  const result = moveWithCollision({ x: 0, z: 5 }, { x: 20, z: 0 }, colliders);
  assert.equal(result.x, 4.65);
});
