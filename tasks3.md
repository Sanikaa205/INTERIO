# INTERIO — Interior Generation Improvement Plan

**Scope:** make the six existing interior styles (`modern`, `minimal`, `traditional`, `industrial`, `scandinavian`, `japandi`) and the ten existing room types produce genuinely different, realistic interiors — in the generation logic first, then the AI/layout logic, then the 3D view.
**Not in scope:** new styles, new room types, floor-plan generation, the floor-plan 3D module (`src/components/FloorPlan3D/*`), auth/projects.
**Status:** planning document only. No code has been changed.

> **How this was produced.** Based on reading the actual source (files listed in §1). I did **not** run the app, install dependencies, or generate sample outputs. Findings about visual behaviour (e.g. furniture facing the wrong way, stretched floor texture) come from reading the code and should be confirmed by the baseline run in task 4.1 before fixes are accepted.

---

## 1. Current pipeline (as implemented)

```
InteriorDesignWorkflow.tsx  (style, roomType, W×L, budget, colours, free text, optional "Phase 1" floor-plan JSON)
   │  generateInteriorApi()  — src/services/api.ts:200-232
   ▼
POST /api/gemini/interior   — server.ts:448-664
   ├─ builds prompt (477-478) ── Gemini (temp 0.3, JSON) ──┐   falls back silently to ↓ on no key / error / bad JSON
   ├─ generateAlgorithmicInterior()  server.ts:4167-4278 ──┤   (palette per style + createRoomFurnitureSuggestions)
   ▼                                                       │
 finish(design)  server.ts:480-629   ◄─────────────────────┘
   ├─ normalises AI furniture (488-504)
   ├─ adds "essential" pieces from the fallback brief (509-532)
   ├─ overwrites x/y/wall/rotation from fallback "anchors" (537-570)
   ├─ prefixes style name, overwrites material / colour / price / size (571-597)
   ├─ optimizeFurnitureLayout()  src/services/layoutOptimizer.ts   (611-613)
   └─ matchFurnitureAsset()  src/services/furnitureAssets.ts       (614-617)
   ▼
 InteriorDesignResult → 2D SVG plan (InteriorDesignWorkflow.tsx:157-330) and
                        3D view (Shared3DView.tsx → src/three/interiorVisuals.ts)
```

**Essential files** (everything else was deliberately not opened):

| Concern | File |
|---|---|
| Endpoint, AI prompt, post-processing, algorithmic fallback | `server.ts` (448-664, 4167-4303) |
| Per-room furniture "briefs" | `src/services/interiorFurniture.ts` |
| Placement solver | `src/services/layoutOptimizer.ts` |
| Asset matching / GLB library | `src/services/furnitureAssets.ts`, `public/assets/furniture/*.glb`, `scripts/generate-furniture-assets.mjs` |
| Procedural 3D furniture, floor texture, decor | `src/three/interiorVisuals.ts` |
| 3D scene (lights, floor, walls, furniture loop, GLB loading) | `src/components/Shared3DView.tsx` (379-421, 509-557, 563-669, 706+) |
| 2D plan (shape picked by `form`+`name`+`category` substrings) | `src/components/InteriorDesignWorkflow.tsx` (157-330) |
| Request/inputs, Phase 1 JSON handling | `InteriorDesignWorkflow.tsx` (332-445, 515-530), `src/services/api.ts` |
| Types | `src/types.ts` (`FurnitureItem` 158-177, `InteriorDesignResult` 186+) |
| Existing tests | `src/services/interiorDesign.test.ts` (run via `npm test`; **file list is hard-coded in `package.json` line 13**) |

---

## 2. Root causes

### A. Why different selections produce the same interior

| # | Root cause | Evidence |
|---|---|---|
| **RC-1** | **One hard-coded template per room type.** `createRoomFurnitureSuggestions` has a single branch per room type with positions expressed as fixed fractions of the room (e.g. living: sofa on the north wall at `y = .78 + placement`, console on the south wall, rug centred, armchair east, lamp NE, plant NW). The *set of pieces and their ids are identical for all six styles*. | `interiorFurniture.ts` (living branch, bedroom branch, etc.) |
| **RC-2** | **Style only changes strings and colours, not design.** The only geometric style inputs are `styleScale` (0.96–1.04) and `language.placement` (−0.12…+0.12 m). Everything else style-related is a name, a material string, or a hex. | `interiorFurniture.ts` (`styleLanguage`, `styleScale`) |
| **RC-3** | **Most AI output is discarded in `finish()`.** AI palette → replaced by the algorithmic palette (485). AI philosophy / materials / lighting → replaced (624-626). AI x/y/preferredWall/rotation → replaced by fallback "anchors" when the name matches a regex (537-570). Every name is prefixed with the style label (587). Material, colour and price are overwritten by category look-ups (590-595). `Kitchen & Dining` and empty AI lists use the fallback entirely (536). The prompt itself gives Gemini no room program, no allowed forms, and no variation input, so even the part that survives is generic. | `server.ts` 477-478, 485, 536-597, 624-626 |
| **RC-4** | **The solver pins items to the anchors.** Score = `anchorDistance × 4 + wallPenalty + …`, first-fit on a 0.1 m grid, tie-breaks toward the top-left, placement order = list order. Result ≈ the template anchor ± grid snap. There is no candidate generation, no alternative arrangement, no seed. | `layoutOptimizer.ts` `optimizeFurnitureLayout` |
| **RC-5** | **Orientation is never derived.** `rotation` defaults to 0 for everything except dining chairs and the kitchen run/fridge. The 3D models' "front" is local +z, so rotation 0 = facing south. Pieces placed against the south, east or west walls (media console, sideboard, wardrobe, bookcase, armchair) therefore face the wall. Sofas/chairs never face a focal point. | `interiorFurniture.ts` (no `rotation` except dining/kitchen); `interiorVisuals.ts` (doors/cushions on +z); `server.ts` 598-610 is the only orientation logic |
| **RC-6** | **One colour per category.** `styleColors[category]` is applied to *every* piece of that category (593): all seating identical, all tables and storage the flooring colour. | `server.ts` 581, 593 |
| **RC-7** | **No variation input at all.** The request has no seed/variant; "Regenerate Design" re-sends the identical payload. The floor-plan endpoint already has `variationSeed` (`server.ts:411`); the interior endpoint does not. | `api.ts` 200-212, `InteriorDesignWorkflow.tsx` 425-440, 670 |
| **RC-8** | **Room-type coverage is thin.** `Studio Apartment` has no branch → falls into the living template (no bed, no kitchenette). `Study Room` and `Executive Home Office` share one template. `Bedroom` vs `Master Bedroom Suite` differ only by a name suffix. `Bathroom` is always 3 fixtures. | `interiorFurniture.ts` regexes; options at `InteriorDesignWorkflow.tsx` 515-530 |
| **RC-9** | **Tests don't detect the problem.** `style choices alter furniture materials and finishes` only asserts that the *first item's name/material/colour* differ across styles. Identical layouts pass. | `interiorDesign.test.ts:119` |

### B. Why user inputs, floor plans and prompts have little effect

| # | Root cause | Evidence |
|---|---|---|
| **RC-10** | **Phase-1 floor plan is barely used.** Only width/depth and `doorSide`/`windowSide` are read; every opening is placed at **40–60 % of the wall span** regardless of the real position/width. Rooms are rectangles only. | `InteriorDesignWorkflow.tsx` ~396-425 |
| **RC-11** | **Opening/door handling is weak.** Door clearance is `min(0.75, max(0.22, min(W,L)×0.08))` — ≈0.32 m in a 4 m room, far less than a door swing. Windows only block within 0.3 m of the wall *regardless of furniture height*. `defaultRoomOpenings` injects a fake south door and north window whenever a type is missing from the request. | `layoutOptimizer.ts` `roomDoorClearance`, `hitsOpening`, `defaultRoomOpenings`; `server.ts` 466-467 |
| **RC-12** | **Free-text requirements: 4 regexes.** Only "no tv", "reading nook/chair", "extra/more storage" are understood. Budget only scales size by ±3–7 % and the price string. | `interiorFurniture.ts` (`pref` checks), `server.ts` 582-584 |
| **RC-13** | **Silent drops and silent AI failure.** An item that doesn't fit is skipped (`if (!best) continue`) with only a generic warning; clearance is `max(a, b)` of both pieces (default 0.75 m), which drops pieces in small rooms in list order rather than by priority. A Gemini failure just logs and returns the fallback — the user can't tell. | `layoutOptimizer.ts`; `server.ts` 642-645, 622 |
| **RC-14** | **Name-regex coupling.** The 2D SVG (`furnitureShape`), the 3D builder (`createFurnitureModel`), asset matching, "essentials" and the AI anchors all pattern-match on **item names**. `FurnitureItem.form` exists in the type but the server never sets it. Any rename (or the blanket style-prefix) risks breaking shapes/models. | `InteriorDesignWorkflow.tsx:157`, `interiorVisuals.ts:123`, `furnitureAssets.ts`, `server.ts` 545-558 |

### C. Why the 3D view looks unrealistic

| # | Root cause | Evidence |
|---|---|---|
| **RC-15** | **One procedural model per category, not per form or style.** A "dining chair" is built as a sofa (arms + 2–4 cushions — the `chair` flag only matches *armchair/accent/lounge*). Legs/metal are fixed colours (`#483a2c`, `#403d39`) in every style. No tufting, plinths, hairpin legs, slats, etc. `height` is never set by the fallback briefs, so generic default heights apply. | `interiorVisuals.ts` 116-296 (esp. 135-136, 199-215) |
| **RC-16** | **Timber colour bug.** `getWood()` takes the first palette entry whose role is `secondary` **or** `flooring`. In the `modern` and `minimal` palettes `secondary` (grey concrete / raw linen) precedes `flooring`, so wooden furniture renders grey/linen. | `interiorVisuals.ts` 111-114 vs palettes at `server.ts` 4169-4190 |
| **RC-17** | **GLB library is placeholder cubes and is bypassed.** The six GLBs are ~2 KB box compositions from `generate-furniture-assets.mjs`; Shared3DView deliberately skips any `/assets/furniture/` URL (line 632). When a real GLB *is* supplied it is scaled **non-uniformly** to the footprint and height (640) and tinted by a fixed 0.22 lerp (649-655), and assumes the model origin is its centre (643). | `Shared3DView.tsx` 626-667 |
| **RC-18** | **Floor and walls are style-blind.** Floor is always the canvas wood-plank texture, even for stone/concrete/terrazzo palettes (`tile` is derived from `/tile|marble/` on the *style id*, which never matches), and no `repeat` is set, so one 1024 px texture is stretched across the whole room. Walls are a flat colour. | `interiorVisuals.ts` 59-109; `Shared3DView.tsx` 509-527 |
| **RC-19** | **Lighting is identical for every style.** Hemisphere + sun + fill + a shadow-casting centre point light (1.4); only day/night differs. Shadow camera is ±20 m for a ~5 m room. Lamps in the data produce no light (the model sets `userData.lamp` only). | `Shared3DView.tsx` 379-421 |
| **RC-20** | **No scene dressing for interior projects.** `addStyledDecor` (curtains, art, plants, lamp) is hard-coded to fixed fractions, ignores collisions/openings, and is only called for `projectType === 'renovation'`. | `interiorVisuals.ts` 314-374; `Shared3DView.tsx` 550-557 |
| **RC-21** | Smaller defects: `/shower\|walk-in/` also matches "walk-in wardrobe"; the module-level `materialCache` is shared across scenes and `floorMat.wireframe = …` mutates a cached material (`Shared3DView.tsx:513`). | `interiorVisuals.ts` 163; 11-19 |

---

## 3. Cross-cutting design decisions

1. **Keep the architecture.** Gemini suggests; the deterministic engine decides geometry. The API shape (`InteriorDesignResult`) stays backward compatible — new fields are optional so saved projects in `data/projects.json` still load.
2. **Stop relying on names.** Introduce two explicit fields on `FurnitureItem`/`FurnitureSuggestion`: `role` (functional slot, e.g. `sofa`, `coffee-table`, `bed`, `wardrobe`) and `form` (style-specific variant, e.g. `sofa/chesterfield`). `form` already exists in `types.ts`. Names stay human-readable and keep the current keyword vocabulary (`sofa`, `dining chair`, `counter`, …) so the 2D SVG, existing tests and asset matching keep working.
3. **Determinism.** Everything uses a seeded PRNG (`variationSeed`). Same inputs + same seed ⇒ same output; "Regenerate" changes the seed.
4. **Feature flag.** Gate the new generator behind `INTERIO_INTERIOR_V2=1` (precedent: `INTERIO_LEGACY_FALLBACK` at `server.ts:3170`) until Phase 4 passes, so the old path stays available for comparison.
5. **No new runtime dependencies** are required for Phases 1–2. Phase 3 uses modules already shipped in `three` (`GLTFLoader`, `DRACOLoader`, `EffectComposer`). Only *assets* (GLBs, texture maps) are new.

---

## Phase 1 — Fix interior generation (deterministic engine)

**Goal:** the six styles × ten room types yield visibly different piece sets, arrangements, orientations, materials and colours — with no AI involved. Ships on its own.

**Files:** `src/services/interiorFurniture.ts` (refactor), new `src/services/interiorStyles.ts`, new `src/services/interiorArrangements.ts`, `src/services/layoutOptimizer.ts` (orientation only), `server.ts` (`finish()`, `generateAlgorithmicInterior`), `src/types.ts`, `src/services/api.ts`, `InteriorDesignWorkflow.tsx` (Regenerate seed).
**Depends on:** nothing.

| # | Task | Fixes |
|---|---|---|
| **1.1** | **Style recipes** (`interiorStyles.ts`): for each existing style, a data table of (a) allowed `form`s per role (sofa: tailored low-profile / modular / tufted / leather loft / bouclé / low flax; bed: platform / slat / panelled / steel-frame / low hinoki; etc.), (b) leg/base type, (c) material set per role, (d) which palette role colours which piece (upholstery = `secondary`, case goods = timber from `flooring`, metals per style), (e) density (minimal fewer pieces, traditional more), (f) symmetry bias (traditional formal/symmetric, japandi low & asymmetric, industrial offset/open), (g) optional-piece ranking (side tables, sideboard, art, pendants, plants, poufs, benches). Move the existing `styles`/`styleLanguage` maps and the `materialByCategory` table from `server.ts:574-580` here so there is one source of truth. | RC-2, RC-6 |
| **1.2** | **Arrangement templates** (`interiorArrangements.ts`): ≥2–3 per room type, each expressed with *constraints* (`against: wall`, `faces: focal-role`, `centerOn`, `group`) rather than fixed x/y. Examples — Living: A) sofa facing media wall; B) sofa floating, back to the entry; C) L-shaped sofa + armchairs. Bedroom: bed on the best wall (window/door aware) with side tables or bench-end; wardrobe wall vs. wall-to-wall run. Study: desk at window vs. desk facing wall. Dining: round vs rectangular, banquette variant. Kitchen: single-run / L / galley depending on aspect ratio and openings. Selection = f(room aspect ratio, area, opening positions, style recipe, seed). | RC-1, RC-4, RC-7 |
| **1.3** | **Refactor `createRoomFurnitureSuggestions`** into `buildRoomProgram(roomType, style, size, requirements, budget, seed)` returning `FurnitureSuggestion[]` (with `role`, `form`, `height`, per-piece colour/material, `facing`). **Keep the exported signature** (extra args optional) and the name keywords the tests assert on. Always set `height` so 3D proportions are right (RC-15). | RC-1, RC-2, RC-15 |
| **1.4** | **Room-type coverage:** `Studio Apartment` → sleeping zone + seating zone (+ compact kitchen run if area allows); `Executive Home Office` → larger desk, credenza, guest chairs; `Study Room` → compact desk/bookcase; `Master Bedroom Suite` → bench/dresser/reading chair on top of `Bedroom`; `Bathroom` → size-aware (shower/bath choice, double vanity when wide enough). Map via an explicit `normalizeRoomType()` instead of scattered regexes (also used by `finish()` at `server.ts:518`). | RC-8 |
| **1.5** | **Orientation:** add `facing?: 'wall' \| 'room' \| { focal: role }` to `FurnitureSuggestion`. After choosing a position, the solver sets rotation so (a) pieces within 0.5 m of a wall have their back to it (`north 0°, south 180°, west 90°, east 270°` — same mapping already used for dining chairs at `server.ts:602`), (b) seating faces its focal piece (sofa → media/fireplace wall or coffee table; desk chair → desk). Restrict the 4-rotation search to the allowed set instead of tie-breaking on `rotation × 0.00001`. | RC-5 |
| **1.6** | **Per-piece colour/material:** replace the category-wide overwrite (`server.ts:593`) with the recipe's role→palette mapping so a room can have a sofa in `secondary`, an armchair in `accent`, and timber in a flooring-derived tone. Keep user-preferred colours flowing through `generateAlgorithmicInterior`. | RC-6 |
| **1.7** | **`variationSeed`:** add optional `variationSeed` to `generateInteriorApi` params and the endpoint (mirror `server.ts:411`); `Regenerate Design` increments it; stored on the result (`generation.seed`). Seeded PRNG chooses arrangement template, optional-piece subset, and palette tie-breaks. | RC-7 |
| **1.8** | **Tidy `finish()`:** compute `generateAlgorithmicInterior(...)` once (it is currently called four times, lines 485/625/626 + the callers); keep the style-name prefix off item names — put the style label in `form`/`notes` (names keep the base noun). | RC-14 |

**Acceptance criteria (Phase 1)**
- For every room type, any two of the six styles differ in **≥ 40 % of items by `(role, form, wall, rotation)`**, and in **piece count or optional-piece set** for at least minimal vs. traditional.
- For each (room type, style), seeds `0..4` reach **≥ 2 distinct arrangement templates**; the same seed reproduces byte-identical output.
- No piece against a wall faces that wall; seating faces its focal piece (assertable from `rotation` + `x/y`).
- Studio Apartment contains a bed; Living Room never contains a bed; Home Office ≠ Study Room piece set.
- `npm test` and `npm run lint` pass unchanged (existing assertions in `interiorDesign.test.ts` still hold).

---

## Phase 2 — Improve AI and layout logic

**Goal:** user inputs, room size, openings and floor-plan data actually drive the result; the AI contributes real design choices that survive post-processing; the solver is constraint-based and validates its own output.
**Files:** `server.ts` (prompt + `finish()`), new `src/services/interiorAi.ts` (prompt builder + response normaliser), `src/services/layoutOptimizer.ts`, new `src/services/requirementsParser.ts`, `InteriorDesignWorkflow.tsx` (Phase-1 JSON parsing), `src/types.ts`.
**Depends on:** Phase 1 (programs, recipes and `role`/`form` vocabulary are what the prompt and parser refer to). Can be developed against recorded Gemini fixtures.

| # | Task | Fixes |
|---|---|---|
| **2.1** | **Rewrite the prompt** (`server.ts:477-478`) to include: room dimensions + aspect ratio, **opening positions/widths**, the Phase-1 room program (required roles), the style recipe's allowed `form`s and materials, budget tier, seed. Ask Gemini to *choose* — arrangement id from the allowed list, a `form`/material/colour for each role (colour from the palette), focal wall, optional pieces with rationale — not to invent coordinates. Use `responseSchema` with the `@google/genai` call (verify support in the installed `^2.4.0` in `generateGeminiContentWithFallback`, `server.ts:201`); raise temperature moderately (≈0.6-0.8) because output is now validated. | RC-3 |
| **2.2** | **Response normaliser** (`interiorAi.ts`): enum/range validation, size clamps relative to the room, role→slot mapping, dedupe. Output a typed result plus `{ source: 'ai' \| 'fallback', accepted: n, rejected: n }`. Replace the name-regex anchor matching (`server.ts:545-558`) with `role` matching. | RC-3, RC-14 |
| **2.3** | **Stop discarding valid AI content.** Accept the AI palette/philosophy/materials/lighting when they pass checks (5 swatches, valid roles/hex, wall lighter than flooring, preferred colours applied); fall back **per field**, not wholesale (replace `server.ts:485` and 624-626). Keep the existing guard that the style identity can't be erased (recipe hue/lightness bounds). | RC-3 |
| **2.4** | **Surface AI status:** return `generation: { source, seed, arrangement, aiFallbackReason? }` and show a small note in the UI when the offline generator was used (today `server.ts:642-645` hides it). | RC-13 |
| **2.5** | **Constraint-based solver** in `layoutOptimizer.ts`: placement by role priority (essentials → functional → optional) instead of list order; constraints `against`, `faces`, `groupWith`, `centerOn`, `alignTo`; **pair-specific clearances** (e.g. 0.45 m sofa–coffee table, 0.9 m bed sides when requested, 1.0–1.2 m accessibility) instead of `max(a,b)` default 0.75; keep the 0.1 m grid and rug/decor exemptions. Generate **N candidates** (arrangement × seed), score (circulation, focal alignment, symmetry for traditional, balance, wall use) and return the best. Drop optional pieces by priority when the room is small and report which. | RC-4, RC-13 |
| **2.6** | **Openings & boundaries:** real door-swing zone (door width as a quarter-circle/rect keep-out on the hinge side, ≥ 0.9 m), **window obstruction by height** (tall pieces — wardrobe/bookcase — may not cover a window span; low pieces may), keep-out for the entry path (door → room centre → each functional piece via a flood-fill on the 0.1 m grid; reject candidates with a pocket < 0.6 m). Extend `LayoutRoom` with optional `blockedRects` so non-rectangular rooms can be approximated by a bounding box + masks (stretch). Stop injecting fake default openings when real ones are supplied (`server.ts:466-467`). | RC-11 |
| **2.7** | **Use the floor-plan input fully** (`InteriorDesignWorkflow.tsx` ~396-425): first audit which fields the floor-plan engine actually emits per room (door/window side, position, width — see where `windowSides`/door data are set around `server.ts:2323` and `3703`), then pass real `start/end` instead of the 40–60 % default; carry room name/type, adjacency (kitchen next to dining) and entry side into the request. | RC-10 |
| **2.8** | **Requirements & budget parser** (`requirementsParser.ts`, same pattern as `layoutConstraints.ts`): extend beyond TV/reading/storage to: pets, kids, accessibility (wider clearances), work-from-home (adds desk), guests (sofa-bed/extra seating), king/queen bed, "no sofa", fewer/more items, specific colours or materials. Report `applied` / `notApplied` lines in the result like the floor-plan engine does. Make **budget drive piece count and material tier** (essential = fewer pieces; bespoke = more decor/higher-grade forms), not just a ±3-7 % size factor (`server.ts:582-584`). | RC-12 |
| **2.9** | **Post-solve validation + repair** (`validateLayout`): bounds, overlaps, door swing, window blocking, reachability, orientation sanity. On failure try the next candidate; remaining issues go to `layoutWarnings` with specific text (which piece, why). | RC-13 |
| **2.10** *(optional)* | Route the renovation endpoint (`server.ts` ~4011-4160, Gemini returns raw x/y) through the same normaliser + solver so both workflows share the layout rules. | consistency |

**Acceptance criteria (Phase 2)**
- Changing **only** room size (e.g. 3.2×3.8 → 5.5×6.5), **only** door/window position, **only** budget tier, or **only** a requirement phrase measurably changes the output (piece set or placement) in tests.
- With a recorded valid Gemini fixture, ≥ 80 % of accepted AI pieces appear in the result with their AI-chosen `form`/colour; with malformed/hostile fixtures the endpoint returns a valid fallback and `generation.source === 'fallback'`.
- No generated layout blocks a door swing or covers a window with a tall piece; all pieces reachable.
- `npm test` / `npm run lint` pass; API response remains accepted by `generateInteriorApi`'s existing consistency checks (`api.ts:223-229`).

---

## Phase 3 — Improve 3D realism

**Goal:** the 3D room is a faithful, good-looking rendering of `furniture[]` with style-appropriate forms, materials and light. Tasks 3.1 and 3.4-3.5 can start in parallel with Phase 1; 3.2-3.3 consume `form`/`height`/`rotation` from Phase 1.
**Files:** `src/three/interiorVisuals.ts` (split), new `src/three/furniture/*.ts`, `src/components/Shared3DView.tsx`, `src/services/furnitureAssets.ts`, `public/assets/furniture/*`, `public/assets/materials/*`, `scripts/generate-furniture-assets.mjs` (retire/document), optionally reuse `FloorPlan3D/materialCatalog.ts` / `materials.ts` texture loader.
**Depends on:** Phase 1 for `form`, `height`, per-piece colour, correct `rotation`. Phase 2 not required.

| # | Task | Fixes |
|---|---|---|
| **3.1** | **Bug fixes (do first, small):** separate `getWoodColor` (palette `flooring`, or derived from item material) from `getFabricColor` (`secondary`); give dining chairs/stools/benches/poufs their own builders; tighten `/shower\|walk-in/` to `shower` only; make `material()` cache per-scene or stop mutating shared materials' `wireframe` (`Shared3DView.tsx:513`); read `item.height`. | RC-15, RC-16, RC-21 |
| **3.2** | **Form-based procedural models:** split the 180-line `createFurnitureModel` chain into `src/three/furniture/{seating,tables,storage,beds,lighting,decor,fixtures}.ts` with a registry keyed by `form` (fallback: today's category/name logic, so nothing regresses). Parameterise by style recipe: leg type (tapered wood, steel hairpin, plinth, turned), arm style (track, rolled, none), tufting/piping, slat headboards, handle/hardware type, edge radius, accent materials (brass for traditional, blackened steel for industrial, cedar slats for japandi). | RC-15 |
| **3.3** | **Better 3D assets (where procedural isn't enough):** identify the highest-impact forms — sofa (3 variants), armchair, dining chair (2), bed (3), dining table (2), coffee table (2), wardrobe, media console/credenza, desk, bookcase, floor lamp, pendant, plant, kitchen run, fridge, vanity, WC, shower/bath. Source **CC0/permissively licensed glTF** only (e.g. Poly Haven, Kenney, Quaternius, sketchfab-CC0) and record source + licence in `public/assets/furniture/README.md` (it currently states "no third-party meshes"). Budget ≤ ~300 KB per model, Draco/meshopt compressed, lazy-loaded. Extend `FurnitureAsset` with `forms`, `styles`, `nativeSize`, `originOffset`. | RC-17 |
| **3.4** | **Fix GLB integration** (`Shared3DView.tsx:626-667`): remove the blanket skip of `/assets/furniture/` only for real models (keep for the placeholder cubes, or delete them and the generator script); **uniform scale** to the footprint with a bounded per-axis tolerance, re-centre by bounding-box centre, floor-snap, map materials by slot name (fabric/wood/metal) instead of the fixed 0.22 tint, fall back to the procedural model on load error (current behaviour). | RC-17 |
| **3.5** | **Floors and walls:** drive material from the data. Add optional `finishes: { floor: id; wall: id }` to `InteriorDesignResult`, chosen in Phase-1 recipes (oak plank, pale ash, herringbone walnut, concrete, limestone, terrazzo; plaster/limewash/wainscot; tile for kitchen/bath). Set texture `repeat` from room size (e.g. one tile ≈ 1.2 m); add normal/roughness maps; reuse `FloorPlan3D/materialCatalog.ts` + the cached texture loader in `FloorPlan3D/materials.ts` where possible; keep the canvas wood as fallback. New texture maps must be CC0 (ambientCG / Poly Haven) with licence recorded in `public/assets/materials/README.md`. Add skirting boards (and crown moulding for traditional). | RC-18 |
| **3.6** | **Style-driven lighting** (`Shared3DView.tsx:379-421`): per-style colour temperature/intensity (scandinavian ≈2700 K soft; industrial warmer pendants; modern cooler recessed; traditional warm shaded lamps); one shadow-casting key light with a **shadow camera fitted to the room bounds** (not ±20 m); drop the centre shadow-casting point light; add non-shadow point lights at `lighting` items and a pendant over the dining/kitchen table; window light from the actual openings; per-mode exposure. Add a cheap contact shadow / AO (blob under furniture, or `GTAOPass` with a mobile opt-out). | RC-19 |
| **3.7** | **Scene dressing from data:** replace `addStyledDecor` hard-coding with decor derived from generated `decor`/`lighting` items and openings — curtains/blinds at real windows, wall art per style, plants placed by the solver (collision-aware), pendants — and apply it to **interior** projects as well as renovation. | RC-20 |
| **3.8** | **3D ⇄ plan consistency tooling:** a debug toggle drawing footprints, facing arrows and clearance zones in 3D; verify GLB-replaced models stay on the same footprint; ensure the 2D SVG `furnitureShape` is given `form` so both views describe the same object. | RC-14 |
| **3.9** | **Performance & disposal:** merge static meshes / instance repeated chairs (there is a `FloorPlan3D/mergeStatic.ts` precedent), cap shadow map size by room size, dispose geometries/materials/textures on rebuild, cap pixel ratio on mobile. | stability |

**Acceptance criteria (Phase 3)**
- Dining chairs render as chairs (no arms/sofa cushions); `modern` and `minimal` timber is no longer grey/linen (unit test on the colour helper).
- For each style, a visual checklist (task 4.4) confirms distinct silhouettes, materials, floor/wall finish and light mood; screenshots stored per (room type, style).
- Floor texture scale is independent of room size (test: `repeat` = size / tile size).
- A GLB with off-centre origin or unusual proportions lands on its footprint without distortion; failed load keeps the procedural model.
- Sustained ≥ 30 fps on a mid-range laptop for a 6×5 m furnished room; no console errors; no unbounded growth of geometries/textures after 10 regenerations.

---

## Phase 4 — Testing and validation

**Goal:** prove the fixes with automated, repeatable checks, and define done for each phase. Write tests alongside each phase; this phase is the full matrix and sign-off.
**Files:** new `src/services/interiorVariation.test.ts`, `interiorAi.test.ts`, `layoutValidation.test.ts`, new `scripts/interior-harness.ts` (pattern: `scripts/floorplan-harness.ts` → results in `scripts/harness-results/`), `package.json` (**add every new test file to the `test` script — it lists files explicitly**).

| # | Task |
|---|---|
| **4.1** | **Baseline before changes:** run the harness (below) on the *current* generator and save results; this confirms RC-1…RC-6 numerically (e.g. layout similarity between styles) and checks the visual hypotheses (RC-5 facing, RC-18 texture stretch) with a few 3D screenshots. |
| **4.2** | **Combination matrix test:** 10 room types × 6 styles × room sizes {small ≈3×3, typical, large, narrow 2.5×6} × seeds {0,1,2} (keep the matrix cheap — pure functions, no AI). Assertions: (1) all items inside the room; (2) no overlaps except rugs/decor; (3) no item in a door-swing zone; (4) no tall item covering a window; (5) every role marked essential for the room type is present at ≥ 3×3 m; (6) walkway ≥ 0.6 m between functional pieces / door reachable; (7) orientation rules from 1.5; (8) **layout signature distance** between any two styles for the same room/size ≥ threshold, and across seeds ≥ 2 templates (define signature = sorted `(role, form, wall, rotation)` tuples; compare with Jaccard); (9) same seed ⇒ identical output; (10) room-type sanity (no bed in Living/Dining/Kitchen; Studio has bed). |
| **4.3** | **AI path tests:** recorded Gemini fixtures — valid, partial, malformed JSON, out-of-range sizes/coordinates, prompt-injection-style strings in names/notes, wrong enum values; assert normaliser output, fallback flags, and that no AI value can place furniture outside the room or inject unsafe strings into the DOM/SVG. |
| **4.4** | **3D checks:** automated unit tests for pure helpers (colour roles, texture repeat, GLB fit maths, light-rig config per style). Manual checklist per style × {living, bedroom, kitchen, bathroom}: silhouettes, proportions (sofa seat ≈ 0.42-0.48 m, table 0.72-0.76 m, bed 0.4-0.55 m), materials, shadows (no acne/peter-panning), lights from lamps, no z-fighting on rugs, wireframe/day/night toggles, selection & transform controls still work. Capture screenshots into `scripts/harness-results/` for before/after. |
| **4.5** | **Regression:** `npm run lint`, `npm test`, `npm run build`; load an old saved interior project from `data/projects.json` (no new fields) in 2D and 3D; renovation/reconstruction workflow (shares `Shared3DView`) still renders; floor-plan workflow untouched (`git diff --stat` shows no changes under `FloorPlan3D/` unless task 3.5 deliberately reuses its helpers via import only). |
| **4.6** | **Rollout:** run with `INTERIO_INTERIOR_V2` on for a review period, compare harness output old vs new, then make V2 default and remove the flag. |

### Completion criteria by phase

| Phase | Done when |
|---|---|
| **1** | Phase-1 acceptance criteria met; matrix tests 4.2 (1,2,7,8,9,10) green on the deterministic generator; existing tests green. |
| **2** | Phase-2 acceptance criteria met; matrix tests 4.2 (3,4,5,6) and AI tests 4.3 green; changing size/openings/budget/requirements demonstrably changes output; AI/fallback status visible in the response and UI. |
| **3** | Phase-3 acceptance criteria met; 3D checklist 4.4 signed off for all six styles; asset licences recorded; performance targets met. |
| **4** | Baseline vs final harness comparison attached; `lint`, `test`, `build` green; legacy projects load; flag removed or defaulted on. |

---

## 5. Order, dependencies and risks

**Suggested order:** 3.1 (quick bug fixes) → Phase 1 → Phase 2 → rest of Phase 3 → full Phase 4. Phase 3 lighting/material tasks (3.5-3.6) can run in parallel with Phase 1.

**Dependencies**
- No new npm packages needed for Phases 1-2. Verify `responseSchema` support in the installed `@google/genai` before task 2.1.
- Phase 3 needs external **assets** (GLBs, PBR textures) with recorded CC0/permissive licences; everything else is code.
- Gemini API key is optional (offline generator must remain first-class).

**Risks / things to watch**
- **Name coupling (RC-14):** the 2D SVG, 3D builder, asset matcher and tests all key off item names. Mitigation: introduce `role`/`form`, keep the existing noun vocabulary, and update `furnitureShape` and `createFurnitureModel` to prefer `form` while falling back to name matching.
- **Solver cost:** N candidates × 4 rotations × a 0.1 m grid per item. Mitigation: coarse-to-fine search (0.25 m then 0.05 m around the best), early exit, cap N (≈6-12).
- **Small rooms:** priority-based dropping must still leave the defining furniture (existing test at `interiorDesign.test.ts:174` guards this).
- **Backward compatibility:** every new field optional; do not change existing field meanings; saved projects keep rendering.
- **Visual hypotheses are unverified** until task 4.1 runs the app.

**Explicitly deferred:** new styles or room types, floor-plan engine changes, non-rectangular room generation (only the `blockedRects` hook), photoreal path-traced rendering.
