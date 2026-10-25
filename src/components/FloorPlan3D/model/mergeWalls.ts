import type { WallSegment } from './types';
import type { Edge } from './wallEdges';
import { PLAN_EPS, WALL_THICKNESS } from './constants';

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/**
 * Merges raw room edges into wall segments, combining shared edges into one
 * segment with multiple roomIds. Walls that share an axis+fixed coordinate
 * (within PLAN_EPS) are merged; their spans are split at every distinct endpoint.
 *
 * Rules:
 * - Two edges share a wall if their axis is the same and |fixed_A - fixed_B| < PLAN_EPS.
 * - Each distinct sub-interval (between consecutive split points) becomes one WallSegment.
 * - Sub-intervals shorter than PLAN_EPS are dropped.
 * - Deterministic ids: `w-<axis>-<fixed>-<from>` (from = start of interval, rounded to 3 dec).
 */
export function mergeEdges(edges: Edge[]): WallSegment[] {
  // Group edges by (axis, rounded-fixed)
  // Key: axis + '_' + fixedKey (fixed rounded to nearest PLAN_EPS bucket)
  const groups = new Map<string, { axis: 'x' | 'z'; fixedVal: number; members: Edge[] }>();

  for (const e of edges) {
    // bucket the fixed coordinate — edges within PLAN_EPS of each other share a wall
    const bucket = Math.round(e.fixed / PLAN_EPS) * PLAN_EPS;
    const fixedKey = round3(bucket);
    const key = `${e.axis}_${fixedKey}`;
    if (!groups.has(key)) {
      groups.set(key, { axis: e.axis, fixedVal: fixedKey, members: [] });
    }
    groups.get(key)!.members.push(e);
  }

  const segments: WallSegment[] = [];

  for (const { axis, fixedVal, members } of groups.values()) {
    // Collect all split points along the span axis
    const pointSet = new Set<number>();
    for (const e of members) {
      pointSet.add(round3(e.from));
      pointSet.add(round3(e.to));
    }
    const points = Array.from(pointSet).sort((a, b) => a - b);

    // For each consecutive pair of points, build one segment
    for (let i = 0; i < points.length - 1; i++) {
      const from = points[i];
      const to = points[i + 1];
      const len = round3(to - from);
      if (len < PLAN_EPS) continue;

      const mid = (from + to) / 2;

      // Find all edges that cover this interval (mid point test)
      const covering = members.filter((e) => e.from <= mid + PLAN_EPS && e.to >= mid - PLAN_EPS);

      if (covering.length === 0) continue;

      // Build roomIds and sides arrays (deduplicate roomId+side pairs)
      const roomIds: string[] = [];
      const sides: WallSegment['sides'] = [];
      const seen = new Set<string>();
      for (const e of covering) {
        const key2 = `${e.roomId}|${e.side}`;
        if (!seen.has(key2)) {
          seen.add(key2);
          roomIds.push(e.roomId);
          sides.push(e.side);
        }
      }

      // Determine world-space a and b
      let a: { x: number; z: number };
      let b: { x: number; z: number };

      if (axis === 'x') {
        // Horizontal wall: constant z = fixedVal, spans world x from→to
        a = { x: from, z: fixedVal };
        b = { x: to, z: fixedVal };
      } else {
        // Vertical wall: constant x = fixedVal, spans world z from→to
        a = { x: fixedVal, z: from };
        b = { x: fixedVal, z: to };
      }

      const id = `w-${axis}-${round3(fixedVal)}-${round3(from)}`;

      segments.push({
        id,
        a,
        b,
        axis,
        length: len,
        thickness: WALL_THICKNESS,
        exterior: false,           // filled by markExterior
        roomIds,
        sides,
        openings: [],
      });
    }
  }

  return segments;
}
