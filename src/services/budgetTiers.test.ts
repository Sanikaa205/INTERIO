import assert from 'node:assert/strict';
import test from 'node:test';
import { BUDGET_TIERS, extrasFor, formatPriceRange, getBudgetTier, priceRange, totalPriceRange } from './budgetTiers';

test('every UI budget id maps to its own tier; unknown strings use the default', () => {
  assert.equal(getBudgetTier('$5,000 - $10,000').id, 'essential');
  assert.equal(getBudgetTier('$15,000 - $25,000').id, 'considered');
  assert.equal(getBudgetTier('$35,000 - $60,000').id, 'premium');
  assert.equal(getBudgetTier('$75,000+').id, 'bespoke');
  for (const junk of ['', 'whatever', undefined as unknown as string, '$1']) assert.equal(getBudgetTier(junk).id, 'considered');
  assert.equal(getBudgetTier('Luxury').id, 'bespoke');
  assert.equal(getBudgetTier('essential').id, 'essential');
});

test('tier settings match the values the generator has always used', () => {
  assert.deepEqual([BUDGET_TIERS.essential.sizeFactor, BUDGET_TIERS.considered.sizeFactor, BUDGET_TIERS.premium.sizeFactor, BUDGET_TIERS.bespoke.sizeFactor], [0.97, 1, 1.035, 1.07]);
  assert.deepEqual([BUDGET_TIERS.essential.priceFactor, BUDGET_TIERS.considered.priceFactor, BUDGET_TIERS.premium.priceFactor, BUDGET_TIERS.bespoke.priceFactor], [0.62, 1, 2.4, 5]);
  assert.deepEqual([BUDGET_TIERS.essential.accentHex, BUDGET_TIERS.considered.accentHex, BUDGET_TIERS.premium.accentHex, BUDGET_TIERS.bespoke.accentHex], ['#9B9A92', null, '#728277', '#B48A4A']);
  assert.deepEqual([BUDGET_TIERS.essential.gradeLabel, BUDGET_TIERS.considered.gradeLabel], ['essential tier', 'considered tier']);
});

test('prices scale with the tier and format as before', () => {
  const sofa = (id: 'essential' | 'considered' | 'premium' | 'bespoke') => priceRange('seating', BUDGET_TIERS[id]);
  assert.equal(formatPriceRange(sofa('considered'), 'considered tier'), '$770–$1,485 considered tier');
  assert.ok(sofa('essential').high < sofa('considered').low * 1.5);
  assert.ok(sofa('premium').low > sofa('considered').high);
  assert.ok(sofa('bespoke').low > sofa('premium').high);
  assert.equal(priceRange('mystery', BUDGET_TIERS.considered).low, 350);
});

test('totals add up per piece', () => {
  const items = [{ category: 'bed' }, { category: 'seating' }, { category: 'decor' }];
  const t = BUDGET_TIERS.considered;
  const sum = items.map((i) => priceRange(i.category, t));
  assert.deepEqual(totalPriceRange(items, t), { low: sum.reduce((a, r) => a + r.low, 0), high: sum.reduce((a, r) => a + r.high, 0) });
  assert.deepEqual(totalPriceRange([], t), { low: 0, high: 0 });
});

test('higher tiers add extra pieces only to rooms big enough; lean tiers add none', () => {
  assert.equal(extrasFor(BUDGET_TIERS.essential, 'living', 8, 8).length, 0);
  assert.equal(extrasFor(BUDGET_TIERS.considered, 'living', 8, 8).length, 0);
  assert.ok(extrasFor(BUDGET_TIERS.premium, 'living', 6, 5).length >= 1);
  assert.ok(extrasFor(BUDGET_TIERS.bespoke, 'living', 6, 5).length > extrasFor(BUDGET_TIERS.premium, 'living', 6, 5).length);
  assert.equal(extrasFor(BUDGET_TIERS.bespoke, 'living', 3, 3).length, 0);
  for (const tier of Object.values(BUDGET_TIERS)) for (const e of tier.extras) assert.match(e.id, /^bud-/);
});
