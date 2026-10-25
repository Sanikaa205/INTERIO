import assert from 'node:assert/strict';
import test from 'node:test';
import type { FloorPlanResult, SurfaceFinish } from '../../types';
import {
  getRoomFinishOverride,
  getWallFinishOverride,
  isValidHexColor,
  isValidRoughness,
  isValidScale,
  resolveSurfaceFinish,
} from './finishes';

const fallback: SurfaceFinish = { materialId: 'paint', color: '#ffffff', roughness: 0.8 };

test('validates supported finish values', () => {
  assert.equal(isValidHexColor('#12aBc0'), true);
  assert.equal(isValidHexColor('#fff'), false);
  assert.equal(isValidHexColor('red'), false);
  assert.equal(isValidScale(0.25), true);
  assert.equal(isValidScale(0), false);
  assert.equal(isValidScale(Infinity), false);
  assert.equal(isValidRoughness(0), true);
  assert.equal(isValidRoughness(1), true);
  assert.equal(isValidRoughness(1.1), false);
});

test('reads and sanitizes a room override', () => {
  const finishes = {
    rooms: {
      kitchen: { floor: { materialId: 'tile', color: '#abcdef', scale: 0.5 } },
    },
  };

  assert.deepEqual(getRoomFinishOverride(finishes, 'kitchen', 'floor'), {
    materialId: 'tile',
    color: '#abcdef',
    scale: 0.5,
  });
  assert.equal(getRoomFinishOverride(finishes, 'kitchen', 'ceiling'), undefined);
  assert.equal(getRoomFinishOverride(finishes, 'missing', 'floor'), undefined);
});

test('reads a wall override and ignores malformed saved data', () => {
  const malformed: unknown = {
    walls: {
      good: { materialId: 'wood', variantId: 'oak' },
      bad: { materialId: 'unknown', color: '#fff' },
    },
  };

  assert.deepEqual(getWallFinishOverride(malformed, 'good'), {
    materialId: 'wood',
    variantId: 'oak',
  });
  assert.equal(getWallFinishOverride(malformed, 'bad'), undefined);
  assert.equal(getWallFinishOverride(undefined, 'good'), undefined);
});

test('resolves an override over a copied fallback without mutating either input', () => {
  const override: SurfaceFinish = { materialId: 'marble', color: '#123456' };
  const result = resolveSurfaceFinish(override, fallback);

  assert.deepEqual(result, {
    materialId: 'marble',
    color: '#123456',
    roughness: 0.8,
  });
  assert.deepEqual(override, { materialId: 'marble', color: '#123456' });
  assert.deepEqual(fallback, { materialId: 'paint', color: '#ffffff', roughness: 0.8 });
});

test('returns a copy of the fallback when no override is present', () => {
  const result = resolveSurfaceFinish(undefined, fallback);
  assert.deepEqual(result, fallback);
  assert.notEqual(result, fallback);
});

test('legacy plans without finishes resolve to their existing defaults', () => {
  const legacyPlan: FloorPlanResult = {
    plotWidth: 6,
    plotLength: 4,
    totalBuiltArea: 24,
    rooms: [{ id: 'legacy-room', name: 'Legacy room', type: 'living-room', x: 0, y: 0, width: 6, height: 4 }],
  };

  assert.equal(getRoomFinishOverride(legacyPlan.finishes, 'legacy-room', 'floor'), undefined);
  assert.equal(getWallFinishOverride(legacyPlan.finishes, 'legacy-wall'), undefined);
  assert.deepEqual(resolveSurfaceFinish(undefined, fallback), fallback);
});

test('malformed persisted finish trees never throw or create an override', () => {
  const malformed: unknown = {
    rooms: { room: { floor: { materialId: 'tile', color: 42, scale: -1, roughness: 4 } } },
    walls: 'not-a-map',
  };

  assert.doesNotThrow(() => getRoomFinishOverride(malformed, 'room', 'floor'));
  assert.deepEqual(getRoomFinishOverride(malformed, 'room', 'floor'), { materialId: 'tile' });
  assert.doesNotThrow(() => getWallFinishOverride(malformed, 'wall'));
  assert.equal(getWallFinishOverride(malformed, 'wall'), undefined);
});
