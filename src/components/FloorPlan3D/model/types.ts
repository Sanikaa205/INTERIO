import type { RoomType } from '../../../types';

export type Side = 'top' | 'bottom' | 'left' | 'right';

export interface Vec2 {
  x: number;
  z: number;
}

/**
 * An opening (door or window) in a wall segment.
 * start/end are metres along the wall from point `a`.
 */
export interface Opening {
  kind: 'door' | 'window';
  /** metres along the wall from `a` — start of opening */
  start: number;
  /** metres along the wall from `a` — end of opening */
  end: number;
  /** sill height (0 for doors, WINDOW_SILL for windows) */
  sill: number;
  /** head height (DOOR_HEIGHT for doors, WINDOW_HEAD for windows) */
  head: number;
  /** which room this opening belongs to */
  roomId: string;
  /** true for the main building entry */
  isMainEntry?: boolean;
}

/**
 * A merged wall segment in 3D world space.
 * axis 'x' = runs along world X (plan x-axis), constant Z = fixed.
 * axis 'z' = runs along world Z (plan y-axis), constant X = fixed.
 */
export interface WallSegment {
  id: string;
  /** start point (the "lesser" end — smaller x or z) */
  a: Vec2;
  /** end point (the "greater" end) */
  b: Vec2;
  /** 'x' = horizontal in plan (top/bottom walls), 'z' = vertical in plan (left/right walls) */
  axis: 'x' | 'z';
  /** length in metres (= |b - a| along the axis) */
  length: number;
  /** wall thickness in metres */
  thickness: number;
  /** true if only one room touches this segment */
  exterior: boolean;
  /** ids of rooms touching this segment */
  roomIds: string[];
  /** which side of each room (parallel arrays with roomIds) */
  sides: Side[];
  /** openings cut into this segment */
  openings: Opening[];
}

export interface FloorPoly {
  roomId: string;
  name: string;
  type: RoomType;
  /** world X of room left edge */
  x: number;
  /** world Z of room top edge */
  z: number;
  width: number;
  depth: number;
  color: string;
}

export interface HouseModel {
  plotWidth: number;
  plotDepth: number;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  walls: WallSegment[];
  floors: FloorPoly[];
  rooms: {
    id: string;
    name: string;
    type: RoomType;
    center: Vec2;
    width: number;
    depth: number;
  }[];
}
