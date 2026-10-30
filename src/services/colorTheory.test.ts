import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveColor } from './colorResolver';
import {
  assignColorRoles, complementary, contrastRatio, derivePalette, DEFAULT_COLOR_BASE, ensureContrast, hexToHsl,
  limitSaturation, relativeLuminance, shade, tint,
} from './colorTheory';

const hex = (name: string) => resolveColor(name).hex;
const hue = (h: string) => hexToHsl(h).h;
const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;
const HEX = /^#[0-9a-f]{6}$/;

test('luminance and contrast ratio match WCAG reference values', () => {
  assert.equal(relativeLuminance('#000000'), 0);
  assert.ok(near(relativeLuminance('#ffffff'), 1, 1e-9));
  assert.ok(near(contrastRatio('#000000', '#ffffff'), 21, 1e-6));
  assert.ok(near(contrastRatio('#777777', '#777777'), 1, 1e-9));
});

test('tint/shade move lightness the right way and keep hue', () => {
  const base = '#b86f52';
  assert.ok(hexToHsl(tint(base, 0.5)).l > hexToHsl(base).l);
  assert.ok(hexToHsl(shade(base, 0.5)).l < hexToHsl(base).l);
  assert.ok(near(hue(tint(base, 0.4)), hue(base), 3));
  assert.ok(near(((hue(complementary('#ff0000')) + 360) % 360), 180, 2));
  assert.ok(hexToHsl(limitSaturation('#00ff00', 0.7)).s <= 0.71);
});

test('ensureContrast reaches the target or returns the best attempt', () => {
  const out = ensureContrast('#f0f0f0', ['#ffffff'], 1.5);
  assert.ok(contrastRatio(out, '#ffffff') >= 1.5);
  const dark = ensureContrast('#101010', ['#000000'], 2);
  assert.ok(contrastRatio(dark, '#000000') >= 2);
  assert.equal(ensureContrast('#000000', ['#ffffff'], 3), '#000000');
  assert.equal(ensureContrast('#123456', [], 3), '#123456');
});

test('role assignment: single colour is hero; none yields nothing', () => {
  assert.deepEqual(assignColorRoles([]), { hero: null, wall: null, floor: null, accents: [] });
  assert.equal(assignColorRoles([hex('pink')]).hero, hex('pink'));
  assert.equal(assignColorRoles(['nonsense', '#12']).hero, null);
});

test('role assignment: navy, mustard, cream → hero/accent/wall', () => {
  const roles = assignColorRoles([hex('navy'), hex('mustard'), hex('cream')]);
  assert.equal(roles.wall, hex('cream'));
  assert.ok(roles.hero === hex('mustard') || roles.hero === hex('navy'));
  const rest = [roles.hero, ...roles.accents];
  assert.ok(rest.includes(hex('navy')) && rest.includes(hex('mustard')));
});

test('role assignment: timber tone becomes the floor, never the only hero', () => {
  const roles = assignColorRoles([hex('sage'), hex('warm oak')]);
  assert.equal(roles.floor, hex('warm oak'));
  assert.equal(roles.hero, hex('sage'));
  const onlyWood = assignColorRoles([hex('warm oak'), hex('cream')]);
  assert.ok(onlyWood.hero);
});

test('no user colours returns the style base unchanged', () => {
  const p = derivePalette([]);
  assert.equal(p.customised, false);
  assert.equal(p.wall, DEFAULT_COLOR_BASE.wall);
  assert.equal(p.floor, DEFAULT_COLOR_BASE.floor);
  assert.equal(p.accent, DEFAULT_COLOR_BASE.accent);
});

test('pink: hero is pink, wall a pale pink tint, floor pale', () => {
  const p = derivePalette([hex('pink')]);
  assert.equal(p.customised, true);
  assert.ok(near(hue(p.hero), hue(hex('pink')), 3));
  assert.ok(near(hue(p.wall), hue(hex('pink')), 6) && hexToHsl(p.wall).l > 0.9);
  assert.ok(hexToHsl(p.floor).l >= 0.7);
});

test('navy: dark hero gets a light floor and visible furniture', () => {
  const p = derivePalette([hex('navy')]);
  assert.ok(hexToHsl(p.floor).l > 0.6);
  assert.ok(contrastRatio(p.hero, p.floor) >= 3);
});

test('neon green is muted for large surfaces', () => {
  const p = derivePalette(['#00ff00']);
  assert.ok(hexToHsl(p.hero).s <= 0.76);
});

test('near-black hero keeps a light wall and floor', () => {
  const p = derivePalette(['#1a1a1a']);
  assert.equal(p.hero, '#1a1a1a');
  assert.ok(hexToHsl(p.wall).l > 0.8);
  assert.ok(hexToHsl(p.floor).l >= 0.7);
});

test('near-white hero on a near-white floor still yields visible furniture (1.5)', () => {
  const p = derivePalette(['#fafafa']);
  assert.ok(contrastRatio(p.hero, p.floor) >= 1.2, `hero ${p.hero} floor ${p.floor}`);
    for (const piece of [p.heroSoft, p.wood, p.accent]) assert.ok(contrastRatio(piece, p.floor) >= 1.1, piece);
});

test('three colours: every role comes out as valid hex and pieces stay visible', () => {
  const p = derivePalette([hex('navy'), hex('mustard'), hex('cream')]);
  for (const v of [p.wall, p.floor, p.hero, p.heroSoft, p.accent, p.neutral, p.wood, p.trim]) assert.match(v, HEX);
  assert.equal(p.wall, hex('cream'));
  assert.ok(contrastRatio(p.hero, p.floor) >= 1.2);
});

test('derivePalette never throws or yields invalid hex for odd inputs', () => {
  for (const inputs of [['#000000'], ['#ffffff'], ['#ff00ff', '#00ffff'], ['#808080'], ['garbage'], ['#123']]) {
    const p = derivePalette(inputs);
    for (const v of [p.wall, p.floor, p.hero, p.heroSoft, p.accent, p.neutral, p.wood, p.trim]) assert.match(v, HEX, JSON.stringify(inputs));
  }
});
