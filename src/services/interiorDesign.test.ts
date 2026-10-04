import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { optimizeFurnitureLayout } from './layoutOptimizer';
import { FURNITURE_ASSETS, matchFurnitureAsset } from './furnitureAssets';

test('optimizer keeps all generated furniture inside room bounds without overlap', () => {
  const room = { width: 5, depth: 5 };
  const layout = optimizeFurnitureLayout([
    { name: 'Sofa', category: 'seating', width: 2.1, depth: 0.9 },
    { name: 'Coffee Table', category: 'table', width: 1, depth: 0.6 },
    { name: 'Cabinet', category: 'storage', width: 1.2, depth: 0.4 },
  ], room);
  assert.equal(layout.length, 3);
  const bounds = (item: (typeof layout)[number]) => ({
    x: item.x, y: item.y,
    width: (item.rotation || 0) % 180 ? item.depth : item.width,
    depth: (item.rotation || 0) % 180 ? item.width : item.depth,
  });
  for (const item of layout) {
    const rect = bounds(item);
    assert.ok(rect.x >= 0 && rect.y >= 0);
    assert.ok(rect.x + rect.width <= room.width + 1e-6);
    assert.ok(rect.y + rect.depth <= room.depth + 1e-6);
  }
  for (let i = 0; i < layout.length; i++) for (let j = i + 1; j < layout.length; j++) {
    const a = bounds(layout[i]), b = bounds(layout[j]);
    assert.ok(a.x + a.width <= b.x + 1e-6 || b.x + b.width <= a.x + 1e-6 || a.y + a.depth <= b.y + 1e-6 || b.y + b.depth <= a.y + 1e-6);
    assert.ok(a.x + a.width + 0.75 <= b.x + 1e-6 || b.x + b.width + 0.75 <= a.x + 1e-6 || a.y + a.depth + 0.75 <= b.y + 1e-6 || b.y + b.depth + 0.75 <= a.y + 1e-6);
  }
});

test('optimizer tries quarter turns when an item fits only after rotation', () => {
  const [item] = optimizeFurnitureLayout([{ name: 'Long Sofa', category: 'seating', width: 2.4, depth: 0.9 }], { width: 2, depth: 3 });
  assert.ok(item);
  assert.equal(item.rotation, 90);
  assert.ok(item.x + item.depth <= 2);
  assert.ok(item.y + item.width <= 3);
});

test('optimizer leaves a clearance around doors and windows', () => {
  const [item] = optimizeFurnitureLayout([{ name: 'Console', category: 'storage', width: 1.2, depth: 0.4, preferredWall: 'north' }], {
    width: 4, depth: 4, openings: [{ wall: 'north', start: 1, end: 3, type: 'door' }],
  });
  assert.ok(item);
  const x1 = item.x, x2 = item.x + item.width;
  assert.ok(item.y >= 0.75 || x2 <= 1 - 0.75 || x1 >= 3 + 0.75);
});

test('asset matching selects a local GLB and safely reports unmatched categories', () => {
  assert.equal(matchFurnitureAsset({ name: 'Velvet Sofa', category: 'seating' })?.url, '/assets/furniture/sofa.glb');
  assert.equal(matchFurnitureAsset({ name: 'Ceiling fan', category: 'electronics' }), null);
});

test('every catalogued local furniture asset exists as a GLB 2.0 file', () => {
  for (const asset of FURNITURE_ASSETS) {
    const filename = path.join(process.cwd(), 'public', asset.url.replace(/^\//, ''));
    const bytes = fs.readFileSync(filename);
    assert.equal(bytes.toString('ascii', 0, 4), 'glTF');
    assert.equal(bytes.readUInt32LE(4), 2);
    assert.equal(bytes.readUInt32LE(8), bytes.length);
  }
});
