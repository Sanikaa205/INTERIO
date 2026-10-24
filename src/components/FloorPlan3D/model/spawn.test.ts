import test from 'node:test';
import assert from 'node:assert/strict';
import { buildHouseModel } from './buildHouseModel';
import { buildColliders } from './collision';
import { findSpawn } from './spawn';
import { plan10x12, plan12x12, plan15x20 } from './fixtures';

for (const [name, plan] of [['10x12', plan10x12], ['12x12', plan12x12], ['15x20', plan15x20] ] as const) {
  test(`finds an interior spawn for ${name}`, () => {
    const model = buildHouseModel(plan);
    const spawn = findSpawn(model);
    assert.ok(model.rooms.some((room) => spawn.x > room.center.x - room.width / 2 && spawn.x < room.center.x + room.width / 2 && spawn.z > room.center.z - room.depth / 2 && spawn.z < room.center.z + room.depth / 2));
    assert.ok(Number.isFinite(spawn.yaw));
    assert.ok(buildColliders(model).every((collider) => spawn.x < collider.minX - 0.01 || spawn.x > collider.maxX + 0.01 || spawn.z < collider.minZ - 0.01 || spawn.z > collider.maxZ + 0.01));
  });
}
