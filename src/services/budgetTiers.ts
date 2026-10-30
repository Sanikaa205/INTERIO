import type { FurnitureCategory } from '../types';
import type { RoomKind, SignaturePiece } from './styleProfiles';

export type BudgetTierId = 'essential' | 'considered' | 'premium' | 'bespoke';

export interface BudgetTier {
  id: BudgetTierId;
  /** UI budget ids (see InteriorDesignWorkflow BUDGET_TIERS) that map here. */
  uiIds: string[];
  /** Word used in material text: "… · premium finish". */
  finishLabel: string;
  /** Label used in price strings and material suffixes: "premium", "essential tier". */
  gradeLabel: string;
  sizeFactor: number;
  priceFactor: number;
  /** Replaces the style accent colour when set. */
  accentHex: string | null;
  finishNote: string;
  /** Optional pieces this tier leaves out, by id pattern. */
  skipPieces: RegExp | null;
  /** Whether style signature pieces are added. */
  signature: boolean;
  /** Extra pieces this tier adds on top of the style's own. */
  extras: SignaturePiece[];
}

const premiumExtras: SignaturePiece[] = [
  { room: 'bedroom', id: 'bud-accent-chair', name: 'Upholstered Accent Chair', category: 'seating', width: 0.75, depth: 0.75, wall: 'east', along: 0.78, material: 'upholstery', role: 'accent', minArea: 16, minSide: 3.4 },
  { room: 'living', id: 'bud-side-table', name: 'Marble Side Table', category: 'table', width: 0.5, depth: 0.5, wall: 'west', along: 0.3, material: 'stone', role: 'wood', minArea: 18, minSide: 3.8 },
  { room: 'study', id: 'bud-armchair', name: 'Leather Reading Armchair', category: 'seating', width: 0.8, depth: 0.8, wall: 'east', along: 0.75, material: 'upholstery', role: 'accent', minArea: 12, minSide: 3 },
];
const bespokeExtras: SignaturePiece[] = [
  ...premiumExtras,
  { room: 'living', id: 'bud-statement-lamp', name: 'Sculptural Statement Lamp', category: 'lighting', width: 0.45, depth: 0.45, wall: 'west', along: 0.85, material: 'metal', role: 'neutral', minArea: 18, minSide: 3.8 },
  { room: 'bedroom', id: 'bud-dressing-table', name: 'Bespoke Dressing Table', category: 'table', width: 1.0, depth: 0.45, wall: 'west', along: 0.5, material: 'wood', role: 'wood', minArea: 16, minSide: 3.4 },
  { room: 'dining', id: 'bud-display', name: 'Artisan Display Cabinet', category: 'storage', width: 1.0, depth: 0.42, wall: 'east', along: 0.5, material: 'wood', role: 'wood', minArea: 14, minSide: 3.2 },
];

export const BUDGET_TIERS: Record<BudgetTierId, BudgetTier> = {
  essential: {
    id: 'essential', uiIds: ['$5,000 - $10,000'], finishLabel: 'essential', gradeLabel: 'essential tier', sizeFactor: 0.97, priceFactor: 0.62,
    accentHex: '#9B9A92', finishNote: 'Prioritize durable, attainable finishes and versatile essential pieces.',
    skipPieces: /(^|-)rug$|^living-(lamp|plant|chair)$|^dining-sideboard$/, signature: false, extras: [],
  },
  considered: {
    id: 'considered', uiIds: ['$15,000 - $25,000'], finishLabel: 'considered', gradeLabel: 'considered tier', sizeFactor: 1, priceFactor: 1,
    accentHex: null, finishNote: 'Balance lasting materials with carefully selected focal details.',
    skipPieces: null, signature: true, extras: [],
  },
  premium: {
    id: 'premium', uiIds: ['$35,000 - $60,000'], finishLabel: 'premium', gradeLabel: 'premium', sizeFactor: 1.035, priceFactor: 2.4,
    accentHex: '#728277', finishNote: 'Use premium durable finishes and custom detailing at focal pieces.',
    skipPieces: null, signature: true, extras: premiumExtras,
  },
  bespoke: {
    id: 'bespoke', uiIds: ['$75,000+'], finishLabel: 'bespoke', gradeLabel: 'bespoke', sizeFactor: 1.07, priceFactor: 5,
    accentHex: '#B48A4A', finishNote: 'Specify bespoke joinery, artisan finishes and premium hardware.',
    skipPieces: null, signature: true, extras: bespokeExtras,
  },
};

/**
 * Map any budget string to a tier. Known UI ids match exactly; otherwise the
 * same keyword rules the generator has always used apply, with "considered"
 * as the default for anything unrecognised.
 */
export function getBudgetTier(budget: string): BudgetTier {
  const text = String(budget ?? '');
  const exact = Object.values(BUDGET_TIERS).find((tier) => tier.uiIds.includes(text.trim()));
  if (exact) return exact;
  if (/75|luxury/i.test(text)) return BUDGET_TIERS.bespoke;
  if (/35|60|high/i.test(text)) return BUDGET_TIERS.premium;
  if (/(^|\D)(5,000|10,000)|essential/i.test(text)) return BUDGET_TIERS.essential;
  return BUDGET_TIERS.considered;
}

export function extrasFor(tier: BudgetTier, room: RoomKind, width: number, depth: number): SignaturePiece[] {
  return tier.extras.filter((piece) => piece.room === room && width * depth >= piece.minArea && Math.min(width, depth) >= piece.minSide);
}

const TYPICAL_PRICE: Record<string, number> = { seating: 1100, table: 800, storage: 900, bed: 1400, fixture: 550, electronics: 1100, lighting: 350, decor: 180 };

export function priceRange(category: FurnitureCategory | string, tier: BudgetTier): { low: number; high: number } {
  const middle = Math.round((TYPICAL_PRICE[category] || 500) * tier.priceFactor / 50) * 50;
  return { low: Math.round(middle * 0.7), high: Math.round(middle * 1.35) };
}

export function formatPriceRange(range: { low: number; high: number }, suffix = ''): string {
  return `$${range.low.toLocaleString()}–$${range.high.toLocaleString()}${suffix ? ` ${suffix}` : ''}`;
}

/** Sum of per-piece ranges, e.g. for "estimated total". */
export function totalPriceRange(items: { category: string }[], tier: BudgetTier): { low: number; high: number } {
  return items.reduce((sum, item) => {
    const r = priceRange(item.category, tier);
    return { low: sum.low + r.low, high: sum.high + r.high };
  }, { low: 0, high: 0 });
}
