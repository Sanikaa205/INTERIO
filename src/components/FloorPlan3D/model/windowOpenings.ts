import type { WallSegment, Opening } from './types';
import type { FloorPlanRoom } from '../../../types';
import { WINDOW_SILL, WINDOW_HEAD, PLAN_EPS } from './constants';
import { openingToWorldInterval } from './doorOpenings';

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function openingsOverlap(a: Opening, b: Opening): boolean {
  return a.start < b.end - PLAN_EPS && a.end > b.start + PLAN_EPS;
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
    return wStart < segTo - PLAN_EPS && wEnd > segFrom + PLAN_EPS;
  });
}

function clipToSegment(
  wall: WallSegment,
  wStart: number,
  wEnd: number,
): { start: number; end: number } | null {
  const segFrom = wall.axis === 'x' ? wall.a.x : wall.a.z;
  const segTo = wall.axis === 'x' ? wall.b.x : wall.b.z;

  const clipStart = Math.max(wStart, segFrom);
  const clipEnd = Math.min(wEnd, segTo);

  if (clipEnd - clipStart < 0.3) return null;

  const margin = 0.1;
  const start = round3(clipStart - segFrom);
  const end = round3(clipEnd - segFrom);

  const cs = Math.max(margin, start);
  const ce = Math.min(wall.length - margin, end);
  if (ce - cs < 0.3) return null;
  return { start: round3(cs), end: round3(ce) };
}

export interface SkippedWindow {
  reason: 'not-exterior' | 'overlaps-door' | 'too-narrow' | 'no-segment';
  roomId: string;
  side: string;
}

/**
 * Applies window openings from each room's `windows` array.
 * Rules:
 * - Only placed on EXTERIOR segments.
 * - Skipped if the interval overlaps an existing door opening.
 * - Duplicate windows (same segment-relative position) are skipped.
 * - Default width: 1.2 m if missing. Min width: 0.4 m.
 * - Rooms without `windows` array get no windows (the model never invents them).
 *
 * Returns { walls, skipped } where skipped is a debug list.
 */
export function applyWindows(
  walls: WallSegment[],
  rooms: FloorPlanRoom[],
): { walls: WallSegment[]; skipped: SkippedWindow[] } {
  const result: WallSegment[] = walls.map((w) => ({ ...w, openings: [...w.openings] }));
  const skipped: SkippedWindow[] = [];

  for (const room of rooms) {
    if (!room.windows || room.windows.length === 0) continue;

    for (const win of room.windows) {
      const width = win.width ?? 1.2;
      if (width < 0.4) {
        skipped.push({ reason: 'too-narrow', roomId: room.id, side: win.side });
        continue;
      }

      const wallLen = win.side === 'left' || win.side === 'right' ? room.height : room.width;
      const offset = win.offset ?? (wallLen - width) / 2;

      const interval = openingToWorldInterval(
        { id: room.id, x: room.x, y: room.y, width: room.width, height: room.height },
        win.side,
        offset,
        width,
        0.4,
      );

      if (!interval) {
        skipped.push({ reason: 'too-narrow', roomId: room.id, side: win.side });
        continue;
      }

      const { wStart, wEnd, wallFixed, axis } = interval;
      const segs = findMatchingSegments(result, axis, wallFixed, wStart, wEnd);

      if (segs.length === 0) {
        skipped.push({ reason: 'no-segment', roomId: room.id, side: win.side });
        continue;
      }

      for (const seg of segs) {
        // Only place windows on exterior segments
        if (!seg.exterior) {
          skipped.push({ reason: 'not-exterior', roomId: room.id, side: win.side });
          continue;
        }

        const clipped = clipToSegment(seg, wStart, wEnd);
        if (!clipped) {
          skipped.push({ reason: 'too-narrow', roomId: room.id, side: win.side });
          continue;
        }

        const newOpening: Opening = {
          kind: 'window',
          start: clipped.start,
          end: clipped.end,
          sill: WINDOW_SILL,
          head: WINDOW_HEAD,
          roomId: room.id,
        };

        // Skip if overlaps with any existing door opening
        const overlapsAnything = seg.openings.some((o) => openingsOverlap(o, newOpening));
        if (overlapsAnything) {
          skipped.push({ reason: 'overlaps-door', roomId: room.id, side: win.side });
          continue;
        }

        // Skip if duplicate (same start/end as existing window)
        const isDuplicate = seg.openings.some(
          (o) => o.kind === 'window' && Math.abs(o.start - newOpening.start) < PLAN_EPS && Math.abs(o.end - newOpening.end) < PLAN_EPS
        );
        if (isDuplicate) continue;

        seg.openings.push(newOpening);
      }
    }
  }

  return { walls: result, skipped };
}
