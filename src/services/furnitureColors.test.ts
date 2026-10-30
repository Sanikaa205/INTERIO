import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isRecoloured,
  resetFurnitureColors,
  setBodyColor,
  setFrameColor,
  setFrameFinish,
} from './furnitureColors';
import type { FurnitureItem } from '../types';

const chair = (): FurnitureItem => ({ id: 'c1', name: 'Chair', category: 'seating', x: 1, y: 1, width: 0.5, depth: 0.5, color: '#aaaaaa' });

test('3.5 recolouring the body keeps the generated colour for reset', () => {
  const edited = setBodyColor(chair(), '#ff0000');
  assert.equal(edited.color, '#ff0000');
  assert.equal(edited.generatedColor, '#aaaaaa');
  // A second edit must not overwrite what the generator chose.
  assert.equal(setBodyColor(edited, '#00ff00').generatedColor, '#aaaaaa');
});

test('3.5 body and frame colours are independent', () => {
  const edited = setFrameColor(setBodyColor(chair(), '#ff0000'), '#332211');
  assert.equal(edited.color, '#ff0000');
  assert.equal(edited.frameColor, '#332211');
  assert.equal(setFrameColor(edited, undefined).frameColor, undefined);
  assert.equal(setFrameColor(edited, undefined).color, '#ff0000');
});

test('3.5 invalid colours and unknown finishes change nothing', () => {
  const item = chair();
  assert.equal(setBodyColor(item, 'red'), item);
  assert.equal(setFrameColor(item, '#12'), item);
  assert.equal(setFrameFinish(item, 'nope'), item);
  assert.equal(setFrameFinish(item, 'wood-walnut').finishId, 'wood-walnut');
  assert.equal('finishId' in setFrameFinish(setFrameFinish(item, 'wood-walnut'), undefined), false);
});

test('3.5 reset restores the generated look and clears frame edits', () => {
  const edited = setFrameFinish(setFrameColor(setBodyColor(chair(), '#ff0000'), '#332211'), 'wood-walnut');
  assert.equal(isRecoloured(edited), true);
  const reset = resetFurnitureColors(edited);
  assert.deepEqual(reset, chair());
  assert.equal(isRecoloured(reset), false);
  assert.deepEqual(resetFurnitureColors(chair()), chair(), 'an untouched piece is unchanged');
});

test('3.5 edits never mutate their input', () => {
  const item = chair();
  const snapshot = JSON.stringify(item);
  setBodyColor(item, '#ff0000');
  setFrameColor(item, '#332211');
  setFrameFinish(item, 'wood-walnut');
  resetFurnitureColors({ ...item, generatedColor: '#123456' });
  assert.equal(JSON.stringify(item), snapshot);
});

test('3.5 colours survive a JSON save and load', () => {
  const edited = setFrameColor(setBodyColor(chair(), '#ff0000'), '#332211');
  assert.deepEqual(JSON.parse(JSON.stringify(edited)), edited);
});
