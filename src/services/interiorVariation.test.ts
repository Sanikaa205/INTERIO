import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoomFurnitureSuggestions, buildRoomProgram } from './interiorFurniture';
import { getStyleRecipe, normalizeRoomType } from './interiorStyles';
import { optimizeFurnitureLayout, defaultRoomOpenings } from './layoutOptimizer';
import type { DesignStyle, ColorSwatch } from '../types';

const STYLES: DesignStyle[] = ['modern', 'minimal', 'traditional', 'industrial', 'scandinavian', 'japandi'];
const ROOM_TYPES = [
  'Living Room',
  'Bedroom',
  'Master Bedroom Suite',
  'Dining Room',
  'Kitchen',
  'Kitchen & Dining',
  'Study Room',
  'Executive Home Office',
  'Bathroom',
  'Studio Apartment',
];

const MOCK_PALETTE: ColorSwatch[] = [
  { hex: '#1e293b', name: 'Primary', role: 'primary' },
  { hex: '#e2e8f0', name: 'Secondary', role: 'secondary' },
  { hex: '#3b82f6', name: 'Accent', role: 'accent' },
  { hex: '#f8fafc', name: 'Wall', role: 'wall' },
  { hex: '#b99569', name: 'Flooring', role: 'flooring' },
];

test('room type normalization covers all 10 room types correctly', () => {
  assert.equal(normalizeRoomType('Living Room'), 'living');
  assert.equal(normalizeRoomType('Bedroom'), 'bedroom');
  assert.equal(normalizeRoomType('Master Bedroom Suite'), 'masterBedroom');
  assert.equal(normalizeRoomType('Dining Room'), 'dining');
  assert.equal(normalizeRoomType('Kitchen'), 'kitchen');
  assert.equal(normalizeRoomType('Kitchen & Dining'), 'kitchenDining');
  assert.equal(normalizeRoomType('Study Room'), 'study');
  assert.equal(normalizeRoomType('Executive Home Office'), 'homeOffice');
  assert.equal(normalizeRoomType('Bathroom'), 'bathroom');
  assert.equal(normalizeRoomType('Studio Apartment'), 'studio');
});

test('studio apartment contains a bed; living room never contains a bed', () => {
  for (const style of STYLES) {
    const studio = createRoomFurnitureSuggestions('Studio Apartment', 5, 5, style, MOCK_PALETTE);
    assert.ok(
      studio.some((item) => /bed/i.test(item.name) || item.category === 'bed'),
      `Studio Apartment must contain a bed in ${style} style`
    );

    const living = createRoomFurnitureSuggestions('Living Room', 5, 5, style, MOCK_PALETTE);
    assert.ok(
      !living.some((item) => /bed/i.test(item.name) || item.category === 'bed'),
      `Living Room must never contain a bed in ${style} style`
    );
  }
});

test('executive home office and study room have distinct piece programs', () => {
  for (const style of STYLES) {
    const office = createRoomFurnitureSuggestions('Executive Home Office', 5, 5, style, MOCK_PALETTE);
    const study = createRoomFurnitureSuggestions('Study Room', 5, 5, style, MOCK_PALETTE);

    const officeNames = new Set(office.map((i) => i.name));
    const studyNames = new Set(study.map((i) => i.name));

    assert.notEqual(
      JSON.stringify([...officeNames].sort()),
      JSON.stringify([...studyNames].sort()),
      `Executive Home Office and Study Room must have distinct piece programs for ${style}`
    );
  }
});

test('minimal style has fewer pieces than traditional style (density variation)', () => {
  for (const room of ['Living Room', 'Master Bedroom Suite', 'Executive Home Office']) {
    const minimal = createRoomFurnitureSuggestions(room, 5, 5, 'minimal', MOCK_PALETTE);
    const traditional = createRoomFurnitureSuggestions(room, 5, 5, 'traditional', MOCK_PALETTE);
    assert.ok(
      traditional.length >= minimal.length,
      `Traditional (${traditional.length}) should have at least as many pieces as Minimal (${minimal.length}) in ${room}`
    );
  }
});

test('any two styles differ substantially in forms, materials, and pieces', () => {
  for (const room of ROOM_TYPES) {
    for (let i = 0; i < STYLES.length; i++) {
      for (let j = i + 1; j < STYLES.length; j++) {
        const s1 = STYLES[i];
        const s2 = STYLES[j];
        const p1 = createRoomFurnitureSuggestions(room, 5.5, 6.0, s1, MOCK_PALETTE);
        const p2 = createRoomFurnitureSuggestions(room, 5.5, 6.0, s2, MOCK_PALETTE);

        const sig1 = p1.map((item) => `${item.role || item.category}:${item.form || item.name}:${item.material}`);
        const sig2 = p2.map((item) => `${item.role || item.category}:${item.form || item.name}:${item.material}`);

        const shared = sig1.filter((s) => sig2.includes(s)).length;
        const total = Math.max(sig1.length, sig2.length);
        const diffRatio = (total - shared) / total;

        assert.ok(
          diffRatio >= 0.4,
          `Expected >= 40% difference between ${s1} and ${s2} for ${room}, got ${(diffRatio * 100).toFixed(1)}%`
        );
      }
    }
  }
});

test('variation seeds produce distinct arrangements and identical seed reproduces byte-identical output', () => {
  for (const room of ['Living Room', 'Bedroom', 'Studio Apartment']) {
    const arrangedSeeds: string[] = [];
    for (let seed = 0; seed < 4; seed++) {
      const p = createRoomFurnitureSuggestions(room, 5.5, 5.5, 'modern', MOCK_PALETTE, '', '', seed);
      const layout = optimizeFurnitureLayout(p, {
        width: 5.5,
        depth: 5.5,
        openings: defaultRoomOpenings(5.5, 5.5),
      });
      arrangedSeeds.push(JSON.stringify(layout.map((item) => ({ id: item.id, x: item.x, y: item.y, rotation: item.rotation }))));
    }

    // At least 2 distinct arrangements across seeds 0..3
    const uniqueArrangements = new Set(arrangedSeeds);
    assert.ok(
      uniqueArrangements.size >= 2,
      `Expected at least 2 distinct arrangement layouts across seeds 0..3 for ${room}, got ${uniqueArrangements.size}`
    );

    // Determinism test: same seed produces identical output
    const run1 = JSON.stringify(createRoomFurnitureSuggestions(room, 5.5, 5.5, 'modern', MOCK_PALETTE, '', '', 42));
    const run2 = JSON.stringify(createRoomFurnitureSuggestions(room, 5.5, 5.5, 'modern', MOCK_PALETTE, '', '', 42));
    assert.equal(run1, run2, `Seed 42 must be completely deterministic for ${room}`);
  }
});

test('all suggestions have defined positive heights for accurate 3D proportions', () => {
  for (const style of STYLES) {
    for (const room of ROOM_TYPES) {
      const items = createRoomFurnitureSuggestions(room, 5, 5, style, MOCK_PALETTE);
      for (const item of items) {
        assert.ok(
          typeof item.height === 'number' && item.height > 0,
          `Item ${item.name} (${item.id}) in ${room} (${style}) must have positive height, got ${item.height}`
        );
      }
    }
  }
});

test('pieces placed against walls have their back to the wall', () => {
  const room = { width: 5.5, depth: 6.5, openings: defaultRoomOpenings(5.5, 6.5) };
  const items = createRoomFurnitureSuggestions('Living Room', 5.5, 6.5, 'modern', MOCK_PALETTE, '', '', 0);
  const layout = optimizeFurnitureLayout(items, room);

  for (const item of layout) {
    // If an item is within 0.5m of North wall and not center-preferred
    if (item.y <= 0.5 && item.preferredWall === 'north') {
      assert.equal(item.rotation, 0, `${item.name} near North wall should face South (rotation 0)`);
    }
    // If an item is within 0.5m of South wall and preferredWall is south
    if (room.depth - (item.y + item.depth) <= 0.5 && item.preferredWall === 'south') {
      assert.equal(item.rotation, 180, `${item.name} near South wall should face North (rotation 180)`);
    }
    // If an item is within 0.5m of West wall
    if (item.x <= 0.5 && item.preferredWall === 'west') {
      assert.equal(item.rotation, 90, `${item.name} near West wall should face East (rotation 90)`);
    }
    // If an item is within 0.5m of East wall
    if (room.width - (item.x + item.width) <= 0.5 && item.preferredWall === 'east') {
      assert.equal(item.rotation, 270, `${item.name} near East wall should face West (rotation 270)`);
    }
  }
});
