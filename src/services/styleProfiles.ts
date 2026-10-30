import type { DesignStyle, FurnitureCategory, FurnitureColorRole } from '../types';
import type { ColorTweak } from './colorTheory';

export type RoomKind = 'living' | 'bedroom' | 'dining' | 'study';

/** An optional, style-defining piece added to a room when there is space for it. */
export interface SignaturePiece {
  room: RoomKind;
  id: string; // always prefixed `sig-` so callers can tell optional pieces apart
  name: string;
  category: FurnitureCategory;
  width: number;
  depth: number;
  wall: 'north' | 'south' | 'east' | 'west';
  /** 0..1 position along the chosen wall. */
  along: number;
  material: 'upholstery' | 'wood' | 'stone' | 'metal';
  role: FurnitureColorRole;
  /** Smallest room (m², and shorter side in m) it is added to. */
  minArea: number;
  minSide: number;
}

export interface StyleProfile {
  id: DesignStyle;
  label: string;
  materials: { upholstery: string; wood: string; stone: string; metal: string };
  /** Overall form language, used in notes and signature piece naming. */
  form: 'sleek' | 'quiet' | 'ornate' | 'raw' | 'soft' | 'low';
  legs: string;
  names: { bed: string; sofa: string; chair: string; table: string; wardrobe: string; kitchen: string; rug: string };
  /** Nudges the living sofa / dining table position (m) so styles breathe differently. */
  placement: number;
  /** Footprint multiplier for the style's proportions. */
  scale: number;
  /** Style-specific adjustments to palette derivation from user colours. */
  colorTweak: ColorTweak;
  signature: SignaturePiece[];
  /** Optional piece ids this style leaves out. */
  avoid: string[];
}

export const STYLE_PROFILES: Record<DesignStyle, StyleProfile> = {
  modern: {
    id: 'modern', label: 'Modern Architectural', form: 'sleek', legs: 'Slim blackened-steel legs',
    materials: { upholstery: 'Performance woven neutral fabric', wood: 'Smoked oak veneer', stone: 'Honed grey quartz', metal: 'matte black steel' },
    names: { bed: 'Sleek Platform Bed', sofa: 'Tailored Low-Profile Sofa', chair: 'Architectural Upholstered Dining Chair', table: 'Clean-Lined Oak Dining Table', wardrobe: 'Full-Height Wardrobe', kitchen: 'Sleek Modern', rug: 'Textured Area Rug' },
    placement: 0.02, scale: 1, colorTweak: {},
    signature: [
      { room: 'living', id: 'sig-side-table', name: 'Slim Stone-Top Side Table', category: 'table', width: 0.5, depth: 0.5, wall: 'east', along: 0.28, material: 'stone', role: 'wood', minArea: 16, minSide: 3.5 },
      { room: 'bedroom', id: 'sig-dresser', name: 'Low Handleless Dresser', category: 'storage', width: 1.1, depth: 0.45, wall: 'east', along: 0.62, material: 'wood', role: 'wood', minArea: 12, minSide: 3.2 },
    ],
    avoid: [],
  },
  minimal: {
    id: 'minimal', label: 'Pure Minimalist', form: 'quiet', legs: 'Concealed plinth bases',
    materials: { upholstery: 'Natural undyed linen', wood: 'Pale ash with a matte finish', stone: 'Warm limestone', metal: 'brushed pale steel' },
    names: { bed: 'Quiet Platform Bed', sofa: 'Essential Modular Sofa', chair: 'Minimal Linen Dining Chair', table: 'Unadorned Solid Dining Table', wardrobe: 'Full-Height Wardrobe', kitchen: 'Handleless Minimal', rug: 'Textured Area Rug' },
    placement: -0.12, scale: 0.96, colorTweak: { heroSaturationScale: 0.7, floorLightnessMin: 0.78 },
    signature: [],
    avoid: ['living-plant'],
  },
  traditional: {
    id: 'traditional', label: 'Classic Heritage', form: 'ornate', legs: 'Turned and carved walnut legs',
    materials: { upholstery: 'Tufted velvet upholstery', wood: 'Hand-finished walnut', stone: 'Calacatta marble', metal: 'aged brass' },
    names: { bed: 'Panelled Heritage Bed', sofa: 'Tufted Heritage Sofa', chair: 'Classic Upholstered Dining Chair', table: 'Hand-Finished Heritage Dining Table', wardrobe: 'Walnut Panel Wardrobe', kitchen: 'Inset Heritage Walnut', rug: 'Heritage Pattern Area Rug' },
    placement: 0.12, scale: 1.04, colorTweak: { woodHue: 28, woodLightnessShift: -0.05, floorLightnessMax: 0.7 },
    signature: [
      { room: 'living', id: 'sig-side-table', name: 'Carved Heritage Side Table', category: 'table', width: 0.55, depth: 0.55, wall: 'east', along: 0.28, material: 'wood', role: 'wood', minArea: 16, minSide: 3.5 },
      { room: 'living', id: 'sig-display', name: 'Glazed Display Cabinet', category: 'storage', width: 0.95, depth: 0.42, wall: 'west', along: 0.55, material: 'wood', role: 'wood', minArea: 16, minSide: 3.5 },
      { room: 'bedroom', id: 'sig-bench', name: 'Upholstered Bed-End Bench', category: 'seating', width: 1.2, depth: 0.45, wall: 'south', along: 0.5, material: 'upholstery', role: 'soft', minArea: 12, minSide: 3.2 },
      { room: 'dining', id: 'sig-china', name: 'Glazed China Cabinet', category: 'storage', width: 1.0, depth: 0.42, wall: 'west', along: 0.5, material: 'wood', role: 'wood', minArea: 12, minSide: 3 },
    ],
    avoid: [],
  },
  industrial: {
    id: 'industrial', label: 'Urban Loft Atelier', form: 'raw', legs: 'Hairpin and blackened-steel frames',
    materials: { upholstery: 'Distressed cognac leather', wood: 'Reclaimed timber and blackened steel', stone: 'Sealed concrete', metal: 'blackened hot-rolled steel' },
    names: { bed: 'Blackened Steel Frame Bed', sofa: 'Cognac Leather Loft Sofa', chair: 'Leather and Steel Dining Chair', table: 'Reclaimed Timber Trestle Dining Table', wardrobe: 'Steel-Framed Storage Wardrobe', kitchen: 'Blackened Steel and Reclaimed Timber', rug: 'Textured Area Rug' },
    placement: 0.08, scale: 1, colorTweak: { heroSaturationScale: 0.6, heroSaturationMax: 0.55 },
    signature: [
      { room: 'living', id: 'sig-shelving', name: 'Open Steel Shelving Unit', category: 'storage', width: 1.0, depth: 0.4, wall: 'west', along: 0.55, material: 'metal', role: 'neutral', minArea: 16, minSide: 3.5 },
      { room: 'bedroom', id: 'sig-trunk', name: 'Steel-Banded Storage Trunk', category: 'storage', width: 0.95, depth: 0.45, wall: 'south', along: 0.2, material: 'metal', role: 'neutral', minArea: 12, minSide: 3.2 },
      { room: 'study', id: 'sig-shelving', name: 'Pipe-Frame Shelving', category: 'storage', width: 0.9, depth: 0.35, wall: 'west', along: 0.5, material: 'metal', role: 'neutral', minArea: 9, minSide: 2.6 },
    ],
    avoid: [],
  },
  scandinavian: {
    id: 'scandinavian', label: 'Nordic Scandinavian', form: 'soft', legs: 'Tapered blonde-oak legs',
    materials: { upholstery: 'Soft oatmeal boucle', wood: 'Blonde white oak', stone: 'Pale terrazzo', metal: 'powder-coated white steel' },
    names: { bed: 'Blonde Oak Slat Bed', sofa: 'Soft Bouclé Nordic Sofa', chair: 'Oatmeal Bouclé Dining Chair', table: 'Light Oak Nordic Dining Table', wardrobe: 'Full-Height Wardrobe', kitchen: 'Sleek Modern', rug: 'Textured Area Rug' },
    placement: 0.04, scale: 1, colorTweak: { floorLightnessMin: 0.8, woodLightnessShift: 0.08 },
    signature: [
      { room: 'living', id: 'sig-pouf', name: 'Woven Nordic Pouf', category: 'seating', width: 0.55, depth: 0.55, wall: 'east', along: 0.7, material: 'upholstery', role: 'soft', minArea: 16, minSide: 3.5 },
      { room: 'bedroom', id: 'sig-bench', name: 'Light Oak Storage Bench', category: 'storage', width: 1.1, depth: 0.42, wall: 'south', along: 0.5, material: 'wood', role: 'wood', minArea: 12, minSide: 3.2 },
    ],
    avoid: [],
  },
  japandi: {
    id: 'japandi', label: 'Japandi', form: 'low', legs: 'Low joinery bases with no visible hardware',
    materials: { upholstery: 'Textured natural flax', wood: 'Oiled cedar and oak', stone: 'Hand-finished clay', metal: 'dark patinated iron' },
    names: { bed: 'Low Hinoki Platform Bed', sofa: 'Natural Flax Low Sofa', chair: 'Woven Cedar Dining Chair', table: 'Wabi-Sabi Timber Dining Table', wardrobe: 'Slatted Cedar Wardrobe', kitchen: 'Slatted Cedar', rug: 'Textured Area Rug' },
    placement: -0.04, scale: 0.96, colorTweak: { heroSaturationScale: 0.8, woodHue: 32 },
    signature: [
      { room: 'living', id: 'sig-cushion', name: 'Floor Cushion Seat', category: 'seating', width: 0.6, depth: 0.6, wall: 'east', along: 0.7, material: 'upholstery', role: 'soft', minArea: 16, minSide: 3.5 },
      { room: 'bedroom', id: 'sig-bench', name: 'Low Tatami Bench', category: 'seating', width: 1.1, depth: 0.4, wall: 'south', along: 0.5, material: 'wood', role: 'wood', minArea: 12, minSide: 3.2 },
      { room: 'study', id: 'sig-cushion', name: 'Floor Cushion Seat', category: 'seating', width: 0.55, depth: 0.55, wall: 'east', along: 0.75, material: 'upholstery', role: 'soft', minArea: 9, minSide: 2.6 },
    ],
    avoid: [],
  },
};

export function getStyleProfile(style: string): StyleProfile {
  return STYLE_PROFILES[style as DesignStyle] || STYLE_PROFILES.modern;
}

export function signaturePiecesFor(profile: StyleProfile, room: RoomKind, width: number, depth: number): SignaturePiece[] {
  return profile.signature.filter((piece) => piece.room === room && width * depth >= piece.minArea && Math.min(width, depth) >= piece.minSide);
}
