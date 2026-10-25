import type { WallSegment, Opening } from './types';
import type { FloorPlanRoom, FloorPlanDoor } from '../../../types';
import { DOOR_HEIGHT, PLAN_EPS } from './constants';

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/**
 * Offset semantics (verified from server.ts clampOpeningToWall / wallLengthForSide, line 715-724):
 * - For 'top'/'bottom' sides: wallLength = room.width; offset is measured from the room's LEFT edge (plan x).
 *   In world space: along world X, from the wall's `a.x` end.
 * - For 'left'/'right' sides: wallLength = room.height; offset is measured from the room's TOP edge (plan y).
 *   In world space: along world Z, from the wall's `a.z` end.
 * - `offset` is the START of the opening; `offset + width` is the end.
 *
 * World-space conversion:
 * - 'top'/'bottom' walls run along world X at a fixed world Z.
 *   World start = room.x + offset; world end = room.x + offset + width.
 * - 'left'/'right' walls run along world Z at a fixed world X.
 *   World start = room.y + offset; world end = room.y + offset + width.
 *
 * (Source: server.ts ~lines 715-724, verified in task 1.1)
 */

interface RoomRect {
  id: string;
  x: number;  // plan x = world x
  y: number;  // plan y = world z
  width: number;
  height: number;
}

function wallLengthForSide(side: string, width: number, height: number): number {
  return side === 'left' || side === 'right' ? height : width;
}

/**
 * Convert a door/window {side, offset, width} to world-space interval [wStart, wEnd]
 * along the wall for the given room.
 *
 * Returns null if the interval is invalid (width < minWidth or after clamping).
 */
export function openingToWorldInterval(
  room: RoomRect,
  side: 'top' | 'bottom' | 'left' | 'right',
  offset: number,
  width: number,
  minWidth = 0.4,
): { wStart: number; wEnd: number; wallFixed: number; axis: 'x' | 'z' } | null {
  const wallLen = wallLengthForSide(side, room.width, room.height);

  // Clamp width
  const w = Math.min(width, wallLen - 0.05);
  if (w < minWidth) return null;

  // Clamp offset
  const o = Math.max(0.05, Math.min(wallLen - w - 0.05, offset));

  let wStart: number;
  let wEnd: number;
  let wallFixed: number;
  let axis: 'x' | 'z';

  if (side === 'top') {
    axis = 'x';
    wallFixed = round3(room.y);           // world Z = plan y (top of room)
    wStart = round3(room.x + o);
    wEnd = round3(room.x + o + w);
  } else if (side === 'bottom') {
    axis = 'x';
    wallFixed = round3(room.y + room.height); // world Z = plan y+h (bottom of room)
    wStart = round3(room.x + o);
    wEnd = round3(room.x + o + w);
  } else if (side === 'left') {
    axis = 'z';
    wallFixed = round3(room.x);           // world X = plan x (left of room)
    wStart = round3(room.y + o);
    wEnd = round3(room.y + o + w);
  } else {
    // right
    axis = 'z';
    wallFixed = round3(room.x + room.width); // world X = plan x+w (right of room)
    wStart = round3(room.y + o);
    wEnd = round3(room.y + o + w);
  }

  return { wStart, wEnd, wallFixed, axis };
}

/**
 * Finds wall segment(s) matching the given axis+fixed coordinate (within PLAN_EPS)
 * that overlap with [wStart, wEnd].
 */
function findMatchingSegments(
  walls: WallSegment[],
  axis: 'x' | 'z',
  wallFixed: number,
  wStart: number,
  wEnd: number,
): WallSegment[] {
  return walls.filter((w) => {
    if (w.axis !== axis) return false;
    const segFixed = axis === 'x' ? w.a.z : w.a.x;
    if (Math.abs(segFixed - wallFixed) > PLAN_EPS) return false;
    const segFrom = axis === 'x' ? w.a.x : w.a.z;
    const segTo = axis === 'x' ? w.b.x : w.b.z;
    // Overlap check: [wStart, wEnd] overlaps [segFrom, segTo]
    return wStart < segTo - PLAN_EPS && wEnd > segFrom + PLAN_EPS;
  });
}

/**
 * Converts a world-space opening interval to segment-relative coordinates [start, end].
 * Clips the interval to the segment's span.
 */
function clipToSegment(
  wall: WallSegment,
  wStart: number,
  wEnd: number,
): { start: number; end: number } | null {
  const segFrom = wall.axis === 'x' ? wall.a.x : wall.a.z;
  const segTo = wall.axis === 'x' ? wall.b.x : wall.b.z;

  const clipStart = Math.max(wStart, segFrom);
  const clipEnd = Math.min(wEnd, segTo);

  if (clipEnd - clipStart < 0.3) return null; // too narrow after clip

  // Convert to segment-relative offset from `a`
  const start = round3(clipStart - segFrom);
  const end = round3(clipEnd - segFrom);

  // Minimum margin from wall ends
  const margin = 0.1;
  if (start < margin - PLAN_EPS || end > wall.length - margin + PLAN_EPS) {
    // Clamp within margins
    const cs = Math.max(margin, start);
    const ce = Math.min(wall.length - margin, end);
    if (ce - cs < 0.3) return null;
    return { start: round3(cs), end: round3(ce) };
  }

  return { start, end };
}

/**
 * Checks if two openings overlap on the same segment (within a small tolerance).
 */
function openingsOverlap(a: Opening, b: Opening): boolean {
  return a.start < b.end - PLAN_EPS && a.end > b.start + PLAN_EPS;
}

/**
 * Deduplicates overlapping door openings on a segment (e.g. from both sides of a shared wall).
 * Merges overlapping door intervals into one.
 */
function deduplicateDoors(openings: Opening[]): Opening[] {
  const result: Opening[] = [];
  for (const op of openings) {
    const existing = result.find((r) => r.kind === 'door' && openingsOverlap(r, op));
    if (!existing) {
      result.push(op);
    } else {
      // Merge: extend the interval to cover both; prefer isMainEntry
      existing.start = Math.min(existing.start, op.start);
      existing.end = Math.max(existing.end, op.end);
      if (op.isMainEntry) existing.isMainEntry = true;
    }
  }
  return result;
}

/**
 * Applies door openings from all rooms onto the wall segments.
 * For rooms without explicit doors[] but with a doorSide, synthesises a 0.9 m centred door.
 */
export function applyDoors(walls: WallSegment[], rooms: FloorPlanRoom[]): WallSegment[] {
  // Clone walls with mutable openings arrays
  const result: WallSegment[] = walls.map((w) => ({ ...w, openings: [...w.openings] }));

  for (const room of rooms) {
    let doors = room.doors ?? [];

    // Fallback: no explicit doors but doorSide set → synthesise one centred door
    if (doors.length === 0 && room.doorSide) {
      const wallLen = wallLengthForSide(room.doorSide, room.width, room.height);
      doors = [{ side: room.doorSide, offset: (wallLen - 0.9) / 2, width: 0.9 }];
    }

    for (const door of doors) {
      const defaultWidth = 0.9;
      const width = door.width ?? defaultWidth;
      const offset = door.offset ?? (wallLengthForSide(door.side, room.width, room.height) - width) / 2;

      const interval = openingToWorldInterval(
        { id: room.id, x: room.x, y: room.y, width: room.width, height: room.height },
        door.side,
        offset,
        width,
        0.4,
      );
      if (!interval) continue;

      const { wStart, wEnd, wallFixed, axis } = interval;
      const segs = findMatchingSegments(result, axis, wallFixed, wStart, wEnd);

      for (const seg of segs) {
        const clipped = clipToSegment(seg, wStart, wEnd);
        if (!clipped) continue;

        const newOpening: Opening = {
          kind: 'door',
          start: clipped.start,
          end: clipped.end,
          sill: 0,
          head: DOOR_HEIGHT,
          roomId: room.id,
          isMainEntry: door.isMainEntry ?? false,
        };

        seg.openings = deduplicateDoors([...seg.openings, newOpening]);
      }
    }
  }

  return result;
}
