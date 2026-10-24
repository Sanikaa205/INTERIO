import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { InteriorFloorPlan } from '../components/InteriorDesignWorkflow';
import { defaultRoomOpenings, optimizeFurnitureLayout, roomDoorClearance } from './layoutOptimizer';
import { createRoomFurnitureSuggestions } from './interiorFurniture';
import { FURNITURE_ASSETS, matchFurnitureAsset } from './furnitureAssets';
import { createFurnitureModel } from '../three/interiorVisuals';

test('optimizer keeps all generated furniture inside room bounds without overlap', () => {
  const room = { width: 5, depth: 5 };
  const layout = optimizeFurnitureLayout([
    { name: 'Sofa', category: 'seating', width: 2.1, depth: 0.9 },
    { name: 'Coffee Table', category: 'table', width: 1, depth: 0.6 },
    { name: 'Cabinet', category: 'storage', width: 1.2, depth: 0.4 },
  ], room);
  assert.equal(layout.length, 3);
  const bounds = (item: (typeof layout)[number]) => ({
    x: item.x, y: item.y,
    width: (item.rotation || 0) % 180 ? item.depth : item.width,
    depth: (item.rotation || 0) % 180 ? item.width : item.depth,
  });
  for (const item of layout) {
    const rect = bounds(item);
    assert.ok(rect.x >= 0 && rect.y >= 0);
    assert.ok(rect.x + rect.width <= room.width + 1e-6);
    assert.ok(rect.y + rect.depth <= room.depth + 1e-6);
  }
  for (let i = 0; i < layout.length; i++) for (let j = i + 1; j < layout.length; j++) {
    const a = bounds(layout[i]), b = bounds(layout[j]);
    assert.ok(a.x + a.width <= b.x + 1e-6 || b.x + b.width <= a.x + 1e-6 || a.y + a.depth <= b.y + 1e-6 || b.y + b.depth <= a.y + 1e-6);
    assert.ok(a.x + a.width + 0.75 <= b.x + 1e-6 || b.x + b.width + 0.75 <= a.x + 1e-6 || a.y + a.depth + 0.75 <= b.y + 1e-6 || b.y + b.depth + 0.75 <= a.y + 1e-6);
  }
});

test('optimizer tries quarter turns when an item fits only after rotation', () => {
  const [item] = optimizeFurnitureLayout([{ name: 'Long Sofa', category: 'seating', width: 2.4, depth: 0.9 }], { width: 2, depth: 3 });
  assert.ok(item);
  assert.equal(item.rotation, 90);
  assert.ok(item.x + item.depth <= 2);
  assert.ok(item.y + item.width <= 3);
});

test('optimizer leaves a clearance around doors and windows', () => {
  const [item] = optimizeFurnitureLayout([{ name: 'Console', category: 'storage', width: 1.2, depth: 0.4, preferredWall: 'north' }], {
    width: 4, depth: 4, openings: [{ wall: 'north', start: 1, end: 3, type: 'door' }],
  });
  assert.ok(item);
  const x1 = item.x, x2 = item.x + item.width;
  assert.ok(item.y >= 0.75 || x2 <= 1 - 0.75 || x1 >= 3 + 0.75);
});

test('room-specific briefs create the correct furniture and fit it to different room sizes', () => {
  const palette = [
    { hex: '#374151', name: 'Primary', role: 'primary' as const },
    { hex: '#e8e0d5', name: 'Textile', role: 'secondary' as const },
    { hex: '#71816a', name: 'Accent', role: 'accent' as const },
    { hex: '#f4f0e8', name: 'Wall', role: 'wall' as const },
    { hex: '#bd9b72', name: 'Floor', role: 'flooring' as const },
  ];
  const cases = [
    { type: 'Living Room', width: 5.5, depth: 6.5, required: [/sofa/i, /rug/i, /coffee table/i] },
    { type: 'Master Bedroom', width: 4.8, depth: 5.2, required: [/bed/i, /wardrobe/i] },
    { type: 'Kitchen', width: 4.5, depth: 5, required: [/counter/i, /refrigerator/i] },
    { type: 'Kitchen & Dining', width: 5, depth: 6, required: [/counter/i, /refrigerator/i, /dining table/i, /dining chair/i] },
    { type: 'Bathroom', width: 3.6, depth: 4, required: [/vanity/i, /shower/i, /wc|toilet/i] },
    { type: 'Dining Room', width: 5, depth: 5, required: [/dining table/i, /dining chair/i] },
    { type: 'Study Room', width: 4, depth: 5, required: [/desk/i, /task chair/i, /bookcase/i] },
  ];

  for (const room of cases) {
    const brief = createRoomFurnitureSuggestions(room.type, room.width, room.depth, 'scandinavian', palette);
    const layout = optimizeFurnitureLayout(brief, { width: room.width, depth: room.depth, openings: defaultRoomOpenings(room.width, room.depth), doorClearance: roomDoorClearance(room.width, room.depth) });
    for (const expected of room.required) assert.ok(layout.some((item) => expected.test(item.name)), `${room.type} should include ${expected}`);

    const footprint = (item: (typeof layout)[number]) => ({ x: item.x, y: item.y, width: item.rotation! % 180 ? item.depth : item.width, depth: item.rotation! % 180 ? item.width : item.depth });
    for (const item of layout) {
      const rect = footprint(item);
      assert.ok(rect.x >= 0 && rect.y >= 0, `${room.type} furniture starts inside the room`);
      assert.ok(rect.x + rect.width <= room.width + 1e-6 && rect.y + rect.depth <= room.depth + 1e-6, `${room.type} furniture ends inside the room`);
    }
    for (let i = 0; i < layout.length; i++) for (let j = i + 1; j < layout.length; j++) {
      if (/rug/i.test(layout[i].name) || /rug/i.test(layout[j].name)) continue;
      const a = footprint(layout[i]), b = footprint(layout[j]);
      assert.ok(a.x + a.width <= b.x + 1e-6 || b.x + b.width <= a.x + 1e-6 || a.y + a.depth <= b.y + 1e-6 || b.y + b.depth <= a.y + 1e-6, `${room.type} furniture footprints do not overlap`);
    }
    if (room.type === 'Kitchen & Dining') {
      const counter = layout.find((item) => /counter/i.test(item.name))!;
      const table = layout.find((item) => /dining table/i.test(item.name))!;
      assert.ok(table.y > counter.y + counter.depth, 'dining table stays in a separate zone beyond the kitchen counter');
      assert.ok(layout.filter((item) => /dining chair/i.test(item.name)).length >= 2, 'dining zone has seating');
    }
    if (/Dining Room|Kitchen & Dining/.test(room.type)) {
      const table = layout.find((item) => /dining table/i.test(item.name))!;
      const tableRect = footprint(table);
      for (const chair of layout.filter((item) => /dining chair/i.test(item.name))) {
        const chairRect = footprint(chair);
        const side = chair.id.endsWith('-n') ? 'north' : chair.id.endsWith('-s') ? 'south' : chair.id.endsWith('-w') ? 'west' : 'east';
        assert.equal(chair.rotation, ({ north: 0, south: 180, west: 90, east: 270 } as const)[side], `${chair.id} faces the table`);
        if (side === 'north') assert.ok(tableRect.y - (chairRect.y + chairRect.depth) >= -1e-6 && tableRect.y - (chairRect.y + chairRect.depth) <= .2, 'north chair aligns against the table edge');
        if (side === 'south') assert.ok(chairRect.y - (tableRect.y + tableRect.depth) >= -1e-6 && chairRect.y - (tableRect.y + tableRect.depth) <= .2, 'south chair aligns against the table edge');
        if (side === 'west') assert.ok(tableRect.x - (chairRect.x + chairRect.width) >= -1e-6 && tableRect.x - (chairRect.x + chairRect.width) <= .2, 'west chair aligns against the table edge');
        if (side === 'east') assert.ok(chairRect.x - (tableRect.x + tableRect.width) >= -1e-6 && chairRect.x - (tableRect.x + tableRect.width) <= .2, 'east chair aligns against the table edge');
      }
    }
  }

  const compact = createRoomFurnitureSuggestions('Living Room', 4, 4, 'modern', palette);
  const spacious = createRoomFurnitureSuggestions('Living Room', 7, 8, 'modern', palette);
  assert.notEqual(compact[0].width, spacious[0].width, 'sofa size follows room dimensions');
  assert.notEqual(compact[0].x, spacious[0].x, 'furniture anchors follow room dimensions');
  assert.ok(defaultRoomOpenings(5.5, 6.5).some((opening) => opening.type === 'door'));
  assert.ok(defaultRoomOpenings(5.5, 6.5).some((opening) => opening.type === 'window'));
});

test('style choices alter furniture materials and finishes', () => {
  const modernPalette = [{ hex: '#ced3d4', name: 'Textile', role: 'secondary' as const }, { hex: '#b89a75', name: 'Floor', role: 'flooring' as const }, { hex: '#637a91', name: 'Accent', role: 'accent' as const }];
  const traditionalPalette = [{ hex: '#805b66', name: 'Textile', role: 'secondary' as const }, { hex: '#73533d', name: 'Floor', role: 'flooring' as const }, { hex: '#b8904f', name: 'Accent', role: 'accent' as const }];
  const industrialPalette = [{ hex: '#755c4b', name: 'Textile', role: 'secondary' as const }, { hex: '#5e564d', name: 'Floor', role: 'flooring' as const }, { hex: '#a85e3d', name: 'Accent', role: 'accent' as const }];
  const modern = createRoomFurnitureSuggestions('Living Room', 5.5, 6.5, 'modern', modernPalette);
  const traditional = createRoomFurnitureSuggestions('Living Room', 5.5, 6.5, 'traditional', traditionalPalette);
  const industrial = createRoomFurnitureSuggestions('Living Room', 5.5, 6.5, 'industrial', industrialPalette);
  const minimal = createRoomFurnitureSuggestions('Living Room', 5.5, 6.5, 'minimal', modernPalette);
  const scandinavian = createRoomFurnitureSuggestions('Living Room', 5.5, 6.5, 'scandinavian', modernPalette);
  const japandi = createRoomFurnitureSuggestions('Living Room', 5.5, 6.5, 'japandi', modernPalette);
  assert.notEqual(modern[0].material, traditional[0].material);
  assert.notEqual(modern[0].name, traditional[0].name);
  assert.notEqual(industrial[0].material, traditional[0].material);
  assert.notEqual(modern[0].color, traditional[0].color, 'selected style palette is used in furniture finishes');
  assert.equal(new Set([modern, traditional, industrial, minimal, scandinavian, japandi].map((items) => items[0].material)).size, 6, 'all six styles provide distinct upholstery/material finishes');

  const noTv = createRoomFurnitureSuggestions('Living Room', 5.5, 6.5, 'modern', modernPalette, 'No TV, please; add a reading nook');
  assert.ok(!noTv.some((item) => /media console/i.test(item.name)));
  assert.ok(noTv.some((item) => /reading chair/i.test(item.name)));
});

test('3D procedural models use room-specific shapes for beds, kitchen units, and bathroom fixtures', () => {
  const palette = [{ hex: '#b99569', name: 'Floor', role: 'flooring' as const }];
  const create = (name: string, category: 'bed' | 'storage' | 'electronics' | 'fixture') => createFurnitureModel({
    id: name, name, category, x: 0, y: 0, width: 1.4, depth: 0.75, height: 0.75, color: '#d8d1c6', rotation: 0,
  }, palette, 'modern', false);
  const bed = create('Upholstered Bed', 'bed');
  const kitchenRun = create('Kitchen Cabinets & Counter', 'storage');
  const refrigerator = create('Tall Refrigerator', 'electronics');
  const vanity = create('Stone-Top Vanity & Basin', 'fixture');
  const shower = create('Glazed Walk-In Shower', 'fixture');
  const toilet = create('Close-Coupled WC', 'fixture');
  assert.equal(bed.userData.fixtureKind, 'bed');
  assert.equal(kitchenRun.userData.fixtureKind, 'kitchen-counter');
  assert.equal(refrigerator.userData.fixtureKind, 'refrigerator');
  assert.equal(vanity.userData.fixtureKind, 'vanity');
  assert.equal(shower.userData.fixtureKind, 'shower');
  assert.equal(toilet.userData.fixtureKind, 'toilet');
  assert.ok([bed, kitchenRun, refrigerator, vanity, shower, toilet].every((model) => model.children.length > 0));
});

test('compact 3m rooms still receive the room-defining furniture instead of an empty plan', () => {
  const palette = [
    { hex: '#374151', name: 'Primary', role: 'primary' as const },
    { hex: '#e8e0d5', name: 'Textile', role: 'secondary' as const },
    { hex: '#71816a', name: 'Accent', role: 'accent' as const },
    { hex: '#f4f0e8', name: 'Wall', role: 'wall' as const },
    { hex: '#bd9b72', name: 'Floor', role: 'flooring' as const },
  ];
  const checks = [
    ['Living Room', /sofa/i], ['Bedroom', /bed|wardrobe/i], ['Kitchen', /counter/i],
    ['Bathroom', /wc|vanity/i], ['Dining Room', /dining table/i], ['Study Room', /desk/i],
  ] as const;
  for (const [type, expected] of checks) {
    const brief = createRoomFurnitureSuggestions(type, 3, 3, 'minimal', palette);
    const plan = optimizeFurnitureLayout(brief, { width: 3, depth: 3, openings: defaultRoomOpenings(3, 3), doorClearance: roomDoorClearance(3, 3) });
    assert.ok(plan.length > 0, `${type} plan is not empty`);
    assert.ok(plan.some((item) => expected.test(item.name)), `${type} keeps its defining furniture within a compact room`);
    if (type === 'Bedroom') {
      assert.ok(plan.some((item) => /wardrobe/i.test(item.name)), 'compact bedroom still fits a wardrobe');
    }
  }
});

test('SVG renderer changes its floor finish, furniture, labels, and scale from the generated result', () => {
  const palettes = {
    modern: [{ hex: '#374151', name: 'Primary', role: 'primary' as const }, { hex: '#e8e0d5', name: 'Textile', role: 'secondary' as const }, { hex: '#71816a', name: 'Accent', role: 'accent' as const }, { hex: '#f4f0e8', name: 'Wall', role: 'wall' as const }, { hex: '#bd9b72', name: 'Floor', role: 'flooring' as const }],
    traditional: [{ hex: '#493a38', name: 'Primary', role: 'primary' as const }, { hex: '#805b66', name: 'Textile', role: 'secondary' as const }, { hex: '#b8904f', name: 'Accent', role: 'accent' as const }, { hex: '#f4f0e8', name: 'Wall', role: 'wall' as const }, { hex: '#73533d', name: 'Floor', role: 'flooring' as const }],
    industrial: [{ hex: '#343638', name: 'Primary', role: 'primary' as const }, { hex: '#755c4b', name: 'Textile', role: 'secondary' as const }, { hex: '#a85e3d', name: 'Accent', role: 'accent' as const }, { hex: '#d1cdc7', name: 'Wall', role: 'wall' as const }, { hex: '#5e564d', name: 'Floor', role: 'flooring' as const }],
  };
  const render = (roomType: string, style: keyof typeof palettes, width: number, depth: number) => {
    const palette = palettes[style];
    const brief = createRoomFurnitureSuggestions(roomType, width, depth, style, palette);
    const furniture = optimizeFurnitureLayout(brief, { width, depth, openings: defaultRoomOpenings(width, depth), doorClearance: roomDoorClearance(width, depth) });
    const result = { roomWidth: width, roomLength: depth, roomType, style, budget: 'mid', furniture, colorPalette: palette, lightingSuggestions: '', openings: defaultRoomOpenings(width, depth) } as const;
    return renderToStaticMarkup(createElement(InteriorFloorPlan, { result, selectedFurnitureId: null, onSelectFurniture: () => undefined }));
  };

  const living = render('Living Room', 'modern', 5.5, 6.5);
  const bedroom = render('Bedroom', 'modern', 4.8, 5.2);
  const kitchen = render('Kitchen', 'modern', 4.5, 5);
  const bathroom = render('Bathroom', 'modern', 3.6, 4);
  const traditional = render('Living Room', 'traditional', 5.5, 6.5);
  const industrial = render('Living Room', 'industrial', 5.5, 6.5);
  assert.notEqual(living, bedroom, 'room category and measurements change the SVG output');
  assert.notEqual(living, kitchen, 'kitchen render uses kitchen counters and appliances');
  assert.notEqual(living, bathroom, 'bathroom render uses sanitary fixtures');
  assert.notEqual(living, traditional, 'style palette changes the rendered plan');
  assert.notEqual(living, industrial, 'floor finish and wall treatment change by style');
  assert.match(living, /Textured Area Rug/);
  assert.match(bedroom, /Wardrobe|wardrobe/);
  assert.match(kitchen, /Kitchen Cabinets|Refrigerator|Kitchen Island/);
  assert.match(bathroom, /<ellipse/, 'bathroom plan draws basin and WC fixture geometry');
  assert.match(bathroom, /BATHROOM/);
  assert.match(kitchen, /KITCHEN/);
  assert.match(living, /WINDOW/);
  assert.match(living, /ENTRY/);
  assert.match(industrial, /stone-floor/);
});

test('asset matching selects a local GLB and safely reports unmatched categories', () => {
  assert.equal(matchFurnitureAsset({ name: 'Velvet Sofa', category: 'seating' })?.url, '/assets/furniture/sofa.glb');
  assert.equal(matchFurnitureAsset({ name: 'Ceiling fan', category: 'electronics' }), null);
});

test('every catalogued local furniture asset exists as a GLB 2.0 file', () => {
  for (const asset of FURNITURE_ASSETS) {
    const filename = path.join(process.cwd(), 'public', asset.url.replace(/^\//, ''));
    const bytes = fs.readFileSync(filename);
    assert.equal(bytes.toString('ascii', 0, 4), 'glTF');
    assert.equal(bytes.readUInt32LE(4), 2);
    assert.equal(bytes.readUInt32LE(8), bytes.length);
  }
});
