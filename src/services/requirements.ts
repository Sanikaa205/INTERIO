/** Items a requirement can add to or remove from a room. */
export type RequirementItem = 'tv' | 'desk' | 'reading-nook' | 'storage' | 'plants' | 'rug' | 'lamp' | 'coffee-table' | 'armchair';

export interface ParsedRequirements {
  add: RequirementItem[];
  remove: RequirementItem[];
  /** Design cautions derived from flags: 'fragile-decor' (pets/kids), 'loose-rugs' and 'tight-clearance' (accessibility). */
  avoid: string[];
  accessibility: boolean;
  pets: boolean;
  kids: boolean;
  notes: string[];
}

export const REQUIREMENT_ITEMS: RequirementItem[] = ['tv', 'desk', 'reading-nook', 'storage', 'plants', 'rug', 'lamp', 'coffee-table', 'armchair'];

const ITEM_PATTERNS: [RequirementItem, RegExp][] = [
  ['reading-nook', /\b(reading (nook|corner|chair|spot|area)|book nook)\b/g],
  ['tv', /\b(tv|t\.v\.|television|media (console|unit|wall)|tv (unit|stand))\b/g],
  ['desk', /\b(desk|work ?station|work ?space|home office|study (table|area|corner)|work(s|ing)? from home|wfh)\b/g],
  ['storage', /\b(storage|shelving|shelves|bookcase|bookshelf|bookshelves|cabinets?|closet|wardrobe)\b/g],
  ['plants', /\b(plants?|greenery|foliage)\b/g],
  ['rug', /\b(rugs?|carpets?)\b/g],
  ['lamp', /\b(lamps?|floor lights?)\b/g],
  ['coffee-table', /\bcoffee table\b/g],
  ['armchair', /\b(arm ?chairs?|accent chairs?)\b/g],
];

const NEGATIVE = /\b(no|not|without|don'?t|do not|dont|avoid|skip|remove|exclude|never|hate|dislike|nothing)\b/g;
const POSITIVE = /\b(need|needs|want|wants|add|include|including|with|have|require|requires|required|prefer|love|extra|more|additional|plus|please)\b/g;
const TRAILING_NEGATION = /\b(is |are )?(not|isn'?t|aren'?t|no longer) (needed|required|necessary|wanted)\b/;

const FLAG_PATTERNS = {
  accessibility: /\b(wheel ?chairs?|accessib\w*|step[- ]free|mobility|walkers?|disab\w*|elderly|seniors?|ageing|aging|handicap\w*)\b/,
  pets: /\b(pets?|dogs?|cats?|puppy|puppies|kitten)\b/,
  kids: /\b(kids?|child|children|toddlers?|babies|baby|infants?)\b/,
};

type Cue = { index: number; kind: 'neg' | 'pos' | 'item'; item?: RequirementItem };

function clauseCues(clause: string): Cue[] {
  const cues: Cue[] = [];
  const claimed: [number, number][] = [];
  for (const [item, pattern] of ITEM_PATTERNS) {
    for (const m of clause.matchAll(new RegExp(pattern.source, 'g'))) {
      const start = m.index ?? 0, end = start + m[0].length;
      // "reading chair" must not also count as an armchair/desk match, etc.
      if (claimed.some(([s, e]) => start < e && end > s)) continue;
      claimed.push([start, end]);
      cues.push({ index: start, kind: 'item', item });
    }
  }
  for (const m of clause.matchAll(NEGATIVE)) cues.push({ index: m.index ?? 0, kind: 'neg' });
  for (const m of clause.matchAll(POSITIVE)) cues.push({ index: m.index ?? 0, kind: 'pos' });
  return cues.sort((a, b) => a.index - b.index);
}

const emptyResult = (): ParsedRequirements => ({ add: [], remove: [], avoid: [], accessibility: false, pets: false, kids: false, notes: [] });

/**
 * Deterministic requirement parsing. Clauses split on punctuation and "but";
 * inside a clause a negative cue ("no", "without", "don't want") flips every
 * following item to "remove" until a positive cue ("need", "want") resets it.
 */
export function parseRequirements(text: string): ParsedRequirements {
  const result = emptyResult();
  const source = String(text ?? '').toLowerCase().replace(/[’`]/g, "'");
  const add = new Set<RequirementItem>(), remove = new Set<RequirementItem>();

  for (const clause of source.split(/[.;,\n!]| but | however | though /)) {
    if (!clause.trim()) continue;
    let negative = false;
    let explicit = false;
    let lastNeg = -100;
    let itemSinceNeg = false;
    for (const cue of clauseCues(clause)) {
      if (cue.kind === 'neg') { negative = true; explicit = true; lastNeg = cue.index; itemSinceNeg = false; }
      // "don't want", "do not need", "no need for": the positive word belongs to the negation.
      else if (cue.kind === 'pos') { if (itemSinceNeg || cue.index - lastNeg > 14) { negative = false; explicit = true; } }
      else if (cue.item) {
        itemSinceNeg = true;
        const trailing = !explicit && TRAILING_NEGATION.test(clause);
        (negative || trailing ? remove : add).add(cue.item);
      }
    }
  }
  // An item both asked for and refused in different clauses: the refusal wins only if it came last.
  for (const item of add) if (remove.has(item)) add.delete(item);
  result.add = REQUIREMENT_ITEMS.filter((i) => add.has(i));
  result.remove = REQUIREMENT_ITEMS.filter((i) => remove.has(i));

  const negatedFlag = (flag: RegExp) => {
    const m = source.match(flag);
    if (!m || m.index === undefined) return false;
    return !/\b(no|without|don'?t have|do not have|not)\s+(\w+\s+)?$/.test(source.slice(Math.max(0, m.index - 20), m.index));
  };
  result.accessibility = negatedFlag(FLAG_PATTERNS.accessibility);
  result.pets = negatedFlag(FLAG_PATTERNS.pets);
  result.kids = negatedFlag(FLAG_PATTERNS.kids);
  return finalizeFlags(result);
}

function finalizeFlags(r: ParsedRequirements): ParsedRequirements {
  const avoid = new Set<string>();
  const notes: string[] = [];
  if (r.accessibility) {
    avoid.add('loose-rugs'); avoid.add('tight-clearance');
    notes.push('Accessibility: walkways widened and loose rugs left out.');
  }
  if (r.pets || r.kids) {
    avoid.add('fragile-decor');
    notes.push(`${[r.pets && 'Pets', r.kids && 'Children'].filter(Boolean).join(' and ')}: fragile floor lamps and plants left out.`);
  }
  return { ...r, avoid: [...avoid], notes };
}

/** Items that end up removed once flags are applied (explicit "add" always wins over a flag). */
export function effectiveRemovals(parsed: ParsedRequirements): RequirementItem[] {
  const out = new Set<RequirementItem>(parsed.remove);
  if (parsed.avoid.includes('fragile-decor')) { out.add('plants'); out.add('lamp'); }
  if (parsed.avoid.includes('loose-rugs')) out.add('rug');
  for (const item of parsed.add) out.delete(item);
  return REQUIREMENT_ITEMS.filter((i) => out.has(i));
}

const REMOVAL_PATTERNS: Partial<Record<RequirementItem, RegExp>> = {
  tv: /\btv\b|television|media (console|unit)/i,
  rug: /\brug\b|carpet/i,
  plants: /plant|greenery/i,
  lamp: /\blamp\b/i,
  'coffee-table': /coffee table/i,
  armchair: /armchair|accent chair/i,
};

/** Drop pieces matching removed items. Works on generated or AI-supplied pieces by name. */
export function applyRemovals<T extends { name: string }>(pieces: T[], parsed: ParsedRequirements): T[] {
  const patterns = effectiveRemovals(parsed).map((i) => REMOVAL_PATTERNS[i]).filter((p): p is RegExp => !!p);
  return patterns.length ? pieces.filter((piece) => !patterns.some((p) => p.test(piece.name))) : pieces;
}

/* ---------- optional AI pass ---------- */

export type RequirementsAiParser = (text: string) => Promise<unknown>;

const asItems = (value: unknown): RequirementItem[] =>
  Array.isArray(value) ? REQUIREMENT_ITEMS.filter((i) => value.includes(i)) : [];

/**
 * Deterministic parse first. When it finds nothing in a non-trivial sentence the
 * optional AI parser is asked for the same structure; its answer is validated
 * against the fixed vocabulary and can never override an explicit deterministic result.
 */
export async function parseRequirementsWithFallback(text: string, aiParser?: RequirementsAiParser): Promise<ParsedRequirements> {
  const base = parseRequirements(text);
  const found = base.add.length || base.remove.length || base.accessibility || base.pets || base.kids;
  if (found || !aiParser || String(text ?? '').trim().length < 12) return base;
  let raw: unknown;
  try { raw = await aiParser(text); } catch { return base; }
  if (!raw || typeof raw !== 'object') return base;
  const ai = raw as Record<string, unknown>;
  const remove = asItems(ai.remove);
  const add = asItems(ai.add).filter((i) => !remove.includes(i));
  return finalizeFlags({
    ...base, add, remove,
    accessibility: ai.accessibility === true, pets: ai.pets === true, kids: ai.kids === true,
  });
}
