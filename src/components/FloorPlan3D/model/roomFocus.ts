import type { CameraFit } from './cameraFit';
import type { HouseModel } from './types';

export interface FocusRoom {
  center: { x: number; z: number };
  width: number;
  depth: number;
}

export function focusFor(room: FocusRoom, fovDeg: number, aspect: number): CameraFit {
  const fov = (fovDeg * Math.PI) / 180;
  const span = Math.max(room.width, room.depth, 0.1) * 1.25;
  const distance = (span / 2) / Math.tan(fov / 2) / Math.max(0.1, aspect);
  const elevation = (55 * Math.PI) / 180;
  const azimuth = (35 * Math.PI) / 180;
  const horizontal = distance * Math.cos(elevation);
  return {
    position: [
      room.center.x + horizontal * Math.sin(azimuth),
      1.4 + distance * Math.sin(elevation),
      room.center.z + horizontal * Math.cos(azimuth),
    ],
    target: [room.center.x, 0.4, room.center.z],
    minDistance: 2,
    maxDistance: distance * 3,
  };
}

export function roomById(model: HouseModel, roomId: string | null): HouseModel['rooms'][number] | undefined {
  return roomId ? model.rooms.find((room) => room.id === roomId) : undefined;
}
