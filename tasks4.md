# INTERIO Interior 3D Editor v1 — Edit, Add Furniture, Look Realistic

Progress: 29 / 38 tasks (all phases done; still partly done: 3.6 screen-reader pass, 4.5 overlap warning, 5.5 plant/lamp decor, 6.2 bump look, 6.6 real-GPU speed)

Goal: if the generated interior is not what the user wanted, they can **fix it themselves in 3D**: change wall and floor colours and textures (wood, marble, tile…), recolour any furniture, add or remove furniture — from a **sidebar like the floor-plan editor's** — and the 3D room should look **realistic and match the 2D plan**. The "Preferred colors" box is removed from the generator form. **Planning document only; nothing is implemented yet.**

Priorities: **P0** required (this is the MVP) · **P1** core · **P2** deferred (see "Later").

## 0. Decisions to confirm before coding

| # | Decision | Recommendation | Why |
|---|---|---|---|
| D1 | Extend the existing interior 3D view (`Shared3DView.tsx`, raw three.js) or rebuild it in react-three-fiber like `FloorPlan3D`? | **Extend it.** Reuse the floor-plan editor's *parts* (material builder, colour picker, catalogue, textures), not its renderer. | The view already has furniture selection, move/rotate gizmos, GLB loading, openings and wall cut-away. A rewrite is weeks of risk for no user-visible gain. |
| D2 | Should 3D edits show in the 2D plan? | **Colours yes, textures no.** A floor/wall colour edit updates the palette (2D floor and the dashboard thumbnail follow); furniture colour edits already flow to 2D through `item.color`. Textures (marble, brick…) are 3D-only; 2D shows the base colour. | Keeps the 2D drawing code untouched, as you asked, while staying consistent. |
| D3 | Does the editor also apply to **renovation** projects, which share this view? | **No for v1.** Interior projects only; renovation renders exactly as today. | Limits risk. Easy to enable later. |
| D4 | Where do realistic furniture models come from? | **Procedural upgrade first (no downloads), then a small set of free CC0 GLB models**, each licence checked and logged. You approve any download. | The six GLBs in `public/assets/furniture` are ~2 KB placeholders; code alone cannot make them realistic. |
| D5 | What happens to the colour engine already written (`colorResolver`, `colorTheory`)? | **Keep the files.** They can later power a "Suggest palette" button. Only the form input and chips go. | No rework, no dead UI. |

## 1. Current state (from the code)

- **Entry** — `App.tsx` renders `Shared3DView` for `3d-studio` when the project type is `interior` or `renovation`. `data` is an `InteriorDesignResult` (or a renovation's nested design).
- **Scene build** — one big `useEffect` in `Shared3DView.tsx` (~1,533 lines) builds the whole scene. Its dependency list includes `data`, `wallHeight`, `lightingMode`, `showWireframe`, `showGrid`, `shellView`, so **any data change rebuilds the whole scene**.
- **Floor** — `createFloorMaterial(color, tile)` in `src/three/interiorVisuals.ts`: a procedural wood texture tinted by the palette `flooring` colour; the "tile/marble" case is a style-name regex hack.
- **Walls** — one `MeshStandardMaterial` from the palette `wall` colour; `buildInteriorShell(...)` makes four walls with door/window openings; each wall gets its own material instance so the camera-facing one can fade.
- **Furniture colour** — `createFurnitureModel(item, palette, style, …)`: `item.color` only colours the **fabric**; wood parts come from the palette (`getWood`), and metal/dark parts are fixed. So "recolour this chair" cannot reach the legs today.
- **Furniture assets** — `furnitureAssets.ts` matches six ~2 KB placeholder GLBs; procedural models are the real fallback.
- **Interaction** — click-to-select furniture, `TransformControls` move/rotate, `onFurnitureChange` → `App.handleFurnitureChange` → `active3DData` → Save to Portfolio (whole object stored).
- **2D** — `InteriorFloorPlan` draws the floor from the palette `flooring` colour and each piece from `item.color`/name/category. The dashboard thumbnail reads palette `wall`/`flooring`.
- **Reusable from the floor-plan editor** (`src/components/FloorPlan3D/`): `ColorPicker.tsx`, `colorUtils.ts`, `materialCatalog.ts` (23 textures in `public/assets/materials/`), `createFinishMaterial()` in `materials.ts` (plain three.js, handles tiling, fallback colour and texture-load callback), `finishes.ts` validators, `finishUpdates.ts` patterns, `BottomSheet.tsx`, and the `DesignPanel` layout (resizable sidebar, mobile bottom sheet).
- **Known issues found**
  1. Full scene rebuild on every data change would reset camera/selection on each colour tweak.
  2. Furniture recolour reaches fabric only; wood/frame parts ignore it.
  3. No way to pick a wall or floor in 3D; only furniture is raycast-selectable.
  4. Wall boxes with openings need world-size UV tiling or textures will stretch.
  5. `Shared3DView` is shared with renovation; changes must be guarded by `projectType === 'interior'`.
  6. The placeholder GLBs are not realistic; procedural models are mostly boxes.

## 2. Guardrails

- **Do not change** `InteriorFloorPlan` drawing code, the layout optimizer's behaviour, `FloorPlan3D/*`, or the floor-plan and renovation flows.
- Renovation projects keep today's rendering exactly (D3).
- All new data fields are **optional**: an old saved project loads and looks as it did before.
- Finishes are sanitised on load (unknown ids dropped, colours validated, scale/roughness clamped), like `FloorPlan3D/finishes.ts`.
- Local assets only; every third-party model gets a licence entry in `public/assets/furniture/LICENSES.md` before it is used.
- No new runtime dependencies. Optional asset-prep tools (e.g. a glTF compressor) run offline, not in the app.
- Furniture added in 3D must also draw correctly in 2D (name/category must hit a specific 2D shape and a specific 3D model, not a generic fallback).
- Keep generated colours and pieces untouched until the user edits something; "reset" returns to the generated look.

## 3. Tasks

### Phase 0 — Remove colour preferences

- [x] **0.1 (P0) Take "Preferred colors" out of the generator form**
  - Files: `InteriorDesignWorkflow.tsx`, `interiorDesign.test.ts`, `interiorPipeline.test.ts`.
  - Remove the input, its state, the `ColorChips` component and its tests. The request stops sending `preferredColors`. The API keeps accepting it (older clients, saved requests) and behaves as today when it is absent; the no-colour output must equal the current no-colour output.
  - Done when: the form has no colour box; generating a design works and is unchanged for the same style/budget/requirements; tests updated and green; the 2D drawing code diff is empty.

### Phase 1 — 3D rendering groundwork (do first; de-risks everything)

- [~] **1.1 (P0) Edits must not rebuild the scene**
  - Files: `Shared3DView.tsx`.
  - Split the effects: scene construction depends on geometry inputs only (room size, openings, wall height, shell view, furniture list identity); finishes and furniture colours update **existing materials in place**. Camera position, orbit target, selection and gizmo state survive an edit.
  - Done when: changing a wall/floor/furniture colour leaves the camera exactly where it was, selection intact, no flash or reload; a dev counter shows the scene-build effect did not re-run.

- [x] **1.2 (P0) Make floor and walls addressable**
  - Files: `Shared3DView.tsx`, new `src/three/interiorShell.ts` (extract `buildInteriorShell` and wall helpers so they can be tested without a browser).
  - Tag the floor mesh and each of the four wall bodies with `userData.surface` (`floor`, `wall:north|south|east|west`); each wall owns its material. Door/window frames and trim stay untinted.
  - Done when: a unit test builds the shell for a sample room and finds exactly one floor and four walls, each with its own material; walls with openings keep correct geometry (existing visuals unchanged).

- [~] **1.3 (P1) Highlight without altering real materials**
  - Files: `Shared3DView.tsx`.
  - Selected floor/wall gets an outline or overlay, not an `emissive` tint on the real material, and the overlay is hidden during screenshot/GLB export.
  - Done when: the on-screen colour equals the chosen colour while selected; export contains no highlight.

- [~] **1.4 (P1) Textures load without blank or stale frames**
  - Files: `Shared3DView.tsx`.
  - Confirm the render loop picks up late-loading textures (or request a render on load); show the fallback colour until the texture arrives; a missing file keeps the fallback colour with no error.
  - Done when: picking a texture never leaves a blank or stale surface.

- [~] **1.5 (P0) Correct texture mapping on walls and floor**
  - Files: `interiorShell.ts`, `Shared3DView.tsx`.
  - Reuse `createFinishMaterial()` so one repeat equals a fixed number of metres; wall pieces around doors and windows continue the same pattern (use the offset options); the floor tiles by room size.
  - Done when: a brick/wallpaper/wood test texture looks correctly proportioned on all four walls and the floor, with no stretching beside openings.

---done---

### Phase 2 — Data model, sanitising and saving

- [x] **2.1 (P0) Optional finish types**
  - Files: `src/types.ts`.
  - Add to `InteriorDesignResult`: `finishes?: InteriorFinishes` where `InteriorFinishes = { floor?: SurfaceFinish; walls?: { all?: SurfaceFinish; north?: SurfaceFinish; south?: SurfaceFinish; east?: SurfaceFinish; west?: SurfaceFinish } }` (reusing `SurfaceFinish`/`FinishMaterialId`). Add to `FurnitureItem`: `frameColor?: string` (wood/frame parts), `finishId?: string` (a wood/metal variant from the catalogue), `generatedColor?: string` (what the generator chose, for "reset").
  - Done when: it compiles; old projects typecheck and load unchanged.

- [x] **2.2 (P0) Sanitiser for interior finishes and furniture colours**
  - Files: new `src/services/interiorFinishes.ts`, `interiorFinishes.test.ts`.
  - Reuse validators from `FloorPlan3D/finishes.ts`. Drop unknown variant ids, invalid hex, out-of-range scale/roughness, unknown wall sides; never throw.
  - Done when: tests cover valid, partial, hostile and legacy (none) input.

- [x] **2.3 (P0) Pure update helpers**
  - Files: `interiorFinishes.ts`, tests.
  - `setFloorFinish`, `setWallFinish(side | 'all')`, `resetFloor`, `resetWalls`, `resetAll`, `resolveWallFinish(finishes, side)` (side > all > palette default). Immutable, like `finishUpdates.ts`.
  - Done when: tests prove precedence, immutability (input not mutated), and reset behaviour.

- [x] **2.4 (P0) Wire edits through App and Save**
  - Files: `App.tsx`, `Shared3DView.tsx`.
  - New `onInteriorChange(next)` (or extend `onFurnitureChange`) writes into `active3DData`; Save to Portfolio stores `finishes` and furniture changes; loading sanitises them; returning to the 2D workflow shows the edited result.
  - Done when: edit → Save → reload the saved project → the same finishes appear; an old saved project opens identical to before.

- [x] **2.5 (P1) Keep 2D and the dashboard in step (decision D2)**
  - Files: `interiorFinishes.ts`, `App.tsx`.
  - When a floor/wall base colour is edited, also update the palette `flooring`/`wall` swatch (a textured variant uses its base colour) so `InteriorFloorPlan` and the dashboard thumbnail follow. Reset restores the generated swatch.
  - Done when: a floor colour change shows in the 2D floor and the dashboard card; no change to 2D code.

### Phase 3 — The sidebar

- [x] **3.1 (P0) Sidebar shell**
  - Files: new `src/components/InteriorEditor/InteriorDesignPanel.tsx` (+ small shared pieces), `Shared3DView.tsx`.
  - Same pattern as the floor-plan `DesignPanel`: docked side panel with a visible toggle button in the toolbar, resizable width, `BottomSheet` on small screens, tabs **Floor · Walls · Furniture**. Shown only for interior projects.
  - Done when: it opens and closes, remembers width, doesn't cover the 3D controls, and works at phone width.

- [x] **3.2 (P0) Floor tab**
  - Files: `InteriorDesignPanel.tsx`.
  - `ColorPicker` for plain colour; material grid from `MATERIAL_CATALOG` filtered to floor (wood, marble, tile, concrete, stone…); scale slider; roughness slider; "Reset floor". Live preview.
  - Done when: picking a colour or texture updates the floor immediately, tiling scale works, reset returns to the generated floor.

- [x] **3.3 (P0) Walls tab**
  - Files: `InteriorDesignPanel.tsx`.
  - Scope chips: **All walls · North · South · East · West** (labelled to match the 2D plan's compass and the window/door side so the user knows which is which). Paint colour, plus wallpaper/brick/plaster/stone/tile/wood-slat from the catalogue; scale; "Reset walls".
  - Done when: each side can be styled independently; "All walls" applies to all unless a side has its own override.

- [x] **3.4 (P0) Click a floor or wall in 3D to edit it**
  - Files: `Shared3DView.tsx`.
  - Extend the existing raycast: furniture wins, then walls/floor via `userData.surface`; the sidebar jumps to the matching tab and side. Escape deselects. Direct sidebar buttons exist too, so clicking is a shortcut, not a requirement.
  - Done when: clicking each wall, the floor and a piece of furniture selects the right thing; a drag (orbit) is never mistaken for a click.

- [x] **3.5 (P0) Furniture tab: edit the selected piece**
  - Files: `InteriorDesignPanel.tsx`, `src/three/interiorVisuals.ts`.
  - Main colour (upholstery/body), frame/wood colour (and optionally a wood/metal finish from the catalogue), reset to generated, duplicate, delete. Update `createFurnitureModel` so `frameColor`/`finishId` reach the wood parts, and expose an `applyFurnitureColors(group, item)` that recolours an existing model in place (needed by 1.1).
  - Done when: recolouring a chair changes cushion and legs independently; colours persist after Save/reload and appear in 2D via `item.color`; reset restores `generatedColor`.

- [~] **3.6 (P1) Material thumbnails and accessibility**
  - Files: `InteriorDesignPanel.tsx`.
  - Thumbnails from the existing textures (lazy-loaded), labelled buttons, keyboard navigation, visible focus, readable contrast.
  - Done when: the whole sidebar is usable by keyboard and screen-reader labels exist.

### Phase 4 — Add and remove furniture

- [x] **4.1 (P0) Furniture catalogue**
  - Files: new `src/services/furnitureCatalog.ts`, `furnitureCatalog.test.ts`.
  - ~25–30 pieces grouped by room use (sofa, armchair, bed single/double, nightstand, wardrobe, desk, desk chair, dining table, dining chair, bookcase, TV unit, coffee table, side table, rug, floor lamp, plant, mirror, shelf…) with default size, category, material, colour, and a **name that hits both** a specific 3D model in `createFurnitureModel` and a specific 2D shape in `InteriorFloorPlan` (no generic fallback).
  - Done when: a test proves every entry matches a non-fallback 3D branch and a non-generic 2D shape, and has a sane size range.

- [x] **4.2 (P0) Free-spot finder**
  - Files: new `src/services/furniturePlacement.ts`, tests; small export from `layoutOptimizer.ts` if `hitsOpening` is needed (no behaviour change).
  - `findFreeSpot(existing, room, piece, openings)`: inside the room, no overlap with existing pieces plus clearance, clear of door swing and window sills where relevant; prefers its preferred wall. Returns `null` when nothing fits.
  - Done when: tests cover empty room, crowded room (returns null), doors blocked, rotation, and bounds.

- [x] **4.3 (P0) Add furniture UI**
  - Files: `InteriorDesignPanel.tsx`, `Shared3DView.tsx`.
  - Searchable, category-filtered catalogue in the Furniture tab. Clicking adds the piece at the found spot, selects it and attaches the move/rotate gizmo; a clear message when there is no room. New pieces get a unique id, an `estimatedPrice` from the existing budget-tier helper, and `generatedColor`.
  - Done when: add → appears in 3D and in the 2D plan; Save → reload keeps it; "no space" shows a message and adds nothing.

- [x] **4.4 (P0) Delete and duplicate**
  - Files: `InteriorDesignPanel.tsx`, `Shared3DView.tsx`.
  - Delete button and Delete key; duplicate places a copy at a free spot; a short "Undo delete" toast for the last removal.
  - Done when: deleting removes the piece from 3D and 2D; undo restores it with its edits.

- [~] **4.5 (P1) Keep moved furniture sensible**
  - Files: `Shared3DView.tsx`.
  - After a drag, clamp the piece inside the room and show a soft warning (not a block) when it overlaps another piece or an opening.
  - Done when: a piece can't be dragged outside the walls; overlaps are flagged but allowed.

- [x] **4.6 (P1) 2D reflects every 3D edit**
  - Files: tests only unless a gap is found.
  - Verify add, delete, move, rotate and colour changes all appear in the 2D plan from the same data, and label overlaps stay no worse than today.
  - Done when: a render test of `InteriorFloorPlan` over an edited result shows the expected pieces and fills.

  ---in process---

### Phase 5 — 3D matches the 2D plan

- [x] **5.1 (P0) Placement and orientation parity**
  - Files: `interiorVisuals.ts` or a new pure helper `furnitureTransform3D.ts`, tests.
  - One pure function maps a furniture item (x, y, width, depth, rotation) to its 3D position and rotation, and a test proves it agrees with `furnitureFootprint` (the 2D footprint) for every rotation (0/90/180/270), room size and piece size. Fix any mismatch found (axis flips, rotation direction).
  - Done when: the test passes over a grid of cases and a visual check shows 3D pieces in the same places as the 2D plan.

- [x] **5.2 (P0) Doors and windows parity**
  - Files: `interiorShell.ts`, tests.
  - Openings use the same wall, offset and width as the 2D plan (including the default openings when none are saved). The compass in 3D matches 2D (north wall in 2D = the same wall in 3D).
  - Done when: a test compares opening rectangles in 3D space against the 2D openings for all four walls.

- [x] **5.3 (P1) Front/back orientation**
  - Files: `interiorVisuals.ts`.
  - Beds have their headboard on the wall side shown in 2D, sofas have their backs to the wall, desks face the room, wardrobes open into the room.
  - Done when: a visual check on bedroom, living, study and dining samples matches the 2D drawing.

- [x] **5.4 (P1) Colour parity and an honest note**
  - Files: `InteriorDesignPanel.tsx`.
  - Furniture and base floor/wall colours match across 2D and 3D; the sidebar says "the 2D plan shows the base colour; textures appear in 3D" where it matters.
  - Done when: the same project shows the same colours in both views.

- [~] **5.5 (P2) Decor parity**
  - Files: `interiorVisuals.ts`.
  - Rugs, plants and lamps appear and sit where the 2D plan shows them.
  - Done when: a sample with decor looks consistent in both views.

### Phase 6 — Realism

- [x] **6.1 (P0) Lighting, shadows and renderer**
  - Files: `Shared3DView.tsx`.
  - Tune exposure/tone mapping, shadow map size and bias, key + fill + window light, soft contact shadows under furniture (cheap blob/shadow planes), and environment intensity. No new dependencies.
  - Done when: before/after screenshots show soft grounded shadows, no acne or light leaks, and walls and floors read as real surfaces.

- [~] **6.2 (P0) Better surface materials**
  - Files: `materials`-using code in `Shared3DView.tsx`, `interiorShell.ts`.
  - Use the catalogue roughness values; add a subtle bump (reusing each texture as a bump map) for wood, brick, stone and plaster; slight reflectivity for marble and polished tile.
  - Done when: textured floors and walls show believable depth under the room lights without a perf drop.

- [x] **6.3 (P1) Upgrade the procedural furniture**
  - Files: `src/three/interiorVisuals.ts`.
  - Replace the boxiest models with proper forms: bed (mattress, duvet, pillows, headboard), sofa (seat and back cushions, arms), armchair, dining chair, tables (tapered legs, thickness), wardrobe (door panels, handles), nightstand (drawer), rug, plant, lamp. Keep each model's footprint equal to `item.width × item.depth`.
  - Done when: before/after screenshots of each category (rendered in headless Chrome) show clear improvement, footprints still match 2D, and every piece stays recolourable via 3.5.

- [x] **6.4 (P1) GLB pipeline**
  - Files: `src/services/furnitureAssets.ts`, `Shared3DView.tsx`, `public/assets/furniture/`.
  - Loader scales a model to the item's size, puts its pivot on the floor, and applies recolour to materials by name convention (`main`, `frame`); any load error falls back to the procedural model. `LICENSES.md` lists source, author, licence and URL for each model.
  - Done when: a test model loads, sizes correctly, recolours, and a deliberately broken URL falls back without errors.

- [x] **6.5 (P1) Integrate a first set of real models (needs your approval to download)**
  - Files: `public/assets/furniture/*`, `LICENSES.md`, `furnitureAssets.ts`.
  - 8–10 free CC0 models (bed, sofa, armchair, dining chair, table, wardrobe, nightstand, lamp, plant, rug) from sources such as Poly Haven, Kenney or Quaternius, licence verified per file, compressed offline to keep each model small.
  - Done when: each model appears at the right size, is recolourable, and its licence is recorded; total added size is reported.

- [~] **6.6 (P1) Performance guard**
  - Files: `Shared3DView.tsx`.
  - Cap pixel ratio, scale shadow map by device, keep textures ≤ 1024 px, dispose materials/geometry on change, and offer a simple Quality toggle (High / Balanced).
  - Done when: a room with ~20 pieces holds a smooth frame rate on a mid-range laptop and memory stays flat after many edits.

### Phase 7 — Verification

- [x] **7.1 (P0) Tests for every new module**
  - Files: tests for `interiorFinishes`, `furnitureCatalog`, `furniturePlacement`, `interiorShell`, `furnitureTransform3D`; add them to `npm test`.
  - Done when: `npm test` and `tsc --noEmit` are green.

- [x] **7.2 (P0) Regression: nothing else changed**
  - Files: tests + manual.
  - Renovation viewer, floor-plan viewer, and an old saved interior project (no `finishes`) render exactly as before; the 2D drawing code diff is empty.
  - Done when: a snapshot or scripted comparison shows no change for those cases.

- [x] **7.3 (P0) Browser QA with screenshots**
  - Files: none (script in the scratchpad).
  - Headless-Chrome screenshots of: default design, edited walls/floor with 3–4 textures, recoloured furniture, added and deleted pieces, mobile width, before/after realism. Review them for obvious faults.
  - Done when: a QA checklist is filled in with screenshots and no open blockers.

- [x] **7.4 (P1) Responsive and keyboard pass**
  - Files: `InteriorDesignPanel.tsx`.
  - Phone/tablet layouts, touch targets, tab order, Escape/Delete keys.
  - Done when: the editor is usable at 375 px width and by keyboard alone.

## 4. Later (P2 / out of scope for v1)

- Undo/redo history for all edits (v1 has per-item Reset and "Undo delete" only).
- Ceiling finishes and a ceiling/lighting editor.
- Editing renovation projects (D3).
- "Suggest palette" button using the existing colour engine (D5).
- Design-board PDF export, live budget tracker, edit-by-sentence, mood-board palette (suggested earlier, deliberately left out).
- Photoreal rendering, AR, sharing and comments.

## 5. Effort and order

| Phase | What it gives | Rough effort |
|---|---|---|
| 0 | Colour box gone | 0.5 day |
| 1 | Stable, addressable 3D scene | 2–3 days |
| 2 | Edits that save, load and sync | 2 days |
| 3 | The sidebar and all editing | 3–4 days |
| 4 | Add, delete, duplicate furniture | 3 days |
| 5 | 3D matches 2D | 2 days |
| 6 | Realism (lighting, materials, models) | 4–6 days (models depend on D4) |
| 7 | Tests and QA | 2 days |

Estimates are rough and have not been prototyped. **MVP = every P0 task** (about 2 weeks): colour box removed, wall/floor/furniture editing in a sidebar, add/delete furniture, 3D matching 2D, and better lighting and materials. The P1 tasks (procedural furniture upgrade, GLB pipeline, real models, performance, polish) follow.

Suggested order: **0.1 → 1.1 → 1.2 → 1.5 → 2.1–2.4 → 3.1–3.5 → 4.1–4.4 → 5.1–5.2 → 6.1–6.2 → 7.1–7.3**, then the P1 tasks (6.3 → 6.4 → 6.5 first for realism), then 2.5 and 3.6.

## 6. Risks

- **Scene rebuild (1.1)** is the riskiest change: a 1,500-line effect with many dependencies. Do it first, behind tests, and verify camera and selection survive.
- **Furniture recolour per part (3.5)** only works if every model's parts are identifiable; procedural models are easy, third-party GLBs need the naming convention in 6.4.
- **Realism depends on assets (6.5).** Code improves lighting and materials; convincing furniture needs real models, so expect "good game-style", not photographic.
- **Shared view with renovation:** every change must be guarded by `projectType === 'interior'`.
- **Performance on low-end devices** with shadows and textures: covered by 6.6 but needs real-device testing.
- **Saving:** projects store the whole object; confirm the server accepts the added optional fields (2.4 round-trip test).
