import test from 'node:test';
import assert from 'node:assert/strict';
import { hexToHsv, hexToRgb, hsvToHex, normalizeHex, rgbToHex, rgbToHsv } from './colorUtils';

test('normalizeHex accepts short, long and unprefixed forms', () => {
  assert.equal(normalizeHex('#fff'), '#ffffff');
  assert.equal(normalizeHex('abc'), '#aabbcc');
  assert.equal(normalizeHex('#AABBCC'), '#aabbcc');
  assert.equal(normalizeHex('  c5b9a0 '), '#c5b9a0');
});

test('normalizeHex returns null for invalid input without throwing', () => {
  for (const bad of ['', '#', '#ff', '#ffff', '#fffff', '#ggg', 'red', '#1234567', null, undefined, 12, {}]) {
    assert.equal(normalizeHex(bad), null, String(bad));
  }
});

test('hex <-> rgb', () => {
  assert.deepEqual(hexToRgb('#ff8000'), { r: 255, g: 128, b: 0 });
  assert.equal(hexToRgb('nope'), null);
  assert.equal(rgbToHex({ r: 255, g: 128, b: 0 }), '#ff8000');
  assert.equal(rgbToHex({ r: -5, g: 300, b: 12.6 }), '#00ff0d');
  assert.equal(rgbToHex({ r: NaN, g: 0, b: 0 }), '#000000');
});

test('hsv conversions', () => {
  assert.deepEqual(rgbToHsv({ r: 255, g: 0, b: 0 }), { h: 0, s: 1, v: 1 });
  assert.deepEqual(rgbToHsv({ r: 0, g: 0, b: 0 }), { h: 0, s: 0, v: 0 });
  assert.equal(hsvToHex({ h: 120, s: 1, v: 1 }), '#00ff00');
  assert.equal(hsvToHex({ h: 360, s: 1, v: 1 }), '#ff0000');
  assert.equal(hsvToHex({ h: 0, s: 0, v: 1 }), '#ffffff');
  assert.equal(hexToHsv('x'), null);
});

test('hex round-trips through hsv', () => {
  for (const hex of ['#e7e1d8', '#53504b', '#b98c5d', '#123456', '#fedcba', '#000000', '#ffffff']) {
    assert.equal(hsvToHex(hexToHsv(hex)!), hex);
  }
});
