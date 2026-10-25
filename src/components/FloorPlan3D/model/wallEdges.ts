import type { FloorPlanResult, FloorPlanRoom } from '../../../types';
import { PLAN_EPS } from './constants';

export interface PlanRect {
  id: string;
  name: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Edge {
  /** 'x' = horizontal edge (constant z), 'z' = vertical edge (constant x) */
  axis: 'x' | 'z';
  /** the constant coordinate value */
  fixed: number;
  /** start of the span along the perpendicular axis */
  from: number;
  /** end of the span along the perpendicular axis */
  to: number;
  roomId: string;
  /** which side of the room this edge belongs to */
  side: 'top' | 'bottom' | 'left' | 'right';
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/**
 * Combines plan.rooms with plan.circulation hallways into a unified list.
 * Circulation entries get id `circ-<index>` and type `hallway`.
 */
export function roomsFromPlan(plan: FloorPlanResult): PlanRect[] {
  const rects: PlanRect[] = plan.rooms
    .filter((r) => isFinite(r.x) && isFinite(r.y) && r.width > 0 && r.height > 0)
    .map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type,
      x: round3(r.x),
      y: round3(r.y),
      width: round3(r.width),
      height: round3(r.height),
    }));

  if (plan.circulation) {
    plan.circulation.forEach((c, i) => {
      if (c.width > 0 && c.height > 0) {
        rects.push({
          id: `circ-${i}`,
          name: c.name,
          type: 'hallway',
          x: round3(c.x),
          y: round3(c.y),
          width: round3(c.width),
          height: round3(c.height),
        });
      }
    });
  }

  return rects;
}

/**
 * Returns 4 edges for a rectangle:
 * - 'top'    → axis 'x', fixed = plan y (= world z_top),   span x..x+width
 * - 'bottom' → axis 'x', fixed = plan y+height (= world z_bottom), span x..x+width
 * - 'left'   → axis 'z', fixed = plan x (= world x_left),  span y..y+height
 * - 'right'  → axis 'z', fixed = plan x+width (= world x_right), span y..y+height
 *
 * In the 3D coordinate system: plan x → world x, plan y → world z.
 * So 'top' and 'bottom' walls run along world X (axis 'x'), and
 * 'left' / 'right' walls run along world Z (axis 'z').
 */
export function roomEdges(rect: PlanRect): Edge[] {
  const x = round3(rect.x);
  const y = round3(rect.y);
  const w = round3(rect.width);
  const h = round3(rect.height);

  return [
    // top wall (plan y = world z_min): runs along world X
    { axis: 'x', fixed: y,       from: x,     to: round3(x + w), roomId: rect.id, side: 'top' },
    // bottom wall (plan y+h = world z_max): runs along world X
    { axis: 'x', fixed: round3(y + h), from: x, to: round3(x + w), roomId: rect.id, side: 'bottom' },
    // left wall (plan x = world x_min): runs along world Z
    { axis: 'z', fixed: x,       from: y,     to: round3(y + h), roomId: rect.id, side: 'left' },
    // right wall (plan x+w = world x_max): runs along world Z
    { axis: 'z', fixed: round3(x + w), from: y, to: round3(y + h), roomId: rect.id, side: 'right' },
  ];
}

/** Collect all edges from a plan */
export function allEdges(plan: FloorPlanResult): Edge[] {
  return roomsFromPlan(plan).flatMap((r) => roomEdges(r));
}

// Make PLAN_EPS available for tests
export { PLAN_EPS };
