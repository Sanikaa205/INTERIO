# INTERIO Interior Design v3 — Input-Driven Generation Tasks

Progress: 20 / 20 tasks

Goal: the generated interior must reflect what the user chose — **colours** on the real elements (floor, walls, bed, furniture), **aesthetic** in furniture style and materials, **additional requirements** in the layout, **budget** in what gets picked. The 2D look stays exactly as it is. **Planning document only; nothing is implemented yet.**

Priorities: **P0** required · **P1** core · **P2** deferred (see "Later").

## 1. Current state (from the code)

- **Entry** — `POST /api/gemini/interior` in `server.ts` (~L448). `InteriorDesignWorkflow.tsx` sends `style`, `budget`, `roomType`, `preferredColors[]`, `additionalRequirements`.
- **Palette** — `generateAlgorithmicInterior` (`server.ts` ~L4167) picks a fixed 5-swatch palette per style, then applies user colours.
- **Furniture** — `createRoomFurnitureSuggestions` (`src/services/interiorFurniture.ts`) builds pieces per room type; positions are finalised by `layoutOptimizer`.
- **2D** — `InteriorDesignWorkflow.tsx` draws the floor from the palette `flooring` swatch and shapes from `item.form`/name/category with `item.color`.
- **Known problems**
  1. `namedColors` has ~40 names; **any other colour (e.g. "pink") is silently dropped**, and the generator behaves as if none was entered.
  2. User colours only reach `flooring`/`secondary`/`accent`, chosen by keyword matching. **Walls never take a user colour.**
  3. Furniture colour is copied from palette roles (`secondary`, `flooring`) with no per-piece intent — the bed is a neutral by default.
  4. `finish()` in the route discards Gemini's palette and rebuilds it algorithmically (~L485); Gemini colours are effectively unused.
  5. Aesthetic changes mostly names, a material string and a `styleScale` factor.
  6. Requirements: only "no TV", "reading nook", "extra storage" are recognised.
  7. Budget changes an accent hex, a text suffix and a size factor; it never changes which pieces are chosen.

## 2. Guardrails

- **2D output must not change** for the same inputs where nothing was ignored before: no edits to the SVG drawing code in `InteriorDesignWorkflow.tsx` (read-only except the optional swatch-confirm UI in 5.3).
- Keep the layout optimizer and its tests untouched; positions/sizes/rotations come from the deterministic path only.
- Keep the response shape (`InteriorDesignResult`) backward compatible: only add optional fields.
- Old saved projects must load unchanged.
- Colour handling must work for **any** input (names, phrases, hex), never rely on specific words like "pink".
- Never drop a user input silently: anything unresolved is reported in the response.
- No new runtime dependencies unless a tiny colour library is justified in 1.1; Gemini is optional — every step needs a deterministic fallback when it is unavailable.

## 3. Tasks

### Phase 1 — Colour engine (do first; everything depends on it)

- [x] **1.1 (P0) Colour resolver**
  - Files: new `src/services/colorResolver.ts`, `colorResolver.test.ts`.
  - `resolveColor(input) → { hex, name, source: 'hex' | 'named' | 'phrase' | 'ai' | 'unresolved' }`.
  - Support `#rgb`/`#rrggbb`, CSS named colours (~148), and interior names (blush, sage, terracotta, mustard, …). Parse phrases as `modifier + base` ("dusty rose", "deep teal", "warm grey", "pastel mint") by shifting HSL lightness/saturation.
  - Done when: tests cover hex, CSS names, interior names, modifiers, mixed case/whitespace, garbage input → `unresolved`.

- [x] **1.2 (P1) AI fallback for unresolved colours**
  - Files: `server.ts`, `colorResolver.ts`.
  - One batched Gemini call for all unresolved strings → hex; skipped when no API key or on error. Validate the returned hex.
  - Done when: "burnt sienna" style inputs resolve with the key present; without a key they come back `unresolved` and are reported (no crash, no silent drop).

- [x] **1.3 (P0) HSL utilities and palette derivation**
  - Files: new `src/services/colorTheory.ts`, `colorTheory.test.ts`.
  - Helpers: hex↔HSL, tint/shade, contrast ratio, complementary/analogous, clamp saturation for neon inputs.
  - `derivePalette(userColors, styleProfile)` → `{ wall, floor, hero, heroSoft, accent, neutral, trim }` using lightness/saturation rules, not colour names (light tint for walls, pale wood/white floor for saturated hero colours, etc.).
  - Done when: tests show sensible output for pink, navy, neon green, near-black, near-white and a 3-colour input.

- [x] **1.4 (P1) Role assignment for multiple colours**
  - Files: `colorTheory.ts`, tests.
  - With several colours: most saturated → hero, lightest → wall tint, rest → accents. One colour: derive the others. Zero colours: use the style palette as today.
  - Done when: `navy, mustard, cream` and a single `pink` both produce a complete 5-role palette.

- [x] **1.5 (P1) Contrast guard**
  - Files: `colorTheory.ts`, tests.
  - Ensure floor vs wall and furniture vs floor have a minimum contrast; nudge lightness otherwise.
  - Done when: a near-white colour on a near-white floor still yields visible furniture.

  ---done---

### Phase 2 — Apply colours to the generated design

- [x] **2.1 (P0) Wire derived palette into the generator**
  - Files: `server.ts` (`generateAlgorithmicInterior`).
  - Replace the keyword role-matching block (~L4254) with `derivePalette`. Keep the output as the existing 5 `ColorSwatch` roles so the 2D code is unaffected. Remove the `finish()` override that discards the palette so Gemini/user colours stay consistent.
  - Done when: entering any colour changes `wall`, `flooring`, `accent` swatches accordingly; with no colour the output equals today's.

- [x] **2.2 (P0) Per-piece colour roles**
  - Files: `interiorFurniture.ts`, `layoutOptimizer.ts` (type only if needed), tests.
  - Add a role to each piece (`hero` | `soft` | `wood` | `neutral` | `accent`). Bed/sofa → hero, rug → soft, tables/storage → wood, lamps/decor → accent. Resolve colour from the palette by role.
  - Done when: a pink input gives a pink bed and accents, pale/white floor, matching nightstands; the same room with no colour matches today's output.

- [x] **2.3 (P1) Material text follows colour**
  - Files: `interiorFurniture.ts`, `server.ts`.
  - Furniture `material`/`notes`, `materialFinishes` and the palette swatch names/descriptions mention the chosen colour ("Blush-pink upholstered bed") instead of generic style text.
  - Done when: names/descriptions reflect the user's colours.

- [x] **2.4 (P1) Report unresolved inputs**
  - Files: `server.ts`, `src/types.ts`.
  - Add optional `inputNotes?: string[]` ("Could not interpret colour 'xyz'; used the style palette").
  - Done when: a garbage colour produces a note, not a silent drop.

### Phase 3 — Aesthetic profiles

- [x] **3.1 (P1) Style profile table**
  - Files: new `src/services/styleProfiles.ts`, tests.
  - Per `DesignStyle`: materials (wood, upholstery, stone, metal), form language (rounded/boxy/low/ornate), leg/frame style, signature pieces to add, pieces to avoid, default neutral palette, lighting.
  - Done when: each of the 6 styles has a complete profile, test asserts no missing fields.

- [x] **3.2 (P1) Use profiles in furniture generation**
  - Files: `interiorFurniture.ts`, `server.ts`.
  - Replace the inline `styles`/`styleLanguage` objects with profile lookups; add style-specific pieces (e.g. japandi low table, traditional side table, industrial shelving) per room type where space allows.
  - Done when: two styles on the same room differ in names, materials and at least one piece; sizes/positions still come from the optimizer.

- [x] **3.3 (P2) Style-aware colour rules**
  - Files: `colorTheory.ts`.
  - Style adjusts palette derivation (e.g. industrial desaturates the hero, scandinavian lightens the floor, traditional warms wood).
  - Done when: same colour + different style gives visibly different palettes.

### Phase 4 — Requirements and budget

- [x] **4.1 (P0) Requirements parser (structured intent)**
  - Files: new `src/services/requirements.ts`, tests; `server.ts`.
  - `parseRequirements(text) → { add: [], remove: [], avoid: [], notes: [] }`. Deterministic keyword pass first (tv, desk, reading nook, storage, pets, kids, wheelchair/accessibility, plants). Optional Gemini pass to convert free text to the same JSON; fall back to the keyword pass if unavailable.
  - Done when: varied phrasings ("don't want a TV", "need a work desk", "step-free for wheelchair") map to flags.

- [x] **4.2 (P1) Apply requirements in the layout inputs**
  - Files: `interiorFurniture.ts`, `server.ts`.
  - `add`/`remove` change the piece list; accessibility widens `clearance`; pets/kids prefer soft edges and fewer small objects. Unfulfillable requests (no space) go into `layoutWarnings`.
  - Done when: each flag has a test showing the piece list change.

- [x] **4.3 (P0) Budget tiers and piece catalogue**
  - Files: new `src/services/budgetTiers.ts`, tests.
  - Define tiers matching the UI's `BUDGET_TIERS` ids, with: allowed optional pieces, material grade, indicative price ranges per category.
  - Done when: every UI budget id maps to a tier; unknown strings map to a default tier.

- [x] **4.4 (P1) Apply budget to piece selection**
  - Files: `interiorFurniture.ts`, `server.ts`.
  - Essential budget drops optional pieces (rug, lamp, plant, accent chair); higher tiers add them and upgrade material text. Set `estimatedPrice` from the tier catalogue and return a total.
  - Done when: same room at two budgets has a different item list and total.

### Phase 5 — Verify and surface

- [x] **5.1 (P0) Regression: 2D unchanged**
  - Files: `interiorPipeline.test.ts`, `__fixtures__/legacyFurniture.json` (generated from the original `interiorFurniture.ts` in git, so it is a true "before").
  - Snapshot the no-preferences output for each style × room type before changes and assert it is unchanged after (colours/pieces/positions), apart from intentionally added fields.
  - Done when: the snapshot test passes in CI.

- [x] **5.2 (P0) End-to-end input matrix tests**
  - Files: `interiorPipeline.test.ts` (calls the real `/api/gemini/interior` route in-process with Gemini off).
  - Matrix: colours (pink, navy, `#1a1a1a`, "dusty rose", `navy, mustard, cream`, garbage) × style × room × budget. Assert: bed/sofa hex close to the hero colour, floor/wall contrast, requirement flags honoured, budget changes the list, no thrown errors.
  - Done when: the matrix passes.

- [x] **5.3 (P2) Show resolved colours in the UI**
  - Files: `InteriorDesignWorkflow.tsx` (new exported `ColorChips` under the colour input, plus `inputNotes` after the result; 26 lines added, none removed, drawing code untouched). Tested in `interiorDesign.test.ts`.
  - Show resolved swatches under the "Preferred colors" input and `inputNotes` after generation, so users can confirm or correct.
  - Done when: swatches render and unresolved colours are flagged; 2D drawing code unchanged.

- [x] **5.4 (P1) Manual check**
  - Generate bedroom/living/kitchen with pink, navy+mustard, a hex, and a made-up colour across 2–3 styles and budgets; confirm the 2D view looks the same apart from colours and pieces.
  - Done by rendering the real `InteriorFloorPlan` for generated results and screenshotting it in headless Chrome (two contact sheets). Layout, walls, doors and drawing style are identical across colour sets; beds/sofas/accents take the colours; budget and style change the piece list. **Known limit:** kitchens (and bathrooms) change very little in 2D because their cabinets and tile are drawn with fixed finishes; only the palette strip and any soft furnishings reflect the colours.

## 4. Later (P2 / out of scope)

- Per-item colour editing after generation.
- Passing generated colours/materials into the 3D floor-plan viewer (`FloorPlan3D` finishes).
- Real product catalogue with live prices.
- Image-based colour extraction (upload a mood-board photo).

## 5. Suggested order

1.1 → 1.3 → 1.4 → 2.1 → 2.2 (biggest visible win, covers the "pink" case) → 5.1/5.2 alongside → 3.x → 4.1/4.2 → 4.3/4.4 → 1.2, 1.5, 2.3, 2.4, 5.3.
