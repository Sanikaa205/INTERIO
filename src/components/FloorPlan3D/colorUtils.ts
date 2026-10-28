export interface Rgb { r: number; g: number; b: number }
/** h in [0, 360), s and v in [0, 1]. */
export interface Hsv { h: number; s: number; v: number }

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Normalizes `#abc`, `abc`, `#aabbcc`, `AABBCC` to lowercase `#rrggbb`; anything else gives null. */
export function normalizeHex(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(input.trim());
  if (!match) return null;
  const digits = match[1].length === 3 ? match[1].split('').map((c) => c + c).join('') : match[1];
  return `#${digits.toLowerCase()}`;
}

export function hexToRgb(hex: string): Rgb | null {
  const normalized = normalizeHex(hex);
  if (!normalized) return null;
  const value = parseInt(normalized.slice(1), 16);
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

/** Channels are rounded and clamped to 0–255; non-finite channels count as 0. */
export function rgbToHex({ r, g, b }: Rgb): string {
  const channel = (v: number) => clamp(Number.isFinite(v) ? Math.round(v) : 0, 0, 255).toString(16).padStart(2, '0');
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

export function rgbToHsv({ r, g, b }: Rgb): Hsv {
  const rn = clamp(r, 0, 255) / 255;
  const gn = clamp(g, 0, 255) / 255;
  const bn = clamp(b, 0, 255) / 255;
  const max = Math.max(rn, gn, bn);
  const delta = max - Math.min(rn, gn, bn);
  let h = 0;
  if (delta > 0) {
    if (max === rn) h = ((gn - bn) / delta) % 6;
    else if (max === gn) h = (bn - rn) / delta + 2;
    else h = (rn - gn) / delta + 4;
    h = (h * 60 + 360) % 360;
  }
  return { h, s: max === 0 ? 0 : delta / max, v: max };
}

export function hsvToRgb({ h, s, v }: Hsv): Rgb {
  const hue = ((Number.isFinite(h) ? h : 0) % 360 + 360) % 360;
  const sat = clamp(Number.isFinite(s) ? s : 0, 0, 1);
  const val = clamp(Number.isFinite(v) ? v : 0, 0, 1);
  const f = (n: number) => {
    const k = (n + hue / 60) % 6;
    return val - val * sat * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return { r: Math.round(f(5) * 255), g: Math.round(f(3) * 255), b: Math.round(f(1) * 255) };
}

export function hexToHsv(hex: string): Hsv | null {
  const rgb = hexToRgb(hex);
  return rgb ? rgbToHsv(rgb) : null;
}

export function hsvToHex(hsv: Hsv): string {
  return rgbToHex(hsvToRgb(hsv));
}
