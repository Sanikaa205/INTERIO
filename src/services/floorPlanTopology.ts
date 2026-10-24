// Topology contract between the LLM and the floor-plan solver.
//
// The model never returns coordinates. It only decides *topology*: which plot
// side is the entry, which rooms are public/private, in what order rooms
// attach to one another, and which pairs must share a wall. The deterministic
// grow-by-attachment solver does all geometry and treats this as a hint.

export type EntrySide = 'bottom' | 'top' | 'left' | 'right';
export type Zone = 'public' | 'private';

export interface TopologyHint {
  entrySide: EntrySide;
  zones: { name: string; type: string; zone: Zone }[];
  /** Placement sequence. attachTo is a room that appears EARLIER, or ENTRY / HALLWAY. */
  attachmentOrder: { room: string; attachTo: string }[];
  adjacencyPairs: { a: string; b: string }[];
}

export interface ProgramRoom {
  name: string;
  /** Already normalised (living-room, master-bedroom, ...). */
  type: string;
}

export const ENTRY_SIDES: EntrySide[] = ['bottom', 'top', 'left', 'right'];
export const ATTACH_TOKENS = ['ENTRY', 'HALLWAY'] as const;

export const KNOWN_ROOM_TYPES = new Set([
  'living-room', 'dining-room', 'kitchen', 'master-bedroom', 'bedroom', 'bathroom', 'powder-room',
  'office', 'laundry', 'utility', 'hallway', 'balcony',
]);

/** JSON Schema handed to Gemini as `responseJsonSchema` (structured output). */
export const TOPOLOGY_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    entrySide: { type: 'string', enum: ENTRY_SIDES },
    rooms: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          zone: { type: 'string', enum: ['public', 'private'] },
        },
        required: ['name', 'zone'],
      },
    },
    attachmentOrder: {
      type: 'array',
      items: {
        type: 'object',
        properties: { room: { type: 'string' }, attachTo: { type: 'string' } },
        required: ['room', 'attachTo'],
      },
    },
    adjacencyPairs: {
      type: 'array',
      items: {
        type: 'object',
        properties: { a: { type: 'string' }, b: { type: 'string' } },
        required: ['a', 'b'],
      },
    },
  },
  required: ['entrySide', 'rooms', 'attachmentOrder', 'adjacencyPairs'],
} as const;

const key = (s: unknown) => String(s ?? '').trim().toLowerCase();

export type TopologyValidation = { ok: true; hint: TopologyHint } | { ok: false; error: string };

/**
 * Validates a parsed model reply against the program: every room present
 * exactly once in both the zoning and the attachment order, only program
 * names, echoed types match, attachTo refers to an earlier room or a token,
 * and pairs reference distinct known rooms.
 */
export function validateTopology(raw: unknown, program: ProgramRoom[]): TopologyValidation {
  const fail = (error: string): TopologyValidation => ({ ok: false, error });
  if (!raw || typeof raw !== 'object') return fail('reply is not a JSON object');
  const r = raw as Record<string, any>;

  if (!ENTRY_SIDES.includes(r.entrySide)) return fail(`entrySide must be one of ${ENTRY_SIDES.join(', ')}`);
  if (!Array.isArray(r.rooms) || !Array.isArray(r.attachmentOrder) || !Array.isArray(r.adjacencyPairs)) {
    return fail('rooms, attachmentOrder and adjacencyPairs must all be arrays');
  }

  const byName = new Map<string, ProgramRoom>();
  for (const p of program) byName.set(key(p.name), p);
  const canonical = (name: unknown) => byName.get(key(name))?.name;

  // Zoning: each program room exactly once, with its own type and a valid zone.
  const zones: TopologyHint['zones'] = [];
  const seenZoned = new Set<string>();
  for (const z of r.rooms) {
    const name = canonical(z?.name);
    if (!name) return fail(`rooms: unknown room "${z?.name}" (use the exact requested names)`);
    if (seenZoned.has(key(name))) return fail(`rooms: "${name}" listed more than once`);
    seenZoned.add(key(name));
    // Types come from the program, not the model: an echoed type was a pure
    // failure source (e.g. "master-bathroom" for a "bathroom"), so the reply
    // does not carry one and the validated hint takes the program's type.
    const expectedType = byName.get(key(name))!.type;
    if (z.zone !== 'public' && z.zone !== 'private') return fail(`rooms: "${name}" zone must be public or private`);
    zones.push({ name, type: expectedType, zone: z.zone });
  }
  for (const p of program) if (!seenZoned.has(key(p.name))) return fail(`rooms: "${p.name}" is missing`);

  // Attachment order: each room exactly once; attachTo is earlier room or token.
  const order: TopologyHint['attachmentOrder'] = [];
  const placedSoFar = new Set<string>();
  for (const step of r.attachmentOrder) {
    const room = canonical(step?.room);
    if (!room) return fail(`attachmentOrder: unknown room "${step?.room}"`);
    if (placedSoFar.has(key(room))) return fail(`attachmentOrder: "${room}" appears more than once`);
    const rawTarget = String(step?.attachTo ?? '').trim();
    const token = ATTACH_TOKENS.find((t) => t === rawTarget.toUpperCase());
    let attachTo: string;
    if (token) attachTo = token;
    else {
      const target = canonical(rawTarget);
      if (!target) return fail(`attachmentOrder: "${room}" attaches to unknown "${rawTarget}"`);
      if (key(target) === key(room)) return fail(`attachmentOrder: "${room}" cannot attach to itself`);
      if (!placedSoFar.has(key(target))) return fail(`attachmentOrder: "${room}" attaches to "${target}", which has not been placed yet`);
      attachTo = target;
    }
    placedSoFar.add(key(room));
    order.push({ room, attachTo });
  }
  for (const p of program) if (!placedSoFar.has(key(p.name))) return fail(`attachmentOrder: "${p.name}" is missing`);

  // Required pairs: distinct, known, de-duplicated.
  const pairs: TopologyHint['adjacencyPairs'] = [];
  const seenPairs = new Set<string>();
  for (const pair of r.adjacencyPairs) {
    // A pair naming the hallway/entry is not a room pair -- ignore it rather
    // than reject an otherwise good reply.
    if (ATTACH_TOKENS.some((tk) => tk === String(pair?.a ?? '').trim().toUpperCase() || tk === String(pair?.b ?? '').trim().toUpperCase())) continue;
    const a = canonical(pair?.a);
    const b = canonical(pair?.b);
    if (!a || !b) return fail(`adjacencyPairs: unknown room in ("${pair?.a}", "${pair?.b}")`);
    if (key(a) === key(b)) return fail(`adjacencyPairs: "${a}" paired with itself`);
    const pk = [key(a), key(b)].sort().join('|');
    if (seenPairs.has(pk)) continue;
    seenPairs.add(pk);
    pairs.push({ a, b });
  }

  return { ok: true, hint: { entrySide: r.entrySide, zones, attachmentOrder: order, adjacencyPairs: pairs } };
}

/** Prompt asking for topology only. `previousError` is set on the single retry. */
export function createTopologyPrompt(
  plotW: number, plotL: number,
  program: (ProgramRoom & { targetArea: number; zone: Zone })[],
  userRequirements: string,
  previousError?: string
): string {
  const lines = program
    .map((r, i) => `${i + 1}. "${r.name}" (type: ${r.type}, zone: ${r.zone}, about ${Math.round(r.targetArea)} m²)`)
    .join('\n');
  const names = program.map((r) => `"${r.name}"`).join(', ');
  return `You are an experienced residential architect deciding the TOPOLOGY of a house plan. You do NOT choose coordinates or sizes -- a geometry solver does that. You only decide how the rooms relate to each other.

Plot: ${plotW} m x ${plotL} m (${Math.round(plotW * plotL)} m²).

Rooms (use these exact names, each exactly once):
${lines}

User requirements:
${userRequirements || 'None. Use a practical residential entry, one circulation hallway, daylight and privacy zoning.'}

Decide:
1. entrySide: which plot side the main entry / public side is on (bottom, top, left or right). Use "bottom" unless the requirements say otherwise.
2. rooms: for every room, give its exact name and mark it public or private. Public = living, dining, kitchen, entry. Private = bedrooms, bathrooms, study, laundry.
3. attachmentOrder: the sequence in which rooms are placed, one entry per room (all ${program.length} rooms). attachTo is either a room that appears EARLIER in the sequence, or "ENTRY" (attaches at the entry), or "HALLWAY" (attaches to the circulation hallway that links the public and private zones). Start with the public rooms attached to ENTRY. An ensuite attaches to its bedroom. Bedrooms and shared bathrooms attach to HALLWAY. The kitchen attaches to the living or dining room.
4. adjacencyPairs: pairs of rooms that must share a wall, e.g. a master bedroom with its ensuite, the kitchen with the dining/living room, wet rooms that can share plumbing.

Allowed room names: ${names}.
Return JSON only, matching the response schema. No coordinates, sizes, doors or markdown.${previousError ? `

Your previous reply was rejected: ${previousError}
Fix exactly that problem and return the full corrected JSON.` : ''}`;
}
