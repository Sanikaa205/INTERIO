import type { ColorSwatch, DesignStyle, FurnitureColorRole } from '../types';
import { defaultRoomOpenings, optimizeFurnitureLayout, roomDoorClearance, type FurnitureSuggestion } from './layoutOptimizer';
import { getStyleRecipe, normalizeRoomType } from './interiorStyles';
import { selectArrangement, ArrangementTemplate } from './interiorArrangements';
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

/** Optional inputs from the colour, requirements and budget engines. */
export interface ProgramOptions {
  /** Palette derived from the user's colours; pieces take their role's tone when it is customised. */
  derived?: DerivedPalette;
  parsed?: ParsedRequirements;
  report?: RequirementReport;
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
  if (piece.category === 'bed' || /bed|sofa|couch|sectional|loveseat/.test(name)) return 'hero';
  if (/rug|carpet/.test(name)) return 'soft';
  if (piece.category === 'seating') return /armchair|accent|lounge|reading/.test(name) ? 'accent' : 'soft';
  if (piece.category === 'table' || piece.category === 'storage') return 'wood';
  if (piece.category === 'lighting') return 'neutral';
  if (piece.category === 'decor') return 'accent';
  return null;
}

export interface RoomProgramResult {
  suggestions: FurnitureSuggestion[];
  arrangement: ArrangementTemplate;
}

/**
 * Builds a deterministic, room- and style-aware furniture program.
 * Incorporates room dimensions, style recipes, arrangement templates,
 * explicit requirements, and variation seeds.
 */
export function buildRoomProgram(
  roomType: string,
  style: DesignStyle,
  size: { width: number; depth: number },
  palette: ColorSwatch[],
  requirements = '',
  budget = '',
  seed = 0,
  options: ProgramOptions = {}
): RoomProgramResult {
  const { width, depth } = size;
  const { derived, report } = options;
  const roomKey = normalizeRoomType(roomType);
  const recipe = getStyleRecipe(style);
  const pref = requirements.toLowerCase();
  const arrangement = selectArrangement(roomKey, width, depth, recipe, seed);

  const tier = getBudgetTier(budget);
  const budgetTier = tier.finishLabel;
  const parsed = options.parsed ?? parseRequirements(requirements);
  const profile = getStyleProfile(style);

  const getColor = (role: ColorSwatch['role'], fallback: string) =>
    palette.find((item) => item.role === role)?.hex || fallback;

  const fabricColor = getColor('secondary', '#d8d1c6');
  const timberColor = getColor('flooring', '#b99b78');
  const accentColor = getColor('accent', '#7d8372');
  const primaryColor = getColor('primary', '#1e293b');

  const getRoleMaterial = (category: string, role: string): string => {
    if (category === 'seating') return recipe.materials.upholstery;
    if (category === 'table' || category === 'storage') return recipe.materials.wood;
    if (category === 'bed') return `${recipe.materials.wood} & ${recipe.materials.upholstery}`;
    if (category === 'fixture') return `${recipe.materials.stone} & ${recipe.materials.metal}`;
    if (category === 'lighting') return recipe.materials.lighting;
    if (role === 'rug') return recipe.materials.upholstery;
    return recipe.materials.wood;
  };

  const getRoleColor = (category: string, role: string): string => {
    if (role === 'accent-chair' || role === 'plant' || role === 'floor-lamp') return accentColor;
    if (category === 'seating' || category === 'bed') return fabricColor;
    if (category === 'table' || category === 'storage') return timberColor;
    if (category === 'fixture') return getColor('secondary', '#e8e6e0');
    if (role === 'rug') return getColor('secondary', '#e5dfd5');
    return primaryColor;
  };

  const scale = recipe.styleScale;
  const suggestions: FurnitureSuggestion[] = [];
  let chairCounter = 0;
  const diningSides: ('north' | 'south' | 'west' | 'east')[] = ['north', 'south', 'west', 'east'];
  const diningRotations = { north: 0, south: 180, west: 90, east: 270 };

  for (const slot of arrangement.slots) {
    // Check density rules: minimal drops non-essential pieces in compact rooms
    if (recipe.density === 'sparse' && !slot.essential && (width < 4.2 || depth < 4.2)) {
      if (slot.role === 'bench' || slot.role === 'accent-chair' || slot.role === 'sideboard') {
        continue;
      }
    }

    // Explicit requirements filtering
    if (/without tv|no tv|no television/i.test(pref) && slot.role === 'media-console') {
      continue;
    }

    // Size calculation bounded by room dimensions and slot limits
    const rawW = width * slot.widthRatio;
    const rawD = depth * slot.depthRatio;
    let itemW = Math.max(slot.minWidth || 0.45, Math.min(slot.maxWidth || width * 0.9, rawW));
    let itemD = Math.max(slot.minDepth || 0.4, Math.min(slot.maxDepth || depth * 0.9, rawD));
    itemW = Math.min(width - 0.2, itemW * scale);
    itemD = Math.min(depth - 0.2, itemD * scale);

    // Initial anchor position based on ratio and placement offset
    let posX = Math.max(0.1, Math.min(width - itemW - 0.1, width * slot.xRatio - itemW / 2));
    let posY = Math.max(0.1, Math.min(depth - itemD - 0.1, depth * slot.yRatio - itemD / 2 + recipe.placementOffset));

    // Form and naming
    const baseForm = recipe.forms[slot.role] || slot.role;
    let displayName = baseForm;
    let itemId = `${slot.role}`;

    if (slot.role === 'dining-chair') {
      const side = diningSides[chairCounter % diningSides.length];
      itemId = `dining-chair-${side[0]}`;
      chairCounter++;
      // Align dining chairs relative to the dining table
      const relTable = slot.relativeTo || 'dining-table';
      const table = suggestions.find((s) => s.id === relTable);
      const chairW = Math.min(0.48, itemW);
      const chairD = Math.min(0.5, itemD);
      let chairX = posX;
      let chairY = posY;
      if (table) {
        if (side === 'north') {
          chairX = table.x + (table.width - chairW) / 2;
          chairY = Math.max(0.04, table.y - chairD - 0.1);
        } else if (side === 'south') {
          chairX = table.x + (table.width - chairW) / 2;
          chairY = Math.min(depth - chairD - 0.04, table.y + table.depth + 0.1);
        } else if (side === 'west') {
          chairX = Math.max(0.04, table.x - chairW - 0.1);
          chairY = table.y + (table.depth - chairD) / 2;
        } else if (side === 'east') {
          chairX = Math.min(width - chairW - 0.04, table.x + table.width + 0.1);
          chairY = table.y + (table.depth - chairD) / 2;
        }
      }
      suggestions.push({
        id: itemId,
        name: displayName,
        category: slot.category,
        role: slot.role,
        form: baseForm,
        x: chairX,
        y: chairY,
        width: chairW,
        depth: chairD,
        height: slot.defaultHeight,
        preferredWall: side,
        facing: 'room',
        material: `${recipe.materials.upholstery} · ${budgetTier} finish`,
        color: fabricColor,
        clearance: 0.5,
        relativeTo: relTable,
        relativeSide: side,
        rotation: diningRotations[side],
      });
      continue;
    }

    if (slot.role === 'nightstand') {
      const isLeft = !suggestions.some((s) => s.id === 'nightstand-left');
      itemId = isLeft ? 'nightstand-left' : 'nightstand-right';
      displayName = 'Bedside Table';
    } else if (slot.role === 'bed') {
      displayName = `${baseForm}${/master/i.test(roomType) ? ' Suite' : ''}`;
    } else if (slot.role === 'rug') {
      displayName =
        roomKey === 'living'
          ? style === 'traditional'
            ? 'Heritage Pattern Area Rug'
            : 'Textured Area Rug'
          : style === 'traditional'
          ? 'Heritage Pattern Area Rug'
          : 'Woven Area Rug';
    } else if (slot.role === 'plant') {
      displayName = 'Potted Floor Plant';
    } else if (slot.role === 'floor-lamp') {
      displayName = 'Accent Floor Lamp';
    } else if (slot.role === 'accent-chair') {
      displayName = 'Accent Armchair';
    } else if (slot.role === 'coffee-table') {
      displayName = 'Timber Coffee Table';
    } else if (slot.role === 'media-console') {
      displayName = 'Media Console';
    } else if (slot.role === 'wardrobe') {
      displayName =
        style === 'traditional'
          ? 'Walnut Panel Wardrobe'
          : style === 'industrial'
          ? 'Steel-Framed Storage Wardrobe'
          : style === 'japandi'
          ? 'Slatted Cedar Wardrobe'
          : 'Full-Height Wardrobe';
    } else if (slot.role === 'kitchen-run') {
      displayName = `${
        style === 'industrial'
          ? 'Blackened Steel and Reclaimed Timber'
          : style === 'traditional'
          ? 'Inset Heritage Walnut'
          : style === 'japandi'
          ? 'Slatted Cedar'
          : style === 'minimal'
          ? 'Handleless Minimal'
          : 'Sleek Modern'
      } Kitchen Cabinets & Counter`;
    } else if (slot.role === 'refrigerator') {
      displayName = 'Tall Refrigerator';
    } else if (slot.role === 'vanity') {
      displayName = 'Stone-Top Vanity & Basin';
    } else if (slot.role === 'shower') {
      displayName = 'Glazed Walk-In Shower';
    } else if (slot.role === 'toilet') {
      displayName = 'Close-Coupled WC';
    } else if (slot.role === 'desk') {
      displayName = 'Writing Desk';
    } else if (slot.role === 'desk-chair') {
      displayName = 'Task Chair';
    } else if (slot.role === 'bookcase') {
      displayName = 'Bookcase';
    } else if (slot.role === 'sideboard') {
      displayName = 'Dining Sideboard';
    } else if (slot.role === 'kitchen-island') {
      displayName = 'Kitchen Island';
    }

    const mat = getRoleMaterial(slot.category, slot.role);
    const col = getRoleColor(slot.category, slot.role);

    suggestions.push({
      id: itemId,
      name: displayName,
      category: slot.category,
      role: slot.role,
      form: baseForm,
      x: posX,
      y: posY,
      width: itemW,
      depth: itemD,
      height: slot.defaultHeight,
      preferredWall: slot.preferredWall,
      facing: slot.facing,
      material: `${mat} · ${budgetTier} finish`,
      color: col,
      clearance: slot.clearance,
      relativeTo: slot.relativeTo,
      relativeSide: slot.relativeSide,
      rotation: slot.rotation,
    });
  }

  // ---- Colour: with user colours each piece takes its role's tone (bed/sofa lead, rugs soft,
  // timber pieces wood); without them the style palette colours chosen above stand.
  const toned = (material: string, hex: string) => `${nearestColorName(hex)}-toned ${material.charAt(0).toLowerCase()}${material.slice(1)}`;
  const applyColour = (piece: FurnitureSuggestion) => {
    const role = furnitureColorRole(piece);
    if (role) piece.colorRole = role;
    if (derived?.customised && role) {
      piece.color = roleColorHex(role, derived);
      if (piece.material && (role === 'hero' || role === 'soft' || role === 'accent')) {
        const [base, ...rest] = piece.material.split(' · ');
        piece.material = [toned(base, piece.color), ...rest].join(' · ');
      }
    }
  };
  suggestions.forEach(applyColour);

  // Helpers for the optional pieces below (signature, budget and requested extras).
  // Added pieces (signature, budget extras, requests) get a believable height so 3D proportions are right.
  const heightFor = (category: FurnitureSuggestion['category'], name: string) =>
    category === 'bed' ? 1.0
    : category === 'seating' ? (/stool|ottoman|pouf/i.test(name) ? 0.45 : 0.85)
    : category === 'table' ? (/coffee|side|bedside/i.test(name) ? 0.45 : 0.75)
    : category === 'storage' ? (/bookcase|wardrobe|shelf/i.test(name) ? 1.8 : 0.8)
    : category === 'lighting' ? (/table|desk/i.test(name) ? 0.5 : 1.55)
    : category === 'decor' ? (/rug|carpet/i.test(name) ? 0.02 : /plant/i.test(name) ? 1.2 : 0.5)
    : 0.8;
  const item = (
    id: string, name: string, category: FurnitureSuggestion['category'], x: number, y: number, itemW: number, itemD: number,
    preferredWall: FurnitureSuggestion['preferredWall'], material: string, itemColor: string | FurnitureColorRole, clearance = 0.2,
  ): FurnitureSuggestion => {
    const colorRole = itemColor.startsWith('#') ? undefined : itemColor as FurnitureColorRole;
    const hex = colorRole ? (derived?.customised ? roleColorHex(colorRole, derived) : ({ hero: fabricColor, soft: fabricColor, wood: timberColor, accent: accentColor, neutral: primaryColor } as const)[colorRole]) : itemColor;
    const baseMaterial = derived?.customised && (colorRole === 'hero' || colorRole === 'soft' || colorRole === 'accent') ? toned(material, hex) : material;
    return {
      id, name, category,
      x: Math.max(0, Math.min(width - itemW * scale, x)), y: Math.max(0, Math.min(depth - itemD * scale, y)),
      width: itemW * scale, depth: itemD * scale, height: heightFor(category, name), preferredWall, material: `${baseMaterial} · ${budgetTier} finish`,
      color: hex, ...(colorRole ? { colorRole } : {}), clearance,
    };
  };
  const fitW = (fraction: number, preferred: number, min = 0.45) => Math.max(Math.min(min, width), Math.min(width * fraction, preferred));
  const fitD = (fraction: number, preferred: number, min = 0.4) => Math.max(Math.min(min, depth), Math.min(depth * fraction, preferred));
  const finish = recipe.materials;
  const roomKind: RoomKind | null = roomKey === 'bedroom' || roomKey === 'masterBedroom' ? 'bedroom'
    : roomKey === 'kitchen' || roomKey === 'bathroom' || roomKey === 'kitchenDining' ? null
    : roomKey === 'dining' ? 'dining' : roomKey === 'study' || roomKey === 'homeOffice' ? 'study' : 'living';
  const placeOnWall = (piece: { wall: 'north' | 'south' | 'east' | 'west'; along: number; width: number; depth: number }) => {
    const along = (span: number, size: number) => Math.max(0.1, Math.min(span - size - 0.1, piece.along * span - size / 2));
    return {
      x: piece.wall === 'west' ? 0.12 : piece.wall === 'east' ? width - piece.width - 0.12 : along(width, piece.width),
      y: piece.wall === 'north' ? 0.12 : piece.wall === 'south' ? depth - piece.depth - 0.12 : along(depth, piece.depth),
    };
  };
  const materialOf = (key: 'upholstery' | 'wood' | 'stone' | 'metal') => recipe.materials[key] ?? profile.materials[key];

  // Optional pieces: the style's signature pieces plus whatever the budget tier adds,
  // only where the room can take them and never in accessible layouts (fewer obstacles).
  if (roomKind && !parsed.accessibility) {
    const optional = [...(tier.signature ? signaturePiecesFor(profile, roomKind, width, depth) : []), ...extrasFor(tier, roomKind, width, depth)];
    for (const piece of optional) {
      if (suggestions.some((existing) => existing.id === piece.id)) continue;
      const { x, y } = placeOnWall(piece);
      suggestions.push(item(piece.id, piece.name, piece.category, x, y, piece.width, piece.depth, piece.wall, materialOf(piece.material), piece.role, 0.2));
    }
  }

  // The generator's role-based ids map onto the ids the style and budget rules were written for.
  const legacyId = (piece: FurnitureSuggestion): string => {
    const role = piece.role;
    if (roomKind === 'living') {
      if (role === 'floor-lamp') return 'living-lamp';
      if (role === 'plant') return 'living-plant';
      if (role === 'accent-chair') return 'living-chair';
    }
    if (roomKind === 'dining' && role === 'sideboard') return 'dining-sideboard';
    return String(piece.id);
  };
  const keep = suggestions.filter((piece) => !profile.avoid.includes(legacyId(piece)));
  suggestions.length = 0;
  suggestions.push(...keep);

  // Budget: lean tiers leave out optional extras unless the user asked for them.
  const requestedFor: Record<string, RequirementItem> = { 'living-plant': 'plants', 'living-lamp': 'lamp', 'living-chair': 'armchair', 'dining-sideboard': 'storage' };
  const wants = (wanted: RequirementItem) => parsed.add.includes(wanted);
  if (tier.skipPieces) {
    const kept = suggestions.filter((piece) => {
      const id = legacyId(piece);
      if (!tier.skipPieces!.test(id)) return true;
      const requested = /rug$/.test(id) ? 'rug' : requestedFor[id];
      return !!requested && wants(requested);
    });
    suggestions.length = 0;
    suggestions.push(...kept);
  }

  // Requirements: add what was asked for, but only where it fits without pushing
  // out a piece the room already has; whatever does not fit is reported.
  const wet = roomKey === 'kitchen' || roomKey === 'bathroom' || roomKey === 'kitchenDining';
  const study = roomKey === 'study' || roomKey === 'homeOffice';
  const trialRoom = { width, depth, openings: defaultRoomOpenings(width, depth), doorClearance: roomDoorClearance(width, depth) };
  const placedIds = (list: FurnitureSuggestion[]) => new Set(optimizeFurnitureLayout(list, trialRoom).map((placed) => placed.id));
  const keepsAll = (before: Set<string>, after: Set<string>) => [...before].every((id) => after.has(id));
  const has = (pattern: RegExp) => suggestions.some((piece) => pattern.test(piece.name) || pattern.test(String(piece.id)));
  let placedSoFar: Set<string> | null = null;
  const tryAdd = (label: string, group: FurnitureSuggestion[]) => {
    placedSoFar ??= placedIds(suggestions);
    const after = placedIds([...suggestions, ...group]);
    if (keepsAll(placedSoFar, after) && group.every((piece) => after.has(String(piece.id)))) { suggestions.push(...group); placedSoFar = after; }
    else report?.unfit.push(label);
  };
  if (wants('reading-nook') && !wet && !suggestions.some((piece) => piece.id === 'reading-chair')) {
    tryAdd('Reading Chair', [item('reading-chair', 'Reading Chair', 'seating', 0.16, depth * 0.58, 0.78, 0.78, 'west', finish.upholstery, 'accent', 0.22)]);
  }
  if (wants('desk') && !wet && !study && !has(/desk/i)) {
    const spot = placeOnWall({ wall: 'west', along: 0.5, width: 1.2, depth: 0.6 });
    tryAdd('Compact Work Desk', [
      item('req-desk', 'Compact Work Desk', 'table', spot.x, spot.y, 1.2, 0.6, 'west', finish.wood, 'wood', 0.18),
      { ...item('req-desk-chair', 'Desk Chair', 'seating', spot.x + 1.3, spot.y + 0.05, 0.5, 0.5, 'center', finish.upholstery, 'soft', 0.16), rotation: 270, relativeTo: 'req-desk', relativeSide: 'east' },
    ]);
  }
  if (wants('plants') && !wet && !has(/plant/i)) tryAdd('Potted Floor Plant', [item('req-plant', 'Potted Floor Plant', 'decor', width - 0.62, depth - 0.62, 0.42, 0.42, 'east', 'Glazed ceramic and foliage', 'accent', 0)]);
  if (wants('lamp') && !wet && !has(/lamp/i)) tryAdd('Accent Floor Lamp', [item('req-lamp', 'Accent Floor Lamp', 'lighting', width - 0.62, 0.22, 0.42, 0.42, 'east', 'Brushed metal and opal glass', 'neutral', 0.12)]);
  if (wants('armchair') && !wet && !has(/armchair|accent chair/i)) tryAdd('Accent Armchair', [item('req-armchair', 'Accent Armchair', 'seating', Math.max(0.12, width - 0.98), depth * 0.34, 0.82, 0.82, 'east', finish.upholstery, 'accent', 0.25)]);
  if (wants('rug') && !wet && !has(/rug|carpet/i)) {
    tryAdd(profile.names.rug, [item('req-rug', profile.names.rug, 'decor', (width - fitW(0.7, 3, 1.5)) / 2, Math.max(0.5, depth * 0.3), fitW(0.7, 3, 1.5), fitD(0.45, 2.2, 1.3), 'center', finish.upholstery, 'soft', 0)]);
  }
  if (wants('storage') && !suggestions.some((piece) => piece.id === 'extra-storage')) {
    tryAdd('Storage Cabinet', [item('extra-storage', 'Storage Cabinet', 'storage', (width - fitW(0.35, 1.2, 0.8)) / 2, depth - 0.58, fitW(0.35, 1.2, 0.8), 0.42, 'south', finish.wood, 'wood', 0.14)]);
  }
  let finalPieces = applyRemovals(suggestions, parsed);

  // Accessibility: widen walkways between free-standing pieces (beds, bedside tables
  // and chairs tied to a table keep their deliberate close spacing). The widest gap
  // that still keeps every piece in the room wins; otherwise the layout is left alone.
  if (parsed.accessibility) {
    const widen = (gap: number) => finalPieces.map((piece) => (
      piece.category === 'decor' || piece.category === 'bed' || piece.relativeTo || /^nightstand/.test(String(piece.id)) ? piece
        : { ...piece, clearance: Math.max(piece.clearance ?? 0.45, gap) }
    ));
    const before = placedIds(finalPieces);
    const gap = [0.7, 0.55].find((candidate) => keepsAll(before, placedIds(widen(candidate))));
    if (gap) finalPieces = widen(gap);
    else report?.notes.push('This room is too small to widen walkways without removing furniture, so the standard spacing was kept.');
  }

  return { suggestions: finalPieces, arrangement };
}

/**
 * Backwards-compatible factory function.
 * Same signature as before, but backed by the new style recipes and arrangement templates.
 */
export function createRoomFurnitureSuggestions(
  roomType: string,
  width: number,
  depth: number,
  style: DesignStyle,
  palette: ColorSwatch[],
  requirements = '',
  budget = '',
  seed = 0,
  options: ProgramOptions = {}
): FurnitureSuggestion[] {
  const { suggestions } = buildRoomProgram(
    roomType,
    style,
    { width, depth },
    palette,
    requirements,
    budget,
    seed,
    options
  );
  return suggestions;
}
