export type ColorSource = 'hex' | 'named' | 'phrase' | 'ai' | 'unresolved';

export interface ResolvedColor {
  input: string;
  hex: string;
  name: string;
  source: ColorSource;
}

type Hsl = { h: number; s: number; l: number };

// CSS named colours (hex without '#').
const CSS_COLORS: Record<string, string> = {
  aliceblue: 'f0f8ff', antiquewhite: 'faebd7', aqua: '00ffff', aquamarine: '7fffd4', azure: 'f0ffff', beige: 'f5f5dc', bisque: 'ffe4c4', black: '000000',
  blanchedalmond: 'ffebcd', blue: '0000ff', blueviolet: '8a2be2', brown: 'a52a2a', burlywood: 'deb887', cadetblue: '5f9ea0', chartreuse: '7fff00',
  chocolate: 'd2691e', coral: 'ff7f50', cornflowerblue: '6495ed', cornsilk: 'fff8dc', crimson: 'dc143c', cyan: '00ffff', darkblue: '00008b', darkcyan: '008b8b',
  darkgoldenrod: 'b8860b', darkgray: 'a9a9a9', darkgreen: '006400', darkgrey: 'a9a9a9', darkkhaki: 'bdb76b', darkmagenta: '8b008b', darkolivegreen: '556b2f',
  darkorange: 'ff8c00', darkorchid: '9932cc', darkred: '8b0000', darksalmon: 'e9967a', darkseagreen: '8fbc8f', darkslateblue: '483d8b', darkslategray: '2f4f4f',
  darkslategrey: '2f4f4f', darkturquoise: '00ced1', darkviolet: '9400d3', deeppink: 'ff1493', deepskyblue: '00bfff', dimgray: '696969', dimgrey: '696969',
  dodgerblue: '1e90ff', firebrick: 'b22222', floralwhite: 'fffaf0', forestgreen: '228b22', fuchsia: 'ff00ff', gainsboro: 'dcdcdc', ghostwhite: 'f8f8ff',
  gold: 'ffd700', goldenrod: 'daa520', gray: '808080', grey: '808080', green: '008000', greenyellow: 'adff2f', honeydew: 'f0fff0', hotpink: 'ff69b4',
  indianred: 'cd5c5c', indigo: '4b0082', ivory: 'fffff0', khaki: 'f0e68c', lavender: 'e6e6fa', lavenderblush: 'fff0f5', lawngreen: '7cfc00',
  lemonchiffon: 'fffacd', lightblue: 'add8e6', lightcoral: 'f08080', lightcyan: 'e0ffff', lightgoldenrodyellow: 'fafad2', lightgray: 'd3d3d3',
  lightgreen: '90ee90', lightgrey: 'd3d3d3', lightpink: 'ffb6c1', lightsalmon: 'ffa07a', lightseagreen: '20b2aa', lightskyblue: '87cefa',
  lightslategray: '778899', lightslategrey: '778899', lightsteelblue: 'b0c4de', lightyellow: 'ffffe0', lime: '00ff00', limegreen: '32cd32', linen: 'faf0e6',
  magenta: 'ff00ff', maroon: '800000', mediumaquamarine: '66cdaa', mediumblue: '0000cd', mediumorchid: 'ba55d3', mediumpurple: '9370db',
  mediumseagreen: '3cb371', mediumslateblue: '7b68ee', mediumspringgreen: '00fa9a', mediumturquoise: '48d1cc', mediumvioletred: 'c71585',
  midnightblue: '191970', mintcream: 'f5fffa', mistyrose: 'ffe4e1', moccasin: 'ffe4b5', navajowhite: 'ffdead', navy: '000080', oldlace: 'fdf5e6',
  olive: '808000', olivedrab: '6b8e23', orange: 'ffa500', orangered: 'ff4500', orchid: 'da70d6', palegoldenrod: 'eee8aa', palegreen: '98fb98',
  paleturquoise: 'afeeee', palevioletred: 'db7093', papayawhip: 'ffefd5', peachpuff: 'ffdab9', peru: 'cd853f', pink: 'ffc0cb', plum: 'dda0dd',
  powderblue: 'b0e0e6', purple: '800080', rebeccapurple: '663399', red: 'ff0000', rosybrown: 'bc8f8f', royalblue: '4169e1', saddlebrown: '8b4513',
  salmon: 'fa8072', sandybrown: 'f4a460', seagreen: '2e8b57', seashell: 'fff5ee', sienna: 'a0522d', silver: 'c0c0c0', skyblue: '87ceeb',
  slateblue: '6a5acd', slategray: '708090', slategrey: '708090', snow: 'fffafa', springgreen: '00ff7f', steelblue: '4682b4', tan: 'd2b48c', teal: '008080',
  thistle: 'd8bfd8', tomato: 'ff6347', turquoise: '40e0d0', violet: 'ee82ee', wheat: 'f5deb3', white: 'ffffff', whitesmoke: 'f5f5f5', yellow: 'ffff00',
  yellowgreen: '9acd32',
};

// Interior-design names. These take precedence over CSS where the design
// meaning differs from the CSS one (e.g. "sage", "cream", "terracotta").
const INTERIOR_COLORS: Record<string, string> = {
  sage: '879477', terracotta: 'b86f52', 'warm oak': 'bd9367', oak: 'bd9367', cream: 'efe8dc', charcoal: '414449', olive: '777b53', blush: 'd6a6a2',
  walnut: '73533d', rust: 'a64b32', 'burnt orange': 'c65d32', forest: '355e3b', moss: '66734f', clay: 'ad765e', sand: 'cbb994', taupe: '8b8178',
  stone: '9b978e', oatmeal: 'd8cdbb', cedar: 'a8754d', bamboo: 'c4a35a', emerald: '168568', mustard: 'd1a52c', burgundy: '722f3e', bronze: '8a633e',
  copper: 'b87333', rose: 'd98a9b', mauve: 'b08ba5', mint: 'a8d5ba', peach: 'f2b8a0', coral: 'e8745f', sky: '8fc1de', slate: '5d6b78', denim: '4a6b8a',
  champagne: 'e6d5b8', camel: 'b58b5a', espresso: '3e2b22', ebony: '2a2724', ash: 'cfc8bd', pearl: 'ede8df', sienna: 'a5522d', 'burnt sienna': 'a5522d',
  sunflower: 'e8b923', lilac: 'b9a4cf', plum: '6b3a5b', aubergine: '3d1f3d', petrol: '1f4e5f', turquoise: '2aa9a1', aqua: '7ec8c8', ochre: 'c68e2e',
  maple: 'd4a96a', teak: 'a77b4b', mahogany: '5c2b1e', pine: 'd9b982', birch: 'e4d3b4', ink: '1b2230', graphite: '4a4d52', pewter: '8d9094', mist: 'b4c0cc', fog: 'cdd3d8', cloud: 'e1e5e8', steel: '9aa7b5', gold: 'c8a24a',
  silver: 'bfc1c4', brass: 'b5984a', blue: '4a78a8', green: '4f8a5b', red: 'b3362e', yellow: 'e3c14a', orange: 'd9792f', purple: '7a5a9a', pink: 'e8a0b4',
  brown: '7a5640', grey: '898989', gray: '898989', black: '1c1c1c', white: 'f7f7f4', beige: 'd8cdbb', ivory: 'f3ead7', lavender: 'a99ac6', teal: '3b8585',
  navy: '34445b',
};

const MODIFIERS: Record<string, { dl?: number; ds?: number; setL?: number }> = {
  light: { dl: 0.16 }, pale: { dl: 0.24, ds: -0.1 }, pastel: { setL: 0.84, ds: -0.1 }, soft: { dl: 0.12, ds: -0.12 }, bright: { dl: 0.04, ds: 0.2 },
  vivid: { ds: 0.25 }, neon: { ds: 0.4, dl: 0.05 }, dark: { dl: -0.18 }, deep: { dl: -0.16, ds: 0.08 }, rich: { dl: -0.08, ds: 0.1 },
  dusty: { ds: -0.25, dl: 0.04 }, muted: { ds: -0.28 }, dull: { ds: -0.3 }, warm: { ds: 0.02 }, cool: { ds: 0.02 }, earthy: { ds: -0.15, dl: -0.06 },
  baby: { setL: 0.86, ds: -0.05 }, powder: { setL: 0.84, ds: -0.1 }, burnt: { dl: -0.12, ds: -0.05 }, midnight: { setL: 0.14 },
};

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export function normalizeHex(value: string): string | null {
  const v = value.trim().replace(/^#/, '').toLowerCase();
  if (/^[0-9a-f]{6}$/.test(v)) return `#${v}`;
  if (/^[0-9a-f]{3}$/.test(v)) return `#${v[0]}${v[0]}${v[1]}${v[1]}${v[2]}${v[2]}`;
  return null;
}

export function hexToHsl(hex: string): Hsl {
  const n = normalizeHex(hex) || '#000000';
  const r = parseInt(n.slice(1, 3), 16) / 255, g = parseInt(n.slice(3, 5), 16) / 255, b = parseInt(n.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? ((g - b) / d + (g < b ? 6 : 0)) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h * 60, s, l };
}

export function hslToHex({ h, s, l }: Hsl): string {
  const hh = ((h % 360) + 360) % 360, ss = clamp01(s), ll = clamp01(l);
  const c = (1 - Math.abs(2 * ll - 1)) * ss, x = c * (1 - Math.abs(((hh / 60) % 2) - 1)), m = ll - c / 2;
  const [r, g, b] = hh < 60 ? [c, x, 0] : hh < 120 ? [x, c, 0] : hh < 180 ? [0, c, x] : hh < 240 ? [0, x, c] : hh < 300 ? [x, 0, c] : [c, 0, x];
  const to = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

function lookupBase(word: string): string | null {
  const key = word.replace(/[\s_-]+/g, ' ').trim();
  const interior = INTERIOR_COLORS[key];
  if (interior) return `#${interior}`;
  const css = CSS_COLORS[key.replace(/ /g, '')];
  return css ? `#${css}` : null;
}

function titleCase(value: string) {
  return value.replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Resolve any user colour input (hex, colour name, or "modifier + colour"
 * phrase) to a hex value. Never throws; unknown input comes back as
 * `source: 'unresolved'` so callers can report it instead of dropping it.
 */
export function resolveColor(input: string): ResolvedColor {
  const raw = String(input ?? '');
  const cleaned = raw.trim().toLowerCase().replace(/\s+/g, ' ');
  const unresolved: ResolvedColor = { input: raw, hex: '', name: raw.trim(), source: 'unresolved' };
  if (!cleaned) return unresolved;

  const hex = normalizeHex(cleaned);
  if (hex) return { input: raw, hex, name: hex.toUpperCase(), source: 'hex' };

  const direct = lookupBase(cleaned);
  if (direct) return { input: raw, hex: direct, name: titleCase(cleaned), source: 'named' };

  // "dusty rose", "deep teal", "light warm grey": peel leading modifiers,
  // resolve the remainder as a base colour, then shift HSL.
  const words = cleaned.split(' ').filter((w) => w !== 'colour' && w !== 'color' && w !== 'and');
  const mods: string[] = [];
  let i = 0;
  while (i < words.length - 1 && MODIFIERS[words[i]]) mods.push(words[i++]);
  const shifted = (base: string, applied: string[]) => {
    const hsl = hexToHsl(base);
    for (const m of applied) {
      const mod = MODIFIERS[m];
      if (mod.setL !== undefined) hsl.l = mod.setL;
      if (mod.dl) hsl.l = clamp01(hsl.l + mod.dl);
      if (mod.ds) hsl.s = clamp01(hsl.s + mod.ds);
    }
    return { input: raw, hex: hslToHex(hsl), name: titleCase(cleaned), source: 'phrase' as const };
  };
  const rest = words.slice(i);
  // Whole remainder is the base ("burnt orange" after modifiers peeled).
  const whole = mods.length ? lookupBase(rest.join(' ')) : null;
  if (whole) return shifted(whole, mods);
  // Leading words are the base and trailing words are filler ("sage green").
  // Only the longest known prefix counts; unknown words are never skipped.
  for (let end = rest.length - 1; end >= 1; end--) {
    const base = lookupBase(rest.slice(0, end).join(' '));
    const tail = rest.slice(end);
    if (base && tail.every((w) => lookupBase(w) !== null && !MODIFIERS[w])) return shifted(base, mods);
  }
  return unresolved;
}

export function resolveColors(inputs: string[]): ResolvedColor[] {
  return inputs.map(resolveColor);
}

/** Looks up hex values for colour phrases the local tables could not resolve. */
export type ColorAiLookup = (phrases: string[]) => Promise<Record<string, string> | null | undefined>;

/**
 * Resolve every input locally first; send the leftovers to `aiLookup` in one
 * batch. A missing lookup, a thrown error, or an invalid reply leaves those
 * inputs `unresolved` (never dropped, never thrown) so callers can report them.
 */
export async function resolveColorsWithFallback(inputs: string[], aiLookup?: ColorAiLookup): Promise<ResolvedColor[]> {
  const results = inputs.map(resolveColor);
  const pending = [...new Set(results.filter((r) => r.source === 'unresolved' && r.input.trim()).map((r) => r.input.trim()))];
  if (!pending.length || !aiLookup) return results;
  let answers: Record<string, string> | null | undefined;
  try { answers = await aiLookup(pending); } catch { return results; }
  if (!answers || typeof answers !== 'object') return results;
  const byKey = new Map(Object.entries(answers).map(([k, v]) => [k.trim().toLowerCase(), v]));
  return results.map((r) => {
    if (r.source !== 'unresolved' || !r.input.trim()) return r;
    const hex = normalizeHex(String(byKey.get(r.input.trim().toLowerCase()) ?? ''));
    return hex ? { input: r.input, hex, name: titleCase(r.input.trim().toLowerCase()), source: 'ai' as const } : r;
  });
}

/** Closest interior-design colour name for any hex (nearest in RGB), title-cased. */
export function nearestColorName(hex: string): string {
  const n = normalizeHex(hex);
  if (!n) return 'Neutral';
  const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [r, g, b] = rgb(n);
  let best = 'neutral', bestD = Infinity;
  for (const [name, value] of Object.entries(INTERIOR_COLORS)) {
    const [r2, g2, b2] = rgb(`#${value}`);
    // "Redmean" weighting tracks perceived difference far better than plain RGB distance.
    const rm = (r + r2) / 2;
    const d = (2 + rm / 256) * (r - r2) ** 2 + 4 * (g - g2) ** 2 + (2 + (255 - rm) / 256) * (b - b2) ** 2;
    if (d < bestD) { bestD = d; best = name; }
  }
  return titleCase(best);
}
