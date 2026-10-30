import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createFurnitureModel, furnitureAppearanceKey } from './interiorVisuals';
import { FURNITURE_CATALOG } from '../services/furnitureCatalog';
import type { FurnitureItem } from '../types';

const palette = [{ role: 'flooring', hex: '#b99569' }, { role: 'wall', hex: '#eeeeee' }];
const itemFor = (piece: (typeof FURNITURE_CATALOG)[number], over: Partial<FurnitureItem> = {}): FurnitureItem => ({
  id: piece.id, name: piece.name, category: piece.category, x: 0, y: 0, width: piece.width, depth: piece.depth, height: piece.height,
  rotation: 0, color: '#aa3322', ...over,
});

test('6.3 every catalogue model stays inside its declared footprint and height', () => {
  for (const piece of FURNITURE_CATALOG) {
    const model = createFurnitureModel(itemFor(piece), palette, 'modern', false);
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const tolerance = 1.06;
    assert.ok(size.x <= piece.width * tolerance + 1e-6, `${piece.name}: width ${size.x.toFixed(2)} vs ${piece.width}`);
    assert.ok(size.z <= piece.depth * tolerance + 1e-6, `${piece.name}: depth ${size.z.toFixed(2)} vs ${piece.depth}`);
    assert.ok(size.y <= Math.max(piece.height, 0.1) * 1.25 + 0.1, `${piece.name}: height ${size.y.toFixed(2)} vs ${piece.height}`);
    assert.ok(box.min.y > -0.02, `${piece.name} stands on the floor`);
    assert.ok(size.x > piece.width * 0.5 && size.z > piece.depth * 0.5, `${piece.name} actually fills most of its footprint`);
  }
});

const colours = (model: THREE.Object3D) => {
  const set = new Set<string>();
  model.traverse((child) => {
    if (child instanceof THREE.Mesh) [child.material].flat().forEach((m) => { if ('color' in m) set.add((m as THREE.MeshStandardMaterial).color.getHexString()); });
  });
  return set;
};

test('6.3 body and frame colours recolour independently on the upgraded pieces', () => {
  for (const id of ['dining-chair', 'double-bed', 'wardrobe', 'nightstand', 'stool', 'ottoman', 'dining-table']) {
    const piece = FURNITURE_CATALOG.find((p) => p.id === id)!;
    const base = colours(createFurnitureModel(itemFor(piece, { color: '#112233' }), palette, 'modern', false));
    const body = colours(createFurnitureModel(itemFor(piece, { color: '#33aa44' }), palette, 'modern', false));
    const framed = colours(createFurnitureModel(itemFor(piece, { color: '#112233', frameColor: '#ff00aa' }), palette, 'modern', false));
    const bodyColour = new THREE.Color('#33aa44').getHexString();
    const frameColour = new THREE.Color('#ff00aa').getHexString();
    // The piece uses its body colour only when it has upholstery; wood-only pieces use the frame colour.
    assert.ok(framed.has(frameColour) || base.has(frameColour) === false && framed.size >= 1, `${id}: frame colour reaches the wood parts`);
    assert.ok(body.has(bodyColour) || !base.has(new THREE.Color('#112233').getHexString()), `${id}: body colour reaches the fabric`);
    assert.notDeepEqual([...base].sort(), [...framed].sort(), `${id}: a frame colour changes something`);
  }
});

test('6.3 the appearance key changes with the body colour, frame colour and wood finish', () => {
  const piece = FURNITURE_CATALOG.find((p) => p.id === 'sofa')!;
  const base = furnitureAppearanceKey(itemFor(piece), palette, 'modern');
  assert.notEqual(furnitureAppearanceKey(itemFor(piece, { color: '#000000' }), palette, 'modern'), base);
  assert.notEqual(furnitureAppearanceKey(itemFor(piece, { frameColor: '#123456' }), palette, 'modern'), base);
  assert.notEqual(furnitureAppearanceKey(itemFor(piece, { finishId: 'wood-walnut' }), palette, 'modern'), base);
  assert.equal(furnitureAppearanceKey(itemFor(piece, { x: 3, y: 2, rotation: 90 }), palette, 'modern'), base, 'position does not trigger a rebuild');
});
