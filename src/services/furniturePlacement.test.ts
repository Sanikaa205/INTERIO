import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { InteriorFloorPlan } from '../components/InteriorDesignWorkflow';
import { furnitureFootprint, rectanglesOverlap, hitsOpening } from './layoutOptimizer';
import { createCatalogItem, createDuplicate, estimatedPriceFor, findFreeSpot, withFurniture } from './furniturePlacement';
import { FURNITURE_CATALOG, getCatalogPiece } from './furnitureCatalog';
import type { FurnitureItem, InteriorDesignResult } from '../types';

const room = { width: 5, depth: 4 };
const piece = (over: Partial<Parameters<typeof findFreeSpot>[2]> = {}) => ({ name: 'Sofa', category: 'seating', width: 2, depth: 0.9, ...over });
const furniture = (id: string, x: number, y: number, width: number, depth: number, over: Partial<FurnitureItem> = {}): FurnitureItem =>
  ({ id, name: 'Cabinet', category: 'storage', x, y, width, depth, rotation: 0, ...over });
const design = (items: FurnitureItem[] = [], over: Partial<InteriorDesignResult> = {}): InteriorDesignResult => ({
  roomWidth: 5, roomLength: 4, roomType: 'Living Room', style: 'modern', budget: '$15,000 - $25,000', furniture: items,
  colorPalette: [{ hex: '#e0e0e0', name: 'Wall', role: 'wall' }], lightingSuggestions: '', ...over,
});
const footprintOf = (spot: { x: number; y: number; rotation: number }, w: number, d: number) =>
  furnitureFootprint({ x: spot.x, y: spot.y, width: w, depth: d, rotation: spot.rotation });
const inside = (r: { x: number; y: number; width: number; depth: number }) =>
  r.x >= -1e-6 && r.y >= -1e-6 && r.x + r.width <= room.width + 1e-6 && r.y + r.depth <= room.depth + 1e-6;

test('4.2 an empty room gives a spot inside the room, on the preferred wall, facing in', () => {
  const away = [{ wall: 'east' as const, start: 1, end: 2, type: 'window' as const }];
  const spot = findFreeSpot([], room, piece({ preferredWall: 'north' }), away)!;
  assert.ok(spot);
  const r = footprintOf(spot, 2, 0.9);
  assert.ok(inside(r));
  assert.equal(r.y, 0, 'against the north wall');
  assert.equal(spot.rotation, 0);
  assert.equal(spot.tight, false);
  const west = findFreeSpot([], room, piece({ preferredWall: 'west' }), away)!;
  assert.equal(west.rotation, 270);
  assert.equal(footprintOf(west, 2, 0.9).x, 0, 'a rotated piece still touches its wall');
});

test('4.2 the spot never overlaps furniture or its clearance, and stays in bounds', () => {
  const others = [furniture('a', 0, 0, 2, 0.9), furniture('b', 3, 0, 2, 0.9), furniture('c', 0, 3, 1.5, 1)];
  const spot = findFreeSpot(others, room, piece({ preferredWall: 'north', clearance: 0.4 }))!;
  const r = footprintOf(spot, 2, 0.9);
  assert.ok(inside(r));
  for (const other of others) assert.equal(rectanglesOverlap(r, furnitureFootprint(other)), false);
});

test('4.2 a crowded room returns null and nothing is placed', () => {
  const wall = [furniture('a', 0, 0, 5, 4)];
  assert.equal(findFreeSpot(wall, room, piece()), null);
  assert.equal(findFreeSpot([], { width: 1, depth: 1 }, piece()), null, 'bigger than the room');
  assert.equal(createCatalogItem(design(wall), getCatalogPiece('sofa')!), null);
});

test('4.2 when only a tight gap fits it is used and flagged', () => {
  // 5 m wide room, an existing 4.6 m piece leaves a 0.4 m strip: too tight for a 0.45 clearance, fine for a 0.05 gap.
  const others = [furniture('a', 0, 0, 5, 3.55)];
  const spot = findFreeSpot(others, room, piece({ width: 0.4, depth: 0.4, clearance: 0.45 }))!;
  assert.ok(spot);
  assert.equal(spot.tight, true);
  assert.equal(rectanglesOverlap(footprintOf(spot, 0.4, 0.4), furnitureFootprint(others[0])), false);
});

test('4.2 door swings and window sills stay clear', () => {
  const openings = [
    { wall: 'south' as const, start: 1, end: 2, type: 'door' as const },
    { wall: 'north' as const, start: 1.5, end: 3.5, type: 'window' as const },
  ];
  const layoutRoom = { ...room, openings, doorClearance: 0.75 };
  for (const wall of ['north', 'south'] as const) {
    const spot = findFreeSpot([], room, piece({ preferredWall: wall }), openings)!;
    assert.ok(spot);
    const r = footprintOf(spot, 2, 0.9);
    assert.equal(hitsOpening(r, { ...layoutRoom, doorClearance: 0.3 }), false, `${wall} piece blocks an opening`);
  }
  // With no saved openings the default door and window still apply.
  const plain = findFreeSpot([], room, piece({ preferredWall: 'north' }))!;
  assert.ok(plain);
});

test('4.2 rotation: a long piece in a narrow room is turned to fit', () => {
  const spot = findFreeSpot([], { width: 1.2, depth: 4 }, piece({ width: 2.1, depth: 0.5, preferredWall: 'center' }))!;
  assert.ok(spot);
  assert.ok([90, 270].includes(spot.rotation));
  const r = footprintOf(spot, 2.1, 0.5);
  assert.ok(r.x >= 0 && r.x + r.width <= 1.2 + 1e-6 && r.y + r.depth <= 4 + 1e-6);
});

test('4.2 rugs ignore other furniture and sit in the middle', () => {
  const spot = findFreeSpot([furniture('sofa', 1.5, 1.5, 2, 1)], room, { name: 'Area rug', category: 'decor', width: 2.4, depth: 1.7, preferredWall: 'center' })!;
  assert.ok(spot);
  const r = footprintOf(spot, 2.4, 1.7);
  assert.ok(Math.abs(r.x + r.width / 2 - 2.5) < 0.6 && Math.abs(r.y + r.depth / 2 - 2) < 0.6, 'near the centre');
});

test('4.2 does not mutate its inputs', () => {
  const others = [furniture('a', 0, 0, 2, 1)];
  const snapshot = JSON.stringify(others);
  findFreeSpot(others, room, piece());
  assert.equal(JSON.stringify(others), snapshot);
});

test('4.3 every catalogue piece can be added to an empty room it is offered for, with a new id and price', () => {
  for (const catalogPiece of FURNITURE_CATALOG) {
    const added = createCatalogItem(design(), catalogPiece);
    assert.ok(added, `${catalogPiece.name} should fit in a 5×4 room`);
    const { item } = added!;
    assert.match(item.id, new RegExp(`^add-${catalogPiece.id}-1$`));
    assert.equal(item.name, catalogPiece.name);
    assert.equal(item.color, item.generatedColor);
    assert.match(item.estimatedPrice || '', /^\$[\d,]+–\$[\d,]+$/);
    const r = furnitureFootprint(item);
    assert.ok(inside(r), `${catalogPiece.name} inside the room`);
  }
});

test('4.3 ids stay unique when the same piece is added repeatedly', () => {
  let data = design();
  for (let i = 0; i < 3; i++) {
    const added = createCatalogItem(data, getCatalogPiece('stool')!)!;
    data = withFurniture(data, [...data.furniture, added.item]);
  }
  assert.deepEqual(data.furniture.map((f) => f.id), ['add-stool-1', 'add-stool-2', 'add-stool-3']);
  const footprints = data.furniture.map(furnitureFootprint);
  for (let i = 0; i < footprints.length; i++) for (let j = i + 1; j < footprints.length; j++) assert.equal(rectanglesOverlap(footprints[i], footprints[j]), false);
});

test('4.3 prices follow the budget tier and the estimated total stays in step', () => {
  assert.notEqual(estimatedPriceFor('seating', '$5,000 - $10,000'), estimatedPriceFor('seating', '$75,000+'));
  const data = design([], { estimatedTotal: '$0–$0 x' });
  const added = createCatalogItem(data, getCatalogPiece('sofa')!)!;
  const next = withFurniture(data, [added.item]);
  assert.notEqual(next.estimatedTotal, data.estimatedTotal);
  assert.match(next.estimatedTotal!, /^\$[\d,]+–\$[\d,]+/);
  // Moving a piece (same count) leaves the total alone; a design without a total stays without.
  assert.equal(withFurniture(next, [{ ...added.item, x: 1 }]).estimatedTotal, next.estimatedTotal);
  assert.equal(withFurniture(design(), [added.item]).estimatedTotal, undefined);
});

test('4.4 duplicate copies colours and edits to a free spot with a new id', () => {
  const source = furniture('add-sofa-1', 0, 0, 2, 0.9, { name: 'Sofa', category: 'seating', color: '#ff0000', frameColor: '#332211', generatedColor: '#aaaaaa', rotation: 0 });
  const data = design([source]);
  const copy = createDuplicate(data, source)!;
  assert.ok(copy);
  assert.notEqual(copy.item.id, source.id);
  assert.equal(copy.item.color, '#ff0000');
  assert.equal(copy.item.frameColor, '#332211');
  assert.equal(copy.item.generatedColor, '#aaaaaa');
  assert.equal(rectanglesOverlap(furnitureFootprint(copy.item), furnitureFootprint(source)), false);
  assert.equal(createDuplicate(design([furniture('a', 0, 0, 5, 4)]), furniture('a', 0, 0, 5, 4)), null);
});

test('4.6 the 2D plan shows added, moved and recoloured pieces and drops deleted ones', () => {
  const render = (data: InteriorDesignResult) => renderToStaticMarkup(createElement(InteriorFloorPlan, { result: data, selectedFurnitureId: null, onSelectFurniture: () => undefined }));
  const base = design();
  const sofa = createCatalogItem(base, getCatalogPiece('sofa')!)!.item;
  const withSofa = withFurniture(base, [sofa]);
  assert.ok(render(withSofa).includes('aria-label="Sofa"'), 'added piece appears');
  assert.equal(render(base).includes('aria-label="Sofa"'), false, 'no sofa before it was added');
  const recoloured = withFurniture(withSofa, [{ ...sofa, color: '#12ab34' }]);
  assert.ok(render(recoloured).includes('#12ab34'), 'body colour reaches the plan fill');
  assert.equal(render(withSofa).includes('#12ab34'), false);
  const moved = withFurniture(withSofa, [{ ...sofa, x: 3, y: 2.5 }]);
  assert.notEqual(render(moved), render(withSofa), 'moved piece draws elsewhere');
  const removed = withFurniture(moved, []);
  assert.equal(render(removed).includes('aria-label="Sofa"'), false, 'deleted piece disappears');
});

test('4.6 no catalogue piece draws an invalid (negative-size) 2D shape, at any rotation', () => {
  for (const catalogPiece of FURNITURE_CATALOG) for (const rotation of [0, 90]) {
    const item = { id: 'a', name: catalogPiece.name, form: catalogPiece.form, category: catalogPiece.category, x: 1, y: 1, width: catalogPiece.width, depth: catalogPiece.depth, rotation } as FurnitureItem;
    const html = renderToStaticMarkup(createElement(InteriorFloorPlan, { result: design([item], { roomWidth: 6, roomLength: 5 }), selectedFurnitureId: null, onSelectFurniture: () => undefined }));
    assert.equal(/(width|height|rx|ry|r)="-[\d.]+"/.test(html), false, `${catalogPiece.name} draws a negative size`);
  }
});
