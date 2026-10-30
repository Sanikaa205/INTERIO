import type { ColorSwatch, DesignStyle, FurnitureColorRole } from '../types';
import { defaultRoomOpenings, optimizeFurnitureLayout, roomDoorClearance, type FurnitureSuggestion } from './layoutOptimizer';
import { nearestColorName } from './colorResolver';
import { shade, type DerivedPalette } from './colorTheory';
import { getStyleProfile, signaturePiecesFor, type RoomKind } from './styleProfiles';
import { applyRemovals, parseRequirements, type ParsedRequirements, type RequirementItem } from './requirements';
import { extrasFor, getBudgetTier } from './budgetTiers';

/** Filled in by the generator: requested pieces that did not fit and notes on adjustments it could not make. */
export interface RequirementReport {
  unfit: string[];
  notes: string[];
}

/** Hex a piece takes for a colour role under a customised palette. */
export function roleColorHex(role: FurnitureColorRole, derived: DerivedPalette): string {
  switch (role) {
    case 'hero': return derived.hero;
    case 'soft': return derived.heroSoft;
    case 'wood': return derived.wood;
    case 'accent': return derived.accent;
    default: return shade(derived.neutral, 0.5);
  }
}

/**
 * Colour role for a piece: the one it was tagged with, else inferred from its
 * name/category (used for AI-supplied pieces). Fixtures and appliances return
 * null so they keep their own finish.
 */
export function furnitureColorRole(piece: { name: string; category: string; colorRole?: FurnitureColorRole }): FurnitureColorRole | null {
  if (piece.colorRole) return piece.colorRole;
  const name = piece.name.toLowerCase();
  if (piece.category === 'bed' || /bed|sofa|couch|sectional|loveseat/.test(name)) return 'hero';
  if (/rug|carpet/.test(name)) return 'soft';
  if (piece.category === 'seating') return /armchair|accent|lounge|reading/.test(name) ? 'accent' : 'soft';
  if (piece.category === 'table' || piece.category === 'storage') return 'wood';
  if (piece.category === 'lighting') return 'neutral';
  if (piece.category === 'decor') return 'accent';
  return null;
}

/** Room-specific measured furniture briefs used when AI output is unavailable or incomplete. */
export function createRoomFurnitureSuggestions(
  roomType: string,
  width: number,
  depth: number,
  style: DesignStyle,
  palette: ColorSwatch[],
  requirements = '',
  budget = '',
  derived?: DerivedPalette,
  parsedRequirements?: ParsedRequirements,
  report?: RequirementReport,
): FurnitureSuggestion[] {
  const kind = roomType.toLowerCase();
  const parsed = parsedRequirements ?? parseRequirements(requirements);
  const wants = (item: RequirementItem) => parsed.add.includes(item);
  const living = /living|lounge|family|sitting/.test(kind);
  const bedroom = /bedroom|master bed|sleep/.test(kind);
  const kitchen = /kitchen|pantry/.test(kind);
  const bath = /bath|powder|washroom|toilet/.test(kind);
  const dining = /dining/.test(kind);
  const study = /study|office|work/.test(kind);
  const profile = getStyleProfile(style);
  const finish = profile.materials;
  const language = { bed: profile.names.bed, sofa: profile.names.sofa, chair: profile.names.chair, table: profile.names.table, placement: profile.placement };
  const tier = getBudgetTier(budget);
  const budgetTier = tier.finishLabel;
  const styleScale = profile.scale;
  const color = (role: ColorSwatch['role'], fallback: string) => palette.find((item) => item.role === role)?.hex || fallback;
  const fabric = color('secondary', '#d8d1c6');
  const timber = color('flooring', '#b99b78');
  const accent = color('accent', '#7d8372');
  const primary = color('primary', '#77736b');
  // Without user colours each role maps to the style palette exactly as before.
  const legacyRole: Record<FurnitureColorRole, string> = { hero: fabric, soft: fabric, wood: timber, accent, neutral: primary };
  const roleHex = (role: FurnitureColorRole) => (derived?.customised ? roleColorHex(role, derived) : legacyRole[role]);
  const toned = (material: string, role: FurnitureColorRole | undefined, hex: string) =>
    derived?.customised && (role === 'hero' || role === 'soft' || role === 'accent')
      ? `${nearestColorName(hex)}-toned ${material.charAt(0).toLowerCase()}${material.slice(1)}` : material;
  const fitW = (fraction: number, preferred: number, min = 0.45) => Math.max(Math.min(min, width), Math.min(width * fraction, preferred));
  const fitD = (fraction: number, preferred: number, min = 0.4) => Math.max(Math.min(min, depth), Math.min(depth * fraction, preferred));
  const item = (id: string, name: string, category: FurnitureSuggestion['category'], x: number, y: number, itemW: number, itemD: number, preferredWall: FurnitureSuggestion['preferredWall'], material: string, itemColor: string | FurnitureColorRole, clearance = 0.45): FurnitureSuggestion => {
    const colorRole = itemColor.startsWith('#') ? undefined : itemColor as FurnitureColorRole;
    const hex = colorRole ? roleHex(colorRole) : itemColor;
    return {
    id, name, category, x: Math.max(0, Math.min(width - itemW * styleScale, x)), y: Math.max(0, Math.min(depth - itemD * styleScale, y)),
    width: itemW * styleScale, depth: itemD * styleScale, preferredWall, material: `${toned(material, colorRole, hex)} · ${budgetTier} finish`, color: hex, ...(colorRole ? { colorRole } : {}), clearance,
  };
  };

  let pieces: FurnitureSuggestion[];
  if (bedroom) {
    const bedW = fitW(.58, 1.8, 1.35), bedD = fitD(.43, 2.05, 1.8);
    const bedX = (width - bedW) / 2;
    pieces = [
      item('bed', `${language.bed}${/master/i.test(kind) ? ' Suite' : ''}`, 'bed', bedX, .28, bedW, bedD, 'north', finish.upholstery, 'hero', .08),
      item('wardrobe', profile.names.wardrobe, 'storage', (width - fitW(.42, 1.65, 1.0)) / 2, depth - .72, fitW(.42, 1.65, 1.0), .62, 'south', finish.wood, 'wood', .12),
      item('nightstand-left', 'Bedside Table', 'table', Math.max(.06, bedX - .48), .44, .4, .4, 'west', finish.wood, 'wood', .08),
      item('nightstand-right', 'Bedside Table', 'table', Math.min(width - .46, bedX + bedW + .08), .44, .4, .4, 'east', finish.wood, 'wood', .08),
      item('bedroom-rug', 'Woven Area Rug', 'decor', (width - fitW(.76, 3.1, 1.5)) / 2, Math.min(depth - 1.8, Math.max(.8, bedD * .72)), fitW(.76, 3.1, 1.5), fitD(.45, 2.4, 1.4), 'center', finish.upholstery, 'soft', 0),
    ];
  } else if (kitchen) {
    // Reserve a connected bay for the fridge so the optimizer can keep the
    // appliance beside the worktop instead of marooning it at a room corner.
    const runW = Math.min(fitW(.78, 3.5, 1.7), Math.max(1.25, width - .84));
    const combined = /dining/.test(kind);
    const tableW = fitW(.38, 1.5, .9), tableD = .82, tableX = (width - tableW) / 2;
    // Keep the south chair clear of the typical entry swing, while leaving
    // enough depth between the back counter zone and the dining setting.
    const diningY = Math.max(1.55, depth * .42);
    const kitchenX = Math.max(0, (width - runW - .84) / 2);
    pieces = [
      { ...item('kitchen-run', `${profile.names.kitchen} Kitchen Cabinets & Counter`, 'storage', kitchenX, .22, runW, .66, 'north', `${finish.wood}, ${finish.stone}`, 'soft', .12), rotation: 0 },
      { ...item('refrigerator', 'Tall Refrigerator', 'electronics', kitchenX + runW + .12, .22, .72, .72, 'north', 'Brushed stainless steel', '#d7dbd9', .12), rotation: 0, relativeTo: 'kitchen-run', relativeSide: 'east' },
    ];
    if (combined && width >= 3.6 && depth >= 4) {
      const tableY = Math.min(depth - tableD - .85, diningY + language.placement);
      pieces.push(
        item('dining-table', `${language.table}`, 'table', tableX, tableY, tableW, tableD, 'center', finish.wood, 'wood', .18),
        { ...item('dining-chair-n', 'Dining Chair', 'seating', tableX + (tableW - .46) / 2, tableY - .56, .46, .46, 'north', finish.upholstery, 'soft', .5), rotation: 0, relativeTo: 'dining-table', relativeSide: 'north' },
        { ...item('dining-chair-s', 'Dining Chair', 'seating', tableX + (tableW - .46) / 2, tableY + tableD + .1, .46, .46, 'south', finish.upholstery, 'soft', .5), rotation: 180, relativeTo: 'dining-table', relativeSide: 'south' },
      );
    } else if (!combined) {
      pieces.push(item('kitchen-island', 'Kitchen Island', 'table', (width - fitW(.4, 1.45, .85)) / 2, Math.max(1.2, depth * .43), fitW(.4, 1.45, .85), .72, 'center', finish.wood, 'wood', .3));
    }
    if (width < 4 || depth < 4) pieces = pieces.filter((piece) => piece.id !== 'kitchen-island');
  } else if (bath) {
    const vanityW = fitW(.42, 1.25, .72), shower = Math.min(1.05, width * .34, depth * .3);
    pieces = [
      item('bath-vanity', 'Stone-Top Vanity & Basin', 'fixture', .14, .14, vanityW, .58, 'north', `Porcelain and ${finish.wood}`, '#e8e6e0', .12),
      item('shower', 'Glazed Walk-In Shower', 'fixture', width - shower - .14, .14, shower, shower, 'east', 'Clear glass and porcelain tile', '#dce9e9', .12),
      item('toilet', 'Close-Coupled WC', 'fixture', width - .56, depth - .78, .42, .68, 'south', 'White vitreous china', '#f8f8f5', .12),
    ];
  } else if (dining) {
    const tableW = fitW(.45, 1.8, 1.0), tableD = fitD(.3, .95, .72);
    const tableX = (width - tableW) / 2, tableY = Math.max(.55, (depth - tableD) / 2 + language.placement);
    pieces = [
      item('dining-table', language.table, 'table', tableX, tableY, tableW, tableD, 'center', finish.wood, 'wood', .28),
      { ...item('dining-chair-n', language.chair, 'seating', tableX + (tableW - .48) / 2, tableY - .6, .48, .5, 'north', finish.upholstery, 'soft', .5), rotation: 0, relativeTo: 'dining-table', relativeSide: 'north' },
      { ...item('dining-chair-s', language.chair, 'seating', tableX + (tableW - .48) / 2, tableY + tableD + .1, .48, .5, 'south', finish.upholstery, 'soft', .5), rotation: 180, relativeTo: 'dining-table', relativeSide: 'south' },
      { ...item('dining-chair-w', language.chair, 'seating', Math.max(.04, tableX - .6), tableY + (tableD - .5) / 2, .5, .48, 'west', finish.upholstery, 'soft', .5), rotation: 90, relativeTo: 'dining-table', relativeSide: 'west' },
      { ...item('dining-chair-e', language.chair, 'seating', Math.min(width - .54, tableX + tableW + .1), tableY + (tableD - .5) / 2, .5, .48, 'east', finish.upholstery, 'soft', .5), rotation: 270, relativeTo: 'dining-table', relativeSide: 'east' },
      item('dining-sideboard', 'Dining Sideboard', 'storage', (width - fitW(.55, 1.6, .9)) / 2, depth - .55, fitW(.55, 1.6, .9), .42, 'south', finish.wood, 'wood', .18),
    ];
  } else if (study) {
    const deskW = fitW(.5, 1.65, 1.0);
    pieces = [
      item('study-desk', 'Writing Desk', 'table', (width - deskW) / 2, .28, deskW, .68, 'north', finish.wood, 'wood', .18),
      item('study-chair', 'Task Chair', 'seating', (width - .58) / 2, 1.08, .58, .6, 'center', finish.upholstery, 'soft', .16),
      item('bookcase', 'Bookcase', 'storage', width - .62, depth * .42, .52, Math.min(1.55, depth * .42), 'east', finish.wood, 'wood', .12),
      item('study-rug', 'Flat-Weave Rug', 'decor', .24, depth * .4, fitW(.68, 2.4, 1.2), fitD(.42, 1.8, 1), 'center', finish.upholstery, 'soft', 0),
    ];
  } else {
    const sofaW = fitW(.58, 2.75, 1.5), sofaD = fitD(.22, .95, .72);
    const rugW = fitW(.78, 3.7, 1.8), rugD = fitD(.52, 3.1, 1.6);
    pieces = [
      item('living-sofa', language.sofa, 'seating', (width - sofaW) / 2, .78 + language.placement, sofaW, sofaD, 'north', finish.upholstery, 'hero', .3),
      item('living-rug', profile.names.rug, 'decor', (width - rugW) / 2, Math.max(.5, depth * .28), rugW, rugD, 'center', finish.upholstery, 'soft', 0),
      item('living-coffee', 'Timber Coffee Table', 'table', (width - fitW(.28, 1.25, .75)) / 2, depth * .53, fitW(.28, 1.25, .75), .58, 'center', finish.wood, 'wood', .24),
      item('living-chair', 'Accent Armchair', 'seating', Math.max(.12, width - .98), depth * .34, .82, .82, 'east', finish.upholstery, 'accent', .25),
      item('living-console', 'Media Console', 'storage', (width - fitW(.52, 2.25, 1.1)) / 2, depth - .62, fitW(.52, 2.25, 1.1), .42, 'south', finish.wood, 'wood', .18),
      item('living-lamp', 'Accent Floor Lamp', 'lighting', width - .62, .22, .42, .42, 'east', 'Brushed metal and opal glass', 'neutral', .12),
      item('living-plant', 'Potted Floor Plant', 'decor', .2, .2, .42, .42, 'west', 'Glazed ceramic and foliage', 'accent', 0),
    ];
  }

  const roomKind: RoomKind | null = bedroom ? 'bedroom' : kitchen || bath ? null : dining ? 'dining' : study ? 'study' : 'living';
  const placeOnWall = (piece: { wall: 'north' | 'south' | 'east' | 'west'; along: number; width: number; depth: number }) => {
    const along = (span: number, size: number) => Math.max(.1, Math.min(span - size - .1, piece.along * span - size / 2));
    return {
      x: piece.wall === 'west' ? .12 : piece.wall === 'east' ? width - piece.width - .12 : along(width, piece.width),
      y: piece.wall === 'north' ? .12 : piece.wall === 'south' ? depth - piece.depth - .12 : along(depth, piece.depth),
    };
  };
  const materialOf = (key: 'upholstery' | 'wood' | 'stone' | 'metal') => profile.materials[key];

  // Optional pieces: the style's signature pieces plus whatever the budget tier adds,
  // only where the room can take them and never in accessible layouts (fewer obstacles).
  if (roomKind && !parsed.accessibility) {
    const optional = [...(tier.signature ? signaturePiecesFor(profile, roomKind, width, depth) : []), ...extrasFor(tier, roomKind, width, depth)];
    for (const piece of optional) {
      if (pieces.some((existing) => existing.id === piece.id)) continue;
      const { x, y } = placeOnWall(piece);
      pieces.push(item(piece.id, piece.name, piece.category, x, y, piece.width, piece.depth, piece.wall, materialOf(piece.material), piece.role, .2));
    }
  }
  pieces = pieces.filter((piece) => !profile.avoid.includes(piece.id));

  // Budget: lean tiers leave out optional extras unless the user asked for them.
  const requestedFor: Record<string, RequirementItem> = { 'living-plant': 'plants', 'living-lamp': 'lamp', 'living-chair': 'armchair', 'dining-sideboard': 'storage' };
  if (tier.skipPieces) {
    pieces = pieces.filter((piece) => {
      if (!tier.skipPieces!.test(piece.id)) return true;
      const requested = /rug$/.test(piece.id) ? 'rug' : requestedFor[piece.id];
      return !!requested && wants(requested);
    });
  }

  // Requirements: add what was asked for, but only where it fits without pushing
  // out a piece the room already has; whatever does not fit is reported.
  const wet = kitchen || bath;
  const trialRoom = { width, depth, openings: defaultRoomOpenings(width, depth), doorClearance: roomDoorClearance(width, depth) };
  const placedIds = (list: FurnitureSuggestion[]) => new Set(optimizeFurnitureLayout(list, trialRoom).map((placed) => placed.id));
  const keepsAll = (before: Set<string>, after: Set<string>) => [...before].every((id) => after.has(id));
  const has = (pattern: RegExp) => pieces.some((piece) => pattern.test(piece.name) || pattern.test(piece.id));
  let placedSoFar: Set<string> | null = null;
  const tryAdd = (label: string, group: FurnitureSuggestion[]) => {
    placedSoFar ??= placedIds(pieces);
    const after = placedIds([...pieces, ...group]);
    if (keepsAll(placedSoFar, after) && group.every((piece) => after.has(String(piece.id)))) { pieces.push(...group); placedSoFar = after; }
    else report?.unfit.push(label);
  };
  if (wants('reading-nook') && !wet && !pieces.some((piece) => piece.id === 'reading-chair')) {
    tryAdd('Reading Chair', [item('reading-chair', 'Reading Chair', 'seating', .16, depth * .58, .78, .78, 'west', finish.upholstery, 'accent', .22)]);
  }
  if (wants('desk') && !wet && !study && !has(/desk/i)) {
    const spot = placeOnWall({ wall: 'west', along: .5, width: 1.2, depth: .6 });
    tryAdd('Compact Work Desk', [
      item('req-desk', 'Compact Work Desk', 'table', spot.x, spot.y, 1.2, .6, 'west', finish.wood, 'wood', .18),
      { ...item('req-desk-chair', 'Desk Chair', 'seating', spot.x + 1.3, spot.y + .05, .5, .5, 'center', finish.upholstery, 'soft', .16), rotation: 270, relativeTo: 'req-desk', relativeSide: 'east' },
    ]);
  }
  if (wants('plants') && !wet && !has(/plant/i)) tryAdd('Potted Floor Plant', [item('req-plant', 'Potted Floor Plant', 'decor', width - .62, depth - .62, .42, .42, 'east', 'Glazed ceramic and foliage', 'accent', 0)]);
  if (wants('lamp') && !wet && !has(/lamp/i)) tryAdd('Accent Floor Lamp', [item('req-lamp', 'Accent Floor Lamp', 'lighting', width - .62, .22, .42, .42, 'east', 'Brushed metal and opal glass', 'neutral', .12)]);
  if (wants('armchair') && !wet && !has(/armchair|accent chair/i)) tryAdd('Accent Armchair', [item('req-armchair', 'Accent Armchair', 'seating', Math.max(.12, width - .98), depth * .34, .82, .82, 'east', finish.upholstery, 'accent', .25)]);
  if (wants('rug') && !wet && !has(/rug|carpet/i)) {
    tryAdd(profile.names.rug, [item('req-rug', profile.names.rug, 'decor', (width - fitW(.7, 3, 1.5)) / 2, Math.max(.5, depth * .3), fitW(.7, 3, 1.5), fitD(.45, 2.2, 1.3), 'center', finish.upholstery, 'soft', 0)]);
  }
  if (wants('storage') && !pieces.some((piece) => piece.id === 'extra-storage')) {
    tryAdd('Storage Cabinet', [item('extra-storage', 'Storage Cabinet', 'storage', (width - fitW(.35, 1.2, .8)) / 2, depth - .58, fitW(.35, 1.2, .8), .42, 'south', finish.wood, 'wood', .14)]);
  }
  pieces = applyRemovals(pieces, parsed);

  // Accessibility: widen walkways between free-standing pieces (beds, bedside tables
  // and chairs tied to a table keep their deliberate close spacing). The widest gap
  // that still keeps every piece in the room wins; otherwise the layout is left alone.
  if (parsed.accessibility) {
    const widen = (gap: number) => pieces.map((piece) => (
      piece.category === 'decor' || piece.category === 'bed' || piece.relativeTo || /^nightstand/.test(String(piece.id)) ? piece
        : { ...piece, clearance: Math.max(piece.clearance ?? .45, gap) }
    ));
    const before = placedIds(pieces);
    const gap = [.7, .55].find((candidate) => keepsAll(before, placedIds(widen(candidate))));
    if (gap) pieces = widen(gap);
    else report?.notes.push('This room is too small to widen walkways without removing furniture, so the standard spacing was kept.');
  }
  return pieces;
}
