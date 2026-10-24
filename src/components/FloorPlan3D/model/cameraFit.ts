import { WALL_HEIGHT } from './constants';

export interface CameraBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface CameraFit {
  position: [number, number, number];
  target: [number, number, number];
  minDistance: number;
  maxDistance: number;
}

export function fitCamera(bounds: CameraBounds, fovDeg: number, aspect: number): CameraFit {
  const width = Math.max(0.1, bounds.maxX - bounds.minX);
  const depth = Math.max(0.1, bounds.maxZ - bounds.minZ);
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerZ = (bounds.minZ + bounds.maxZ) / 2;
  const verticalSpan = Math.max(WALL_HEIGHT, depth * 0.75);
  const horizontalSpan = Math.max(width, depth);
  const fov = (fovDeg * Math.PI) / 180;
  const verticalDistance = (verticalSpan / 2) / Math.tan(fov / 2);
  const horizontalFov = 2 * Math.atan(Math.tan(fov / 2) * Math.max(0.1, aspect));
  const horizontalDistance = (horizontalSpan / 2) / Math.tan(horizontalFov / 2);
  const distance = Math.max(verticalDistance, horizontalDistance) * 1.35;
  const elevation = (50 * Math.PI) / 180;
  const azimuth = (35 * Math.PI) / 180;
  const horizontal = distance * Math.cos(elevation);

  return {
    position: [
      centerX + horizontal * Math.sin(azimuth),
      WALL_HEIGHT / 2 + distance * Math.sin(elevation),
      centerZ + horizontal * Math.cos(azimuth),
    ],
    target: [centerX, WALL_HEIGHT / 2, centerZ],
    minDistance: 2,
    maxDistance: distance * 3,
  };
}
