import type { ColorSwatch, DesignStyle } from '../types';
import type { FurnitureSuggestion } from './layoutOptimizer';
import { getStyleRecipe, normalizeRoomType } from './interiorStyles';
import { selectArrangement, ArrangementTemplate } from './interiorArrangements';

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
  seed = 0
): RoomProgramResult {
  const { width, depth } = size;
  const roomKey = normalizeRoomType(roomType);
  const recipe = getStyleRecipe(style);
  const pref = requirements.toLowerCase();
  const arrangement = selectArrangement(roomKey, width, depth, recipe, seed);

  const budgetTier = /75|luxury/i.test(budget)
    ? 'bespoke'
    : /35|60|high/i.test(budget)
    ? 'premium'
    : /(^|\D)(5,000|10,000)|essential/i.test(budget)
    ? 'essential'
    : 'considered';

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

  // Handle explicit reading nook/chair request
  if (/reading nook|reading chair/i.test(pref) && !suggestions.some((s) => s.id === 'reading-chair')) {
    suggestions.push({
      id: 'reading-chair',
      name: 'Reading Chair',
      category: 'seating',
      role: 'accent-chair',
      form: recipe.forms['accent-chair'],
      x: Math.max(0.16, width * 0.12),
      y: Math.max(0.16, depth * 0.6),
      width: 0.78 * scale,
      depth: 0.78 * scale,
      height: 0.82,
      preferredWall: 'west',
      facing: 'room',
      material: `${recipe.materials.upholstery} · ${budgetTier} finish`,
      color: accentColor,
      clearance: 0.25,
    });
  }

  // Handle extra storage request
  if (
    /extra storage|more storage/i.test(pref) &&
    !suggestions.some((piece) => piece.category === 'storage')
  ) {
    const storeW = Math.min(width * 0.35, 1.2) * scale;
    suggestions.push({
      id: 'extra-storage',
      name: 'Storage Cabinet',
      category: 'storage',
      role: 'media-console',
      form: recipe.forms['media-console'],
      x: (width - storeW) / 2,
      y: depth - 0.58,
      width: storeW,
      depth: 0.42 * scale,
      height: 0.78,
      preferredWall: 'south',
      facing: 'wall',
      material: `${recipe.materials.wood} · ${budgetTier} finish`,
      color: timberColor,
      clearance: 0.2,
    });
  }

  return { suggestions, arrangement };
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
  seed = 0
): FurnitureSuggestion[] {
  const { suggestions } = buildRoomProgram(
    roomType,
    style,
    { width, depth },
    palette,
    requirements,
    budget,
    seed
  );
  return suggestions;
}
