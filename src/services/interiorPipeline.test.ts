// End-to-end checks for the interior generator: the real /api/gemini/interior route is
// called in-process with Gemini switched off, so every result is the deterministic path.
process.env.INTERIO_NO_LISTEN = '1';
process.env.GEMINI_API_KEY = ''; // set before the server loads so dotenv cannot supply a real key

import assert from 'node:assert/strict';
import http from 'node:http';
import test, { after, before } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { InteriorDesignResult } from '../types';
import { hexToHsl, resolveColor } from './colorResolver';
import { contrastRatio } from './colorTheory';
import { createRoomFurnitureSuggestions } from './interiorFurniture';
import { furnitureFootprint } from './layoutOptimizer';

let server: http.Server;
let port = 0;

before(async () => {
  const { app } = await import('../../server');
  server = http.createServer(app).listen(0);
  port = (server.address() as { port: number }).port;
});
after(() => { server?.close(); });

type Req = { style?: string; budget?: string; roomType?: string; preferredColors?: unknown; additionalRequirements?: unknown; roomWidth?: number; roomLength?: number };
const MID = '$15,000 - $25,000', LEAN = '$5,000 - $10,000', RICH = '$75,000+';

async function generate(req: Req): Promise<InteriorDesignResult & { status: number }> {
  const res = await fetch(`http://127.0.0.1:${port}/api/gemini/interior`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ roomWidth: 5, roomLength: 4.5, style: 'modern', budget: MID, roomType: 'Living Room', preferredColors: [], additionalRequirements: '', ...req }),
  });
  return { ...(await res.json()), status: res.status };
}
const swatch = (r: InteriorDesignResult, role: string) => r.colorPalette.find((s) => s.role === role)!.hex.toLowerCase();
const ids = (r: InteriorDesignResult) => r.furniture.map((f) => f.id);
const hueGap = (a: number, b: number) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };

/* ---------- 5.1 regression: no preferences leaves the original design untouched ---------- */

const legacy = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '__fixtures__', 'legacyFurniture.json'), 'utf8')) as Record<string, Record<string, unknown>[]>;
const LEGACY_PALETTE = [
  { hex: '#1E293B', name: 'a', role: 'primary' as const }, { hex: '#F8FAFC', name: 'b', role: 'wall' as const },
  { hex: '#6366F1', name: 'c', role: 'accent' as const }, { hex: '#94A3B8', name: 'd', role: 'secondary' as const },
  { hex: '#C2A382', name: 'e', role: 'flooring' as const },
];

test('5.1 every base-generator piece (id, position, size, colour, material) is unchanged for each style and room', () => {
  assert.equal(Object.keys(legacy).length, 48);
  for (const [key, original] of Object.entries(legacy)) {
    const [style, room] = key.split('|');
    // Intentional differences only: style signature / budget pieces, the colour role tag, and the
    // minimalist living room's omitted plant. Everything else the base generator makes is untouched.
    const current = JSON.parse(JSON.stringify(createRoomFurnitureSuggestions(room, 5, 4.5, style as never, LEGACY_PALETTE, '', MID)))
      .filter((piece: Record<string, unknown>) => !/^(sig|bud)-/.test(String(piece.id)))
      .map(({ colorRole: _role, ...piece }: Record<string, unknown>) => piece);
    const expected = original.filter((piece) => !(style === 'minimal' && /living/i.test(room) && piece.role === 'plant'));
    const byId = (list: Record<string, unknown>[]) => [...list].sort((a, b) => String(a.id).localeCompare(String(b.id)));
    assert.deepEqual(byId(current), byId(expected), key);
  }
});

test('5.1 with no colours the route returns the style palette exactly as before', async () => {
  const expected: Record<string, Record<string, string>> = {
    modern: { primary: '#1E293B', wall: '#F8FAFC', accent: '#6366F1', secondary: '#94A3B8', flooring: '#C2A382' },
    minimal: { primary: '#262626', wall: '#FDFBF7', accent: '#8C7B6B', secondary: '#E5DCCF', flooring: '#B8A898' },
    industrial: { primary: '#1F2421', wall: '#D1CDC7', accent: '#9A5C3E', secondary: '#6D5D4B', flooring: '#3E424B' },
    traditional: { primary: '#2A3439', wall: '#F5F2EB', accent: '#A85A3C', secondary: '#C5A059', flooring: '#7C6752' },
    scandinavian: { primary: '#3B4348', wall: '#FAFAF8', accent: '#7D8C7C', secondary: '#EBE3D5', flooring: '#DDD1C1' },
    japandi: { primary: '#2B2A27', wall: '#EFECE6', accent: '#5A6258', secondary: '#757268', flooring: '#9E8872' },
  };
  await Promise.all(Object.entries(expected).map(async ([style, palette]) => {
    const r = await generate({ style, roomType: 'Bedroom' });
    assert.equal(r.status, 200);
    for (const [role, hex] of Object.entries(palette)) assert.equal(swatch(r, role), hex.toLowerCase(), `${style} ${role}`);
    assert.equal(r.inputNotes, undefined, 'no notes when nothing needs saying');
  }));
});

test('5.1 the same request twice gives identical results', async () => {
  const req: Req = { style: 'japandi', roomType: 'Bedroom', preferredColors: ['sage', 'cream'], additionalRequirements: 'need a desk' };
  assert.deepEqual(await generate(req), await generate(req));
});

/* ---------- 5.2 input matrix ---------- */

const COLOR_SETS: string[][] = [['pink'], ['navy'], ['#1a1a1a'], ['dusty rose'], ['navy', 'mustard', 'cream'], ['blorp']];
const MATRIX_STYLES = ['modern', 'japandi', 'industrial'];
const MATRIX_ROOMS = ['Bedroom', 'Living Room', 'Kitchen'];

test('5.2 colour matrix: lead colour reaches the key piece, contrast holds, garbage is reported', async () => {
  for (const colors of COLOR_SETS) for (const style of MATRIX_STYLES) for (const roomType of MATRIX_ROOMS) for (const budget of [LEAN, RICH]) {
    const label = `${colors.join('+')} / ${style} / ${roomType} / ${budget}`;
    const r = await generate({ style, roomType, budget, preferredColors: colors });
    assert.equal(r.status, 200, label);
    assert.ok(r.furniture.length >= 2, `${label}: furniture present`);
    for (const f of r.furniture) {
      assert.match(String(f.color), /^#[0-9a-f]{6}$/i, `${label}: ${f.id} colour`);
      const box = furnitureFootprint(f);
      assert.ok(box.x >= -1e-6 && box.y >= -1e-6 && box.x + box.width <= 5 + 1e-6 && box.y + box.depth <= 4.5 + 1e-6, `${label}: ${f.id} inside room`);
    }

    const user = colors.map((c) => resolveColor(c)).filter((c) => c.source !== 'unresolved');
    const lead = swatch(r, 'primary');
    if (!user.length) {
      const baseline = await generate({ style, roomType, budget });
      assert.deepEqual(r.colorPalette.map((s) => s.hex), baseline.colorPalette.map((s) => s.hex), `${label}: unusable colours leave the style palette alone`);
      assert.ok(r.inputNotes?.some((n) => /blorp/.test(n)), `${label}: unresolved colour reported`);
      continue;
    }
    const chromatic = user.filter((c) => hexToHsl(c.hex).s > 0.2);
    if (chromatic.length) {
      const leadHue = hexToHsl(lead).h;
      assert.ok(chromatic.some((c) => hueGap(leadHue, hexToHsl(c.hex).h) <= 25), `${label}: lead ${lead} keeps a user hue`);
    } else {
      assert.ok(hexToHsl(lead).l < 0.2, `${label}: near-black stays near-black (${lead})`);
    }
    assert.ok(contrastRatio(lead, swatch(r, 'flooring')) >= 1.1, `${label}: lead vs floor`);
    assert.notEqual(swatch(r, 'wall'), swatch(r, 'flooring'), `${label}: wall differs from floor`);
    const keyPiece = roomType === 'Bedroom' ? 'bed' : roomType === 'Living Room' ? 'sofa' : null;
    if (keyPiece) assert.equal(r.furniture.find((f) => f.id === keyPiece)?.color?.toLowerCase(), lead, `${label}: ${keyPiece} takes the lead colour`);
    assert.ok(!r.inputNotes?.some((n) => /Could not interpret/.test(n)), `${label}: nothing to report`);
  }
});

test('5.2 colour changes follow the colour, not a fixed word list', async () => {
  const hues = new Set<number>();
  for (const colour of ['pink', 'teal', 'mustard', 'sage', 'burgundy', 'lavender', 'sky', 'orchid']) {
    const r = await generate({ roomType: 'Bedroom', preferredColors: [colour] });
    hues.add(Math.round(hexToHsl(r.furniture.find((f) => f.id === 'bed')!.color!).h / 20));
  }
  assert.ok(hues.size >= 6, `bed hue varies with the colour (got ${hues.size} distinct bands)`);
});

test('5.2 requirement flags are honoured or reported, and never remove other pieces', async () => {
  const living = await generate({ roomType: 'Living Room', roomWidth: 6, roomLength: 5 });
  const run = (req: string, room = 'Living Room') => generate({ roomType: room, roomWidth: 6, roomLength: 5, additionalRequirements: req });

  const noTv = await run('No TV please');
  assert.ok(!ids(noTv).includes('media-console') && ids(living).includes('media-console'));
  assert.ok(ids(noTv).includes('sofa'));

  const desk = await run('I need a desk', 'Bedroom');
  assert.ok(ids(desk).includes('req-desk') || desk.layoutWarnings?.some((w) => /Compact Work Desk/.test(w)));

  const access = await run('step-free for a wheelchair user');
  assert.ok(!ids(access).some((id) => /rug/.test(id)));
  assert.ok(access.inputNotes?.some((n) => /Accessibility/.test(n)));
  assert.ok(ids(access).includes('sofa'));

  const dog = await run('we have a dog');
  assert.ok(!ids(dog).includes('floor-lamp') && !ids(dog).includes('plant'));

  const storage = await run('extra storage');
  assert.ok(ids(storage).includes('extra-storage') || storage.layoutWarnings?.some((w) => /Storage Cabinet/.test(w)));

  const nook = await run('a reading nook', 'Bedroom');
  assert.ok(ids(nook).includes('reading-chair') || nook.layoutWarnings?.some((w) => /Reading Chair/.test(w)));
});

test('5.2 budget changes the list and the price', async () => {
  const [lean, mid, rich] = await Promise.all([LEAN, MID, RICH].map((budget) => generate({ budget, roomWidth: 6, roomLength: 5 })));
  assert.ok(lean.furniture.length < mid.furniture.length, 'essential has fewer pieces than considered');
  assert.ok(rich.furniture.length > mid.furniture.length, 'bespoke adds pieces');
  const low = (r: InteriorDesignResult) => Number(/\$([\d,]+)/.exec(r.estimatedTotal || '')?.[1].replace(/,/g, ''));
  assert.ok(low(lean) < low(mid) && low(mid) < low(rich), `totals rise with the tier: ${lean.estimatedTotal} / ${mid.estimatedTotal} / ${rich.estimatedTotal}`);
  assert.match(String(rich.estimatedTotal), /bespoke$/);
  for (const r of [lean, mid, rich]) for (const f of r.furniture) assert.match(String(f.estimatedPrice), /^\$[\d,]+–\$[\d,]+ /);
});

test('5.2 unusual input never throws', async () => {
  const odd: Req[] = [
    { preferredColors: 'pink' }, { preferredColors: [1, null, {}, 'pink'] }, { preferredColors: ['', '   ', '#12', '#fffffff'] },
    { preferredColors: Array(30).fill('teal') }, { additionalRequirements: 12345 }, { additionalRequirements: 'x'.repeat(5000) },
    { additionalRequirements: 'no, no, no. not. without' }, { style: 'unknown-style' }, { budget: 'cheap' }, { budget: '' },
    { roomWidth: 1, roomLength: 1 }, { roomType: 'Hallway' },
  ];
  for (const req of odd) {
    const r = await generate(req);
    assert.equal(r.status, 200, JSON.stringify(req).slice(0, 80));
    assert.ok(Array.isArray(r.furniture) && Array.isArray(r.colorPalette));
  }
  assert.equal((await generate({ roomType: '' })).status, 400);
  assert.equal((await generate({ roomWidth: 0 })).status, 400);
});
