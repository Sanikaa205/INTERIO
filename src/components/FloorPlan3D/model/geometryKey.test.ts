import test from 'node:test';
import assert from 'node:assert/strict';
import { buildHouseModel } from './buildHouseModel';
import { houseGeometryKey } from './geometryKey';
import { plan10x12 } from './fixtures';
import { setSurfaceFinish } from '../finishUpdates';

test('a finish edit keeps the geometry key, and the model is deep-equal when rebuilt', () => {
  const before = buildHouseModel(plan10x12);
  const edited = setSurfaceFinish(plan10x12, { kind: 'room-floor', roomId: plan10x12.rooms[0].id }, { materialId: 'paint', color: '#ff0000' }, before.walls.map((w) => w.id));
  assert.notEqual(edited, plan10x12);
  assert.equal(houseGeometryKey(edited), houseGeometryKey(plan10x12));
  assert.deepEqual(buildHouseModel(edited), before);
});

test('changing a room changes the geometry key', () => {
  const moved = { ...plan10x12, rooms: plan10x12.rooms.map((r, i) => (i === 0 ? { ...r, width: r.width + 1 } : r)) };
  assert.notEqual(houseGeometryKey(moved), houseGeometryKey(plan10x12));
});
