// Public API for the FloorPlan3D model layer.
// All exports here are pure TypeScript with no three/react imports.

export { buildHouseModel } from './buildHouseModel';
export { FLOOR_COLORS } from './floors';
export * from './constants';
export type { HouseModel, WallSegment, Opening, FloorPoly, Vec2, Side } from './types';
