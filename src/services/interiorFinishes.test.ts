import test from 'node:test';
import assert from 'node:assert/strict';
import {
  finishBaseColor,
  resetAll,
  resetFloor,
  resetWalls,
  resolveWallFinish,
  sanitizeFurnitureEdits,
  sanitizeInteriorEdits,
  sanitizeInteriorFinishes,
  sanitizeSurfaceFinish,
  setFloorFinish,
  setWallFinish,
} from './interiorFinishes';
import type { FurnitureItem, InteriorDesignResult, SurfaceFinish } from '../types';

const base = (): InteriorDesignResult => ({
  roomWidth: 5, roomLength: 4, roomType: 'Living Room', style: 'modern', budget: '$',
  furniture: [{ id: 'sofa', name: 'Sofa', category: 'seating', x: 1, y: 1, width: 2, depth: 1, color: '#aaaaaa' } as FurnitureItem],
  colorPalette: [
    { hex: '#111111', name: 'Wall', role: 'wall' },
    { hex: '#222222', name: 'Floor', role: 'flooring' },
  ],
  lightingSuggestions: '',
});
const paint = (color: string): SurfaceFinish => ({ materialId: 'paint', color });
const oak: SurfaceFinish = { materialId: 'wood', variantId: 'wood-light-oak', scale: 0.8, roughness: 0.5 };
const brick: SurfaceFinish = { materialId: 'brick', variantId: 'brick-red' };

test('2.2 valid finishes pass through unchanged', () => {
  const finishes = { floor: oak, walls: { all: paint('#336699'), north: brick } };
  assert.deepEqual(sanitizeInteriorFinishes(finishes), finishes);
});

test('2.2 partial input keeps only what is valid', () => {
  assert.deepEqual(sanitizeInteriorFinishes({ walls: { east: paint('#abcdef') } }), { walls: { east: paint('#abcdef') } });
  assert.deepEqual(sanitizeInteriorFinishes({ floor: { materialId: 'paint' } }), { floor: { materialId: 'paint' } });
});

test('2.2 hostile input never throws and drops bad fields', () => {
  const hostile: unknown[] = [
    null, undefined, 5, 'x', [], { floor: 'oak' }, { floor: null, walls: 7 }, { walls: [] },
    { floor: { materialId: 'lava' } }, { floor: { materialId: {} } }, { walls: { up: paint('#fff000') } },
  ];
  for (const value of hostile) assert.equal(sanitizeInteriorFinishes(value), undefined);
  const mixed = sanitizeInteriorFinishes({
    floor: { materialId: 'wood', variantId: 'nope', color: 'red', scale: -1, roughness: 3, rotation: Infinity },
    walls: { all: { materialId: 'brick', variantId: 'wood-light-oak', scale: 1e9 }, ceiling: paint('#ffffff') },
    __proto__: { polluted: true },
  });
  assert.deepEqual(mixed, { floor: { materialId: 'wood' }, walls: { all: { materialId: 'brick' } } });
  assert.equal(({} as Record<string, unknown>).polluted, undefined);
});

test('2.2 a variant only counts on a surface it is offered for', () => {
  // Walnut is floor-only, slat panelling wall-only.
  assert.equal(sanitizeSurfaceFinish({ materialId: 'wood', variantId: 'wood-walnut' }, 'wall')?.variantId, undefined);
  assert.equal(sanitizeSurfaceFinish({ materialId: 'wood', variantId: 'wood-walnut' }, 'floor')?.variantId, 'wood-walnut');
  assert.equal(sanitizeSurfaceFinish({ materialId: 'wood', variantId: 'wood-slat-panel' }, 'floor')?.variantId, undefined);
});

test('2.2 furniture edit fields are validated, other fields untouched', () => {
  const item = { ...base().furniture[0], frameColor: 'blue', finishId: 'nope', generatedColor: '#12345' } as FurnitureItem;
  const clean = sanitizeFurnitureEdits(item);
  assert.equal('frameColor' in clean, false);
  assert.equal('finishId' in clean, false);
  assert.equal('generatedColor' in clean, false);
  assert.equal(clean.color, '#aaaaaa');
  const good = { ...item, frameColor: '#336699', finishId: 'wood-walnut', generatedColor: '#aaaaaa' } as FurnitureItem;
  assert.deepEqual(sanitizeFurnitureEdits(good), good);
});

test('2.2 legacy projects (no edit fields) load unchanged and bad saved data is dropped', () => {
  const legacy = base();
  assert.deepEqual(sanitizeInteriorEdits(legacy), legacy);
  const bad = { ...base(), finishes: { floor: { materialId: 'lava' } }, generatedSwatches: { wall: 'x' } } as unknown as InteriorDesignResult;
  const loaded = sanitizeInteriorEdits(bad);
  assert.equal('finishes' in loaded, false);
  assert.equal('generatedSwatches' in loaded, false);
  assert.doesNotThrow(() => sanitizeInteriorEdits(null as unknown as InteriorDesignResult));
});

test('2.3 resolveWallFinish: side beats all beats palette default', () => {
  const finishes = { walls: { all: paint('#111111'), north: brick } };
  assert.equal(resolveWallFinish(finishes, 'north'), brick);
  assert.deepEqual(resolveWallFinish(finishes, 'south'), paint('#111111'));
  assert.equal(resolveWallFinish({ floor: oak }, 'south'), undefined);
  assert.equal(resolveWallFinish(undefined, 'south'), undefined);
});

test('2.3 updates are immutable', () => {
  const data = base();
  const snapshot = JSON.stringify(data);
  setFloorFinish(data, oak);
  setWallFinish(data, 'all', paint('#336699'));
  setWallFinish(data, 'north', brick);
  resetAll(setFloorFinish(data, oak));
  assert.equal(JSON.stringify(data), snapshot);
  const withFloor = setFloorFinish(data, oak);
  const snapshot2 = JSON.stringify(withFloor);
  setWallFinish(withFloor, 'east', brick);
  resetFloor(withFloor);
  assert.equal(JSON.stringify(withFloor), snapshot2);
});

test('2.3 setting and resetting the floor', () => {
  const edited = setFloorFinish(base(), oak);
  assert.deepEqual(edited.finishes?.floor, oak);
  assert.equal(edited.generatedSwatches?.flooring, '#222222');
  const reset = resetFloor(edited);
  assert.equal(reset.finishes, undefined);
  assert.equal(reset.colorPalette.find((s) => s.role === 'flooring')?.hex, '#222222');
  assert.equal(setFloorFinish(edited, undefined).finishes, undefined);
});

test('2.3 wall scopes: only "all" moves the wall swatch; resetWalls clears every side', () => {
  let data = setWallFinish(base(), 'north', brick);
  assert.equal(data.colorPalette.find((s) => s.role === 'wall')?.hex, '#111111', 'a single side leaves the 2D wall colour alone');
  data = setWallFinish(data, 'all', paint('#336699'));
  assert.equal(data.colorPalette.find((s) => s.role === 'wall')?.hex, '#336699');
  assert.deepEqual(Object.keys(data.finishes!.walls!).sort(), ['all', 'north']);
  data = setFloorFinish(data, oak);
  const reset = resetWalls(data);
  assert.equal(reset.finishes?.walls, undefined);
  assert.deepEqual(reset.finishes?.floor, oak, 'the floor edit survives');
  assert.equal(reset.colorPalette.find((s) => s.role === 'wall')?.hex, '#111111');
  const all = resetAll(data);
  assert.equal(all.finishes, undefined);
  assert.deepEqual(all.colorPalette, base().colorPalette);
});

test('2.3 clearing one side keeps the others; invalid input changes nothing', () => {
  const data = setWallFinish(setWallFinish(base(), 'north', brick), 'south', brick);
  const cleared = setWallFinish(data, 'north', undefined);
  assert.deepEqual(Object.keys(cleared.finishes!.walls!), ['south']);
  const before = JSON.stringify(data);
  assert.equal(setWallFinish(data, 'up' as never, brick), data);
  assert.equal(setWallFinish(data, 'east', { materialId: 'lava' } as never), data);
  assert.equal(setFloorFinish(data, { materialId: 'lava' } as never), data);
  assert.equal(JSON.stringify(data), before);
});

test('2.5 a textured variant uses its base colour for the 2D swatch; an explicit colour wins', () => {
  assert.equal(finishBaseColor(oak), '#b98c5d');
  assert.equal(finishBaseColor({ ...oak, color: '#010203' }), '#010203');
  assert.equal(setFloorFinish(base(), oak).colorPalette.find((s) => s.role === 'flooring')?.hex, '#b98c5d');
  assert.equal(setWallFinish(base(), 'all', brick).colorPalette.find((s) => s.role === 'wall')?.hex, '#a2452f');
  // A palette without a wall swatch gets one so the 2D plan and thumbnail can follow.
  const bare = { ...base(), colorPalette: [] };
  assert.equal(setFloorFinish(bare, paint('#445566')).colorPalette.find((s) => s.role === 'flooring')?.hex, '#445566');
});

test('2.4 finishes survive save and load (JSON round-trip + sanitise)', () => {
  let data = setFloorFinish(base(), oak);
  data = setWallFinish(data, 'all', paint('#336699'));
  data = setWallFinish(data, 'west', brick);
  data.furniture = [{ ...data.furniture[0], color: '#ff0000', generatedColor: '#aaaaaa', frameColor: '#332211', finishId: 'wood-walnut' }];
  const loaded = sanitizeInteriorEdits(JSON.parse(JSON.stringify(data)) as InteriorDesignResult);
  assert.deepEqual(loaded, data);
});
