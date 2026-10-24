// Layout constraints extracted from the user's written requirements.
//
// Two producers fill the same structure: a deterministic local parser (works
// offline, so a Gemini outage never throws the description away) and the
// Gemini topology reply (which can read looser phrasing). The solver treats
// every constraint as a score/filter on candidates -- never as geometry -- and
// the plan reports which requirements it applied and which it could not.

export type Side = 'top' | 'bottom' | 'left' | 'right';
export type RelSide = 'front' | 'back' | Side;

export interface RoomPair { a: string; b: string; /** scored, never a hard rule */ soft?: boolean }

export interface LayoutConstraints {
  /** Explicit entry side from the text ("entrance on the east"). */
  entrySide?: Side;
  /** Rooms that must share a wall. */
  adjacent: RoomPair[];
  /** Rooms that must not share a wall. */
  avoid: RoomPair[];
  /** A room should sit in the front/back/left/right half of the plot. */
  placements: { room: string; side: RelSide }[];
  /** Bathrooms that are shared (not an ensuite of the master). */
  sharedBathrooms: string[];
  minimalCorridor: boolean;
  bedroomPrivacy: boolean;
  naturalLight: boolean;
  /** Human-readable lines for the plan notes. */
  applied: string[];
  notApplied: string[];
}

export interface ProgramRoom { name: string; type: string }

export function emptyConstraints(): LayoutConstraints {
  return {
    adjacent: [], avoid: [], placements: [], sharedBathrooms: [],
    minimalCorridor: false, bedroomPrivacy: false, naturalLight: false, applied: [], notApplied: [],
  };
}

const norm = (s: string) => s.trim().toLowerCase();
const pairKey = (p: RoomPair) => [norm(p.a), norm(p.b)].sort().join('|');

const DIRECTION: Record<string, RelSide> = {
  north: 'top', top: 'top', south: 'bottom', bottom: 'bottom', east: 'right', right: 'right', west: 'left', left: 'left',
  front: 'front', back: 'back', rear: 'back',
};

interface Mention { start: number; end: number; rooms: string[]; label: string }

/** Finds room mentions ("the common bathroom", "second bedroom", "kitchen") in text. */
function findMentions(text: string, program: ProgramRoom[]): Mention[] {
  const lower = text.toLowerCase();
  const taken: [number, number][] = [];
  const mentions: Mention[] = [];
  const free = (s: number, e: number) => !taken.some(([a, b]) => s < b && e > a);
  const add = (re: RegExp, resolve: (m: RegExpExecArray) => string[]) => {
    const rx = new RegExp(re.source, 'gi');
    let m: RegExpExecArray | null;
    while ((m = rx.exec(lower))) {
      const s = m.index;
      const e = s + m[0].length;
      if (!free(s, e)) continue;
      const rooms = resolve(m);
      if (!rooms.length) continue;
      taken.push([s, e]);
      mentions.push({ start: s, end: e, rooms, label: m[0] });
    }
  };

  const masters = program.filter((r) => r.type === 'master-bedroom').map((r) => r.name);
  const bedrooms = program.filter((r) => r.type === 'bedroom').map((r) => r.name);
  const bathrooms = program.filter((r) => r.type === 'bathroom').map((r) => r.name);
  const ofType = (t: string) => program.filter((r) => r.type === t).map((r) => r.name);
  const sharedBaths = bathrooms.filter((n) => !/master|en-?suite|attached/i.test(n));
  const ensuites = bathrooms.filter((n) => /master|en-?suite|attached/i.test(n));

  // 0. A qualified bathroom ("common bathroom") must claim its span before the
  // plain program name "Bathroom" does.
  add(/\b(?:common|shared|family|guest|hall)\s*(?:bath(?:room)?|toilet|wc)\b/, () => (sharedBaths.length ? sharedBaths : bathrooms));
  // 1. Exact program names (longest first) so "Kitchen Area" wins over "kitchen".
  for (const room of [...program].sort((a, b) => b.name.length - a.name.length)) {
    const escaped = room.name.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    add(new RegExp(`\\b${escaped}\\b`), () => [room.name]);
  }
  // 2. Role phrases.
  add(/\b(?:master|primary|main)\s*(?:bed\s*room|bedroom|suite)\b/, () => masters);
  add(/\b(?:en-?suite|attached\s*bath(?:room)?|master\s*bath(?:room)?)\b/, () => (ensuites.length ? ensuites : masters.length ? bathrooms.slice(0, 1) : []));
  add(/\b(?:common|shared|family|guest|hall)\s*(?:bath(?:room)?|toilet|wc)\b/, () => (sharedBaths.length ? sharedBaths : bathrooms));
  add(/\b(?:second|2nd|other|another|kids?|children'?s?|guest)\s*(?:bed\s*room|bedroom)\b|\bbed\s*room\s*(?:2|two)\b/, (m) => (/second|2nd|two|2/.test(m[0]) ? bedrooms.slice(0, 1) : bedrooms));
  add(/\bbed\s*rooms?\b/, () => [...masters, ...bedrooms]);
  add(/\b(?:bath(?:room)?s?|toilets?|wc|washroom)\b/, () => bathrooms);
  add(/\b(?:living(?:\s*room)?|lounge|family\s*room|drawing\s*room)\b/, () => ofType('living-room'));
  add(/\bkitchen\b/, () => ofType('kitchen'));
  add(/\bdining\b/, () => ofType('dining-room').concat(ofType('kitchen').filter(() => !ofType('dining-room').length)));
  add(/\bpowder\s*room\b/, () => ofType('powder-room'));
  add(/\b(?:office|study)\b/, () => ofType('office'));
  add(/\blaundry\b/, () => ofType('laundry'));
  return mentions.sort((x, y) => x.start - y.start);
}

const ADJACENT_RE = /\b(?:with\s+(?:an?\s+)?(?=attached|en-?suite)|near(?:\s+to)?|next\s+to|adjacent\s+to|adjoining|beside|close\s+to|attached\s+to|connected\s+to|opening\s+(?:in)?to|shares?\s+a\s+wall\s+with)\b/g;
const AVOID_RE = /\b(?:away\s+from|far\s+from|apart\s+from|separate(?:d)?\s+from|isolated\s+from|not\s+(?:next\s+to|near|adjacent\s+to))\b/g;
const PLACE_RE = /\b(?:at|in|on|toward|towards|to)\s+the\s+(front|back|rear|left|right|north|south|east|west|top|bottom)\b/g;
const ENTRY_RE = /\b(?:entry|entrance|main\s+door|front\s+door|gate)\b[^.;]{0,40}?\b(north|south|east|west|left|right|top|bottom)\b/;

const SKIP_CLAUSE = /\b(efficient|practical|realistic|furniture|good|nice|modern|beautiful|functional|comfortable|well[- ]designed|create|design|generate|ensure|include|make)\b/;

/** Deterministic parse of the requirements text against the room program. */
export function parseRequirementsLocally(text: string, program: ProgramRoom[]): LayoutConstraints {
  const out = emptyConstraints();
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return out;
  const lower = clean.toLowerCase();

  const addAdjacent = (a: string, b: string, why: string) => {
    if (norm(a) === norm(b) || out.adjacent.some((p) => pairKey(p) === pairKey({ a, b }))) return;
    out.adjacent.push({ a, b });
    out.applied.push(`${why}: ${a} next to ${b}`);
  };
  const addAvoid = (a: string, b: string, why: string, soft = false) => {
    if (norm(a) === norm(b) || out.avoid.some((p) => pairKey(p) === pairKey({ a, b }))) return;
    out.avoid.push(soft ? { a, b, soft: true } : { a, b });
    out.applied.push(`${why}: ${a} kept apart from ${b}`);
  };

  const sentences = clean.split(/(?<=[.;!?])\s+|\n+/).filter(Boolean);
  const handled: [number, number][] = [];
  let offset = 0;
  for (const sentence of sentences) {
    const start = lower.indexOf(sentence.toLowerCase(), offset);
    offset = start + sentence.length;
    const mentions = findMentions(sentence, program);
    const s = sentence.toLowerCase();
    let used = false;

    for (const [re, kind] of [[ADJACENT_RE, 'adj'], [AVOID_RE, 'avoid']] as const) {
      const rx = new RegExp(re.source, 'g');
      let m: RegExpExecArray | null;
      while ((m = rx.exec(s))) {
        const left = [...mentions].reverse().find((x) => x.end <= m!.index);
        const right = mentions.find((x) => x.start >= m!.index + m![0].length);
        if (!left || !right) continue;
        used = true;
        for (const a of left.rooms.slice(0, 3)) for (const b of right.rooms.slice(0, 3)) {
          if (kind === 'adj') addAdjacent(a, b, `"${left.label} ${m![0]} ${right.label}"`);
          else addAvoid(a, b, `"${left.label} ${m![0]} ${right.label}"`);
        }
      }
    }

    if (/\bbed\s*rooms?\b[^.;]{0,25}\b(?:separate|separated|apart|isolated)\b|\bkeep\b[^.;]{0,30}\bbed\s*rooms?\b[^.;]{0,20}\bseparate\b/.test(s)) {
      const sleeping = program.filter((r) => r.type === 'bedroom' || r.type === 'master-bedroom').map((r) => r.name);
      for (let i = 0; i < sleeping.length; i++) for (let j = i + 1; j < sleeping.length; j++) addAvoid(sleeping[i], sleeping[j], 'Bedrooms kept separate', true);
      if (sleeping.length > 1) used = true;
    }

    const place = new RegExp(PLACE_RE.source, 'g');
    let pm: RegExpExecArray | null;
    while ((pm = place.exec(s))) {
      const subject = [...mentions].reverse().find((x) => x.end <= pm!.index);
      if (!subject) continue;
      // "the entrance on the east side" is an entry rule, not a room placement.
      if (/\b(?:entry|entrance|main\s+door|front\s+door|gate|door)\b/.test(s.slice(Math.max(0, pm.index - 30), pm.index))) continue;
      used = true;
      const side = DIRECTION[pm[1]];
      for (const room of subject.rooms.slice(0, 3)) {
        if (!out.placements.some((p) => norm(p.room) === norm(room))) {
          out.placements.push({ room, side });
          out.applied.push(`${room} toward the ${pm[1]} of the plot`);
        }
      }
    }

    const entry = ENTRY_RE.exec(s);
    if (entry) {
      const side = DIRECTION[entry[1]];
      if (side !== 'front' && side !== 'back') {
        out.entrySide = side as Side;
        out.applied.push(`Entry on the ${entry[1]} side`);
        used = true;
      }
    }

    if (/\b(?:common|shared|family)\s*(?:bath(?:room)?|toilet|wc)\b/.test(s)) {
      for (const m of mentions) if (/common|shared|family/.test(m.label)) for (const r of m.rooms) if (!out.sharedBathrooms.includes(r)) out.sharedBathrooms.push(r);
      if (out.sharedBathrooms.length) { out.applied.push(`${out.sharedBathrooms.join(', ')} treated as a shared bathroom (not an ensuite)`); used = true; }
    }
    if (/\bprivacy\b|\bprivate\s+bed\s*rooms?\b/.test(s) && !out.bedroomPrivacy) {
      out.bedroomPrivacy = true; used = true;
      out.applied.push('Bedroom privacy: bedrooms open onto the hallway, not the living areas');
    }
    if (/minimal\s+(?:corridor|circulation|passage|hallway)|no\s+corridor|avoid\s+(?:long\s+)?(?:corridors?|hallways?)|compact\s+circulation|less\s+corridor|minimi[sz]e\s+(?:corridor|circulation)/.test(s) && !out.minimalCorridor) {
      out.minimalCorridor = true; used = true;
      out.applied.push('Minimal corridor space: shortest workable hallway');
    }
    if (/natural\s+(?:light|daylight)|daylight|ventilation|well[- ]lit|sunlight/.test(s) && !out.naturalLight) {
      out.naturalLight = true; used = true;
      out.applied.push('Natural light/ventilation: habitable rooms favour exterior walls');
    }
    if (used) handled.push([start, start + sentence.length]);
  }

  // Report what has no layout rule behind it, clause by clause, so a
  // requirement is never silently dropped.
  const knownByOldPrefs = /open[\s-]*(?:plan|concept)?\s*kitchen|master[^.]*(?:far|away|furthest|farthest)[^.]*(?:entr|door|front)/;
  for (const sentence of sentences) {
    const s = sentence.toLowerCase();
    if (handled.some(([a, b]) => lower.indexOf(s) >= a && lower.indexOf(s) < b)) continue;
    if (knownByOldPrefs.test(s)) { out.applied.push(`"${sentence.trim().slice(0, 70)}"`); continue; }
    for (const clause of s.split(/,|\band\b/).map((c) => c.trim()).filter((c) => c.length > 8)) {
      if (SKIP_CLAUSE.test(clause) && !/(?:near|next|away|corner|front|back|left|right|north|south|east|west)/.test(clause)) continue;
      out.notApplied.push(clause.slice(0, 80));
    }
  }
  return out;
}

/** Union of two constraint sets; `primary` wins on the entry side. */
export function mergeConstraints(primary: LayoutConstraints, extra: Partial<LayoutConstraints> | null | undefined): LayoutConstraints {
  const out: LayoutConstraints = JSON.parse(JSON.stringify(primary));
  if (!extra) return out;
  for (const p of extra.adjacent || []) if (!out.adjacent.some((q) => pairKey(q) === pairKey(p))) { out.adjacent.push(p); out.applied.push(`AI: ${p.a} next to ${p.b}`); }
  for (const p of extra.avoid || []) if (!out.avoid.some((q) => pairKey(q) === pairKey(p))) { out.avoid.push(p); out.applied.push(`AI: ${p.a} kept apart from ${p.b}`); }
  for (const p of extra.placements || []) if (!out.placements.some((q) => norm(q.room) === norm(p.room))) { out.placements.push(p); out.applied.push(`AI: ${p.room} toward the ${p.side}`); }
  for (const n of extra.sharedBathrooms || []) if (!out.sharedBathrooms.includes(n)) out.sharedBathrooms.push(n);
  if (!out.entrySide && extra.entrySide) out.entrySide = extra.entrySide;
  for (const flag of ['minimalCorridor', 'bedroomPrivacy', 'naturalLight'] as const) {
    if (extra[flag] && !out[flag]) { out[flag] = true; out.applied.push(`AI: ${flag}`); }
  }
  return out;
}

/** One-sentence summary appended to the plan's design notes. */
export function describeConstraints(c: LayoutConstraints): string {
  const parts: string[] = [];
  if (c.applied.length) parts.push(`Applied from your requirements: ${c.applied.slice(0, 6).join('; ')}.`);
  if (c.notApplied.length) parts.push(`No layout rule yet for: ${c.notApplied.slice(0, 4).join('; ')}.`);
  return parts.join(' ');
}

export function hasAnyConstraint(c: LayoutConstraints): boolean {
  return !!(c.entrySide || c.adjacent.length || c.avoid.length || c.placements.length || c.sharedBathrooms.length || c.minimalCorridor || c.bedroomPrivacy || c.naturalLight);
}
