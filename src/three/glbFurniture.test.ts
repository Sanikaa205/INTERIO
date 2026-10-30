import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { applyItemColors, fitModelToItem, loadFurnitureModel, recolorModel, type GlbLoaderLike } from './glbFurniture';
import type { FurnitureItem } from '../types';

const item = (over: Partial<FurnitureItem> = {}): FurnitureItem =>
  ({ id: 'c1', name: 'Chair', category: 'seating', x: 0, y: 0, width: 0.6, depth: 0.5, height: 0.9, color: '#ff0000', ...over });

/** A model like a loaded GLB: off-centre, floating, wrong size, with named materials. */
function sampleModel(names: [string, string] = ['main', 'frame']) {
  const root = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 2), new THREE.MeshStandardMaterial({ color: '#888888', name: names[0] }));
  body.position.set(5, 3, -4);
  const legs = new THREE.Mesh(new THREE.BoxGeometry(2, 0.5, 2), new THREE.MeshStandardMaterial({ color: '#444444', name: names[1] }));
  legs.position.set(5, 2.25, -4);
  root.add(body, legs);
  return { root, body, legs };
}

const fakeLoader = (model: THREE.Object3D | 'error' | 'throw'): GlbLoaderLike => ({
  load(_url, onLoad, _progress, onError) {
    if (model === 'throw') throw new Error('boom');
    if (model === 'error') onError(new Error('404'));
    else onLoad({ scene: model });
  },
});

test('6.4 a model is scaled to the item size, stood on the floor and centred on its footprint', () => {
  const { root } = sampleModel();
  assert.equal(fitModelToItem(root, item()), true);
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  assert.ok(Math.abs(size.x - 0.6) < 1e-6 && Math.abs(size.y - 0.9) < 1e-6 && Math.abs(size.z - 0.5) < 1e-6);
  assert.ok(Math.abs(box.min.y) < 1e-6, 'pivot on the floor');
  const centre = box.getCenter(new THREE.Vector3());
  assert.ok(Math.abs(centre.x) < 1e-6 && Math.abs(centre.z) < 1e-6, 'centred on x/z');
});

test('6.4 without a height, seating defaults to 0.95 and other pieces to 0.8', () => {
  const seat = sampleModel().root;
  fitModelToItem(seat, item({ height: undefined }));
  assert.ok(Math.abs(new THREE.Box3().setFromObject(seat).getSize(new THREE.Vector3()).y - 0.95) < 1e-6);
  const other = sampleModel().root;
  fitModelToItem(other, item({ height: undefined, category: 'table' }));
  assert.ok(Math.abs(new THREE.Box3().setFromObject(other).getSize(new THREE.Vector3()).y - 0.8) < 1e-6);
});

test('6.4 an empty model cannot be fitted', () => {
  assert.equal(fitModelToItem(new THREE.Group(), item()), false);
});

test('6.4 "main" and "frame" materials take the body and frame colours independently', () => {
  const { root, body, legs } = sampleModel();
  const originalBody = body.material;
  const found = recolorModel(root, { main: '#00ff00', frame: '#0000ff' });
  assert.deepEqual(found, { main: true, frame: true });
  assert.equal((body.material as THREE.MeshStandardMaterial).color.getHexString(), '00ff00');
  assert.equal((legs.material as THREE.MeshStandardMaterial).color.getHexString(), '0000ff');
  assert.notEqual(body.material, originalBody, 'materials are cloned, so a shared model is not changed');
  assert.equal((originalBody as THREE.MeshStandardMaterial).color.getHexString(), '888888');
});

test('6.4 names match by convention (e.g. "Seat_main", "legFrame")', () => {
  const { root, body, legs } = sampleModel(['Seat_main_fabric', 'legFrame']);
  recolorModel(root, { main: '#123456', frame: '#654321' });
  assert.equal((body.material as THREE.MeshStandardMaterial).color.getHexString(), '123456');
  assert.equal((legs.material as THREE.MeshStandardMaterial).color.getHexString(), '654321');
});

test('6.4 models without named materials get a light tint and stay recognisable', () => {
  const { root, body } = sampleModel(['mat0', 'mat1']);
  applyItemColors(root, item({ color: '#ff0000' }));
  const before = new THREE.Color('#888888');
  const color = (body.material as THREE.MeshStandardMaterial).color;
  assert.ok(color.r > before.r && color.r < 1, 'moved towards the red tint');
  assert.ok(color.g < before.g, 'and away from the other channels');
  assert.ok(Math.abs(color.g - color.b) < 1e-6);
});

test('6.4 loading resolves to a sized, recoloured model; the frame colour only applies when set', async () => {
  const { root, legs } = sampleModel();
  const holder = await loadFurnitureModel('/x.glb', item({ color: '#00ff00', generatedColor: '#101010', frameColor: '#0000ff' }), fakeLoader(root));
  assert.ok(holder);
  const size = new THREE.Box3().setFromObject(holder!).getSize(new THREE.Vector3());
  assert.ok(Math.abs(size.x - 0.6) < 1e-6);
  assert.equal((legs.material as THREE.MeshStandardMaterial).color.getHexString(), '0000ff');
  const plain = sampleModel();
  await loadFurnitureModel('/x.glb', item({ color: '#00ff00' }), fakeLoader(plain.root));
  assert.equal((plain.legs.material as THREE.MeshStandardMaterial).color.getHexString(), '444444', 'no frame colour: the frame keeps its own');
});

test('6.4 a broken URL, a throwing loader or an empty model all fall back (null), never throw', async () => {
  assert.equal(await loadFurnitureModel('/missing.glb', item(), fakeLoader('error')), null);
  assert.equal(await loadFurnitureModel('/x.glb', item(), fakeLoader('throw')), null);
  assert.equal(await loadFurnitureModel('/x.glb', item(), fakeLoader(new THREE.Group())), null);
});
