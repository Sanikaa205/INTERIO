import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createContactShadow, defaultQuality, disposeContactShadow, enhanceSurfaceMaterial, isFlatPiece, qualitySettings, shadowFrustum, sunPosition } from './interiorRealism';
import { MATERIAL_CATALOG } from '../components/FloorPlan3D/materialCatalog';

const variant = (id: string) => MATERIAL_CATALOG.find((v) => v.id === id)!;

test('6.6 quality settings cap pixel ratio and shadow size, and never exceed the device', () => {
  assert.deepEqual(qualitySettings('high', 3), { pixelRatio: 2, shadowMapSize: 2048, anisotropy: 8 });
  assert.deepEqual(qualitySettings('balanced', 3), { pixelRatio: 1.25, shadowMapSize: 1024, anisotropy: 4 });
  assert.equal(qualitySettings('balanced', 1).pixelRatio, 1);
  assert.equal(qualitySettings('high', Number.NaN).pixelRatio, 1, 'a bad ratio falls back to 1');
  assert.equal(qualitySettings('high', 2, 2).anisotropy, 2, 'limited by the GPU');
});

test('6.6 default quality: balanced on phones and low-core machines', () => {
  assert.equal(defaultQuality(390, 8), 'balanced');
  assert.equal(defaultQuality(1400, 4), 'balanced');
  assert.equal(defaultQuality(1400, 12), 'high');
  assert.equal(defaultQuality(1400, undefined), 'high');
});

test('6.1 the shadow frustum fits the room and the sun sits above and beside it', () => {
  const small = shadowFrustum(3, 3, 2.8);
  const big = shadowFrustum(8, 10, 2.8);
  assert.ok(small.half < big.half && small.half < 6, 'a small room gets a tight frustum');
  assert.ok(big.half >= Math.hypot(8, 10) / 2, 'the whole room is covered');
  assert.ok(small.far > small.near);
  const sun = sunPosition(5, 4, 2.8);
  assert.ok(sun.y > 2.8 && sun.x > 0 && sun.z > 0);
  assert.ok(sun.length() < small.far + 20);
});

test('6.1 contact shadows: a soft plane under a piece that ignores clicks and can be disposed', () => {
  const blob = createContactShadow({ name: 'Sofa', category: 'seating', width: 2, depth: 1 });
  // The blob needs a canvas, which plain node does not have; in a browser it exists.
  if (typeof document === 'undefined') {
    assert.equal(blob, null);
    return;
  }
  assert.ok(blob);
  const raycaster = new THREE.Raycaster(new THREE.Vector3(0, 2, 0), new THREE.Vector3(0, -1, 0));
  assert.equal(raycaster.intersectObject(blob!).length, 0, 'never steals a click from the furniture');
  const root = new THREE.Group();
  root.add(blob!);
  disposeContactShadow(root);
});

test('6.1 rugs get no contact shadow', () => {
  assert.equal(isFlatPiece({ name: 'Area rug', category: 'decor' }), true);
  assert.equal(isFlatPiece({ name: 'Wool carpet', category: 'decor' }), true);
  assert.equal(isFlatPiece({ name: 'Potted plant', category: 'decor' }), false);
  assert.equal(isFlatPiece({ name: 'Sofa', category: 'seating' }), false);
  assert.equal(createContactShadow({ name: 'Area rug', category: 'decor', width: 2, depth: 1 }), null);
});

test('6.2 polished stone and tile reflect more than matte plaster, and rougher finishes reflect less', () => {
  const marble = enhanceSurfaceMaterial(new THREE.MeshStandardMaterial(), variant('marble-nero-marquina'));
  const tile = enhanceSurfaceMaterial(new THREE.MeshStandardMaterial(), variant('tile-black'));
  const plaster = enhanceSurfaceMaterial(new THREE.MeshStandardMaterial(), variant('plaster-venetian'));
  const brick = enhanceSurfaceMaterial(new THREE.MeshStandardMaterial(), variant('brick-red'));
  assert.ok(marble.envMapIntensity > 1.3, 'marble is glossy');
  assert.ok(tile.envMapIntensity > 1);
  assert.ok(marble.envMapIntensity > tile.envMapIntensity, 'glossier marble reflects more than tile');
  assert.equal(brick.envMapIntensity, 0.75);
  assert.ok(plaster.envMapIntensity <= 1);
});

test('6.2 the texture doubles as a bump map for wood, brick, stone and plaster once it has loaded', () => {
  for (const id of ['wood-walnut', 'brick-red', 'stone-stacked', 'plaster-venetian', 'concrete-polished']) {
    const material = new THREE.MeshStandardMaterial();
    enhanceSurfaceMaterial(material, variant(id));
    assert.equal(material.bumpMap, null, `${id}: nothing to bump before the texture arrives`);
    material.map = new THREE.Texture();
    enhanceSurfaceMaterial(material, variant(id));
    assert.equal(material.bumpMap, material.map, `${id}: same texture, so tiling matches`);
    assert.ok(material.bumpScale > 0 && material.bumpScale < 3);
  }
  // Tile and plain paint are smooth: no bump.
  const tile = new THREE.MeshStandardMaterial();
  tile.map = new THREE.Texture();
  enhanceSurfaceMaterial(tile, variant('tile-white-matte'));
  assert.equal(tile.bumpMap, null);
});

test('6.2 the catalogue roughness is kept (marble is glossier than brick)', () => {
  assert.ok(variant('marble-calacatta').roughness < variant('brick-red').roughness);
});
