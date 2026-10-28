import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_VARIANT_BY_MATERIAL, MATERIAL_CATALOG, getMaterialVariant, materialsForSurface, variantsForSurface } from './materialCatalog';

const publicDir = join(process.cwd(), 'public');

test('variant ids are unique', () => {
  const ids = MATERIAL_CATALOG.map((variant) => variant.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('every texture file exists and stays small', () => {
  for (const variant of MATERIAL_CATALOG) {
    if (!variant.mapUrl) continue;
    const file = join(publicDir, variant.mapUrl);
    assert.ok(existsSync(file), `${variant.id}: missing ${variant.mapUrl}`);
    assert.ok(statSync(file).size <= 300 * 1024, `${variant.id}: texture over 300 KB`);
  }
});

test('legacy variant ids still resolve to the same material', () => {
  const legacy: Array<[string, 'paint' | 'tile' | 'marble' | 'wood']> = [
    ['paint-warm-white', 'paint'], ['paint-sage', 'paint'], ['paint-charcoal', 'paint'],
    ['tile-white-matte', 'tile'], ['marble-carrara', 'marble'], ['wood-light-oak', 'wood'],
  ];
  for (const [id, materialId] of legacy) {
    const variant = getMaterialVariant(id, materialId);
    assert.equal(variant.id, id);
    assert.equal(variant.materialId, materialId);
  }
});

test('defaults exist and every variant declares valid metadata', () => {
  for (const [materialId, id] of Object.entries(DEFAULT_VARIANT_BY_MATERIAL)) {
    const variant = MATERIAL_CATALOG.find((item) => item.id === id);
    assert.ok(variant, `default ${id} missing`);
    assert.equal(variant.materialId, materialId);
  }
  for (const variant of MATERIAL_CATALOG) {
    assert.ok(variant.surfaces.length > 0, variant.id);
    assert.ok(variant.category.length > 0, variant.id);
    assert.ok(/^#[0-9a-f]{6}$/i.test(variant.color), variant.id);
  }
});

test('library size per surface', () => {
  assert.ok(variantsForSurface('floor').length >= 12);
  assert.ok(variantsForSurface('wall').length >= 10);
  assert.ok(materialsForSurface('ceiling').includes('paint'));
  assert.ok(!materialsForSurface('floor').includes('brick'));
});
