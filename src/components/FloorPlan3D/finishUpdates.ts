import type { FloorPlanResult, SurfaceFinish } from '../../types';
import type { SelectedSurface } from './finishTypes';

function isKnownSurface(plan: FloorPlanResult, surface: SelectedSurface, wallIds?: readonly string[]): boolean {
  if (surface.kind === 'wall') return !wallIds || wallIds.includes(surface.wallId);
  return plan.rooms.some((room) => room.id === surface.roomId);
}

/** Returns a new plan with only the targeted surface override replaced. */
export function setSurfaceFinish(
  plan: FloorPlanResult,
  surface: SelectedSurface,
  finish: SurfaceFinish,
  wallIds?: readonly string[],
): FloorPlanResult {
  if (!isKnownSurface(plan, surface, wallIds)) return plan;

  const rooms = { ...(plan.finishes?.rooms ?? {}) };
  const walls = { ...(plan.finishes?.walls ?? {}) };
  if (surface.kind === 'wall') {
    walls[surface.wallId] = { ...finish };
  } else {
    const room = { ...(rooms[surface.roomId] ?? {}) };
    if (surface.kind === 'room-floor') room.floor = { ...finish };
    else room.ceiling = { ...finish };
    rooms[surface.roomId] = room;
  }
  return { ...plan, finishes: { rooms, walls } };
}

/** Returns a new plan with only the targeted surface override removed. */
export function resetSurfaceFinish(
  plan: FloorPlanResult,
  surface: SelectedSurface,
  wallIds?: readonly string[],
): FloorPlanResult {
  if (!isKnownSurface(plan, surface, wallIds)) return plan;

  const rooms = { ...(plan.finishes?.rooms ?? {}) };
  const walls = { ...(plan.finishes?.walls ?? {}) };
  if (surface.kind === 'wall') {
    delete walls[surface.wallId];
  } else {
    const room = { ...(rooms[surface.roomId] ?? {}) };
    if (surface.kind === 'room-floor') delete room.floor;
    else delete room.ceiling;
    if (Object.keys(room).length === 0) delete rooms[surface.roomId];
    else rooms[surface.roomId] = room;
  }
  const finishes = Object.keys(rooms).length || Object.keys(walls).length ? { rooms, walls } : undefined;
  return { ...plan, finishes };
}
