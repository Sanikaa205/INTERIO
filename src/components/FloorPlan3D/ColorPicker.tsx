import React, { useCallback, useEffect, useRef, useState } from 'react';
import { hexToHsv, hexToRgb, hsvToHex, normalizeHex, rgbToHex, type Hsv } from './colorUtils';

const BASIC_COLORS = [
  '#ffffff', '#c0c0c0', '#808080', '#000000',
  '#e53935', '#fb8c00', '#fdd835', '#43a047',
  '#00acc1', '#1e88e5', '#5e35b1', '#d81b60',
];

const INTERIOR_PRESETS = [
  '#f9f6f0', '#f0ead6', '#e7e1d8', '#e2d9c5', '#d6cdb3', '#c5b9a0',
  '#e8d5c4', '#d9b8a0', '#c98f78', '#a8553f', '#b9c5b1', '#9caf94',
  '#6f8a73', '#4d6652', '#c9d6dc', '#9ba9b8', '#6e8499', '#3e5368',
  '#b08464', '#8a6244', '#765640', '#4f5355', '#53504b', '#2b2b2b',
];

const RECENTS_KEY = 'interio:recent-colors';
const MAX_RECENTS = 8;

function loadRecents(): string[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(RECENTS_KEY) ?? '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeHex).filter((c): c is string => c !== null).slice(0, MAX_RECENTS);
  } catch {
    return [];
  }
}

function saveRecents(colors: string[]): void {
  try {
    window.localStorage.setItem(RECENTS_KEY, JSON.stringify(colors));
  } catch {
    // Storage unavailable: recents simply do not persist.
  }
}

interface ColorPickerProps {
  /** Current colour as `#rrggbb`. */
  value: string;
  /** Live updates while dragging (rAF-throttled) and on every discrete choice. */
  onChange: (hex: string) => void;
}

const swatchClass = (active: boolean) =>
  `h-6 w-6 rounded-full border transition-transform sm:h-5 sm:w-5 ${
    active ? 'border-cyan-300 ring-2 ring-cyan-300 scale-110' : 'border-white/20 hover:scale-110'
  }`;

const sectionTitle = 'mb-1 text-[10px] font-semibold uppercase tracking-widest text-stone-500';
const inputClass = 'w-full rounded-lg border border-stone-700 bg-stone-800 px-2 py-1.5 text-sm text-white outline-none focus:border-cyan-400';

export const ColorPicker: React.FC<ColorPickerProps> = ({ value, onChange }) => {
  const current = normalizeHex(value) ?? '#ffffff';
  const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(current) ?? { h: 0, s: 0, v: 1 });
  const [hexText, setHexText] = useState(current);
  const [hexError, setHexError] = useState(false);
  const [recents, setRecents] = useState<string[]>(loadRecents);
  const pending = useRef<string | null>(null);
  const frame = useRef<number | null>(null);
  const lastEmitted = useRef(current);
  const squareRef = useRef<HTMLDivElement>(null);

  // Follow external changes (another surface selected, reset) while keeping the
  // hue when the colour is grey.
  useEffect(() => {
    if (current === lastEmitted.current) return;
    lastEmitted.current = current;
    setHsv((previous) => (hsvToHex(previous) === current ? previous : hexToHsv(current) ?? previous));
    setHexText(current);
    setHexError(false);
  }, [current]);

  useEffect(() => () => { if (frame.current !== null) cancelAnimationFrame(frame.current); }, []);

  const flush = useCallback(() => {
    if (frame.current !== null) {
      cancelAnimationFrame(frame.current);
      frame.current = null;
    }
    if (pending.current && pending.current !== lastEmitted.current) {
      lastEmitted.current = pending.current;
      onChange(pending.current);
    }
    pending.current = null;
  }, [onChange]);

  /** rAF-throttled live preview. */
  const preview = useCallback((hex: string) => {
    pending.current = hex;
    setHexText(hex);
    setHexError(false);
    if (frame.current === null) frame.current = requestAnimationFrame(flush);
  }, [flush]);

  /** Applies the colour and records it in the recents list. */
  const commit = useCallback((hex: string) => {
    flush();
    if (hex !== lastEmitted.current) {
      lastEmitted.current = hex;
      onChange(hex);
    }
    setRecents((previous) => {
      const next = [hex, ...previous.filter((c) => c !== hex)].slice(0, MAX_RECENTS);
      saveRecents(next);
      return next;
    });
  }, [flush, onChange]);

  const choose = (hex: string) => {
    const next = hexToHsv(hex);
    if (next) setHsv(next);
    setHexText(hex);
    setHexError(false);
    commit(hex);
  };

  const dragSquare = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = squareRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return;
    const s = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const v = 1 - Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
    const next = { h: hsv.h, s, v };
    setHsv(next);
    preview(hsvToHex(next));
  };

  const applyHex = (text: string) => {
    const normalized = normalizeHex(text);
    if (!normalized) {
      setHexError(true);
      return;
    }
    choose(normalized);
  };

  const rgb = hexToRgb(hsvToHex(hsv)) ?? { r: 255, g: 255, b: 255 };
  const applyChannel = (channel: 'r' | 'g' | 'b', text: string) => {
    const n = Number(text);
    if (text.trim() === '' || !Number.isFinite(n)) return;
    const hex = rgbToHex({ ...rgb, [channel]: Math.min(255, Math.max(0, Math.round(n))) });
    const next = hexToHsv(hex);
    // Keep the hue stable when a channel edit lands on a grey.
    if (next) setHsv(next.s === 0 ? { ...next, h: hsv.h } : next);
    preview(hex);
  };

  const renderSwatches = (colors: string[], label: string) => (
    <div className="flex flex-wrap gap-1.5">
      {colors.map((c) => (
        <button
          key={`${label}-${c}`}
          type="button"
          aria-label={`${label} ${c}`}
          title={c}
          onClick={() => choose(c)}
          className={swatchClass(current === c)}
          style={{ backgroundColor: c }}
        />
      ))}
    </div>
  );

  return (
    <div className="flex flex-col gap-2.5">
      <div><p className={sectionTitle}>Basic</p>{renderSwatches(BASIC_COLORS, 'Basic colour')}</div>
      <div><p className={sectionTitle}>Interior presets</p>{renderSwatches(INTERIOR_PRESETS, 'Preset')}</div>
      {recents.length > 0 && <div><p className={sectionTitle}>Recent</p>{renderSwatches(recents, 'Recent colour')}</div>}

      <div>
        <p className={sectionTitle}>Custom</p>
        <div
          ref={squareRef}
          role="slider"
          aria-label="Saturation and brightness"
          aria-valuetext={current}
          tabIndex={0}
          className="relative h-28 w-full cursor-crosshair rounded-lg border border-stone-700"
          style={{
            touchAction: 'none',
            backgroundColor: `hsl(${hsv.h} 100% 50%)`,
            backgroundImage: 'linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent)',
          }}
          onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); dragSquare(e); }}
          onPointerMove={(e) => { if (e.currentTarget.hasPointerCapture(e.pointerId)) dragSquare(e); }}
          onPointerUp={() => commit(hsvToHex(hsv))}
        >
          <span
            className="pointer-events-none absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
            style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, backgroundColor: current }}
          />
        </div>
        <input
          type="range"
          min={0}
          max={360}
          step={1}
          aria-label="Hue"
          value={Math.round(hsv.h)}
          onChange={(e) => {
            const next = { ...hsv, h: Number(e.target.value) };
            setHsv(next);
            preview(hsvToHex(next));
          }}
          onPointerUp={() => commit(hsvToHex(hsv))}
          onKeyUp={() => commit(hsvToHex(hsv))}
          className="mt-2 h-3 w-full cursor-pointer appearance-none rounded-full"
          style={{ background: 'linear-gradient(to right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)' }}
        />
      </div>

      <div className="grid grid-cols-[1fr_auto] items-start gap-2">
        <label className="block text-xs text-stone-300">
          <span className="font-medium">HEX</span>
          <input
            type="text"
            value={hexText}
            maxLength={7}
            spellCheck={false}
            aria-invalid={hexError}
            onChange={(e) => { setHexText(e.target.value); setHexError(false); }}
            onBlur={() => { if (hexText !== current) applyHex(hexText); }}
            onKeyDown={(e) => { if (e.key === 'Enter') applyHex(hexText); }}
            className={`${inputClass} mt-1 font-mono ${hexError ? 'border-red-500 focus:border-red-500' : ''}`}
          />
          {hexError && <span role="alert" className="mt-1 block text-[11px] text-red-400">Enter a valid hex colour, e.g. #c5b9a0</span>}
        </label>
        <span className="mt-5 h-9 w-9 rounded-lg border border-stone-600" style={{ backgroundColor: current }} aria-hidden />
      </div>

      <div className="grid grid-cols-3 gap-2">
        {(['r', 'g', 'b'] as const).map((channel) => (
          <label key={channel} className="block text-xs uppercase text-stone-300">
            <span className="font-medium">{channel}</span>
            <input
              type="number"
              min={0}
              max={255}
              value={rgb[channel]}
              onChange={(e) => applyChannel(channel, e.target.value)}
              onBlur={() => commit(hsvToHex(hsv))}
              className={`${inputClass} mt-1`}
            />
          </label>
        ))}
      </div>
    </div>
  );
};
