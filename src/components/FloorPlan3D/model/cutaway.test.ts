import test from 'node:test';
import assert from 'node:assert/strict';
import { wallFacesCamera } from './cutaway';
import type { WallSegment } from './types';

const southWall: WallSegment = {
  id: 'south', a: { x: 0, z: 10 }, b: { x: 10, z: 10 }, axis: 'x', length: 10,
  thickness: 0.15, exterior: true, roomIds: ['room'], sides: ['bottom'], openings: [],
};

test('south exterior wall faces a southern camera', () => {
  assert.equal(wallFacesCamera(southWall, { x: 5, z: 20 }, { x: 5, z: 5 }), true);
  assert.equal(wallFacesCamera(southWall, { x: 5, z: 0 }, { x: 5, z: 5 }), false);
});

test('interior walls never face the camera', () => {
  assert.equal(wallFacesCamera({ ...southWall, exterior: false }, { x: 5, z: 20 }, { x: 5, z: 5 }), false);
});
