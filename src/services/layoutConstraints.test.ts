import assert from 'node:assert/strict';
import test from 'node:test';
import { parseRequirementsLocally, mergeConstraints, describeConstraints, emptyConstraints, type ProgramRoom } from './layoutConstraints';
import { validateTopology } from './floorPlanTopology';

// server.ts starts listening on import unless this is set.
process.env.INTERIO_NO_LISTEN = '1';

const PROGRAM: ProgramRoom[] = [
  { name: 'Living & Lounge', type: 'living-room' }, { name: 'Master Bedroom', type: 'master-bedroom' },
  { name: 'Guest Bedroom', type: 'bedroom' }, { name: 'Kitchen Area', type: 'kitchen' }, { name: 'Bathroom', type: 'bathroom' },
];
const UI_ROOMS = [
  { name: 'Living & Lounge', type: 'living', minSize: 20 }, { name: 'Master Bedroom', type: 'bedroom', minSize: 16 },
  { name: 'Guest Bedroom', type: 'bedroom', minSize: 12 }, { name: 'Kitchen Area', type: 'kitchen', minSize: 12 },
  { name: 'Bathroom', type: 'bathroom', minSize: 5 },
];
const REQUIREMENTS = 'Create a compact home with a spacious living room, a master bedroom, a common bathroom near the second bedroom, ample natural light, proper ventilation, bedroom privacy, and minimal corridor space. Ensure realistic furniture placement and an efficient, practical layout.';

test('requirements parser: reads adjacency, shared bathroom and flags from the UI text', () => {
  const c = parseRequirementsLocally(REQUIREMENTS, PROGRAM);
  assert.deepEqual(c.adjacent, [{ a: 'Bathroom', b: 'Guest Bedroom' }]);
  assert.deepEqual(c.sharedBathrooms, ['Bathroom']);
  assert.equal(c.bedroomPrivacy, true);
  assert.equal(c.minimalCorridor, true);
  assert.equal(c.naturalLight, true);
  assert.equal(c.entrySide, undefined);
  assert.match(describeConstraints(c), /common bathroom near second bedroom/);
});

test('requirements parser: avoid pairs, placement, and an entry side that is not mistaken for a room placement', () => {
  const c = parseRequirementsLocally('The kitchen should be at the back, away from the bedrooms, and the entrance on the east side.', PROGRAM);
  assert.equal(c.entrySide, 'right');
  assert.deepEqual(c.placements, [{ room: 'Kitchen Area', side: 'back' }]);
  assert.ok(c.avoid.some((p) => p.a === 'Kitchen Area' && p.b === 'Master Bedroom'));
  assert.ok(c.avoid.some((p) => p.a === 'Kitchen Area' && p.b === 'Guest Bedroom'));
});

test('requirements parser: never invents rooms, and empty text yields nothing', () => {
  const c = parseRequirementsLocally('Put the sauna next to the swimming pool.', PROGRAM);
  assert.equal(c.adjacent.length, 0);
  assert.deepEqual(parseRequirementsLocally('', PROGRAM), emptyConstraints());
});

test('merge: the model adds constraints but does not override a written entry side', () => {
  const local = parseRequirementsLocally('The entrance on the west side.', PROGRAM);
  const merged = mergeConstraints(local, { entrySide: 'top', adjacent: [{ a: 'Kitchen Area', b: 'Living & Lounge' }], bedroomPrivacy: true });
  assert.equal(merged.entrySide, 'left');
  assert.equal(merged.adjacent.length, 1);
  assert.equal(merged.bedroomPrivacy, true);
});

test('Gemini constraints: valid ones are kept, unknown rooms/sides are dropped without rejecting the topology', () => {
  const topology: any = {
    entrySide: 'bottom',
    rooms: PROGRAM.map((r) => ({ name: r.name, zone: r.type === 'kitchen' || r.type === 'living-room' ? 'public' : 'private' })),
    attachmentOrder: PROGRAM.map((r, i) => ({ room: r.name, attachTo: i === 0 ? 'ENTRY' : 'HALLWAY' })),
    adjacencyPairs: [],
    constraints: {
      adjacentPairs: [{ a: 'Bathroom', b: 'Guest Bedroom' }, { a: 'Ghost', b: 'Bathroom' }],
      placements: [{ room: 'Kitchen Area', side: 'back' }, { room: 'Kitchen Area', side: 'sideways' }],
      sharedBathrooms: ['Bathroom', 'Pool'], bedroomPrivacy: true,
    },
  };
  const v: any = validateTopology(topology, PROGRAM);
  assert.equal(v.ok, true);
  assert.deepEqual(v.hint.constraints.adjacent, [{ a: 'Bathroom', b: 'Guest Bedroom' }]);
  assert.deepEqual(v.hint.constraints.placements, [{ room: 'Kitchen Area', side: 'back' }]);
  assert.deepEqual(v.hint.constraints.sharedBathrooms, ['Bathroom']);
  assert.equal(v.hint.constraints.bedroomPrivacy, true);
});

async function server(): Promise<any> {
  return import('../../server.ts');
}

const doorNeighbour = (rooms: any[], r: any) => rooms.find((o) => o.id === r.doorTargetId);
const sharesWall = (a: any, b: any) => {
  const h = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const v = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return ((Math.abs(a.y + a.height - b.y) < 0.15 || Math.abs(b.y + b.height - a.y) < 0.15) && h >= 1) ||
    ((Math.abs(a.x + a.width - b.x) < 0.15 || Math.abs(b.x + b.width - a.x) < 0.15) && v >= 1);
};

test('solver: every room meets the minimum area the user typed (12x16, UI program)', async () => {
  const { generateFloorPlanWithTopology } = await server();
  for (const seed of ['a', 'b', 'c', 'd', 'e', 'f']) {
    const plan: any = await generateFloorPlanWithTopology({ plotW: 12, plotL: 16, rooms: UI_ROOMS, userRequirements: REQUIREMENTS, variationSeed: seed, callModel: null });
    assert.equal(plan.constraintError, undefined, `seed ${seed}`);
    for (const room of UI_ROOMS) {
      const r = plan.rooms.find((x: any) => x.name === room.name);
      assert.ok(r.width * r.height >= room.minSize - 0.05, `seed ${seed}: ${room.name} ${(r.width * r.height).toFixed(2)} m2 < ${room.minSize}`);
    }
  }
});

test('solver: written requirements shape the plan (common bath by the guest room, bedroom doors on the hallway, short hallway)', async () => {
  const { generateFloorPlanWithTopology } = await server();
  let bathNearGuest = 0;
  let privateDoors = 0;
  const seeds = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  for (const seed of seeds) {
    const plan: any = await generateFloorPlanWithTopology({ plotW: 12, plotL: 16, rooms: UI_ROOMS, userRequirements: REQUIREMENTS, variationSeed: seed, callModel: null });
    assert.equal(plan.constraintError, undefined);
    const byName = (n: string) => plan.rooms.find((r: any) => r.name === n);
    if (sharesWall(byName('Bathroom'), byName('Guest Bedroom'))) bathNearGuest++;
    const ok = ['Master Bedroom', 'Guest Bedroom'].every((n) => {
      const t = doorNeighbour(plan.rooms, byName(n));
      return t && !/foyer|living|kitchen/i.test(t.name);
    });
    if (ok) privateDoors++;
    assert.match(plan.designNotes, /Applied from your requirements/);
  }
  assert.ok(bathNearGuest >= 5, `bathroom next to the guest bedroom in only ${bathNearGuest}/${seeds.length} plans`);
  assert.ok(privateDoors >= 6, `bedroom doors on the hallway in only ${privateDoors}/${seeds.length} plans`);
});

test('retry policy: an API error moves the retry to another model without a validation message; a bad reply retries the same model with the error', async () => {
  const { requestTopologyHint } = await server();
  const calls: { prompt: string; ctx: any }[] = [];
  await requestTopologyHint({
    plotW: 12, plotL: 16, rooms: UI_ROOMS, userRequirements: '',
    callModel: async (prompt: string, ctx: any) => { calls.push({ prompt, ctx }); throw new Error('timed out after 12000ms'); },
  });
  assert.equal(calls.length, 2);
  assert.equal(calls[1].ctx.previousWasApiError, true);
  assert.doesNotMatch(calls[1].prompt, /previous reply was rejected/);

  const calls2: { prompt: string; ctx: any }[] = [];
  await requestTopologyHint({
    plotW: 12, plotL: 16, rooms: UI_ROOMS, userRequirements: '',
    callModel: async (prompt: string, ctx: any) => { calls2.push({ prompt, ctx }); return '{"entrySide":"bottom","rooms":[],"attachmentOrder":[],"adjacencyPairs":[]}'; },
  });
  assert.equal(calls2[1].ctx.previousWasApiError, false);
  assert.match(calls2[1].prompt, /previous reply was rejected/);
});
