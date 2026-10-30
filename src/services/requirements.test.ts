import assert from 'node:assert/strict';
import test from 'node:test';
import { applyRemovals, effectiveRemovals, parseRequirements, parseRequirementsWithFallback } from './requirements';

test('removal phrasings all remove the TV', () => {
  for (const text of ['no TV', "don't want a TV", 'without television', 'Please avoid a media console', 'tv not needed', 'I do not want a tv in here']) {
    const r = parseRequirements(text);
    assert.deepEqual(r.remove, ['tv'], text);
    assert.deepEqual(r.add, [], text);
  }
});

test('addition phrasings add the desk', () => {
  for (const text of ['need a work desk', 'I want a home office', 'add a desk', 'my husband works from home', 'a study table please']) {
    assert.ok(parseRequirements(text).add.includes('desk'), text);
  }
});

test('mixed requests keep each item on its own side', () => {
  const r = parseRequirements('I need a desk and no TV, extra storage, reading nook');
  assert.deepEqual(r.add, ['desk', 'reading-nook', 'storage']);
  assert.deepEqual(r.remove, ['tv']);
  const b = parseRequirements("don't want a TV but need a desk");
  assert.deepEqual([b.add, b.remove], [['desk'], ['tv']]);
});

test('negation carries across "and" but resets on a positive cue', () => {
  assert.deepEqual(parseRequirements('no tv and rug').remove, ['tv', 'rug']);
  const r = parseRequirements('no tv and want plants');
  assert.deepEqual([r.remove, r.add], [['tv'], ['plants']]);
});

test('legacy phrases keep working', () => {
  assert.deepEqual(parseRequirements('Without TV').remove, ['tv']);
  assert.ok(parseRequirements('Reading nook').add.includes('reading-nook'));
  assert.ok(parseRequirements('extra storage').add.includes('storage'));
  assert.ok(parseRequirements('more storage please').add.includes('storage'));
});

test('flags: accessibility, pets, kids, with their cautions and notes', () => {
  const a = parseRequirements('step-free for wheelchair');
  assert.equal(a.accessibility, true);
  assert.deepEqual(a.avoid.sort(), ['loose-rugs', 'tight-clearance']);
  assert.ok(a.notes.length);
  const p = parseRequirements('we have two dogs and a toddler');
  assert.deepEqual([p.pets, p.kids, p.avoid], [true, true, ['fragile-decor']]);
  assert.deepEqual(parseRequirements('no pets, no kids').avoid, []);
});

test('flags remove implied items, but an explicit "add" wins', () => {
  assert.deepEqual(effectiveRemovals(parseRequirements('I have a cat')), ['plants', 'lamp']);
  assert.deepEqual(effectiveRemovals(parseRequirements('I have a cat but I want plants')), ['lamp']);
  assert.deepEqual(effectiveRemovals(parseRequirements('wheelchair user')), ['rug']);
});

test('empty, junk and unrelated text parse to nothing without throwing', () => {
  for (const text of ['', '   ', 'asdf qwer', 'make it cozy and warm', null as unknown as string]) {
    const r = parseRequirements(text);
    assert.deepEqual([r.add, r.remove, r.avoid, r.accessibility], [[], [], [], false], String(text));
  }
});

test('applyRemovals filters generated or AI pieces by name', () => {
  const pieces = [{ name: 'Media Console' }, { name: 'Textured Area Rug' }, { name: 'Accent Floor Lamp' }, { name: 'Potted Floor Plant' }, { name: 'Reading Chair' }, { name: 'Accent Armchair' }];
  const out = applyRemovals(pieces, parseRequirements('no tv, no rug, I have a dog'));
  assert.deepEqual(out.map((p) => p.name), ['Reading Chair', 'Accent Armchair']);
  assert.equal(applyRemovals(pieces, parseRequirements('')).length, pieces.length);
});

test('AI fallback runs only when the deterministic pass finds nothing, and is validated', async () => {
  let calls = 0;
  const ai = async () => { calls++; return { add: ['desk', 'bogus'], remove: ['tv'], pets: true }; };
  const hit = await parseRequirementsWithFallback('no tv', ai);
  assert.equal(calls, 0);
  assert.deepEqual(hit.remove, ['tv']);
  const miss = await parseRequirementsWithFallback('the family works remotely and has a retriever', ai);
  assert.equal(calls, 1);
  assert.deepEqual([miss.add, miss.remove, miss.pets], [['desk'], ['tv'], true]);
  assert.ok(miss.avoid.includes('fragile-decor'));
  assert.equal((await parseRequirementsWithFallback('short', ai)).add.length, 0);
  assert.equal(calls, 1);
  for (const bad of [async () => { throw new Error('x'); }, async () => null, async () => 'text']) {
    assert.deepEqual((await parseRequirementsWithFallback('something long enough here', bad as never)).add, []);
  }
});
