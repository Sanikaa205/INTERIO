import type { Vec2, WallSegment } from './types';

export function wallFacesCamera(wall: WallSegment, cameraXZ: Vec2, houseCenterXZ: Vec2): boolean {
  if (!wall.exterior) return false;
  const wallCenter = {
    x: (wall.a.x + wall.b.x) / 2,
    z: (wall.a.z + wall.b.z) / 2,
  };
  const towardCamera = { x: cameraXZ.x - wallCenter.x, z: cameraXZ.z - wallCenter.z };
  const outward = wall.axis === 'x'
    ? { x: 0, z: wallCenter.z >= houseCenterXZ.z ? 1 : -1 }
    : { x: wallCenter.x >= houseCenterXZ.x ? 1 : -1, z: 0 };
  return outward.x * towardCamera.x + outward.z * towardCamera.z > 0;
}
