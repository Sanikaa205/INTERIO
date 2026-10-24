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
  budget = '',
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
  const styleLanguage: Record<DesignStyle, { bed: string; sofa: string; chair: string; table: string; placement: number }> = {
    modern: { bed: 'Sleek Platform Bed', sofa: 'Tailored Low-Profile Sofa', chair: 'Architectural Upholstered Dining Chair', table: 'Clean-Lined Oak Dining Table', placement: 0.02 },
    minimal: { bed: 'Quiet Platform Bed', sofa: 'Essential Modular Sofa', chair: 'Minimal Linen Dining Chair', table: 'Unadorned Solid Dining Table', placement: -0.12 },
    traditional: { bed: 'Panelled Heritage Bed', sofa: 'Tufted Heritage Sofa', chair: 'Classic Upholstered Dining Chair', table: 'Hand-Finished Heritage Dining Table', placement: 0.12 },
    industrial: { bed: 'Blackened Steel Frame Bed', sofa: 'Cognac Leather Loft Sofa', chair: 'Leather and Steel Dining Chair', table: 'Reclaimed Timber Trestle Dining Table', placement: 0.08 },
    scandinavian: { bed: 'Blonde Oak Slat Bed', sofa: 'Soft Bouclé Nordic Sofa', chair: 'Oatmeal Bouclé Dining Chair', table: 'Light Oak Nordic Dining Table', placement: 0.04 },
    japandi: { bed: 'Low Hinoki Platform Bed', sofa: 'Natural Flax Low Sofa', chair: 'Woven Cedar Dining Chair', table: 'Wabi-Sabi Timber Dining Table', placement: -0.04 },
  };
  const language = styleLanguage[style] || styleLanguage.modern;
  const budgetTier = /75|luxury/i.test(budget) ? 'bespoke' : /35|60|high/i.test(budget) ? 'premium' : /(^|\D)(5,000|10,000)|essential/i.test(budget) ? 'essential' : 'considered';
  const styleScale = style === 'traditional' ? 1.04 : style === 'minimal' || style === 'japandi' ? .96 : 1;
  const color = (role: ColorSwatch['role'], fallback: string) => palette.find((item) => item.role === role)?.hex || fallback;
  const fabric = color('secondary', '#d8d1c6');
  const timber = color('flooring', '#b99b78');
  const accent = color('accent', '#7d8372');
  const primary = color('primary', '#77736b');
  const fitW = (fraction: number, preferred: number, min = 0.45) => Math.max(Math.min(min, width), Math.min(width * fraction, preferred));
  const fitD = (fraction: number, preferred: number, min = 0.4) => Math.max(Math.min(min, depth), Math.min(depth * fraction, preferred));
  const item = (id: string, name: string, category: FurnitureSuggestion['category'], x: number, y: number, itemW: number, itemD: number, preferredWall: FurnitureSuggestion['preferredWall'], material: string, itemColor: string, clearance = 0.45): FurnitureSuggestion => ({
    id, name, category, x: Math.max(0, Math.min(width - itemW * styleScale, x)), y: Math.max(0, Math.min(depth - itemD * styleScale, y)),
    width: itemW * styleScale, depth: itemD * styleScale, preferredWall, material: `${material} · ${budgetTier} finish`, color: itemColor, clearance,
  });

  let pieces: FurnitureSuggestion[];
  if (bedroom) {
    const bedW = fitW(.58, 1.8, 1.35), bedD = fitD(.43, 2.05, 1.8);
    const bedX = (width - bedW) / 2;
    pieces = [
      item('bed', `${language.bed}${/master/i.test(kind) ? ' Suite' : ''}`, 'bed', bedX, .28, bedW, bedD, 'north', finish.upholstery, fabric, .08),
      item('wardrobe', style === 'traditional' ? 'Walnut Panel Wardrobe' : style === 'industrial' ? 'Steel-Framed Storage Wardrobe' : style === 'japandi' ? 'Slatted Cedar Wardrobe' : 'Full-Height Wardrobe', 'storage', (width - fitW(.42, 1.65, 1.0)) / 2, depth - .72, fitW(.42, 1.65, 1.0), .62, 'south', finish.wood, timber, .12),
      item('nightstand-left', 'Bedside Table', 'table', Math.max(.06, bedX - .48), .44, .4, .4, 'west', finish.wood, timber, .08),
      item('nightstand-right', 'Bedside Table', 'table', Math.min(width - .46, bedX + bedW + .08), .44, .4, .4, 'east', finish.wood, timber, .08),
      item('bedroom-rug', 'Woven Area Rug', 'decor', (width - fitW(.76, 3.1, 1.5)) / 2, Math.min(depth - 1.8, Math.max(.8, bedD * .72)), fitW(.76, 3.1, 1.5), fitD(.45, 2.4, 1.4), 'center', finish.upholstery, fabric, 0),
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
      { ...item('kitchen-run', `${style === 'industrial' ? 'Blackened Steel and Reclaimed Timber' : style === 'traditional' ? 'Inset Heritage Walnut' : style === 'japandi' ? 'Slatted Cedar' : style === 'minimal' ? 'Handleless Minimal' : 'Sleek Modern'} Kitchen Cabinets & Counter`, 'storage', kitchenX, .22, runW, .66, 'north', `${finish.wood}, ${finish.stone}`, color('secondary', '#d7d0c4'), .12), rotation: 0 },
      { ...item('refrigerator', 'Tall Refrigerator', 'electronics', kitchenX + runW + .12, .22, .72, .72, 'north', 'Brushed stainless steel', '#d7dbd9', .12), rotation: 0, relativeTo: 'kitchen-run', relativeSide: 'east' },
    ];
    if (combined && width >= 3.6 && depth >= 4) {
      const tableY = Math.min(depth - tableD - .85, diningY + language.placement);
      pieces.push(
        item('dining-table', `${language.table}`, 'table', tableX, tableY, tableW, tableD, 'center', finish.wood, timber, .18),
        { ...item('dining-chair-n', 'Dining Chair', 'seating', tableX + (tableW - .46) / 2, tableY - .56, .46, .46, 'north', finish.upholstery, fabric, .5), rotation: 0, relativeTo: 'dining-table', relativeSide: 'north' },
        { ...item('dining-chair-s', 'Dining Chair', 'seating', tableX + (tableW - .46) / 2, tableY + tableD + .1, .46, .46, 'south', finish.upholstery, fabric, .5), rotation: 180, relativeTo: 'dining-table', relativeSide: 'south' },
      );
    } else if (!combined) {
      pieces.push(item('kitchen-island', 'Kitchen Island', 'table', (width - fitW(.4, 1.45, .85)) / 2, Math.max(1.2, depth * .43), fitW(.4, 1.45, .85), .72, 'center', finish.wood, timber, .3));
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
      item('dining-table', language.table, 'table', tableX, tableY, tableW, tableD, 'center', finish.wood, timber, .28),
      { ...item('dining-chair-n', language.chair, 'seating', tableX + (tableW - .48) / 2, tableY - .6, .48, .5, 'north', finish.upholstery, fabric, .5), rotation: 0, relativeTo: 'dining-table', relativeSide: 'north' },
      { ...item('dining-chair-s', language.chair, 'seating', tableX + (tableW - .48) / 2, tableY + tableD + .1, .48, .5, 'south', finish.upholstery, fabric, .5), rotation: 180, relativeTo: 'dining-table', relativeSide: 'south' },
      { ...item('dining-chair-w', language.chair, 'seating', Math.max(.04, tableX - .6), tableY + (tableD - .5) / 2, .5, .48, 'west', finish.upholstery, fabric, .5), rotation: 90, relativeTo: 'dining-table', relativeSide: 'west' },
      { ...item('dining-chair-e', language.chair, 'seating', Math.min(width - .54, tableX + tableW + .1), tableY + (tableD - .5) / 2, .5, .48, 'east', finish.upholstery, fabric, .5), rotation: 270, relativeTo: 'dining-table', relativeSide: 'east' },
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
      item('living-sofa', language.sofa, 'seating', (width - sofaW) / 2, .78 + language.placement, sofaW, sofaD, 'north', finish.upholstery, fabric, .3),
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
