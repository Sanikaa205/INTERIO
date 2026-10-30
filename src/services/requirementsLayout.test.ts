import assert from 'node:assert/strict';
import test from 'node:test';
import { createRoomFurnitureSuggestions, type RequirementReport } from './interiorFurniture';

const palette = [
  { hex: '#1E293B', name: 'p', role: 'primary' as const }, { hex: '#F8FAFC', name: 'w', role: 'wall' as const },
  { hex: '#6366F1', name: 'a', role: 'accent' as const }, { hex: '#94A3B8', name: 's', role: 'secondary' as const },
  { hex: '#C2A382', name: 'f', role: 'flooring' as const },
];
const MID = '$15,000 - $25,000', LEAN = '$5,000 - $10,000', RICH = '$75,000+';
const ids = (room: string, req: string, budget = MID, w = 5, d = 4.5, style: 'modern' | 'traditional' = 'modern', report?: RequirementReport) =>
  createRoomFurnitureSuggestions(room, w, d, style, palette, req, budget, undefined, undefined, report).map((p) => String(p.id));

test('TV requests: removal phrasings drop the console, a desk request adds a desk', () => {
  assert.ok(ids('Living Room', '').includes('living-console'));
  for (const text of ['no tv', "don't want a TV", 'without television']) assert.ok(!ids('Living Room', text).includes('living-console'), text);
  assert.ok(ids('Bedroom', 'need a desk').includes('req-desk'));
  assert.ok(ids('Bedroom', 'need a desk').includes('req-desk-chair'));
  assert.ok(!ids('Study', 'need a desk').includes('req-desk'), 'a study already has a desk');
});

test('requested pieces that do not fit are left out and reported, never displacing core pieces', () => {
  const report: RequirementReport = { unfit: [], notes: [] };
  const small = ids('Dining Room', 'need a desk, plants, extra storage', MID, 3, 3, 'modern', report);
  const baseline = ids('Dining Room', '', MID, 3, 3);
  assert.deepEqual(baseline.filter((id) => !small.includes(id)), [], 'no base piece removed');
  assert.ok(report.unfit.length > 0);
});

test('reading nook works in a bedroom now, not just a living room', () => {
  assert.ok(ids('Bedroom', 'reading nook', MID, 5.5, 5).includes('reading-chair'));
  assert.ok(ids('Living Room', 'reading nook').includes('reading-chair'));
  assert.ok(!ids('Bathroom', 'reading nook', MID, 5, 5).includes('reading-chair'));
});

test('extra storage is honoured even when other storage exists', () => {
  assert.ok(ids('Living Room', 'extra storage', MID, 6, 5).includes('extra-storage'));
});

test('pets / children drop fragile lamps and plants unless plants are asked for', () => {
  const dog = ids('Living Room', 'I have a dog');
  assert.ok(!dog.includes('living-lamp') && !dog.includes('living-plant'));
  assert.ok(dog.includes('living-sofa'));
  assert.ok(ids('Living Room', 'I have a dog but I want plants').some((id) => /plant/.test(id)));
});

test('accessibility: no loose rugs or optional pieces, wider spacing where it fits, nothing else lost', () => {
  const base = createRoomFurnitureSuggestions('Living Room', 6, 5, 'traditional', palette, '', RICH);
  const access = createRoomFurnitureSuggestions('Living Room', 6, 5, 'traditional', palette, 'wheelchair user', RICH);
  assert.ok(!access.some((p) => /rug/.test(String(p.id))));
  assert.ok(!access.some((p) => /^(sig|bud)-/.test(String(p.id))));
  assert.ok(access.some((p) => (p.clearance ?? 0) >= 0.55));
  assert.ok(base.some((p) => /^(sig|bud)-/.test(String(p.id))));
  const noRugs = (list: string[]) => list.filter((id) => !/rug/.test(id)).sort();
  assert.deepEqual(noRugs(ids('Bedroom', 'wheelchair', MID, 3, 3)), noRugs(ids('Bedroom', '', MID, 3, 3)));
});

test('budget tier changes which pieces are chosen', () => {
  const lean = ids('Living Room', '', LEAN), mid = ids('Living Room', '', MID), rich = ids('Living Room', '', RICH, 6.5, 5.5, 'traditional');
  assert.ok(!lean.includes('living-rug') && !lean.includes('living-lamp') && !lean.includes('living-plant'));
  assert.ok(mid.includes('living-rug') && mid.includes('living-lamp'));
  assert.ok(rich.some((id) => id.startsWith('bud-')));
  assert.ok(lean.length < mid.length);
  assert.ok(!ids('Bedroom', '', LEAN).includes('bedroom-rug'));
  assert.ok(ids('Living Room', 'plants', LEAN).includes('living-plant'), 'an asked-for plant survives a lean budget');
  assert.ok(ids('Living Room', 'a rug', LEAN).includes('living-rug'), 'an asked-for rug survives a lean budget');
});
