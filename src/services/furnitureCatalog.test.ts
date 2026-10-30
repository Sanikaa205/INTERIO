import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as THREE from 'three';
import { InteriorFloorPlan } from '../components/InteriorDesignWorkflow';
import { createFurnitureModel } from '../three/interiorVisuals';
import {
  CATALOG_GROUPS,
  FURNITURE_CATALOG,
  catalogColor,
  facingRotation,
  getCatalogPiece,
  searchCatalog,
  type CatalogPiece,
} from './furnitureCatalog';
import type { FurnitureItem, InteriorDesignResult } from '../types';

const toItem = (piece: CatalogPiece, name = piece.name, category: FurnitureItem['category'] = piece.category): FurnitureItem => ({
  id: 'x', name, category, ...(piece.form ? { form: piece.form } : {}), x: 0.5, y: 0.5, width: piece.width, depth: piece.depth, height: piece.height, rotation: 0, color: '#9a7b5f',
});

/** What a model is made of, so two models can be compared without rendering. */
function signature(item: FurnitureItem) {
  const group = createFurnitureModel(item, [], 'modern', false);
  const parts: string[] = [];
  group.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const box = new THREE.Box3().setFromBufferAttribute(o.geometry.getAttribute('position') as THREE.BufferAttribute);
    const size = box.getSize(new THREE.Vector3());
    parts.push([o.geometry.type, size.x, size.y, size.z, o.position.x, o.position.y, o.position.z].map((v) => (typeof v === 'number' ? v.toFixed(3) : v)).join(':'));
  });
  return parts.join('|');
}

const resultWith = (item: FurnitureItem): InteriorDesignResult => ({
  roomWidth: 6, roomLength: 5, roomType: 'Living Room', style: 'modern', budget: '$15,000 - $25,000',
  furniture: [item], colorPalette: [{ hex: '#e0e0e0', name: 'Wall', role: 'wall' }, { hex: '#c9a882', name: 'Floor', role: 'flooring' }],
  lightingSuggestions: '',
});
const plan = (item: FurnitureItem) => renderToStaticMarkup(createElement(InteriorFloorPlan, { result: resultWith(item), selectedFurnitureId: null, onSelectFurniture: () => undefined }));

test('4.1 the catalogue has 25-30 pieces with unique ids, valid groups and sane sizes', () => {
  assert.ok(FURNITURE_CATALOG.length >= 25 && FURNITURE_CATALOG.length <= 30, `${FURNITURE_CATALOG.length} pieces`);
  assert.equal(new Set(FURNITURE_CATALOG.map((p) => p.id)).size, FURNITURE_CATALOG.length);
  assert.equal(new Set(FURNITURE_CATALOG.map((p) => p.name)).size, FURNITURE_CATALOG.length, 'names are unique');
  const categories = new Set(['seating', 'table', 'storage', 'bed', 'lighting', 'decor', 'fixture', 'electronics']);
  for (const piece of FURNITURE_CATALOG) {
    assert.ok(CATALOG_GROUPS.includes(piece.group), piece.id);
    assert.ok(categories.has(piece.category), piece.id);
    assert.ok(piece.rooms.length > 0, `${piece.id} is offered for a room`);
    assert.ok(piece.width >= 0.25 && piece.width <= 3.2, `${piece.id} width ${piece.width}`);
    assert.ok(piece.depth >= 0.25 && piece.depth <= 2.3, `${piece.id} depth ${piece.depth}`);
    assert.ok(piece.height >= 0.01 && piece.height <= 2.2, `${piece.id} height ${piece.height}`);
    assert.match(piece.fallbackColor, /^#[0-9a-f]{6}$/i, piece.id);
  }
  for (const group of CATALOG_GROUPS) assert.ok(FURNITURE_CATALOG.some((p) => p.group === group), `${group} has pieces`);
});

test('4.1 every piece draws as a specific 3D model, not the generic box', () => {
  for (const piece of FURNITURE_CATALOG) {
    const generic = signature(toItem(piece, 'zzz', 'fixture'));
    assert.notEqual(signature(toItem(piece)), generic, `${piece.name} falls back to the generic 3D model`);
  }
});

test('4.1 every piece draws as a specific 2D shape, not the generic fallback', () => {
  for (const piece of FURNITURE_CATALOG) {
    // Same item with a meaningless name/category lands in the 2D fallback; the name is masked so only the drawing is compared.
    const mask = (html: string, name: string) => html.split(name).join('NAME');
    const specific = mask(plan(toItem(piece)), piece.name);
    const generic = mask(plan({ ...toItem(piece, 'zzz', 'fixture'), form: undefined }), 'zzz');
    assert.notEqual(specific, generic, `${piece.name} falls back to the generic 2D shape`);
  }
});

test('4.1 the 2D plan draws the footprint the catalogue declares', () => {
  const sofa = getCatalogPiece('sofa')!;
  const html = plan(toItem(sofa));
  assert.ok(html.includes('aria-label="Sofa"'));
});

test('4.1 search matches names, keywords and groups; filters by group and room', () => {
  assert.deepEqual(searchCatalog('couch').map((p) => p.id), ['sofa']);
  assert.ok(searchCatalog('tv').some((p) => p.id === 'media-console'));
  assert.ok(searchCatalog('table lamp').some((p) => p.id === 'table-lamp'));
  assert.ok(searchCatalog('', 'Beds').every((p) => p.group === 'Beds'));
  assert.equal(searchCatalog('', 'All').length, FURNITURE_CATALOG.length);
  assert.ok(searchCatalog('', 'All', 'bedroom').every((p) => p.rooms.includes('bedroom')));
  assert.equal(searchCatalog('zzzz').length, 0);
  assert.ok(searchCatalog('queen bed').some((p) => p.id === 'queen-bed'), 'every typed word must match');
  assert.equal(searchCatalog('sofa bed').length, 0);
});

test('4.1 new pieces take their colour from the design palette, with a fallback', () => {
  const palette = [
    { hex: '#112233', name: 'a', role: 'accent' as const }, { hex: '#445566', name: 'f', role: 'flooring' as const }, { hex: '#778899', name: 's', role: 'secondary' as const },
  ];
  assert.equal(catalogColor(getCatalogPiece('bed' as string) ?? getCatalogPiece('queen-bed')!, palette), '#778899');
  assert.equal(catalogColor(getCatalogPiece('desk')!, palette), '#445566');
  assert.equal(catalogColor(getCatalogPiece('armchair')!, palette), '#112233');
  assert.equal(catalogColor(getCatalogPiece('desk')!, []), getCatalogPiece('desk')!.fallbackColor);
  assert.equal(catalogColor(getCatalogPiece('desk')!, undefined), getCatalogPiece('desk')!.fallbackColor);
});

test('4.1 pieces face into the room from their wall', () => {
  assert.equal(facingRotation('north'), 0);
  assert.equal(facingRotation('south'), 180);
  assert.equal(facingRotation('west'), 270);
  assert.equal(facingRotation('east'), 90);
  assert.equal(facingRotation('center'), 0);
});
