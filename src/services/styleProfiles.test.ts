import assert from 'node:assert/strict';
import test from 'node:test';
import type { DesignStyle } from '../types';
import { derivePalette } from './colorTheory';
import { createRoomFurnitureSuggestions } from './interiorFurniture';
import { defaultRoomOpenings, optimizeFurnitureLayout, roomDoorClearance } from './layoutOptimizer';
import { getStyleProfile, STYLE_PROFILES } from './styleProfiles';

const STYLES = Object.keys(STYLE_PROFILES) as DesignStyle[];
const palette = [
  { hex: '#1E293B', name: 'p', role: 'primary' as const }, { hex: '#F8FAFC', name: 'w', role: 'wall' as const },
  { hex: '#6366F1', name: 'a', role: 'accent' as const }, { hex: '#94A3B8', name: 's', role: 'secondary' as const },
  { hex: '#C2A382', name: 'f', role: 'flooring' as const },
];
const budget = '$15,000 - $25,000';

test('every style has a complete profile', () => {
  assert.equal(STYLES.length, 6);
  for (const id of STYLES) {
    const p = STYLE_PROFILES[id];
    assert.equal(p.id, id);
    for (const v of [p.label, p.form, p.legs, ...Object.values(p.materials), ...Object.values(p.names)]) assert.ok(v && String(v).trim(), `${id} has an empty field`);
    assert.ok(p.scale > 0.8 && p.scale < 1.2);
    for (const s of p.signature) {
      assert.match(s.id, /^sig-/);
      assert.ok(s.width > 0 && s.depth > 0 && s.minArea > 0 && s.minSide > 0);
    }
  }
  assert.equal(getStyleProfile('nonsense').id, 'modern');
});

test('styles differ in names, materials and at least one piece in the same room', () => {
  const sets = STYLES.map((s) => createRoomFurnitureSuggestions('Living Room', 5, 4.5, s, palette, '', budget));
  const sofas = new Set(sets.map((set) => set.find((p) => p.role === 'sofa')?.name));
  assert.equal(sofas.size, 6);
  const woods = new Set(sets.map((set) => set.find((p) => p.role === 'coffee-table')?.material));
  assert.equal(woods.size, 6);
  assert.ok(STYLES.filter((s) => s !== 'minimal').every((s, i) => sets[STYLES.indexOf(s)].some((p) => p.id.startsWith('sig-')), `signature pieces missing`));
  assert.ok(!sets[STYLES.indexOf('minimal')].some((p) => p.role === 'plant'), 'minimal leaves out the plant');
});

test('signature pieces are skipped in small rooms, essential budgets, and wet rooms', () => {
  const sig = (set: { id?: string }[]) => set.filter((p) => p.id?.startsWith('sig-')).length;
  assert.equal(sig(createRoomFurnitureSuggestions('Living Room', 3, 3, 'traditional', palette, '', budget)), 0);
  assert.equal(sig(createRoomFurnitureSuggestions('Living Room', 5, 4.5, 'traditional', palette, '', '$5,000 - $10,000')), 0);
  assert.ok(sig(createRoomFurnitureSuggestions('Living Room', 5, 4.5, 'traditional', palette, '', budget)) > 0);
  for (const room of ['Kitchen', 'Bathroom']) assert.equal(sig(createRoomFurnitureSuggestions(room, 6, 5, 'traditional', palette, '', budget)), 0);
});

test('signature pieces never stop the optimizer placing everything', () => {
  for (const style of STYLES) for (const room of ['Bedroom', 'Living Room', 'Dining Room', 'Study']) {
    for (let w = 2.6; w <= 7; w += 0.8) for (let d = 2.6; d <= 7; d += 0.8) {
      const suggestions = createRoomFurnitureSuggestions(room, w, d, style, palette, '', budget);
      if (!suggestions.some((p) => p.id?.startsWith('sig-'))) continue;
      const placed = optimizeFurnitureLayout(suggestions, { width: w, depth: d, openings: defaultRoomOpenings(w, d), doorClearance: roomDoorClearance(w, d) });
      assert.equal(placed.length, suggestions.length, `${style} ${room} ${w.toFixed(1)}x${d.toFixed(1)} dropped pieces`);
    }
  }
});

test('extra storage is still added when only a signature cabinet is present', () => {
  const out = createRoomFurnitureSuggestions('Living Room', 6, 5, 'traditional', palette, 'extra storage, no tv', budget);
  assert.ok(out.some((p) => p.id === 'extra-storage'));
});

test('same colour, different style gives visibly different palettes (3.3)', () => {
  const pink = '#e8a0b4';
  const base = { wall: '#f4f1ea', floor: '#b0a090', neutral: '#d8d1c6', wood: '#b99b78', accent: '#7d8372', trim: '#fbfaf7' };
  const by = Object.fromEntries(STYLES.map((s) => [s, derivePalette([pink], base, STYLE_PROFILES[s].colorTweak)]));
  const sat = (hex: string) => { const n = (i: number) => parseInt(hex.slice(i, i + 2), 16); return Math.max(n(1), n(3), n(5)) - Math.min(n(1), n(3), n(5)); };
  assert.ok(sat(by.industrial.hero) < sat(by.modern.hero), 'industrial mutes the hero');
  assert.ok(sat(by.japandi.hero) < sat(by.modern.hero), 'japandi softens the hero');
  assert.notEqual(by.scandinavian.floor, by.traditional.floor);
  assert.notEqual(by.traditional.wood, by.modern.wood);
  assert.notEqual(by.scandinavian.wood, by.modern.wood);
});
