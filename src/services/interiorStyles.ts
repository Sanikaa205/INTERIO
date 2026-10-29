import type { ColorSwatch, DesignStyle } from '../types';

export type FurnitureRole =
  | 'sofa'
  | 'accent-chair'
  | 'coffee-table'
  | 'media-console'
  | 'rug'
  | 'floor-lamp'
  | 'plant'
  | 'bed'
  | 'nightstand'
  | 'wardrobe'
  | 'dresser'
  | 'bench'
  | 'dining-table'
  | 'dining-chair'
  | 'sideboard'
  | 'kitchen-run'
  | 'kitchen-island'
  | 'refrigerator'
  | 'desk'
  | 'desk-chair'
  | 'bookcase'
  | 'vanity'
  | 'shower'
  | 'bathtub'
  | 'toilet';

export interface StyleRecipe {
  id: DesignStyle;
  label: string;
  philosophy: string;
  finishes: string;
  defaultFinishes: { floor: string; wall: string };
  materials: {
    upholstery: string;
    wood: string;
    stone: string;
    metal: string;
    lighting: string;
  };
  paletteRoles: {
    seating: 'secondary' | 'accent' | 'primary';
    accentSeating: 'accent' | 'secondary' | 'primary';
    table: 'flooring' | 'primary';
    storage: 'flooring' | 'primary';
    bed: 'secondary';
    fixture: 'primary' | 'secondary' | 'flooring';
    lighting: 'primary' | 'accent' | 'secondary';
    decor: 'accent' | 'secondary';
  };
  forms: Record<FurnitureRole, string>;
  legType: 'tapered' | 'hairpin' | 'plinth' | 'turned' | 'sled' | 'block';
  density: 'sparse' | 'balanced' | 'rich';
  symmetryBias: number; // -1 (asymmetric) to 1 (symmetric)
  styleScale: number;
  placementOffset: number;
  optionalPieces: FurnitureRole[];
  palette: ColorSwatch[];
}

export const STYLE_RECIPES: Record<DesignStyle, StyleRecipe> = {
  modern: {
    id: 'modern',
    label: 'Modern Architectural',
    philosophy: 'Crisp linear geometry, understated monolithic silhouettes, and balanced spatial tension allowing architectural features to breathe.',
    finishes: 'Polished microcement flooring, smoked oak accents, matte black architectural hardware, and high-performance tactile bouclé upholstery.',
    defaultFinishes: { floor: 'oak-plank', wall: 'chalk-white' },
    materials: {
      upholstery: 'Performance woven neutral fabric',
      wood: 'Smoked oak veneer',
      stone: 'Honed grey quartz',
      metal: 'Matte black architectural aluminum',
      lighting: 'Matte black architectural metal and opal glass',
    },
    paletteRoles: {
      seating: 'secondary',
      accentSeating: 'accent',
      table: 'flooring',
      storage: 'flooring',
      bed: 'secondary',
      fixture: 'secondary',
      lighting: 'primary',
      decor: 'accent',
    },
    forms: {
      sofa: 'Tailored Low-Profile Sofa',
      'accent-chair': 'Architectural Lounge Chair',
      'coffee-table': 'Monolithic Low Coffee Table',
      'media-console': 'Flush Wall-Hung Media Credenza',
      rug: 'Linear Textured Area Rug',
      'floor-lamp': 'Slim Matte Black Arc Lamp',
      plant: 'Architectural Fiddle Leaf Fig',
      bed: 'Sleek Platform Bed',
      nightstand: 'Floating Smoked Oak Nightstand',
      wardrobe: 'Flush Full-Height Wardrobe',
      dresser: 'Horizontal Minimalist Dresser',
      bench: 'Slim Architectural Bed Bench',
      'dining-table': 'Clean-Lined Oak Dining Table',
      'dining-chair': 'Architectural Upholstered Dining Chair',
      sideboard: 'Low Architectural Sideboard',
      'kitchen-run': 'Sleek Modern Kitchen Cabinets & Counter',
      'kitchen-island': 'Waterfall Quartz Kitchen Island',
      refrigerator: 'Integrated Column Refrigerator',
      desk: 'Cantilevered Architectural Writing Desk',
      'desk-chair': 'Ergonomic Mesh Task Chair',
      bookcase: 'Open Steel and Oak Bookcase',
      vanity: 'Wall-Hung Quartz Vanity & Basin',
      shower: 'Glazed Walk-In Shower with Black Hardware',
      bathtub: 'Freestanding Oval Composite Tub',
      toilet: 'Wall-Hung Concealed Tank WC',
    },
    legType: 'tapered',
    density: 'balanced',
    symmetryBias: 0.2,
    styleScale: 1.0,
    placementOffset: 0.02,
    optionalPieces: ['floor-lamp', 'plant', 'bench', 'sideboard', 'accent-chair'],
    palette: [
      { hex: '#1E293B', name: 'Architectural Charcoal', role: 'primary', description: 'Deep grounding tone for accent elements and metals' },
      { hex: '#F8FAFC', name: 'Chalk White', role: 'wall', description: 'Ultra-clean reflective wall surface amplifying daylight' },
      { hex: '#6366F1', name: 'Indigo Accent', role: 'accent', description: 'Sophisticated focal color for soft textiles and artwork' },
      { hex: '#94A3B8', name: 'Cast Concrete', role: 'secondary', description: 'Mid-tone neutral for architectural joinery and rug base' },
      { hex: '#C2A382', name: 'Honey Oak', role: 'flooring', description: 'Organic warm grain bringing tactile warmth' },
    ],
  },

  minimal: {
    id: 'minimal',
    label: 'Pure Minimalist',
    philosophy: 'Uncompromising subtraction of the non-essential. Spatial serenity achieved through monolithic planes and shadow-line detailing.',
    finishes: 'Seamless lime plaster walls, wide-plank untreated Dinesen douglas fir, raw linen, and concealed flush-door joinery.',
    defaultFinishes: { floor: 'pale-ash', wall: 'bone-plaster' },
    materials: {
      upholstery: 'Natural undyed linen',
      wood: 'Pale ash with a matte finish',
      stone: 'Warm limestone',
      metal: 'Satin brushed stainless steel',
      lighting: 'Concealed warm LED and flush opal diffusers',
    },
    paletteRoles: {
      seating: 'secondary',
      accentSeating: 'secondary',
      table: 'flooring',
      storage: 'flooring',
      bed: 'secondary',
      fixture: 'secondary',
      lighting: 'primary',
      decor: 'secondary',
    },
    forms: {
      sofa: 'Essential Modular Sofa',
      'accent-chair': 'Low Linen Armchair',
      'coffee-table': 'Block Limestone Coffee Table',
      'media-console': 'Concealed Floating Joinery Console',
      rug: 'Unadorned Wool Felt Rug',
      'floor-lamp': 'Recessed Linear Up-Light',
      plant: 'Single Bonsai Specimen',
      bed: 'Quiet Platform Bed',
      nightstand: 'Solid Ash Block Pedestal',
      wardrobe: 'Handleless Concealed Wardrobe',
      dresser: 'Flush Ash Drawers',
      bench: 'Solid Wood Plank Bench',
      'dining-table': 'Unadorned Solid Dining Table',
      'dining-chair': 'Minimal Linen Dining Chair',
      sideboard: 'Flush Wall-Recessed Credenza',
      'kitchen-run': 'Handleless Minimal Kitchen Cabinets & Counter',
      'kitchen-island': 'Monolithic Limestone Island',
      refrigerator: 'Seamless Integrated Refrigerator',
      desk: 'Solid Ash Minimalist Desk',
      'desk-chair': 'Streamlined Task Chair',
      bookcase: 'Concealed Shadow-Line Bookshelf',
      vanity: 'Monolithic Stone Basin Vanity',
      shower: 'Frameless Glass Walk-In Shower',
      bathtub: 'Monolithic Stone Soaking Tub',
      toilet: 'Concealed Minimalist WC',
    },
    legType: 'plinth',
    density: 'sparse',
    symmetryBias: 0.1,
    styleScale: 0.96,
    placementOffset: -0.12,
    optionalPieces: ['plant', 'floor-lamp'],
    palette: [
      { hex: '#FDFBF7', name: 'Bone Plaster', role: 'wall', description: 'Warm organic plaster rejecting stark sterile white' },
      { hex: '#262626', name: 'Wabi Black', role: 'primary', description: 'Sparse punctuation in blackened steel hardware' },
      { hex: '#E5DCCF', name: 'Raw Linen', role: 'secondary', description: 'Unbleached natural drapery and seating slipcovers' },
      { hex: '#B8A898', name: 'Limestone Ochre', role: 'flooring', description: 'Honed stone flooring running continuously throughout' },
      { hex: '#8C7B6B', name: 'Walnut Shadow', role: 'accent', description: 'Single solid timber monolith table element' },
    ],
  },

  traditional: {
    id: 'traditional',
    label: 'Classic Heritage',
    philosophy: 'Timeless architectural proportions, bespoke millwork, elegant wainscoting, and layered heirloom textile heritage.',
    finishes: 'Heritage herringbone parquetry, double-crowned cornices, aged brass hardware, and plush velvet drapery.',
    defaultFinishes: { floor: 'herringbone-walnut', wall: 'clotted-cream' },
    materials: {
      upholstery: 'Tufted velvet upholstery',
      wood: 'Hand-finished walnut',
      stone: 'Calacatta marble',
      metal: 'Aged antique brass',
      lighting: 'Aged brass and shaded crystal',
    },
    paletteRoles: {
      seating: 'secondary',
      accentSeating: 'accent',
      table: 'flooring',
      storage: 'flooring',
      bed: 'secondary',
      fixture: 'secondary',
      lighting: 'secondary',
      decor: 'accent',
    },
    forms: {
      sofa: 'Tufted Heritage Sofa',
      'accent-chair': 'Wingback Heritage Armchair',
      'coffee-table': 'Carved Walnut Coffee Table',
      'media-console': 'Panelled Walnut Media Console',
      rug: 'Heritage Pattern Area Rug',
      'floor-lamp': 'Turned Brass Floor Lamp with Silk Shade',
      plant: 'Fern in Classical Urn',
      bed: 'Panelled Heritage Bed',
      nightstand: 'Moulded Walnut Bedside Table',
      wardrobe: 'Walnut Panel Wardrobe',
      dresser: 'Antique Carved Walnut Dresser',
      bench: 'Upholstered Tufted End Bench',
      'dining-table': 'Hand-Finished Heritage Dining Table',
      'dining-chair': 'Classic Upholstered Dining Chair',
      sideboard: 'Bespoke Double-Panel Sideboard',
      'kitchen-run': 'Inset Heritage Walnut Kitchen Cabinets & Counter',
      'kitchen-island': 'Turned-Leg Heritage Kitchen Island',
      refrigerator: 'Cabinet-Panelled Classic Refrigerator',
      desk: 'Executive Heritage Pedestal Desk',
      'desk-chair': 'Tufted Leather Swivel Chair',
      bookcase: 'Built-In Crown Moulding Bookcase',
      vanity: 'Marble-Top Heritage Vanity & Basin',
      shower: 'Heritage Glazed Shower with Brass Trim',
      bathtub: 'Clawfoot Cast Iron Roll-Top Tub',
      toilet: 'Traditional Ceramic High-Level WC',
    },
    legType: 'turned',
    density: 'rich',
    symmetryBias: 0.85,
    styleScale: 1.04,
    placementOffset: 0.12,
    optionalPieces: ['floor-lamp', 'plant', 'bench', 'sideboard', 'accent-chair', 'dresser'],
    palette: [
      { hex: '#2A3439', name: 'Heritage Navy', role: 'primary', description: 'Refined deep tone for custom built-in library millwork' },
      { hex: '#F5F2EB', name: 'Clotted Cream', role: 'wall', description: 'Warm eggshell wall backdrop complementing oil portraits' },
      { hex: '#A85A3C', name: 'Burnt Ochre', role: 'accent', description: 'Persian rug woven accents and velvet throw cushions' },
      { hex: '#7C6752', name: 'French Walnut', role: 'flooring', description: 'Hand-scraped rich parquet wood underfoot' },
      { hex: '#C5A059', name: 'Antique Brass', role: 'secondary', description: 'Warm metallic highlights in lighting and cabinetry pulls' },
    ],
  },

  industrial: {
    id: 'industrial',
    label: 'Urban Loft Atelier',
    philosophy: 'Celebration of raw structural honesty, honest structural steelwork, patinated brick, and utilitarian ergonomics.',
    finishes: 'Sealed exposed aggregate concrete, blackened hot-rolled steel, reclaimed factory timber, and distressed cognac saddle leather.',
    defaultFinishes: { floor: 'concrete', wall: 'brushed-cement' },
    materials: {
      upholstery: 'Distressed cognac leather',
      wood: 'Reclaimed timber and blackened steel',
      stone: 'Sealed concrete',
      metal: 'Blackened industrial steel and iron',
      lighting: 'Blackened steel and exposed filament cage lamps',
    },
    paletteRoles: {
      seating: 'secondary',
      accentSeating: 'accent',
      table: 'flooring',
      storage: 'flooring',
      bed: 'secondary',
      fixture: 'primary',
      lighting: 'primary',
      decor: 'accent',
    },
    forms: {
      sofa: 'Cognac Leather Loft Sofa',
      'accent-chair': 'Leather and Riveted Steel Club Chair',
      'coffee-table': 'Factory Cart Reclaimed Wood Coffee Table',
      'media-console': 'Perforated Steel Locker Console',
      rug: 'Distressed Vintage Overdyed Rug',
      'floor-lamp': 'Blackened Steel Tripod Spotlight',
      plant: 'Cast Iron Planter with Snake Plant',
      bed: 'Blackened Steel Frame Bed',
      nightstand: 'Reclaimed Timber and Iron Side Table',
      wardrobe: 'Steel-Framed Storage Wardrobe',
      dresser: 'Industrial Drawer Chest with Iron Pulls',
      bench: 'Reclaimed Beam and Steel Bench',
      'dining-table': 'Reclaimed Timber Trestle Dining Table',
      'dining-chair': 'Leather and Steel Dining Chair',
      sideboard: 'Riveted Metal and Reclaimed Wood Credenza',
      'kitchen-run': 'Blackened Steel and Reclaimed Timber Kitchen Cabinets & Counter',
      'kitchen-island': 'Steel Caster Commercial Kitchen Island',
      refrigerator: 'Commercial Brushed Stainless Steel Refrigerator',
      desk: 'Steel Pipe and Reclaimed Wood Drafting Desk',
      'desk-chair': 'Industrial Swivel Shop Stool',
      bookcase: 'Industrial Steel Pipe Shelving Unit',
      vanity: 'Sealed Concrete Trough Vanity & Basin',
      shower: 'Steel-Framed Crittall Glass Shower',
      bathtub: 'Matte Black Freestanding Soaking Tub',
      toilet: 'Matte Dark Industrial Close-Coupled WC',
    },
    legType: 'hairpin',
    density: 'balanced',
    symmetryBias: -0.4,
    styleScale: 1.0,
    placementOffset: 0.08,
    optionalPieces: ['floor-lamp', 'plant', 'bench', 'sideboard', 'accent-chair'],
    palette: [
      { hex: '#1F2421', name: 'Forged Steel', role: 'primary', description: 'Exposed structural I-beams and custom steel glazing' },
      { hex: '#9A5C3E', name: 'Terracotta Brick', role: 'accent', description: 'Aged masonry warmth providing historic soul' },
      { hex: '#6D5D4B', name: 'Aged Leather', role: 'secondary', description: 'Rich deep cognac upholstery with saddle stitching' },
      { hex: '#D1CDC7', name: 'Brushed Cement', role: 'wall', description: 'Raw concrete wall planes with form-tie impressions' },
      { hex: '#3E424B', name: 'Gunmetal Slate', role: 'flooring', description: 'Durable resin-bonded architectural screed' },
    ],
  },

  scandinavian: {
    id: 'scandinavian',
    label: 'Nordic Scandinavian',
    philosophy: 'Nordic democratic design prioritizing hygge warmth, maximized sunlight bouncing, and organic ergonomic contours.',
    finishes: 'Bleached white ash, molded plywood, textured shearling wool, and woven paper-cord seating.',
    defaultFinishes: { floor: 'pale-ash', wall: 'snow-birch' },
    materials: {
      upholstery: 'Soft oatmeal boucle',
      wood: 'Blonde white oak',
      stone: 'Pale terrazzo',
      metal: 'Matte white and satin nickel',
      lighting: 'Layered paper shades and opal glass',
    },
    paletteRoles: {
      seating: 'secondary',
      accentSeating: 'accent',
      table: 'flooring',
      storage: 'flooring',
      bed: 'secondary',
      fixture: 'secondary',
      lighting: 'primary',
      decor: 'accent',
    },
    forms: {
      sofa: 'Soft Bouclé Nordic Sofa',
      'accent-chair': 'Curved Birch Lounge Chair',
      'coffee-table': 'Organic Pebble Blonde Oak Coffee Table',
      'media-console': 'Slatted White Oak Media Credenza',
      rug: 'High-Pile Berber Wool Rug',
      'floor-lamp': 'Nordic Wood and Paper Floor Lamp',
      plant: 'Monstera in Birch Plant Stand',
      bed: 'Blonde Oak Slat Bed',
      nightstand: 'Round Blonde Oak Bedside Table',
      wardrobe: 'Light Oak Nordic Wardrobe',
      dresser: 'Scandinavian 6-Drawer Oak Dresser',
      bench: 'Woven Paper-Cord Entry Bench',
      'dining-table': 'Light Oak Nordic Dining Table',
      'dining-chair': 'Oatmeal Bouclé Dining Chair',
      sideboard: 'Nordic Tambour-Door Sideboard',
      'kitchen-run': 'Blonde White Oak Nordic Kitchen Cabinets & Counter',
      'kitchen-island': 'White Oak Slat Island with Terrazzo Top',
      refrigerator: 'Panel-Ready Seamless Refrigerator',
      desk: 'Nordic Tapered-Leg Oak Writing Desk',
      'desk-chair': 'Molded Plywood Swivel Desk Chair',
      bookcase: 'Modular Blonde Oak Wall Shelf',
      vanity: 'Light Oak Nordic Vanity & Basin',
      shower: 'Terrazzo and Glass Walk-In Shower',
      bathtub: 'Nordic Ergonomic White Soaking Tub',
      toilet: 'Modern Rimless Back-to-Wall WC',
    },
    legType: 'tapered',
    density: 'balanced',
    symmetryBias: 0.1,
    styleScale: 1.0,
    placementOffset: 0.04,
    optionalPieces: ['floor-lamp', 'plant', 'bench', 'sideboard', 'accent-chair'],
    palette: [
      { hex: '#FAFAF8', name: 'Snow Birch', role: 'wall', description: 'Airy daylight-diffusing Scandinavian wall wash' },
      { hex: '#DDD1C1', name: 'Blonde Ash', role: 'flooring', description: 'Pale pale timber flooring expanding room perception' },
      { hex: '#3B4348', name: 'Nordic Twilight', role: 'primary', description: 'Subtle slate gray framing fixtures' },
      { hex: '#7D8C7C', name: 'Forest Sage', role: 'accent', description: 'Botanical muted green grounding the living zone' },
      { hex: '#EBE3D5', name: 'Oatmeal Wool', role: 'secondary', description: 'Tactile heavy-knit throws and upholstery' },
    ],
  },

  japandi: {
    id: 'japandi',
    label: 'Japandi',
    philosophy: 'The mindful confluence of Japanese wabi-sabi imperfect beauty and Scandinavian functional simplicity.',
    finishes: 'Shoji-grade Hinoki cypress, cedar slats, hand-thrown stoneware ceramics, and tatami-weave accents.',
    defaultFinishes: { floor: 'pale-ash', wall: 'rice-paper' },
    materials: {
      upholstery: 'Textured natural flax',
      wood: 'Oiled cedar and oak',
      stone: 'Hand-finished clay',
      metal: 'Sumi blackened brass',
      lighting: 'Washi paper and stoneware ceramic',
    },
    paletteRoles: {
      seating: 'secondary',
      accentSeating: 'accent',
      table: 'flooring',
      storage: 'flooring',
      bed: 'secondary',
      fixture: 'secondary',
      lighting: 'primary',
      decor: 'accent',
    },
    forms: {
      sofa: 'Natural Flax Low Sofa',
      'accent-chair': 'Low Tatami Accent Chair',
      'coffee-table': 'Low Hinoki Live-Edge Coffee Table',
      'media-console': 'Slatted Cedar Low Media Console',
      rug: 'Woven Hemp and Jute Rug',
      'floor-lamp': 'Washi Paper Akari Floor Lamp',
      plant: 'Japanese Maple Bonsai in Clay Pot',
      bed: 'Low Hinoki Platform Bed',
      nightstand: 'Low Cedar Block Nightstand',
      wardrobe: 'Slatted Cedar Wardrobe',
      dresser: 'Low-Slung Cedar Dresser',
      bench: 'Solid Cedar Slat Bench',
      'dining-table': 'Wabi-Sabi Timber Dining Table',
      'dining-chair': 'Woven Cedar Dining Chair',
      sideboard: 'Low Slatted Cedar Credenza',
      'kitchen-run': 'Slatted Cedar Kitchen Cabinets & Counter',
      'kitchen-island': 'Low Hinoki Wood Kitchen Island',
      refrigerator: 'Integrated Discreet Refrigerator',
      desk: 'Low-Profile Hinoki Writing Desk',
      'desk-chair': 'Woven Cane Low Task Chair',
      bookcase: 'Asymmetric Cedar Display Shelf',
      vanity: 'Hinoki Vessel Vanity & Basin',
      shower: 'Clay Tile and Hinoki Slatted Shower',
      bathtub: 'Japanese Hinoki Wooden Ofuro Soaking Tub',
      toilet: 'Concealed Tank Minimalist WC',
    },
    legType: 'plinth',
    density: 'sparse',
    symmetryBias: -0.5, // Asymmetric wabi-sabi
    styleScale: 0.96,
    placementOffset: -0.04,
    optionalPieces: ['plant', 'floor-lamp', 'bench'],
    palette: [
      { hex: '#EFECE6', name: 'Rice Paper', role: 'wall', description: 'Textured washi-toned wall wash' },
      { hex: '#2B2A27', name: 'Sumi Ink', role: 'primary', description: 'Calligraphic focal lines in low-slung table legs' },
      { hex: '#9E8872', name: 'Bamboo Cedar', role: 'flooring', description: 'Natural horizontal grain grounding the senses' },
      { hex: '#757268', name: 'Zen Clay', role: 'secondary', description: 'Matte clay surfaces and linen curtains' },
      { hex: '#5A6258', name: 'Moss Garden', role: 'accent', description: 'Delicate organic green in bonsai and ceramics' },
    ],
  },
};

export function getStyleRecipe(style: DesignStyle | string): StyleRecipe {
  const key = (style || 'modern').toLowerCase() as DesignStyle;
  return STYLE_RECIPES[key] || STYLE_RECIPES.modern;
}

export function normalizeRoomType(roomType: string): string {
  const lower = (roomType || '').toLowerCase().trim();
  if (/studio/.test(lower)) return 'studio';
  if (/executive.*office|home.*office|executive/.test(lower)) return 'homeOffice';
  if (/study|library|workroom/.test(lower)) return 'study';
  if (/master.*bed/.test(lower)) return 'masterBedroom';
  if (/bed/.test(lower)) return 'bedroom';
  if (/kitchen.*dining|dining.*kitchen/.test(lower)) return 'kitchenDining';
  if (/kitchen|pantry/.test(lower)) return 'kitchen';
  if (/dining/.test(lower)) return 'dining';
  if (/bath|powder|washroom|toilet|wc|restroom/.test(lower)) return 'bathroom';
  return 'living';
}
