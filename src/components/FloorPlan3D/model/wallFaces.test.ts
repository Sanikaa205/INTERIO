import test from 'node:test';
import assert from 'node:assert/strict';
import { buildHouseModel } from './buildHouseModel';
import { plan10x12 } from './fixtures';
import type { Side, WallSegment } from './types';
import { FACE_MATERIAL_INDEX, OUTSIDE_FACE, faceFromMaterialIndex, faceTowardPoint, faceUReversed, wallFaceTargets } from './wallFaces';

function wall(axis: 'x' | 'z', roomIds: string[], sides: Side[], exterior = roomIds.length === 1): WallSegment {
  return {
    id: 'w-test', a: { x: 0, z: 0 }, b: { x: axis === 'x' ? 4 : 0, z: axis === 'z' ? 4 : 0 },
    axis, length: 4, thickness: 0.15, exterior, roomIds, sides, openings: [],
  };
}

test('side maps to the direction the room interior lies in', () => {
  assert.equal(wallFaceTargets(wall('x', ['a'], ['top']))[0].dir, 'pz');
  assert.equal(wallFaceTargets(wall('x', ['a'], ['bottom']))[0].dir, 'nz');
  assert.equal(wallFaceTargets(wall('z', ['a'], ['left']))[0].dir, 'px');
  assert.equal(wallFaceTargets(wall('z', ['a'], ['right']))[0].dir, 'nx');
});

test('a shared interior wall has two faces in opposite directions', () => {
  const targets = wallFaceTargets(wall('x', ['a', 'b'], ['bottom', 'top']));
  assert.deepEqual(targets.map((t) => [t.faceKey, t.dir, t.materialIndex]), [['a', 'nz', 5], ['b', 'pz', 4]]);
});

test('an exterior wall gets an inside face and an outside face', () => {
  const targets = wallFaceTargets(wall('z', ['a'], ['left']));
  assert.deepEqual(targets.map((t) => [t.faceKey, t.roomId, t.dir]), [['a', 'a', 'px'], [OUTSIDE_FACE, null, 'nx']]);
  assert.equal(targets[1].materialIndex, FACE_MATERIAL_INDEX.nx);
});

test('overlapping rooms on the same side: first wins, no crash', () => {
  const targets = wallFaceTargets(wall('x', ['a', 'b'], ['top', 'top'], false));
  assert.deepEqual(targets.map((t) => t.faceKey), ['a']);
});

test('walls with 0 or 3 rooms do not crash', () => {
  assert.deepEqual(wallFaceTargets(wall('x', [], [], false)), []);
  const three = wallFaceTargets(wall('x', ['a', 'b', 'c'], ['top', 'bottom', 'top'], false));
  assert.deepEqual(three.map((t) => t.faceKey), ['a', 'b']);
  // A room listed twice yields one face.
  assert.equal(wallFaceTargets(wall('x', ['a', 'a'], ['top', 'bottom'], false)).length, 1);
});

test('material index round-trips; top, bottom and jamb indices give null', () => {
  const w = wall('x', ['a', 'b'], ['bottom', 'top']);
  for (const target of wallFaceTargets(w)) {
    assert.equal(faceFromMaterialIndex(w, target.materialIndex)?.faceKey, target.faceKey);
  }
  for (const index of [0, 1, 2, 3]) assert.equal(faceFromMaterialIndex(w, index), null);
});

test('every wall in the fixture house resolves faces consistently', () => {
  const model = buildHouseModel(plan10x12);
  for (const w of model.walls) {
    const targets = wallFaceTargets(w);
    assert.equal(targets.length, w.exterior ? 2 : 2, w.id);
    assert.equal(new Set(targets.map((t) => t.materialIndex)).size, targets.length, w.id);
    for (const t of targets) assert.ok(t.roomId === null || w.roomIds.includes(t.roomId));
  }
});

test('a click on a top or jamb face picks the face on the viewer side', () => {
  const w = wall('x', ['a', 'b'], ['bottom', 'top']); // a looks -z, b looks +z
  assert.equal(faceTowardPoint(w, { x: 2, z: 5 })?.faceKey, 'b');
  assert.equal(faceTowardPoint(w, { x: 2, z: -5 })?.faceKey, 'a');
  const exterior = wall('z', ['a'], ['left']); // inside looks +x, outside looks -x
  assert.equal(faceTowardPoint(exterior, { x: -3, z: 2 })?.faceKey, OUTSIDE_FACE);
  assert.equal(faceTowardPoint(wall('x', [], [], false), { x: 0, z: 1 }), null);
});

test('U direction is reversed only on px and nz faces', () => {
  assert.deepEqual((['px', 'nx', 'pz', 'nz'] as const).map(faceUReversed), [true, false, false, true]);
});
