import test from 'node:test';
import assert from 'node:assert/strict';
import type { FloorPlanResult, SurfaceFinish } from '../../types';
import { resetSurfaceFinish, setSurfaceFinish } from './finishUpdates';

const plan: FloorPlanResult = {
  plotWidth: 8, plotLength: 6, totalBuiltArea: 48,
  rooms: [{ id: 'living', name: 'Living', type: 'living-room', x: 0, y: 0, width: 8, height: 6 }],
};
const paint: SurfaceFinish = { materialId: 'paint', color: '#112233', variantId: 'paint-charcoal' };

test('adds and replaces only the targeted finish without mutating the input', () => {
  const first = setSurfaceFinish(plan, { kind: 'room-floor', roomId: 'living' }, paint);
  const second = setSurfaceFinish(first, { kind: 'wall', wallId: 'wall-1' }, { materialId: 'wood' }, ['wall-1']);
  assert.deepEqual(plan.finishes, undefined);
  assert.deepEqual(first.finishes?.rooms?.living?.floor, paint);
  assert.deepEqual(second.finishes?.rooms?.living?.floor, paint);
  assert.deepEqual(second.finishes?.walls?.['wall-1'], { materialId: 'wood' });
});

test('resets only the targeted finish and prunes empty containers', () => {
  const withFinishes = setSurfaceFinish(
    setSurfaceFinish(plan, { kind: 'room-floor', roomId: 'living' }, paint),
    { kind: 'room-ceiling', roomId: 'living' }, { materialId: 'tile' },
  );
  const floorReset = resetSurfaceFinish(withFinishes, { kind: 'room-floor', roomId: 'living' });
  const allReset = resetSurfaceFinish(floorReset, { kind: 'room-ceiling', roomId: 'living' });
  assert.equal(floorReset.finishes?.rooms?.living?.floor, undefined);
  assert.deepEqual(floorReset.finishes?.rooms?.living?.ceiling, { materialId: 'tile' });
  assert.equal(allReset.finishes, undefined);
});

test('ignores unknown room and wall targets', () => {
  assert.equal(setSurfaceFinish(plan, { kind: 'room-floor', roomId: 'missing' }, paint), plan);
  assert.equal(setSurfaceFinish(plan, { kind: 'wall', wallId: 'missing' }, paint, ['wall-1']), plan);
  assert.equal(resetSurfaceFinish(plan, { kind: 'wall', wallId: 'missing' }, ['wall-1']), plan);
});

// ── Wall faces (5.3) ─────────────────────────────────────────────────────────
import { buildHouseModel } from './model/buildHouseModel';
import { plan10x12 } from './model/fixtures';
import { wallFaceTargets } from './model/wallFaces';
import {
  pruneOrphanFinishes, resetAllFinishes, resetRoomFinishes, resetWholeWall, setRoomWallsFinish, setWholeWallFinish,
} from './finishUpdates';

const house = buildHouseModel(plan10x12);
const shared = house.walls.find((w) => !w.exterior && w.roomIds.length === 2)!;
const [roomA, roomB] = shared.roomIds;
const brick: SurfaceFinish = { materialId: 'brick' };
const sage: SurfaceFinish = { materialId: 'paint', color: '#b9c5b1' };

test('editing one face of a shared wall leaves the neighbour face and legacy data identical', () => {
  const base = setSurfaceFinish(plan10x12, { kind: 'wall-face', wallId: shared.id, faceKey: roomB }, sage, house.walls);
  const next = setSurfaceFinish(base, { kind: 'wall-face', wallId: shared.id, faceKey: roomA }, brick, house.walls);
  assert.equal(next.finishes?.wallFaces?.[shared.id]?.[roomB], base.finishes?.wallFaces?.[shared.id]?.[roomB]);
  assert.deepEqual(next.finishes?.wallFaces?.[shared.id]?.[roomA], brick);
  assert.deepEqual(next.finishes?.walls, base.finishes?.walls);
  assert.equal(plan10x12.finishes, undefined, 'input not mutated');
});

test('face reset touches one face only and prunes empties', () => {
  const both = setSurfaceFinish(
    setSurfaceFinish(plan10x12, { kind: 'wall-face', wallId: shared.id, faceKey: roomA }, brick, house.walls),
    { kind: 'wall-face', wallId: shared.id, faceKey: roomB }, sage, house.walls);
  const one = resetSurfaceFinish(both, { kind: 'wall-face', wallId: shared.id, faceKey: roomA }, house.walls);
  assert.equal(one.finishes?.wallFaces?.[shared.id]?.[roomA], undefined);
  assert.deepEqual(one.finishes?.wallFaces?.[shared.id]?.[roomB], sage);
  const none = resetSurfaceFinish(one, { kind: 'wall-face', wallId: shared.id, faceKey: roomB }, house.walls);
  assert.equal(none.finishes, undefined);
});

test('unknown wall-face targets are no-ops', () => {
  const surface = { kind: 'wall-face' as const, wallId: shared.id, faceKey: 'nobody' };
  assert.equal(setSurfaceFinish(plan10x12, surface, brick, house.walls), plan10x12);
  assert.equal(setSurfaceFinish(plan10x12, { ...surface, wallId: 'nope', faceKey: roomA }, brick, house.walls), plan10x12);
  assert.equal(setSurfaceFinish(plan10x12, { ...surface, faceKey: roomA }, brick, [shared.id]), plan10x12, 'ids alone cannot validate a face');
  assert.equal(resetSurfaceFinish(plan10x12, surface, house.walls), plan10x12);
});

test('editing one face of a legacy-finished wall expands the legacy finish onto the other faces', () => {
  const legacy = setSurfaceFinish(plan10x12, { kind: 'wall', wallId: shared.id }, sage, house.walls);
  const next = setSurfaceFinish(legacy, { kind: 'wall-face', wallId: shared.id, faceKey: roomA }, brick, house.walls);
  assert.deepEqual(next.finishes?.wallFaces?.[shared.id]?.[roomA], brick);
  assert.deepEqual(next.finishes?.wallFaces?.[shared.id]?.[roomB], sage);
  assert.deepEqual(next.finishes?.walls?.[shared.id], sage, 'legacy entry kept for jamb/top faces');
});

test('setWholeWallFinish writes every face and clears the legacy entry', () => {
  const legacy = setSurfaceFinish(plan10x12, { kind: 'wall', wallId: shared.id }, sage, house.walls);
  const next = setWholeWallFinish(legacy, shared, brick);
  assert.equal(next.finishes?.walls?.[shared.id], undefined);
  for (const target of wallFaceTargets(shared)) assert.deepEqual(next.finishes?.wallFaces?.[shared.id]?.[target.faceKey], brick);
});

test('room-wide apply only touches this room side', () => {
  const next = setRoomWallsFinish(plan10x12, roomA, brick, house.walls);
  for (const wall of house.walls) {
    const faces = next.finishes?.wallFaces?.[wall.id];
    if (wall.roomIds.includes(roomA)) assert.deepEqual(faces?.[roomA], brick);
    const others = Object.keys(faces ?? {}).filter((key) => key !== roomA);
    assert.deepEqual(others, [], wall.id);
  }
  assert.equal(setRoomWallsFinish(plan10x12, 'missing', brick, house.walls), plan10x12);
});

test('reset wall, room and all', () => {
  const painted = setRoomWallsFinish(setRoomWallsFinish(plan10x12, roomA, brick, house.walls), roomB, sage, house.walls);
  const floor = setSurfaceFinish(painted, { kind: 'room-floor', roomId: roomA }, sage);
  const wallReset = resetWholeWall(floor, shared.id);
  assert.equal(wallReset.finishes?.wallFaces?.[shared.id], undefined);
  assert.ok(wallReset.finishes?.rooms?.[roomA]);
  const roomReset = resetRoomFinishes(floor, roomA);
  assert.equal(roomReset.finishes?.rooms?.[roomA], undefined);
  assert.deepEqual(roomReset.finishes?.wallFaces?.[shared.id]?.[roomB], sage, 'neighbour side kept');
  assert.equal(resetAllFinishes(floor).finishes, undefined);
  assert.equal(resetWholeWall(plan10x12, 'x'), plan10x12);
});

test('pruneOrphanFinishes drops stale data and keeps valid data by identity', () => {
  const valid = setSurfaceFinish(plan10x12, { kind: 'wall-face', wallId: shared.id, faceKey: roomA }, brick, house.walls);
  assert.equal(pruneOrphanFinishes(valid, house), valid);
  const stale: FloorPlanResult = {
    ...valid,
    finishes: {
      ...valid.finishes,
      rooms: { gone: { floor: sage } },
      walls: { 'w-gone': sage },
      wallFaces: { ...valid.finishes!.wallFaces, 'w-gone': { [roomA]: sage }, [shared.id]: { ...valid.finishes!.wallFaces![shared.id], ghost: sage } },
    },
  };
  const pruned = pruneOrphanFinishes(stale, house);
  assert.deepEqual(pruned.finishes?.rooms, {});
  assert.deepEqual(pruned.finishes?.walls, {});
  assert.deepEqual(Object.keys(pruned.finishes?.wallFaces ?? {}), [shared.id]);
  assert.deepEqual(Object.keys(pruned.finishes?.wallFaces?.[shared.id] ?? {}), [roomA]);
});
