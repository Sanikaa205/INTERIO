import assert from 'node:assert/strict';
import test from 'node:test';
import { validateTopology, type ProgramRoom } from './floorPlanTopology';

// server.ts starts listening on import unless this is set.
process.env.INTERIO_NO_LISTEN = '1';

const UI_PROGRAM = [
  { name: 'Living Room', type: 'living', minSize: 24 }, { name: 'Master Bedroom', type: 'bedroom', minSize: 18 },
  { name: 'Guest Bedroom', type: 'bedroom', minSize: 14 }, { name: 'Kitchen & Dining', type: 'kitchen', minSize: 16 },
  { name: 'Master Bathroom', type: 'bathroom', minSize: 6 }, { name: 'Powder Room', type: 'bathroom', minSize: 4 },
];
const NORMALISED: ProgramRoom[] = [
  { name: 'Living Room', type: 'living-room' }, { name: 'Master Bedroom', type: 'master-bedroom' },
  { name: 'Guest Bedroom', type: 'bedroom' }, { name: 'Kitchen & Dining', type: 'kitchen' },
  { name: 'Master Bathroom', type: 'bathroom' }, { name: 'Powder Room', type: 'powder-room' },
];

function validTopology(entrySide = 'bottom'): any {
  return {
    entrySide,
    rooms: [
      { name: 'Living Room', type: 'living-room', zone: 'public' }, { name: 'Master Bedroom', type: 'master-bedroom', zone: 'private' },
      { name: 'Guest Bedroom', type: 'bedroom', zone: 'private' }, { name: 'Kitchen & Dining', type: 'kitchen', zone: 'public' },
      { name: 'Master Bathroom', type: 'bathroom', zone: 'private' }, { name: 'Powder Room', type: 'powder-room', zone: 'private' },
    ],
    attachmentOrder: [
      { room: 'Living Room', attachTo: 'ENTRY' }, { room: 'Kitchen & Dining', attachTo: 'Living Room' },
      { room: 'Master Bedroom', attachTo: 'HALLWAY' }, { room: 'Master Bathroom', attachTo: 'Master Bedroom' },
      { room: 'Guest Bedroom', attachTo: 'HALLWAY' }, { room: 'Powder Room', attachTo: 'HALLWAY' },
    ],
    adjacencyPairs: [{ a: 'Master Bedroom', b: 'Master Bathroom' }, { a: 'Kitchen & Dining', b: 'Living Room' }],
  };
}
const clone = (x: any): any => JSON.parse(JSON.stringify(x));

test('topology schema: a complete, consistent reply is accepted', () => {
  const v = validateTopology(validTopology(), NORMALISED);
  assert.equal(v.ok, true);
  if (v.ok) {
    assert.equal(v.hint.attachmentOrder.length, 6);
    assert.equal(v.hint.adjacencyPairs.length, 2);
  }
});

test('topology schema: rejects each kind of invalid reply with a specific error', () => {
  const cases: [string, (t: any) => void, RegExp][] = [
    ['bad entry side', (t) => { t.entrySide = 'north'; }, /entrySide/],
    ['missing room in zoning', (t) => { t.rooms.pop(); }, /"Powder Room" is missing/],
    ['duplicate room in zoning', (t) => { t.rooms[1] = t.rooms[0]; }, /more than once/],
    ['unknown room name', (t) => { t.rooms[0].name = 'Ballroom'; }, /unknown room "Ballroom"/],
    ['bad zone', (t) => { t.rooms[0].zone = 'semi'; }, /zone must be/],
    ['order missing a room', (t) => { t.attachmentOrder.pop(); }, /attachmentOrder: "Powder Room" is missing/],
    ['order repeats a room', (t) => { t.attachmentOrder[1].room = 'Living Room'; }, /more than once/],
    ['attach to a later room', (t) => { t.attachmentOrder[1].attachTo = 'Powder Room'; }, /not been placed yet/],
    ['attach to an unknown room', (t) => { t.attachmentOrder[1].attachTo = 'Garage'; }, /unknown "Garage"/],
    ['pair with itself', (t) => { t.adjacencyPairs[0] = { a: 'Kitchen & Dining', b: 'Kitchen & Dining' }; }, /with itself/],
    ['pair with unknown room', (t) => { t.adjacencyPairs[0].b = 'Pool'; }, /adjacencyPairs: unknown room/],
  ];
  for (const [label, mutate, expected] of cases) {
    const t = clone(validTopology());
    mutate(t);
    const v: any = validateTopology(t, NORMALISED);
    assert.equal(v.ok, false, label);
    assert.match(v.error, expected, label);
  }
  for (const junk of [null, 'text', 42, [], {}]) assert.equal(validateTopology(junk, NORMALISED).ok, false);
});

test('topology schema: room names and attach tokens match case-insensitively', () => {
  const t = validTopology();
  t.rooms[0].name = 'living room';
  t.attachmentOrder[0].attachTo = 'entry';
  assert.equal(validateTopology(t, NORMALISED).ok, true);
});

async function server(): Promise<any> {
  return import('../../server.ts');
}

test('fallback: Gemini throws on every call -> solver alone still returns a valid plan, no error', async () => {
  const { generateFloorPlanWithTopology } = await server();
  let calls = 0;
  const plan: any = await generateFloorPlanWithTopology({
    plotW: 12, plotL: 15, rooms: UI_PROGRAM,
    callModel: async () => { calls++; throw new Error('503 high demand'); },
  });
  assert.equal(plan.constraintError, undefined);
  assert.equal(calls, 2, 'one try plus exactly one retry');
  assert.equal(plan.topologyHintReceived, false);
  assert.equal(plan.topologyErrors.length, 2);
  assert.ok(plan.rooms.length >= UI_PROGRAM.length);
});

test('fallback: Gemini returns garbage -> retried once with the error in the prompt, then solver alone', async () => {
  const { generateFloorPlanWithTopology } = await server();
  const prompts: string[] = [];
  const plan: any = await generateFloorPlanWithTopology({
    plotW: 12, plotL: 15, rooms: UI_PROGRAM,
    callModel: async (p: string) => { prompts.push(p); return 'this is not json {{{'; },
  });
  assert.equal(plan.constraintError, undefined);
  assert.equal(prompts.length, 2);
  assert.doesNotMatch(prompts[0], /previous reply was rejected/);
  assert.match(prompts[1], /previous reply was rejected/);
  assert.equal(plan.topologyHintReceived, false);
});

test('fallback: invalid schema first, valid topology on the retry -> hint is received', async () => {
  const { generateFloorPlanWithTopology } = await server();
  const prompts: string[] = [];
  const replies = [JSON.stringify({ entrySide: 'bottom', rooms: [], attachmentOrder: [], adjacencyPairs: [] }), JSON.stringify(validTopology())];
  const plan: any = await generateFloorPlanWithTopology({
    plotW: 12, plotL: 15, rooms: UI_PROGRAM,
    callModel: async (p: string) => { prompts.push(p); return replies[prompts.length - 1]; },
  });
  assert.equal(plan.constraintError, undefined);
  assert.equal(plan.topologyAttempts, 2);
  assert.equal(plan.topologyHintReceived, true);
  assert.match(prompts[1], /is missing/);
});

test('valid topology on the first try -> one call; entry side left puts the living room on the left edge', async () => {
  const { generateFloorPlanWithTopology } = await server();
  let calls = 0;
  const plan: any = await generateFloorPlanWithTopology({
    plotW: 14, plotL: 16, rooms: UI_PROGRAM,
    callModel: async () => { calls++; return JSON.stringify(validTopology('left')); },
  });
  assert.equal(plan.constraintError, undefined);
  assert.equal(calls, 1);
  assert.equal(plan.topologyHintUsed, true);
  const living = plan.rooms.find((r: any) => r.name === 'Living Room');
  assert.ok(living.x <= 0.35, `living room should touch the left edge, x=${living.x}`);
});

test('no Gemini configured (callModel null) -> solver alone, no attempts, no error', async () => {
  const { generateFloorPlanWithTopology } = await server();
  const plan: any = await generateFloorPlanWithTopology({ plotW: 12, plotL: 15, rooms: UI_PROGRAM, callModel: null });
  assert.equal(plan.constraintError, undefined);
  assert.equal(plan.topologyAttempts, 0);
});
