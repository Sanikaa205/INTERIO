import assert from 'node:assert/strict';
import test from 'node:test';
import { hexToHsl, hslToHex, normalizeHex, resolveColor } from './colorResolver';

test('resolves hex in long and short form, any case', () => {
  assert.deepEqual(resolveColor('#1A1A1A'), { input: '#1A1A1A', hex: '#1a1a1a', name: '#1A1A1A', source: 'hex' });
  assert.equal(resolveColor('#fa0').hex, '#ffaa00');
  assert.equal(resolveColor('ff00ff').source, 'hex');
});

test('resolves CSS and interior names, with whitespace and case tolerance', () => {
  assert.equal(resolveColor('Pink').source, 'named');
  assert.match(resolveColor('  PINK  ').hex, /^#[0-9a-f]{6}$/);
  assert.equal(resolveColor('sage green').hex, resolveColor('sage').hex); // base word wins over trailing colour word
  assert.equal(resolveColor('mistyrose').source, 'named');
  assert.equal(resolveColor('terracotta').hex, '#b86f52');
  assert.equal(resolveColor('burnt sienna').source, 'named');
});

test('modifier phrases shift lightness and saturation of the base colour', () => {
  const base = hexToHsl(resolveColor('rose').hex);
  const dusty = resolveColor('dusty rose');
  assert.equal(dusty.source, 'phrase');
  assert.ok(hexToHsl(dusty.hex).s < base.s);
  assert.ok(hexToHsl(resolveColor('light blue').hex).l > hexToHsl(resolveColor('blue').hex).l - 0.001);
  assert.ok(hexToHsl(resolveColor('dark teal').hex).l < hexToHsl(resolveColor('teal').hex).l);
  assert.ok(hexToHsl(resolveColor('pastel mint').hex).l >= 0.8);
  assert.ok(hexToHsl(resolveColor('deep navy').hex).l < hexToHsl(resolveColor('navy').hex).l);
});

test('multiple modifiers and multi-word bases both work', () => {
  assert.equal(resolveColor('light warm grey').source, 'phrase');
  assert.equal(resolveColor('deep burnt orange').source, 'phrase');
  assert.equal(resolveColor('dusty rose').hex, resolveColor('Dusty   Rose').hex);
});

test('unknown or empty input is reported as unresolved, never thrown', () => {
  for (const bad of ['', '   ', 'xyzzy', 'dusty xyzzy', '#12', '##ffffff', 'undefined colour']) {
    const r = resolveColor(bad);
    assert.equal(r.source, 'unresolved', bad);
    assert.equal(r.hex, '');
  }
  assert.doesNotThrow(() => resolveColor(null as unknown as string));
});

test('hex/HSL helpers round-trip', () => {
  for (const hex of ['#ff0000', '#00ff00', '#0000ff', '#808080', '#d6a6a2', '#123456']) {
    const back = hslToHex(hexToHsl(hex));
    const d = (a: string, b: string) => Math.abs(parseInt(a, 16) - parseInt(b, 16));
    for (const i of [1, 3, 5]) assert.ok(d(hex.slice(i, i + 2), back.slice(i, i + 2)) <= 1, `${hex} -> ${back}`);
  }
  assert.equal(normalizeHex('zzz'), null);
});

test('AI fallback resolves only unresolved inputs, in one batch, and validates replies', async () => {
  const { resolveColorsWithFallback } = await import('./colorResolver');
  const calls: string[][] = [];
  const out = await resolveColorsWithFallback(['pink', 'Quantum Teal', 'blorp', ''], async (phrases) => {
    calls.push(phrases);
    return { 'quantum teal': '#18A0A0', blorp: 'not-a-colour' };
  });
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], ['Quantum Teal', 'blorp']);
  assert.equal(out[0].source, 'named');
  assert.deepEqual([out[1].source, out[1].hex], ['ai', '#18a0a0']);
  assert.equal(out[2].source, 'unresolved');
  assert.equal(out[3].source, 'unresolved');
});

test('AI fallback is skipped, or fails safe, without a key or on error', async () => {
  const { resolveColorsWithFallback } = await import('./colorResolver');
  assert.equal((await resolveColorsWithFallback(['zzqq'])).at(0)?.source, 'unresolved');
  assert.equal((await resolveColorsWithFallback(['zzqq'], async () => { throw new Error('boom'); }))[0].source, 'unresolved');
  assert.equal((await resolveColorsWithFallback(['zzqq'], async () => null))[0].source, 'unresolved');
  let called = false;
  await resolveColorsWithFallback(['pink', '#fff'], async () => { called = true; return {}; });
  assert.equal(called, false);
});
