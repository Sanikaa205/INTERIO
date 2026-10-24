import type { ColorSwatch, DesignStyle } from '../types';
import type { FurnitureSuggestion } from './layoutOptimizer';

/** Room-specific measured furniture briefs used when AI output is unavailable or incomplete. */
export function createRoomFurnitureSuggestions(
  roomType: string,
  width: number,
  depth: number,
  style: DesignStyle,
  palette: ColorSwatch[],
  requirements = '',
): FurnitureSuggestion[] {
  const kind = roomType.toLowerCase();
  const pref = requirements.toLowerCase();
  const living = /living|lounge|family|sitting/.test(kind);
  const bedroom = /bedroom|master bed|sleep/.test(kind);
  const kitchen = /kitchen|pantry/.test(kind);
  const bath = /bath|powder|washroom|toilet/.test(kind);
  const dining = /dining/.test(kind);
  const study = /study|office|work/.test(kind);
  const styles: Record<DesignStyle, { upholstery: string; wood: string; stone: string }> = {
    modern: { upholstery: 'Performance woven neutral fabric', wood: 'Smoked oak veneer', stone: 'Honed grey quartz' },
    minimal: { upholstery: 'Natural undyed linen', wood: 'Pale ash with a matte finish', stone: 'Warm limestone' },
    traditional: { upholstery: 'Tufted velvet upholstery', wood: 'Hand-finished walnut', stone: 'Calacatta marble' },
    industrial: { upholstery: 'Distressed cognac leather', wood: 'Reclaimed timber and blackened steel', stone: 'Sealed concrete' },
    scandinavian: { upholstery: 'Soft oatmeal boucle', wood: 'Blonde white oak', stone: 'Pale terrazzo' },
    japandi: { upholstery: 'Textured natural flax', wood: 'Oiled cedar and oak', stone: 'Hand-finished clay' },
  };
  const finish = styles[style] || styles.modern;
  const color = (role: ColorSwatch['role'], fallback: string) => palette.find((item) => item.role === role)?.hex || fallback;
  const fabric = color('secondary', '#d8d1c6');
  const timber = color('flooring', '#b99b78');
  const accent = color('accent', '#7d8372');
  const primary = color('primary', '#77736b');
  const fitW = (fraction: number, preferred: number, min = 0.45) => Math.max(Math.min(min, width), Math.min(width * fraction, preferred));
  const fitD = (fraction: number, preferred: number, min = 0.4) => Math.max(Math.min(min, depth), Math.min(depth * fraction, preferred));
  const item = (id: string, name: string, category: FurnitureSuggestion['category'], x: number, y: number, itemW: number, itemD: number, preferredWall: FurnitureSuggestion['preferredWall'], material: string, itemColor: string, clearance = 0.45): FurnitureSuggestion => ({
    id, name, category, x: Math.max(0, Math.min(width - itemW, x)), y: Math.max(0, Math.min(depth - itemD, y)),
    width: itemW, depth: itemD, preferredWall, material, color: itemColor, clearance,
  });

  let pieces: FurnitureSuggestion[];
  if (bedroom) {
    const bedW = fitW(.58, 1.8, 1.35), bedD = fitD(.43, 2.05, 1.8);
    const bedX = (width - bedW) / 2;
    pieces = [
      item('bed', /master/i.test(kind) ? 'Upholstered King Bed' : 'Upholstered Bed', 'bed', bedX, .28, bedW, bedD, 'north', finish.upholstery, fabric, .08),
      item('wardrobe', 'Full-Height Wardrobe', 'storage', (width - fitW(.42, 1.65, 1.0)) / 2, depth - .72, fitW(.42, 1.65, 1.0), .62, 'south', finish.wood, timber, .12),
      item('nightstand-left', 'Bedside Table', 'table', Math.max(.06, bedX - .48), .44, .4, .4, 'west', finish.wood, timber, .08),
      item('nightstand-right', 'Bedside Table', 'table', Math.min(width - .46, bedX + bedW + .08), .44, .4, .4, 'east', finish.wood, timber, .08),
      item('bedroom-rug', 'Woven Area Rug', 'decor', (width - fitW(.76, 3.1, 1.5)) / 2, Math.min(depth - 1.8, Math.max(.8, bedD * .72)), fitW(.76, 3.1, 1.5), fitD(.45, 2.4, 1.4), 'center', finish.upholstery, fabric, 0),
    ];
  } else if (kitchen) {
    const runW = fitW(.86, 3.5, 1.7);
    pieces = [
      item('kitchen-run', 'Kitchen Cabinets & Counter', 'storage', (width - runW) / 2, .14, runW, .66, 'north', `${finish.wood}, ${finish.stone}`, color('secondary', '#d7d0c4'), .12),
      item('refrigerator', 'Tall Refrigerator', 'electronics', .16, depth - .82, .72, .72, 'west', 'Brushed stainless steel', '#d7dbd9', .22),
      item('kitchen-island', 'Kitchen Island', 'table', (width - fitW(.4, 1.45, .85)) / 2, Math.max(.95, depth * .43), fitW(.4, 1.45, .85), .72, 'center', finish.wood, timber, .3),
    ];
    if (/dining/.test(kind) && width >= 4.2 && depth >= 4.2) {
      pieces = pieces.filter((piece) => piece.id !== 'kitchen-island');
      const tableW = fitW(.38, 1.5, .9), tableD = .82, tableX = (width - tableW) / 2, tableY = Math.max(1.25, depth * .47);
      pieces.push(
        item('dining-table', 'Compact Dining Table', 'table', tableX, tableY, tableW, tableD, 'center', finish.wood, timber, .18),
        item('dining-chair-n', 'Dining Chair', 'seating', tableX + (tableW - .44) / 2, tableY - .52, .44, .46, 'north', finish.upholstery, fabric, .08),
        item('dining-chair-s', 'Dining Chair', 'seating', tableX + (tableW - .44) / 2, tableY + tableD + .08, .44, .46, 'south', finish.upholstery, fabric, .08),
      );
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
    const tableX = (width - tableW) / 2, tableY = Math.max(.55, (depth - tableD) / 2);
    pieces = [
      item('dining-table', 'Solid Timber Dining Table', 'table', tableX, tableY, tableW, tableD, 'center', finish.wood, timber, .28),
      item('dining-chair-n', 'Upholstered Dining Chair', 'seating', tableX + (tableW - .48) / 2, tableY - .58, .48, .5, 'north', finish.upholstery, fabric, .12),
      item('dining-chair-s', 'Upholstered Dining Chair', 'seating', tableX + (tableW - .48) / 2, tableY + tableD + .12, .48, .5, 'south', finish.upholstery, fabric, .12),
      item('dining-chair-w', 'Upholstered Dining Chair', 'seating', Math.max(.04, tableX - .58), tableY + (tableD - .48) / 2, .5, .48, 'west', finish.upholstery, fabric, .12),
      item('dining-chair-e', 'Upholstered Dining Chair', 'seating', Math.min(width - .54, tableX + tableW + .12), tableY + (tableD - .48) / 2, .5, .48, 'east', finish.upholstery, fabric, .12),
      item('dining-sideboard', 'Dining Sideboard', 'storage', (width - fitW(.55, 1.6, .9)) / 2, depth - .55, fitW(.55, 1.6, .9), .42, 'south', finish.wood, timber, .18),
    ];
  } else if (study) {
    const deskW = fitW(.5, 1.65, 1.0);
    pieces = [
      item('study-desk', 'Writing Desk', 'table', (width - deskW) / 2, .28, deskW, .68, 'north', finish.wood, timber, .18),
      item('study-chair', 'Task Chair', 'seating', (width - .58) / 2, 1.08, .58, .6, 'center', finish.upholstery, fabric, .16),
      item('bookcase', 'Bookcase', 'storage', width - .62, depth * .42, .52, Math.min(1.55, depth * .42), 'east', finish.wood, timber, .12),
      item('study-rug', 'Flat-Weave Rug', 'decor', .24, depth * .4, fitW(.68, 2.4, 1.2), fitD(.42, 1.8, 1), 'center', finish.upholstery, fabric, 0),
    ];
  } else {
    const sofaW = fitW(.58, 2.75, 1.5), sofaD = fitD(.22, .95, .72);
    const rugW = fitW(.78, 3.7, 1.8), rugD = fitD(.52, 3.1, 1.6);
    pieces = [
      item('living-sofa', style === 'traditional' ? 'Tufted Lounge Sofa' : 'Tailored Lounge Sofa', 'seating', (width - sofaW) / 2, .78, sofaW, sofaD, 'north', finish.upholstery, fabric, .3),
      item('living-rug', style === 'traditional' ? 'Heritage Pattern Area Rug' : 'Textured Area Rug', 'decor', (width - rugW) / 2, Math.max(.5, depth * .28), rugW, rugD, 'center', finish.upholstery, color('secondary', '#e5dfd5'), 0),
      item('living-coffee', 'Timber Coffee Table', 'table', (width - fitW(.28, 1.25, .75)) / 2, depth * .53, fitW(.28, 1.25, .75), .58, 'center', finish.wood, timber, .24),
      item('living-chair', 'Accent Armchair', 'seating', Math.max(.12, width - .98), depth * .34, .82, .82, 'east', finish.upholstery, accent, .25),
      item('living-console', 'Media Console', 'storage', (width - fitW(.52, 2.25, 1.1)) / 2, depth - .62, fitW(.52, 2.25, 1.1), .42, 'south', finish.wood, timber, .18),
      item('living-lamp', 'Accent Floor Lamp', 'lighting', width - .62, .22, .42, .42, 'east', 'Brushed metal and opal glass', primary, .12),
      item('living-plant', 'Potted Floor Plant', 'decor', .2, .2, .42, .42, 'west', 'Glazed ceramic and foliage', accent, 0),
    ];
    if (/without tv|no tv|no television/i.test(pref)) pieces = pieces.filter((piece) => piece.id !== 'living-console');
    if (/reading nook|reading chair/i.test(pref)) pieces.push(item('reading-chair', 'Reading Chair', 'seating', .16, depth * .58, .78, .78, 'west', finish.upholstery, accent, .22));
  }

  if (/extra storage|more storage/i.test(pref) && !pieces.some((piece) => piece.category === 'storage')) {
    pieces.push(item('extra-storage', 'Storage Cabinet', 'storage', (width - fitW(.35, 1.2, .8)) / 2, depth - .58, fitW(.35, 1.2, .8), .42, 'south', finish.wood, timber, .14));
  }
  return pieces;
}
