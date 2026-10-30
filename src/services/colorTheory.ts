import { hexToHsl, hslToHex, normalizeHex } from './colorResolver';

export { hexToHsl, hslToHex };

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/* ---------- 1.3 helpers ---------- */

export function relativeLuminance(hex: string): number {
  const n = normalizeHex(hex) || '#000000';
  const ch = (i: number) => {
    const v = parseInt(n.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(1) + 0.7152 * ch(3) + 0.0722 * ch(5);
}

/** WCAG contrast ratio, 1 (identical) to 21 (black on white). */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a), lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Mix toward white. amount 0..1 */
export function tint(hex: string, amount: number): string {
  const { h, s, l } = hexToHsl(hex);
  return hslToHex({ h, s, l: l + (1 - l) * clamp01(amount) });
}

/** Mix toward black. amount 0..1 */
export function shade(hex: string, amount: number): string {
  const { h, s, l } = hexToHsl(hex);
  return hslToHex({ h, s, l: l * (1 - clamp01(amount)) });
}

export function rotateHue(hex: string, degrees: number): string {
  const { h, s, l } = hexToHsl(hex);
  return hslToHex({ h: h + degrees, s, l });
}

export const complementary = (hex: string) => rotateHue(hex, 180);
export const analogous = (hex: string, degrees = 30) => rotateHue(hex, degrees);

/** Cap saturation so neon inputs still give livable large surfaces. */
export function limitSaturation(hex: string, max = 0.75): string {
  const { h, s, l } = hexToHsl(hex);
  return s > max ? hslToHex({ h, s: max, l }) : normalizeHex(hex) || hex;
}

function withLightness(hex: string, l: number, s?: number): string {
  const hsl = hexToHsl(hex);
  return hslToHex({ h: hsl.h, s: s ?? hsl.s, l: clamp01(l) });
}

/* ---------- 1.5 contrast guard ---------- */

/**
 * Nudge `color`'s lightness away from the backgrounds until it has at least
 * `min` contrast against every one of them (or the lightness limit is hit).
 * Hue and saturation are preserved.
 */
export function ensureContrast(color: string, backgrounds: string[], min: number): string {
  const bgs = backgrounds.filter((b) => normalizeHex(b));
  if (!bgs.length) return color;
  const ok = (c: string) => bgs.every((b) => contrastRatio(c, b) >= min);
  if (ok(color)) return color;
  const hsl = hexToHsl(color);
  const avgLum = bgs.reduce((sum, b) => sum + relativeLuminance(b), 0) / bgs.length;
  const dirs = avgLum > 0.45 ? [-1, 1] : [1, -1];
  let best = color, bestScore = Math.min(...bgs.map((b) => contrastRatio(color, b)));
  for (const dir of dirs) {
    for (let step = 1; step <= 50; step++) {
      const candidate = hslToHex({ ...hsl, l: clamp01(hsl.l + dir * step * 0.02) });
      const score = Math.min(...bgs.map((b) => contrastRatio(candidate, b)));
      if (score > bestScore) { best = candidate; bestScore = score; }
      if (score >= min) return candidate;
    }
  }
  return best;
}

/* ---------- 1.4 role assignment ---------- */

export interface ColorRoles {
  hero: string | null;
  wall: string | null;
  floor: string | null;
  accents: string[];
}

const isLight = (hex: string) => hexToHsl(hex).l >= 0.8;
// Hue/lightness test (not a name test): warm, moderately saturated mid-tones read as timber.
const isWoodLike = (hex: string) => {
  const { h, s, l } = hexToHsl(hex);
  return h >= 15 && h <= 50 && s >= 0.15 && s <= 0.5 && l >= 0.25 && l <= 0.72;
};
const heroScore = (hex: string) => {
  const { s, l } = hexToHsl(hex);
  return s * (1 - Math.abs(l - 0.5) * 0.8);
};

/**
 * Split user colours into design roles using hue, saturation and lightness:
 * lightest light tone → wall, timber-like tone → floor, most saturated
 * remaining → hero, everything else → accents. A single colour is always hero.
 */
export function assignColorRoles(colors: string[]): ColorRoles {
  const list = [...new Set(colors.map((c) => normalizeHex(c)).filter((c): c is string => !!c))];
  if (!list.length) return { hero: null, wall: null, floor: null, accents: [] };
  if (list.length === 1) return { hero: list[0], wall: null, floor: null, accents: [] };

  let pool = [...list];
  const take = (pick: string | undefined) => { if (pick) pool = pool.filter((c) => c !== pick); return pick || null; };
  const byLight = [...pool].filter(isLight).sort((a, b) => hexToHsl(b).l - hexToHsl(a).l)[0];
  const wall = take(byLight);
  const woodPick = pool.filter(isWoodLike).sort((a, b) => hexToHsl(a).l - hexToHsl(b).l)[0];
  // Only treat a wood tone as the floor if something else can still be hero.
  const floor = pool.length > 1 ? take(woodPick) : null;
  let hero = take([...pool].sort((a, b) => heroScore(b) - heroScore(a))[0]);
  // Everything was wall/floor-like: promote the floor, then the wall, to hero.
  let floorOut = floor, wallOut = wall;
  if (!hero) { hero = floorOut || wallOut; if (hero === floorOut) floorOut = null; else wallOut = null; }
  return { hero, wall: wallOut, floor: floorOut, accents: pool };
}

/* ---------- 1.3 palette derivation ---------- */

export interface StyleColorBase {
  wall: string;
  floor: string;
  neutral: string;
  wood: string;
  accent: string;
  trim: string;
}

/** Fallback when no style profile is supplied (3.1 will replace this per style). */
export const DEFAULT_COLOR_BASE: StyleColorBase = {
  wall: '#f4f1ea', floor: '#d6c3a5', neutral: '#d8d1c6', wood: '#b99b78', accent: '#7d8372', trim: '#fbfaf7',
};

export interface DerivedPalette {
  wall: string;
  floor: string;
  hero: string;
  heroSoft: string;
  accent: string;
  neutral: string;
  wood: string;
  trim: string;
  /** True when user colours drove the result; false means the style base was used as-is. */
  customised: boolean;
}

/** Style-specific adjustments applied while deriving a palette from user colours. */
export interface ColorTweak {
  /** Multiply the hero colour's saturation (e.g. 0.6 mutes it for industrial). */
  heroSaturationScale?: number;
  /** Cap on hero saturation (default 0.75). */
  heroSaturationMax?: number;
  floorLightnessMin?: number;
  floorLightnessMax?: number;
  /** Force the wood tone's hue (degrees) and shift its lightness. */
  woodHue?: number;
  woodLightnessShift?: number;
}

export function derivePalette(userColors: string[], base: StyleColorBase = DEFAULT_COLOR_BASE, tweak: ColorTweak = {}): DerivedPalette {
  const roles = assignColorRoles(userColors);
  if (!roles.hero) {
    return {
      wall: base.wall, floor: base.floor, hero: base.neutral, heroSoft: tint(base.neutral, 0.3), accent: base.accent,
      neutral: base.neutral, wood: base.wood, trim: base.trim, customised: false,
    };
  }

  let hero = limitSaturation(roles.hero, tweak.heroSaturationMax ?? 0.75);
  if (tweak.heroSaturationScale !== undefined) {
    const h = hexToHsl(hero);
    hero = hslToHex({ ...h, s: h.s * tweak.heroSaturationScale });
  }
  const heroHsl = hexToHsl(hero);
  const nearWhite = heroHsl.l > 0.85, nearBlack = heroHsl.l < 0.15, neutralHero = heroHsl.s < 0.2;

  // Wall: a supplied light tone, otherwise a whisper of the hero colour.
  let wall = roles.wall || (nearWhite ? hero : hslToHex({ h: heroHsl.h, s: Math.min(heroHsl.s, 0.35), l: 0.94 }));
  if (nearBlack) wall = roles.wall || base.wall;

  // Floor: a supplied timber tone, else the style's floor; saturated or dark
  // hero colours get a pale floor so the main pieces stand out, light heroes a mid one.
  let floor = roles.floor || base.floor;
  if (!roles.floor) {
    const fl = hexToHsl(floor).l;
    if (tweak.floorLightnessMin !== undefined || tweak.floorLightnessMax !== undefined) {
      floor = withLightness(floor, Math.min(tweak.floorLightnessMax ?? 1, Math.max(tweak.floorLightnessMin ?? 0, fl)));
    }
    if (heroHsl.s > 0.35 || nearBlack) floor = withLightness(floor, Math.max(hexToHsl(floor).l, 0.74));
    if (nearWhite) floor = withLightness(floor, Math.min(hexToHsl(floor).l, 0.55));
  }

  const accent = roles.accents[0] ||
    (neutralHero ? base.accent : limitSaturation(withLightness(analogous(hero, 30), clamp01(Math.min(0.6, Math.max(0.42, heroHsl.l))), heroHsl.s * 0.8)));
  let wood = roles.floor ? shade(roles.floor, 0.08) : base.wood;
  if (!roles.floor && (tweak.woodHue !== undefined || tweak.woodLightnessShift)) {
    const w = hexToHsl(wood);
    wood = hslToHex({ h: tweak.woodHue ?? w.h, s: w.s, l: w.l + (tweak.woodLightnessShift || 0) });
  }

  // 1.5 contrast guard: keep the hero fixed; adjust everything else around it.
  // Floors stay pale on purpose (furniture is outlined in 2D), so thresholds are gentle.
  floor = ensureContrast(ensureContrast(floor, [hero], 1.2), [wall], 1.08);
  const heroSoft = ensureContrast(tint(hero, 0.45), [floor], 1.15);
  const safeWood = ensureContrast(wood, [floor], 1.3);
  const safeAccent = ensureContrast(accent, [floor, hero], 1.3);
  const neutral = ensureContrast(base.neutral, [floor], 1.15);

  return {
    wall, floor, hero, heroSoft, accent: safeAccent, neutral, wood: safeWood,
    trim: hslToHex({ h: hexToHsl(wall).h, s: Math.min(hexToHsl(wall).s, 0.2), l: 0.97 }),
    customised: true,
  };
}
