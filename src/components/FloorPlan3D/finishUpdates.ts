import type { FloorPlanFinishes, FloorPlanResult, RoomFinishOverrides, SurfaceFinish } from '../../types';
import type { SelectedSurface } from './finishTypes';
import type { HouseModel, WallSegment } from './model/types';
import { wallFaceTargets } from './model/wallFaces';

/**
 * Walls a target is validated against. Plain ids only validate whole-wall
 * targets; face targets need the segments to know which faces exist.
 */
export type WallRefs = ReadonlyArray<string | WallSegment>;

type WallFaces = NonNullable<FloorPlanFinishes['wallFaces']>;

function findWall(walls: WallRefs | undefined, wallId: string): WallSegment | 'id-only' | undefined {
  if (!walls) return undefined;
  for (const wall of walls) {
    if (typeof wall === 'string') {
      if (wall === wallId) return 'id-only';
    } else if (wall.id === wallId) {
      return wall;
    }
  }
  return undefined;
}

function isKnownSurface(plan: FloorPlanResult, surface: SelectedSurface, walls?: WallRefs): boolean {
  if (surface.kind === 'wall') return !walls || findWall(walls, surface.wallId) !== undefined;
  if (surface.kind === 'wall-face') {
    const wall = findWall(walls, surface.wallId);
    return typeof wall === 'object' && wallFaceTargets(wall).some((target) => target.faceKey === surface.faceKey);
  }
  return plan.rooms.some((room) => room.id === surface.roomId);
}

/** Assembles `finishes`, dropping empty containers; undefined when nothing is left. */
function buildFinishes(
  rooms: Record<string, RoomFinishOverrides>,
  walls: Record<string, SurfaceFinish>,
  wallFaces: WallFaces,
): FloorPlanFinishes | undefined {
  const hasFaces = Object.keys(wallFaces).length > 0;
  if (!Object.keys(rooms).length && !Object.keys(walls).length && !hasFaces) return undefined;
  return hasFaces ? { rooms, walls, wallFaces } : { rooms, walls };
}

function withFinishes(plan: FloorPlanResult, finishes: FloorPlanFinishes | undefined): FloorPlanResult {
  return { ...plan, finishes };
}

function copyParts(plan: FloorPlanResult) {
  return {
    rooms: { ...(plan.finishes?.rooms ?? {}) },
    walls: { ...(plan.finishes?.walls ?? {}) },
    wallFaces: { ...(plan.finishes?.wallFaces ?? {}) } as WallFaces,
  };
}

/** Returns a new plan with only the targeted surface override replaced. */
export function setSurfaceFinish(
  plan: FloorPlanResult,
  surface: SelectedSurface,
  finish: SurfaceFinish,
  walls?: WallRefs,
): FloorPlanResult {
  if (!isKnownSurface(plan, surface, walls)) return plan;

  const { rooms, walls: wallFinishes, wallFaces } = copyParts(plan);
  if (surface.kind === 'wall') {
    wallFinishes[surface.wallId] = { ...finish };
  } else if (surface.kind === 'wall-face') {
    const faces = { ...(wallFaces[surface.wallId] ?? {}) };
    // A legacy whole-wall finish keeps applying to the other faces: write it
    // out explicitly so only the chosen face changes.
    const legacy = wallFinishes[surface.wallId];
    if (legacy) {
      const wall = findWall(walls, surface.wallId);
      if (typeof wall === 'object') {
        for (const target of wallFaceTargets(wall)) {
          if (target.faceKey !== surface.faceKey && !faces[target.faceKey]) faces[target.faceKey] = { ...legacy };
        }
      }
    }
    faces[surface.faceKey] = { ...finish };
    wallFaces[surface.wallId] = faces;
  } else {
    const room = { ...(rooms[surface.roomId] ?? {}) };
    if (surface.kind === 'room-floor') room.floor = { ...finish };
    else room.ceiling = { ...finish };
    rooms[surface.roomId] = room;
  }
  return withFinishes(plan, buildFinishes(rooms, wallFinishes, wallFaces) ?? { rooms, walls: wallFinishes });
}

/** Returns a new plan with only the targeted surface override removed. */
export function resetSurfaceFinish(
  plan: FloorPlanResult,
  surface: SelectedSurface,
  walls?: WallRefs,
): FloorPlanResult {
  if (!isKnownSurface(plan, surface, walls)) return plan;

  const { rooms, walls: wallFinishes, wallFaces } = copyParts(plan);
  if (surface.kind === 'wall') {
    delete wallFinishes[surface.wallId];
  } else if (surface.kind === 'wall-face') {
    const faces = { ...(wallFaces[surface.wallId] ?? {}) };
    delete faces[surface.faceKey];
    if (Object.keys(faces).length === 0) delete wallFaces[surface.wallId];
    else wallFaces[surface.wallId] = faces;
  } else {
    const room = { ...(rooms[surface.roomId] ?? {}) };
    if (surface.kind === 'room-floor') delete room.floor;
    else delete room.ceiling;
    if (Object.keys(room).length === 0) delete rooms[surface.roomId];
    else rooms[surface.roomId] = room;
  }
  return withFinishes(plan, buildFinishes(rooms, wallFinishes, wallFaces));
}

/**
 * "Both sides": writes the finish to every existing face of the wall and
 * clears the legacy whole-wall entry, so the result is explicit per-face data.
 * A wall with no resolvable faces keeps a whole-wall entry instead.
 */
export function setWholeWallFinish(plan: FloorPlanResult, wall: WallSegment, finish: SurfaceFinish): FloorPlanResult {
  const targets = wallFaceTargets(wall);
  const { rooms, walls: wallFinishes, wallFaces } = copyParts(plan);
  if (targets.length === 0) {
    wallFinishes[wall.id] = { ...finish };
  } else {
    delete wallFinishes[wall.id];
    const faces = { ...(wallFaces[wall.id] ?? {}) };
    for (const target of targets) faces[target.faceKey] = { ...finish };
    wallFaces[wall.id] = faces;
  }
  return withFinishes(plan, buildFinishes(rooms, wallFinishes, wallFaces));
}

/** Applies a finish to this room's side of every wall that touches it; neighbours' sides are untouched. */
export function setRoomWallsFinish(
  plan: FloorPlanResult,
  roomId: string,
  finish: SurfaceFinish,
  walls: readonly WallSegment[],
): FloorPlanResult {
  if (!plan.rooms.some((room) => room.id === roomId)) return plan;
  const { rooms, walls: wallFinishes, wallFaces } = copyParts(plan);
  let changed = false;
  for (const wall of walls) {
    const target = wallFaceTargets(wall).find((item) => item.faceKey === roomId);
    if (!target) continue;
    wallFaces[wall.id] = { ...(wallFaces[wall.id] ?? {}), [roomId]: { ...finish } };
    changed = true;
  }
  return changed ? withFinishes(plan, buildFinishes(rooms, wallFinishes, wallFaces)) : plan;
}

/** Removes the whole-wall finish and every face finish of one wall. */
export function resetWholeWall(plan: FloorPlanResult, wallId: string): FloorPlanResult {
  const { rooms, walls: wallFinishes, wallFaces } = copyParts(plan);
  if (!(wallId in wallFinishes) && !(wallId in wallFaces)) return plan;
  delete wallFinishes[wallId];
  delete wallFaces[wallId];
  return withFinishes(plan, buildFinishes(rooms, wallFinishes, wallFaces));
}

/** Removes one room's floor, ceiling and its own side of every wall; other rooms' sides stay. */
export function resetRoomFinishes(plan: FloorPlanResult, roomId: string): FloorPlanResult {
  const { rooms, walls: wallFinishes, wallFaces } = copyParts(plan);
  let changed = roomId in rooms;
  delete rooms[roomId];
  for (const wallId of Object.keys(wallFaces)) {
    if (!(roomId in wallFaces[wallId])) continue;
    const faces = { ...wallFaces[wallId] };
    delete faces[roomId];
    if (Object.keys(faces).length === 0) delete wallFaces[wallId];
    else wallFaces[wallId] = faces;
    changed = true;
  }
  return changed ? withFinishes(plan, buildFinishes(rooms, wallFinishes, wallFaces)) : plan;
}

/** Removes every finish. */
export function resetAllFinishes(plan: FloorPlanResult): FloorPlanResult {
  return plan.finishes === undefined ? plan : withFinishes(plan, undefined);
}

/**
 * Drops finishes whose room, wall or face no longer exists. Wall ids are
 * derived from geometry, so call this only when the plan geometry changes,
 * never during normal edits. Returns the same plan when nothing is orphaned.
 */
export function pruneOrphanFinishes(plan: FloorPlanResult, model: HouseModel): FloorPlanResult {
  if (!plan.finishes) return plan;
  const roomIds = new Set(model.rooms.map((room) => room.id));
  const wallById = new Map(model.walls.map((wall) => [wall.id, wall] as const));
  const { rooms, walls: wallFinishes, wallFaces } = copyParts(plan);
  let changed = false;

  for (const id of Object.keys(rooms)) {
    if (!roomIds.has(id)) { delete rooms[id]; changed = true; }
  }
  for (const id of Object.keys(wallFinishes)) {
    if (!wallById.has(id)) { delete wallFinishes[id]; changed = true; }
  }
  for (const id of Object.keys(wallFaces)) {
    const wall = wallById.get(id);
    if (!wall) { delete wallFaces[id]; changed = true; continue; }
    const valid = new Set(wallFaceTargets(wall).map((target) => target.faceKey));
    const faces = { ...wallFaces[id] };
    for (const key of Object.keys(faces)) {
      if (!valid.has(key)) { delete faces[key]; changed = true; }
    }
    if (Object.keys(faces).length === 0) delete wallFaces[id];
    else wallFaces[id] = faces;
  }
  return changed ? withFinishes(plan, buildFinishes(rooms, wallFinishes, wallFaces)) : plan;
}
