import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { furnitureTransform3D, itemPositionFromScene, rotationFromRadians, rotationToRadians } from './furnitureTransform3D';
import { furnitureFootprint } from '../services/layoutOptimizer';
import { buildInteriorShell } from './interiorShell';
import { interiorSceneKey, resolveInteriorOpenings } from './interiorSceneKey';
import { defaultRoomOpenings } from '../services/layoutOptimizer';

const close = (a: number, b: number, message?: string) => assert.ok(Math.abs(a - b) < 1e-9, `${message ?? ''} ${a} vs ${b}`);
const ROTATIONS = [0, 90, 180, 270];
const ROOMS = [{ width: 5, depth: 4 }, { width: 3.2, depth: 6.5 }, { width: 8, depth: 8 }];
const SIZES = [[2.1, 0.9], [0.5, 0.5], [1.2, 0.4], [0.9, 2.0], [3, 2.2]];

/** What the 2D plan does: translate to the footprint centre, SVG rotate(deg) (clockwise, y down). */
const svgRotate = (deg: number, x: number, y: number) => {
  const r = (deg * Math.PI) / 180;
  return { x: x * Math.cos(r) - y * Math.sin(r), y: x * Math.sin(r) + y * Math.cos(r) };
};
/** What the 3D scene does: object.rotation.y = rotationY, then a local vector (x,z) in scene x/z. */
const threeRotate = (rotationY: number, x: number, z: number) => {
  const v = new THREE.Vector3(x, 0, z).applyEuler(new THREE.Euler(0, rotationY, 0));
  return { x: v.x, y: v.z };
};

test('5.1 the 3D centre is the centre of the 2D footprint, for every room, size and rotation', () => {
  for (const room of ROOMS) for (const [w, d] of SIZES) for (const rotation of ROTATIONS) {
    const item = { x: 0.7, y: 0.4, width: w, depth: d, rotation };
    const fp = furnitureFootprint(item);
    const t = furnitureTransform3D(item, room);
    close(t.x, fp.x + fp.width / 2 - room.width / 2, 'x');
    close(t.z, fp.y + fp.depth / 2 - room.depth / 2, 'z');
  }
});

test('5.1 a rotated piece fills exactly its 2D footprint (corners match the AABB)', () => {
  for (const room of ROOMS) for (const [w, d] of SIZES) for (const rotation of ROTATIONS) {
    const item = { x: 0.3, y: 0.2, width: w, depth: d, rotation };
    const fp = furnitureFootprint(item);
    const t = furnitureTransform3D(item, room);
    const xs: number[] = [];
    const zs: number[] = [];
    for (const [cx, cz] of [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]]) {
      const p = threeRotate(t.rotationY, cx, cz);
      xs.push(t.x + p.x + room.width / 2);
      zs.push(t.z + p.y + room.depth / 2);
    }
    close(Math.min(...xs), fp.x, `minX ${w}x${d}@${rotation}`);
    close(Math.max(...xs), fp.x + fp.width, `maxX ${w}x${d}@${rotation}`);
    close(Math.min(...zs), fp.y, `minY ${w}x${d}@${rotation}`);
    close(Math.max(...zs), fp.y + fp.depth, `maxY ${w}x${d}@${rotation}`);
  }
});

test('5.1 front and back point the same way in 2D and 3D at 0/90/180/270', () => {
  for (const rotation of ROTATIONS) {
    const t = furnitureTransform3D({ x: 0, y: 0, width: 2, depth: 1, rotation }, { width: 5, depth: 4 });
    // 2D draws a piece's front towards +y (e.g. a sofa's back is at the top) and applies rotate(rotation).
    for (const [lx, ly] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const plan = svgRotate(rotation, lx, ly);
      const scene = threeRotate(t.rotationY, lx, ly);
      close(scene.x, plan.x, `dx at ${rotation} for (${lx},${ly})`);
      close(scene.y, plan.y, `dy at ${rotation} for (${lx},${ly})`);
    }
  }
  // The case that used to be wrong: at 90° the front faces west in the plan.
  const t90 = furnitureTransform3D({ x: 0, y: 0, width: 2, depth: 1, rotation: 90 }, { width: 5, depth: 4 });
  const front = threeRotate(t90.rotationY, 0, 1);
  close(front.x, -1);
  close(front.y, 0);
});

test('5.1 degrees and radians round-trip; positions round-trip', () => {
  for (const deg of [0, 45, 90, 180, 270, 359]) close(rotationFromRadians(rotationToRadians(deg)), deg, `deg ${deg}`);
  assert.equal(rotationToRadians(undefined), 0);
  assert.equal(rotationToRadians(0), 0);
  const room = { width: 5, depth: 4 };
  const item = { x: 1.3, y: 0.6, width: 2, depth: 0.9, rotation: 90 };
  const fp = furnitureFootprint(item);
  const t = furnitureTransform3D(item, room);
  const back = itemPositionFromScene(t, fp, room);
  close(back.x, item.x);
  close(back.y, item.y);
});

// ---- 5.2 doors and windows

type Opening = { wall: 'north' | 'south' | 'east' | 'west'; start: number; end: number; type: 'door' | 'window' };

/**
 * Reads the opening back out of the built shell: along the wall, the stretch
 * where no solid wall piece covers a given height. That is the hole you can
 * see through (door at 1 m, window at 1.5 m), in 2D plan metres from the wall's start.
 */
function openingsFromShell(openings: Opening[], width: number, depth: number, height = 2.8) {
  const scene = new THREE.Scene();
  const shell = buildInteriorShell(scene, { width, depth, height, thickness: 0.2, wallMaterial: new THREE.MeshStandardMaterial(), openings });
  const found: Opening[] = [];
  for (const side of ['north', 'south', 'west', 'east'] as const) {
    const horizontal = side === 'north' || side === 'south';
    const length = horizontal ? width : depth;
    for (const [type, y] of [['door', 1.0], ['window', 1.5]] as const) {
      const spans: Array<[number, number]> = [];
      shell.groups[side].traverse((o) => {
        if (!(o instanceof THREE.Mesh) || o.userData.surface !== `wall:${side}`) return;
        const box = new THREE.Box3().setFromObject(o);
        if (box.min.y > y || box.max.y < y) return;
        spans.push(horizontal ? [box.min.x + width / 2, box.max.x + width / 2] : [box.min.z + depth / 2, box.max.z + depth / 2]);
      });
      spans.sort((a, b) => a[0] - b[0]);
      let cursor = 0;
      for (const [a, b] of spans) {
        if (a - cursor > 1e-6) found.push({ wall: side, start: cursor, end: a, type });
        cursor = Math.max(cursor, b);
      }
      if (length - cursor > 1e-6) found.push({ wall: side, start: cursor, end: length, type });
    }
  }
  return found;
}

test('5.2 the holes in the 3D walls are exactly the 2D plan openings, on all four walls', () => {
  const width = 6;
  const depth = 5;
  const openings: Opening[] = [
    { wall: 'north', start: 1.2, end: 2.6, type: 'window' },
    { wall: 'south', start: 0.8, end: 1.7, type: 'door' },
    { wall: 'east', start: 1.0, end: 2.4, type: 'window' },
    { wall: 'west', start: 3.1, end: 4.0, type: 'door' },
  ];
  const found = openingsFromShell(openings, width, depth);
  for (const o of openings) {
    // A window is open at window height; a door is open at both heights.
    const match = found.find((f) => f.wall === o.wall && f.type === (o.type === 'window' ? 'window' : 'door') && Math.abs(f.start - o.start) < 1e-6 && Math.abs(f.end - o.end) < 1e-6);
    assert.ok(match, `${o.wall} ${o.type} ${o.start}-${o.end} not found in 3D; got ${JSON.stringify(found.filter((f) => f.wall === o.wall))}`);
  }
  // Nothing extra: the other walls have no holes at all.
  for (const side of ['north', 'south', 'east', 'west'] as const) {
    const expected = openings.filter((o) => o.wall === side).length;
    const holes = new Set(found.filter((f) => f.wall === side).map((f) => `${f.start.toFixed(4)}-${f.end.toFixed(4)}`));
    assert.equal(holes.size, expected, `${side} should have ${expected} hole(s)`);
  }
});

test('5.2 north in 2D is north in 3D (the north wall sits at -z, west at -x)', () => {
  const scene = new THREE.Scene();
  const shell = buildInteriorShell(scene, { width: 6, depth: 5, height: 2.8, thickness: 0.2, wallMaterial: new THREE.MeshStandardMaterial(), openings: [] });
  const centre = (side: 'north' | 'south' | 'east' | 'west') => new THREE.Box3().setFromObject(shell.groups[side]).getCenter(new THREE.Vector3());
  assert.ok(centre('north').z < -2.4 && Math.abs(centre('north').x) < 1e-6);
  assert.ok(centre('south').z > 2.4);
  assert.ok(centre('west').x < -2.9 && Math.abs(centre('west').z) < 1e-6);
  assert.ok(centre('east').x > 2.9);
});

test('5.2 with no saved openings, 3D uses the same default door and window as the 2D plan', () => {
  const width = 5.5;
  const depth = 6.5;
  const resolved = resolveInteriorOpenings({}, width, depth);
  assert.deepEqual(resolved, defaultRoomOpenings(width, depth));
  const found = openingsFromShell(resolved, width, depth);
  const door = defaultRoomOpenings(width, depth).find((o) => o.type === 'door')!;
  const window = defaultRoomOpenings(width, depth).find((o) => o.type === 'window')!;
  assert.ok(found.some((f) => f.wall === door.wall && f.type === 'door' && Math.abs(f.start - door.start) < 1e-6 && Math.abs(f.end - door.end) < 1e-6), 'default door');
  assert.ok(found.some((f) => f.wall === window.wall && f.type === 'window' && Math.abs(f.start - window.start) < 1e-6 && Math.abs(f.end - window.end) < 1e-6), 'default window');
  assert.equal(interiorSceneKey({ roomWidth: width, roomLength: depth, style: 'modern', furniture: [] }), interiorSceneKey({ roomWidth: width, roomLength: depth, style: 'modern', furniture: [], openings: resolved }));
});
