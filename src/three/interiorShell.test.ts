import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  applyWorldUvs,
  buildInteriorShell,
  createInteriorFloor,
  createSurfaceHighlight,
  createSurfaceMaterial,
  isSurfaceId,
  WALL_SIDES,
} from './interiorShell';
import { interiorSceneKey, resolveInteriorOpenings } from './interiorSceneKey';
import { defaultRoomOpenings } from '../services/layoutOptimizer';
import { MATERIAL_CATALOG } from '../components/FloorPlan3D/materialCatalog';
import type { InteriorDesignResult } from '../types';

const W = 5;
const D = 4;
const H = 2.8;
const T = 0.2;

function buildSample(openings = defaultRoomOpenings(W, D)) {
  const scene = new THREE.Scene();
  const base = new THREE.MeshStandardMaterial({ color: '#eee9df' });
  const floor = createInteriorFloor(new THREE.MeshStandardMaterial(), { width: W, depth: D });
  scene.add(floor);
  const shell = buildInteriorShell(scene, { width: W, depth: D, height: H, thickness: T, wallMaterial: base, openings });
  return { scene, floor, shell };
}

function surfaces(scene: THREE.Object3D) {
  const found: THREE.Mesh[] = [];
  scene.traverse((o) => { if (o instanceof THREE.Mesh && o.userData.surface) found.push(o); });
  return found;
}

test('1.2 the shell has exactly one floor and four walls, each wall with its own material', () => {
  const { scene, floor, shell } = buildSample();
  const tagged = surfaces(scene);
  assert.equal(tagged.filter((m) => m.userData.surface === 'floor').length, 1);
  assert.equal(tagged[0] === floor || tagged.includes(floor), true);
  const wallSurfaces = new Set(tagged.map((m) => m.userData.surface).filter((s) => s !== 'floor'));
  assert.deepEqual([...wallSurfaces].sort(), ['wall:east', 'wall:north', 'wall:south', 'wall:west']);
  const materials = new Set(WALL_SIDES.map((side) => shell.wallMaterials[side]));
  assert.equal(materials.size, 4);
  for (const side of WALL_SIDES) {
    const pieces = tagged.filter((m) => m.userData.surface === `wall:${side}`);
    assert.ok(pieces.length >= 1);
    assert.ok(pieces.every((m) => m.material === shell.wallMaterials[side]), `${side} pieces share the wall's material`);
  }
});

test('1.2 frames, glass and doors stay untagged and untinted', () => {
  const { scene, shell } = buildSample();
  const wallMats = new Set<THREE.Material>(Object.values(shell.wallMaterials));
  let trim = 0;
  scene.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || o.userData.surface) return;
    if (o === scene.children[0]) return;
    trim++;
    assert.equal(wallMats.has(o.material as THREE.Material), false);
  });
  assert.ok(trim > 0, 'default room has a door and a window with trim');
});

test('1.2 walls with openings keep their geometry: the openings are left clear', () => {
  const { scene } = buildSample([{ wall: 'north', start: 1, end: 2, type: 'door' }]);
  const north = surfaces(scene).filter((m) => m.userData.surface === 'wall:north');
  const boxes = north.map((m) => new THREE.Box3().setFromObject(m));
  const doorTop = Math.min(2.08, H - 0.12);
  // Nothing solid between the floor and the door head inside the opening (x from -1.5 to -0.5).
  for (const box of boxes) {
    const overlapsOpeningX = box.max.x > -1.5 + 1e-6 && box.min.x < -0.5 - 1e-6;
    if (overlapsOpeningX) assert.ok(box.min.y >= doorTop - 1e-6, 'only the lintel sits over the door');
  }
  // The solid pieces together still cover the wall length outside the opening.
  const covered = boxes.filter((b) => b.max.y - b.min.y > doorTop).reduce((sum, b) => sum + (b.max.x - b.min.x), 0);
  assert.ok(Math.abs(covered - (W - 1)) < 1e-6);
});

test('1.2 per-wall material override is used instead of a clone', () => {
  const scene = new THREE.Scene();
  const mine = new THREE.MeshStandardMaterial({ color: 'red' });
  const shell = buildInteriorShell(scene, {
    width: W, depth: D, height: H, thickness: T, wallMaterial: new THREE.MeshStandardMaterial(),
    materialFor: (side) => (side === 'east' ? mine : undefined), openings: [],
  });
  assert.equal(shell.wallMaterials.east, mine);
  assert.notEqual(shell.wallMaterials.west, mine);
});

test('1.2 isSurfaceId accepts only real surfaces', () => {
  assert.equal(isSurfaceId('floor'), true);
  assert.equal(isSurfaceId('wall:north'), true);
  assert.equal(isSurfaceId('wall:up'), false);
  assert.equal(isSurfaceId('ceiling'), false);
  assert.equal(isSurfaceId(null), false);
});

test('1.5 wall UVs are in metres and continue across a door', () => {
  const { scene } = buildSample([{ wall: 'north', start: 1.5, end: 2.5, type: 'door' }]);
  const pieces = surfaces(scene).filter((m) => m.userData.surface === 'wall:north');
  // Inside face of the north wall faces +z; U runs with world x, V with world y.
  for (const mesh of pieces) {
    const geo = mesh.geometry;
    const pos = geo.getAttribute('position');
    const nor = geo.getAttribute('normal');
    const uv = geo.getAttribute('uv');
    for (let i = 0; i < pos.count; i++) {
      if (nor.getZ(i) > 0.5) {
        assert.ok(Math.abs(uv.getX(i) - (pos.getX(i) + mesh.position.x)) < 1e-6);
        assert.ok(Math.abs(uv.getY(i) - (pos.getY(i) + mesh.position.y)) < 1e-6);
      }
    }
  }
  // A world point on both sides of the door gets consistent U, so the pattern is continuous.
  const left = pieces.find((m) => m.position.x < 0 && (m.geometry as THREE.BoxGeometry).parameters.height === H)!;
  const right = pieces.find((m) => m.position.x > 0 && (m.geometry as THREE.BoxGeometry).parameters.height === H)!;
  const uvAt = (mesh: THREE.Mesh, worldX: number) => {
    const pos = mesh.geometry.getAttribute('position');
    const nor = mesh.geometry.getAttribute('normal');
    const uv = mesh.geometry.getAttribute('uv');
    for (let i = 0; i < pos.count; i++) {
      if (nor.getZ(i) > 0.5 && Math.abs(pos.getX(i) + mesh.position.x - worldX) < 1e-6) return uv.getX(i);
    }
    return null;
  };
  const leftEdge = left.position.x + (left.geometry as THREE.BoxGeometry).parameters.width / 2;
  const rightEdge = right.position.x - (right.geometry as THREE.BoxGeometry).parameters.width / 2;
  assert.ok(Math.abs(uvAt(left, leftEdge)! - leftEdge) < 1e-6);
  assert.ok(Math.abs(uvAt(right, rightEdge)! - rightEdge) < 1e-6);
  assert.ok(Math.abs(rightEdge - leftEdge - 1) < 1e-6, 'the door opening is exactly 1 m of pattern');
});

test('1.5 applyWorldUvs maps floor-facing boxes by x/z and keeps vertices untouched', () => {
  const geo = new THREE.BoxGeometry(2, 0.1, 3);
  const before = Array.from(geo.getAttribute('position').array);
  applyWorldUvs(geo, new THREE.Vector3(1, 0, 1));
  assert.deepEqual(Array.from(geo.getAttribute('position').array), before);
  const pos = geo.getAttribute('position');
  const nor = geo.getAttribute('normal');
  const uv = geo.getAttribute('uv');
  for (let i = 0; i < pos.count; i++) {
    if (nor.getY(i) > 0.5) assert.ok(Math.abs(uv.getX(i) - (pos.getX(i) + 1)) < 1e-6);
  }
});

test('1.5 a surface material keeps its fallback colour until the texture has loaded', () => {
  const paint = MATERIAL_CATALOG.find((v) => !v.mapUrl)!;
  const plain = createSurfaceMaterial(paint, { color: '#336699' });
  assert.equal(plain.color.getHexString(), '336699');
  assert.equal(plain.map, null);
  // Textured variants show the fallback colour until the image arrives.
  const textured = MATERIAL_CATALOG.find((v) => v.mapUrl && v.surfaces.includes('wall'))!;
  const originalLoad = THREE.TextureLoader.prototype.load;
  THREE.TextureLoader.prototype.load = function () { return new THREE.Texture(); } as typeof originalLoad;
  try {
    const mat = createSurfaceMaterial(textured, { scale: 0.5 });
    assert.equal(mat.color.getHexString(), new THREE.Color(textured.color).getHexString());
    assert.equal(mat.map, null, 'no map attached until the texture has loaded');
  } finally {
    THREE.TextureLoader.prototype.load = originalLoad;
  }
});

test('1.3 the selection outline is a separate exportHidden overlay and leaves materials alone', () => {
  const { scene, shell, floor } = buildSample();
  const room = { width: W, depth: D, height: H, thickness: T };
  const before = shell.wallMaterials.north.emissive.getHex();
  const outline = createSurfaceHighlight('wall:north', room);
  scene.add(outline);
  assert.equal(outline.userData.exportHidden, true);
  assert.equal(shell.wallMaterials.north.emissive.getHex(), before);
  assert.equal((floor.material as THREE.MeshStandardMaterial).emissive.getHex(), 0);
  const box = new THREE.Box3().setFromObject(outline);
  assert.ok(Math.abs(box.max.y - H) < 1e-6);
  assert.ok(Math.abs((box.min.z + box.max.z) / 2 + D / 2) < 1e-6, 'sits on the north wall');
  const floorOutline = createSurfaceHighlight('floor', room);
  const floorBox = new THREE.Box3().setFromObject(floorOutline);
  assert.ok(Math.abs(floorBox.max.x - floorBox.min.x - W) < 1e-6);
  // Hiding exportHidden objects (as PNG export does) removes every highlight.
  scene.traverse((o) => { if (o.userData.exportHidden) o.visible = false; });
  assert.equal(outline.visible, false);
});

const sample = (over: Partial<InteriorDesignResult> = {}): InteriorDesignResult => ({
  roomWidth: W, roomLength: D, roomType: 'Living Room', style: 'modern', budget: '$', estimatedCost: 0,
  colorPalette: [{ hex: '#111111', name: 'a', role: 'wall' }, { hex: '#222222', name: 'f', role: 'flooring' }],
  furniture: [
    { id: 'sofa', name: 'Sofa', category: 'seating', x: 1, y: 1, width: 2, depth: 1, height: 0.9, rotation: 0, color: '#aaaaaa' },
  ],
  lighting: [], explanation: '',
  ...over,
} as unknown as InteriorDesignResult);

test('1.1 colour and position edits do not change the scene key; geometry edits do', () => {
  const base = interiorSceneKey(sample());
  const recoloured = sample({
    colorPalette: [{ hex: '#abcdef', name: 'a', role: 'wall' }, { hex: '#fedcba', name: 'f', role: 'flooring' }],
    furniture: [{ ...sample().furniture[0], color: '#ff0000', x: 3, y: 0.5, rotation: 90 }],
  });
  assert.equal(interiorSceneKey(recoloured), base, 'the scene is edited in place, not rebuilt');
  const bigger = sample({ roomWidth: 6 });
  assert.notEqual(interiorSceneKey(bigger), base);
  const added = sample({ furniture: [...sample().furniture, { ...sample().furniture[0], id: 'chair', name: 'Chair' }] });
  assert.notEqual(interiorSceneKey(added), base);
  const removed = sample({ furniture: [] });
  assert.notEqual(interiorSceneKey(removed), base);
  const resized = sample({ furniture: [{ ...sample().furniture[0], width: 2.4 }] });
  assert.notEqual(interiorSceneKey(resized), base);
  const opened = sample({ openings: [{ wall: 'east', start: 1, end: 2, type: 'door' }] });
  assert.notEqual(interiorSceneKey(opened), base);
});

test('1.1 saved projects without openings use the default door and window', () => {
  assert.deepEqual(resolveInteriorOpenings({}, W, D), defaultRoomOpenings(W, D));
  const own = [{ wall: 'east' as const, start: 1, end: 2, type: 'door' as const }];
  assert.deepEqual(resolveInteriorOpenings({ openings: own }, W, D), own);
  assert.equal(interiorSceneKey(null), 'none');
});
