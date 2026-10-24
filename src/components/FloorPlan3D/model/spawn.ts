import type { HouseModel } from './types';
import { EYE_HEIGHT } from './constants';

export interface SpawnPoint {
  x: number;
  z: number;
  yaw: number;
}

export function findSpawn(model: HouseModel): SpawnPoint {
  const entry = model.walls.flatMap((wall) => wall.openings
    .filter((opening) => opening.kind === 'door' && opening.isMainEntry)
    .map((opening) => ({ wall, opening }))) [0];
  if (entry) {
    const along = (entry.opening.start + entry.opening.end) / 2;
    const wallPoint = entry.wall.axis === 'x'
      ? { x: entry.wall.a.x + along, z: entry.wall.a.z }
      : { x: entry.wall.a.x, z: entry.wall.a.z + along };
    const room = model.rooms.find((item) => item.id === entry.opening.roomId);
    if (room) {
      const inward = { x: room.center.x - wallPoint.x, z: room.center.z - wallPoint.z };
      const length = Math.hypot(inward.x, inward.z) || 1;
      const direction = { x: inward.x / length, z: inward.z / length };
      return { x: wallPoint.x + direction.x * 0.8, z: wallPoint.z + direction.z * 0.8, yaw: Math.atan2(direction.x, direction.z) };
    }
  }
  const fallback = model.rooms.find((room) => room.type === 'living-room') ?? model.rooms[0];
  return fallback
    ? { x: fallback.center.x, z: fallback.center.z, yaw: 0 }
    : { x: model.bounds.minX + 0.5, z: model.bounds.minZ + 0.5, yaw: 0 };
}
