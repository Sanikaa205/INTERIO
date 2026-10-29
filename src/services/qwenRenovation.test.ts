import test from 'node:test';
import assert from 'node:assert/strict';
import { createQwenRenovationPrompt, validateQwenRecommendations } from './qwenRenovation';

const valid = {
  designConcept: 'Warm modern bedroom with durable finishes.',
  colorPalette: [{ hex: '#f2e7d5', name: 'Warm ivory', role: 'wall', description: 'Brightens the room.' }],
  materials: ['Engineered oak'],
  furnitureChanges: ['Replace the bed with a storage frame.'],
  lightingChanges: ['Add warm bedside reading lights.'],
  renovationTasks: [{ step: 'Prepare', details: 'Protect existing openings and inspect surfaces.' }],
  estimatedCost: null,
};

test('validates structured Qwen renovation recommendations', () => {
  assert.deepEqual(validateQwenRecommendations(valid), valid);
});

test('rejects malformed palette colors and unsafe cost ranges', () => {
  assert.throws(() => validateQwenRecommendations({ ...valid, colorPalette: [{ ...valid.colorPalette[0], hex: 'red' }] }));
  assert.throws(() => validateQwenRecommendations({ ...valid, estimatedCost: { min: 100, max: 10, currency: 'USD', basis: 'Estimate' } }));
});

test('prompt includes selected room, style, budget, requirements, dimensions, and existing layout', () => {
  const prompt = createQwenRenovationPrompt({
    roomType: 'Kitchen', style: 'traditional', budget: '$8,000', conditionAndRequirements: 'Keep current cabinets.',
    dimensions: { width: 4, length: 5 }, existingFurniture: [{ name: 'Dining table', category: 'table' }],
  });
  for (const value of ['Kitchen', 'traditional', '$8,000', 'Keep current cabinets.', 'Dining table']) assert.ok(prompt.includes(value));
});
