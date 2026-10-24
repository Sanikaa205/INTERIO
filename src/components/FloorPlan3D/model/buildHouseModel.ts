import type { FloorPlanResult, FloorPlanRoom } from '../../../types';
import type { HouseModel } from './types';
import { roomsFromPlan, allEdges } from './wallEdges';
import { mergeEdges } from './mergeWalls';
import { markExterior } from './exterior';
import { applyDoors } from './doorOpenings';
import { applyWindows } from './windowOpenings';
import { buildFloors } from './floors';

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/**
 * Builds the complete 3D house model from a FloorPlanResult.
 *
 * Pipeline:
 * 1. roomsFromPlan — combine rooms + circulation
 * 2. roomEdges + mergeEdges — merge shared walls
 * 3. markExterior — flag exterior walls and adjust thickness
 * 4. applyDoors — place door openings
 * 5. applyWindows — place window openings (exterior only)
 * 6. buildFloors — create floor polygons
 * 7. compute room centres and overall bounds
 *
 * Pure and deterministic: same input → deep-equal output.
 * Invalid rooms (non-finite or ≤ 0 dimensions) are ignored.
 * Empty rooms → returns empty model without throwing.
 */
export function buildHouseModel(plan: FloorPlanResult): HouseModel {
  const rects = roomsFromPlan(plan);

  if (rects.length === 0) {
    return {
      plotWidth: plan.plotWidth,
      plotDepth: plan.plotLength,
      bounds: { minX: 0, maxX: plan.plotWidth, minZ: 0, maxZ: plan.plotLength },
      walls: [],
      floors: [],
      rooms: [],
    };
  }

  // Build walls pipeline
  const edges = allEdges(plan);
  let walls = mergeEdges(edges);
  walls = markExterior(walls);

  // Only apply openings for rooms[] (not circulation — they have no door/window data)
  const validRooms: FloorPlanRoom[] = plan.rooms.filter(
    (r) => isFinite(r.x) && isFinite(r.y) && r.width > 0 && r.height > 0,
  );
  walls = applyDoors(walls, validRooms);
  const { walls: wallsWithWindows } = applyWindows(walls, validRooms);
  walls = wallsWithWindows;

  // Build floors (including circulation)
  const roomColorMap = new Map<string, string>(
    plan.rooms.map((r) => [r.id, r.color ?? ''])
  );
  const floors = buildFloors(rects, roomColorMap);

  // Compute bounds from all rects
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const r of rects) {
    minX = Math.min(minX, r.x);
    maxX = Math.max(maxX, r.x + r.width);
    minZ = Math.min(minZ, r.y);
    maxZ = Math.max(maxZ, r.y + r.height);
  }
  const bounds = {
    minX: round3(minX),
    maxX: round3(maxX),
    minZ: round3(minZ),
    maxZ: round3(maxZ),
  };

  // Room summaries with centre
  const rooms = rects.map((r) => ({
    id: r.id,
    name: r.name,
    type: r.type as any,
    center: {
      x: round3(r.x + r.width / 2),
      z: round3(r.y + r.height / 2),
    },
    width: r.width,
    depth: r.height,
  }));

  return {
    plotWidth: plan.plotWidth,
    plotDepth: plan.plotLength,
    bounds,
    walls,
    floors,
    rooms,
  };
}
