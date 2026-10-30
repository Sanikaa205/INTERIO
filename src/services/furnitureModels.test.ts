import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { REAL_MODELS, findRealModel } from './furnitureModels';
import { FURNITURE_CATALOG } from './furnitureCatalog';
import { createCachedGlbLoader, fitModelToItem, loadFurnitureModel, recolorModel, type GlbLoaderLike } from '../three/glbFurniture';
import type { FurnitureItem } from '../types';

const root = process.cwd();
const publicPath = (url: string) => path.join(root, 'public', url);

/** Reads a GLB's JSON chunk and binary length without any image decoding. */
function readGlb(file: string) {
  const buffer = fs.readFileSync(file);
  assert.equal(buffer.readUInt32LE(0), 0x46546c67, 'glTF magic');
  assert.equal(buffer.readUInt32LE(4), 2, 'glTF version 2');
  assert.equal(buffer.readUInt32LE(8), buffer.length, 'declared length matches the file');
  const jsonLength = buffer.readUInt32LE(12);
  assert.equal(buffer.readUInt32LE(16), 0x4e4f534a, 'first chunk is JSON');
  const json = JSON.parse(buffer.subarray(20, 20 + jsonLength).toString('utf8'));
  const binHeader = 20 + jsonLength;
  assert.equal(buffer.readUInt32LE(binHeader + 4), 0x004e4942, 'second chunk is BIN');
  return { json, binLength: buffer.readUInt32LE(binHeader), size: buffer.length };
}

test('6.5 every registered model is a valid, self-contained GLB within the size budget', () => {
  let total = 0;
  for (const model of REAL_MODELS) {
    const file = publicPath(model.url);
    assert.ok(fs.existsSync(file), `${model.url} exists`);
    const { json, binLength, size } = readGlb(file);
    total += size;
    assert.ok(size <= 1.4 * 1024 * 1024, `${model.id} is ${Math.round(size / 1024)} KB`);
    assert.equal(json.asset.version, '2.0');
    assert.ok(json.meshes?.length > 0, `${model.id} has geometry`);
    for (const buffer of json.buffers) assert.equal(buffer.uri, undefined, `${model.id}: no external buffer`);
    for (const image of json.images ?? []) {
      assert.equal(image.uri, undefined, `${model.id}: textures are embedded, not linked`);
      assert.ok(image.bufferView !== undefined && image.mimeType, `${model.id}: embedded image`);
    }
    for (const view of json.bufferViews) assert.ok(view.byteOffset + view.byteLength <= binLength, `${model.id}: buffer views stay inside the binary chunk`);
    const names: string[] = json.materials.map((m: { name?: string }) => m.name ?? '');
    assert.ok(names.some((n) => /main|frame/i.test(n)), `${model.id} has a main/frame material (got ${names.join(', ')})`);
  }
  assert.ok(total <= 4.5 * 1024 * 1024, `all models together: ${Math.round(total / 1024)} KB`);
});

test('6.5 at least 8 models are bundled, with unique ids and urls', () => {
  assert.ok(REAL_MODELS.length >= 8 && REAL_MODELS.length <= 10);
  assert.equal(new Set(REAL_MODELS.map((m) => m.id)).size, REAL_MODELS.length);
  assert.equal(new Set(REAL_MODELS.map((m) => m.url)).size, REAL_MODELS.length);
});

test('6.5 every bundled model has a CC0 entry in LICENSES.md with source, author and URL', () => {
  const licences = fs.readFileSync(path.join(root, 'public/assets/furniture/LICENSES.md'), 'utf8');
  for (const model of REAL_MODELS) {
    const file = path.basename(model.url);
    const row = licences.split('\n').find((line) => line.includes(`models/${file}`));
    assert.ok(row, `${file} has a licence row`);
    assert.match(row!, /CC0/);
    assert.match(row!, /https:\/\/polyhaven\.com\/a\//);
    assert.ok(row!.split('|').filter((cell) => cell.trim()).length >= 6, `${file}: source, author, licence, URL and date filled in`);
  }
});

test('6.5 pieces are matched to a model only when the name and category suit it', () => {
  const pick = (name: string, category: FurnitureItem['category']) => findRealModel({ name, category })?.id ?? null;
  assert.equal(pick('Japandi Low-Profile Modular Linen Sofa', 'seating'), 'sofa');
  assert.equal(pick('Armchair', 'seating'), 'armchair');
  assert.equal(pick('Dining chair', 'seating'), 'dining-chair');
  assert.equal(pick('Ottoman', 'seating'), 'ottoman');
  assert.equal(pick('Coffee table', 'table'), 'coffee-table');
  assert.equal(pick('Dining table', 'table'), 'dining-table');
  assert.equal(pick('Nightstand', 'storage'), 'nightstand');
  assert.equal(pick('Slimline Media Credenza', 'storage'), 'sideboard');
  assert.equal(pick('Bookcase', 'storage'), 'bookcase');
  // Not matched: no model, or the wrong category (a bed called "sofa bed" is still a bed).
  assert.equal(pick('Floor lamp', 'lighting'), null);
  assert.equal(pick('Double bed', 'bed'), null);
  assert.equal(pick('Sofa bed', 'bed'), null);
  assert.equal(pick('Desk', 'table'), null);
});

test('6.5 which catalogue pieces use a bundled model', () => {
  const used = FURNITURE_CATALOG.filter((piece) => findRealModel(piece)).map((piece) => piece.id);
  for (const id of ['sofa', 'loveseat', 'armchair', 'dining-chair', 'ottoman', 'coffee-table', 'dining-table', 'nightstand', 'media-console', 'sideboard', 'bookcase']) {
    assert.ok(used.includes(id), `${id} should use a real model`);
  }
});

test('6.5 a model that would be stretched too far is left to the procedural piece', () => {
  const tall = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());
  const item = { width: 4, depth: 0.3, height: 0.5, category: 'storage' } as FurnitureItem;
  assert.equal(fitModelToItem(tall, item, 1.7), false, 'a 1 m cube forced into 4 x 0.5 x 0.3 m');
  const ok = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial());
  assert.equal(fitModelToItem(ok, { width: 1.2, depth: 0.9, height: 1, category: 'storage' } as FurnitureItem, 1.7), true);
});

test('6.5 "main_frame" wood takes the frame colour when set, else the body colour', () => {
  const build = () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: '#ffffff', name: 'main_frame' }));
    return { group: new THREE.Group().add(mesh), mesh };
  };
  const a = build();
  assert.deepEqual(recolorModel(a.group, { main: '#ff0000' }), { main: true, frame: true });
  assert.equal((a.mesh.material as THREE.MeshStandardMaterial).color.getHexString(), 'ff0000');
  const b = build();
  recolorModel(b.group, { main: '#ff0000', frame: '#0000ff' });
  assert.equal((b.mesh.material as THREE.MeshStandardMaterial).color.getHexString(), '0000ff');
});

test('6.5 the loader cache fetches a file once, hands out independent clones, and retries after a failure', async () => {
  let loads = 0;
  let fail = true;
  const base: GlbLoaderLike = {
    load(_url, onLoad, _p, onError) {
      loads++;
      if (fail) onError(new Error('offline'));
      else onLoad({ scene: new THREE.Group().add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ name: 'main' }))) });
    },
  };
  const cached = createCachedGlbLoader(base);
  const item = { id: 'a', name: 'Sofa', category: 'seating', x: 0, y: 0, width: 2, depth: 1, height: 1, color: '#00ff00', generatedColor: '#101010' } as FurnitureItem;
  assert.equal(await loadFurnitureModel('/m.glb', item, cached), null, 'a failure falls back');
  fail = false;
  const first = await loadFurnitureModel('/m.glb', item, cached);
  const second = await loadFurnitureModel('/m.glb', { ...item, id: 'b', color: '#ff0000' }, cached);
  assert.ok(first && second);
  assert.equal(loads, 2, 'one failed attempt, one successful download shared by both pieces');
  assert.notEqual(first, second);
  const colourOf = (model: THREE.Object3D) => { let hex = ''; model.traverse((c) => { if (c instanceof THREE.Mesh) hex = (c.material as THREE.MeshStandardMaterial).color.getHexString(); }); return hex; };
  assert.equal(colourOf(first!), '00ff00');
  assert.equal(colourOf(second!), 'ff0000', 'recolouring one piece never changes the other');
});

test('6.5 a model keeps its own look until the user edits a colour, and an edit replaces the texture', async () => {
  const build = () => {
    const texture = new THREE.Texture();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ name: 'main', map: texture, color: '#ffffff' }));
    return { scene: new THREE.Group().add(mesh), mesh, texture };
  };
  const loaderFor = (scene: THREE.Object3D): GlbLoaderLike => ({ load: (_u, ok) => ok({ scene }) });
  const item = { id: 'a', name: 'Sofa', category: 'seating', x: 0, y: 0, width: 2, depth: 1, height: 1 } as FurnitureItem;
  const untouched = build();
  await loadFurnitureModel('/m.glb', { ...item, color: '#aa0000', generatedColor: '#aa0000' }, loaderFor(untouched.scene));
  assert.equal((untouched.mesh.material as THREE.MeshStandardMaterial).map, untouched.texture, 'generated colour: original texture kept');
  const edited = build();
  await loadFurnitureModel('/m.glb', { ...item, color: '#00aa00', generatedColor: '#aa0000' }, loaderFor(edited.scene));
  const material = edited.mesh.material as THREE.MeshStandardMaterial;
  assert.equal(material.map, null, 'edited colour: flat colour, so a dark texture cannot swallow it');
  assert.equal(material.color.getHexString(), '00aa00');
});
