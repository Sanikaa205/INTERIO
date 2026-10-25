# INTERIO Floor-Plan Editor v2 — Realistic Implementation Tasks

Progress: 0 / 22 tasks

Builds on the phase-1 finish editor (`tasks1.md`). Goal: a visible, bottom-docked design panel, a proper colour picker, a bigger material library, and room-specific editing — without touching floor-plan geometry. **Planning document only; nothing is implemented yet.**

Priorities: **P0** required · **P1** core · **P2** deferred (see "Later").

## 1. Current state (from the code)

- **Editor** — `FinishEditor.tsx` is a floating `w-72` panel that only appears after clicking a surface. No visible entry point.
- **Selection** — `SelectedSurface` (`room-floor | room-ceiling | wall`) lives in `FloorPlan3D.tsx`; 3D meshes call `onSelectSurface`.
- **Data** — `FloorPlanResult.finishes` (`rooms[id].floor/ceiling`, `walls[wallId]`), each a `SurfaceFinish`. Edits go through immutable `setSurfaceFinish` / `resetSurfaceFinish` → `onPlanChange` → `App`. Sanitized by `finishes.ts`.
- **Catalog** — `materialCatalog.ts` has 6 variants; textures are 3 small SVGs in `public/assets/materials/`.
- **Rendering** — `materials.ts` `createFinishMaterial`; `Floors/Walls/Ceilings.tsx` rebuild **all** materials in a `useMemo` on every finish/selection change.
- **Camera** — drei `OrbitControls` (rotate/zoom/pan already work) via `CameraRig.tsx`; `frameloop="demand"`.
- **Known issues found**
  1. `model = useMemo(buildHouseModel, [plan])` rebuilds geometry on every finish edit.
  2. Selection/focus highlight sets `emissive` on the real material → tints the colour being edited and leaks into GLB export.
  3. Wall textures use a scaled unit box, so UVs may stretch.
  4. An interior wall segment has one finish for both faces (painting one room repaints the neighbour's side). **Being fixed with Option (b) — see section 3A.**
  5. Colour input is the native picker + 6 swatches only.

## 2. Guardrails

- Finishes stay optional display overrides; a plan with no `finishes` renders exactly as today.
- Do not change `buildHouseModel`, `model/*`, wall merging, openings, doors, windows, collision, dimensions, or `rooms[].furniture`.
- No Three.js in `model/`. No `server.ts` or `FloorPlanWorkflow.tsx` changes. Save semantics unchanged.
- Wall-face work (3A) must not alter `WallSegment` ids, `roomIds`/`sides`, piece positions/sizes, openings, door/window meshes or collision.
- Local assets only; existing variant IDs are permanent. Old projects must load unchanged.
- No new runtime dependencies.

## 3. Tasks

### Phase 1 — Rendering groundwork (do first; de-risks everything)

- [ ] **1.1 (P0) Stop rebuilding geometry on finish edits**
  - Files: `FloorPlan3D.tsx`.
  - Memoize `buildHouseModel` on geometry inputs only (rooms, plot size), not the whole `plan`.
  - Done when: a test or dev assertion shows the `HouseModel` identity is unchanged after a finish edit; doors/windows render identically.

- [ ] **1.2 (P0) Highlight without touching real materials**
  - Files: `Floors.tsx`, `Walls.tsx`, `Ceilings.tsx`, `exportGlb.ts`, `exportGlb.test.ts`.
  - Replace the `emissive` hack with a simple overlay/outline; hide it during GLB export.
  - Done when: on-screen colour equals chosen colour; exported GLB has no highlight emissive; selection still clearly visible.

- [ ] **1.3 (P1) Correct wall texture mapping**
  - Files: `Walls.tsx`, `materials.ts`.
  - Fix UV/repeat so textures aren't stretched on long/short walls or around openings. Wall piece positions/sizes must not change (`wallPieces` tests stay green).
  - Done when: a brick/wallpaper test texture looks correctly proportioned on several walls.

- [ ] **1.4 (P1) Repaint when textures load**
  - Files: `materials.ts`, floor/wall/ceiling components.
  - Call `invalidate()` when a texture finishes loading (frameloop is `demand`); show the fallback colour until then; fall back gracefully on a missing file.
  - Done when: no blank or stale surfaces after selecting a texture.
  
---done---

### Phase 2 — Visible editor and bottom panel

- [ ] **2.1 (P0) "Design" button always visible**
  - Files: `FloorPlan3D.tsx` top bar, `BottomSheet.tsx` (small screens).
  - Labelled button with `aria-pressed` toggling `editorOpen`.
  - Done when: visible on load on desktop and mobile without clicking a room.

- [ ] **2.2 (P0) Docked `DesignPanel` replaces the floating editor**
  - Files: new `DesignPanel.tsx` (+ small sub-components as needed); retire `FinishEditor.tsx` once migrated.
  - Panel sits in a flex column **below** the canvas so it shrinks the viewport instead of covering it. Collapsible; drag-to-resize height (min ≈ 220 px, max ≈ 50 %). On small screens it is a bottom drawer with 44 px touch targets and never open together with the controls sheet.
  - Done when: whole house stays visible after "Fit" with the panel open; no horizontal scroll at 360 px; closing restores full canvas.

- [ ] **2.3 (P0) Pick targets from the panel, not only by clicking**
  - Files: `DesignPanel.tsx`, `finishTypes.ts`, `finishUpdates.ts` (helpers) + tests.
  - Room chips + `Floor | Walls | Ceiling` tabs; for Walls, a list of that room's wall segments. Clicking in 3D still selects and opens the panel; both stay in sync. Empty-clicking the canvas no longer closes/empties the panel; double-click resets the camera only.
  - Done when: every room's floor, walls and ceiling can be edited without clicking the 3D view; ceiling tab turns ceilings on (or is clearly disabled) when hidden.

- [ ] **2.4 (P1) View controls: Fit, Top view, Zoom ±**
  - Files: `CameraRig.tsx`, new small `ViewControls.tsx`.
  - Fit re-frames using the reduced canvas height; Top-down view for editing; zoom buttons (wheel/pinch/pan already work). Refit when the panel opens/closes **unless** the user has manually moved the camera.
  - Done when: Top view shows every room; panel open/close doesn't jump a manually panned camera.

### Phase 3 — Colour picker

- [ ] **3.1 (P1) Colour utilities**
  - Files: new `colorUtils.ts` + test (add to `package.json` test script).
  - Parse/normalize hex (`#abc`, `abc`, `#aabbcc`), hex↔RGB↔HSV. Invalid input returns `null`, never throws; output is always `#rrggbb`.

- [ ] **3.2 (P1) `ColorPicker` component**
  - Files: new `ColorPicker.tsx`; used by `DesignPanel`.
  - Basic colours (~12), interior presets (~18–24 curated paint-like tones), recent colours (last 8), custom: saturation/value square + hue slider, HEX input, R/G/B inputs. Live preview while dragging (rAF-throttled), commit to recents on release. Plain React/CSS, no library.
  - Done when: any colour can be created via HEX, RGB or picker and applied; `#fff` normalizes to `#ffffff`; invalid text shows an error and isn't applied.

- [ ] **3.3 (P1) Tint vs. colour**
  - Files: `materials.ts`, `materialCatalog.ts`.
  - Paint: colour is the surface colour. Textured materials: colour is a *tint*, defaulting to neutral so the texture shows true colour; add "Reset tint". Legacy saved finishes with a `color` render unchanged.

### Phase 4 — Material library

- [ ] **4.1 (P0) Catalog schema + assets with licences**
  - Files: `materialCatalog.ts` (+ test), `public/assets/materials/` + `README.md`.
  - Add `category`, `surfaces` (floor/wall/ceiling), `defaultScale`, optional thumbnail. Keep all 6 existing IDs. Use CC0/licensed seamless maps (e.g. ambientCG, Poly Haven) or original tiles; record source + licence for every file; 512–1024 px JPG/WebP, ≈ ≤ 300 KB each.
  - Done when: test asserts unique IDs, every `mapUrl` exists, legacy IDs resolve.

- [ ] **4.2 (P1) Floor materials (~12–15)**
  - Wood: light oak, walnut, dark walnut, grey-washed, maple. Tile: white, grey, beige, black, terracotta. Marble: Carrara, Calacatta, Nero Marquina. Granite: black, grey. Plus polished concrete.
  - Done when: each has name, thumbnail, sensible scale/roughness, no obvious seams at default scale.

- [ ] **4.3 (P1) Wall materials (~10–12)**
  - Paint presets with matte/satin/gloss; brick (red, white-washed); stacked stone; wallpaper (stripe, geometric, damask); venetian plaster/concrete; wood slat panelling.
  - Done when: every item has `surfaces` including `wall` and looks right after task 1.3.

### Phase 5 — Room-specific editing & wrap-up

**Decision made: Option (b) — independent finishes per room-facing wall face.** Design, rendering approach and rationale are in section 3A. Tasks 5.1–5.7 implement it; do them after Phase 1 (1.1–1.4) because they depend on the non-polluting highlight and texture mapping fixes.

- [ ] **5.1 (P0) Pure face-resolution helper (no rendering yet)**
  - Files: new `model/wallFaces.ts` + `model/wallFaces.test.ts` (add to `package.json` test script). No Three.js import; does not modify `buildHouseModel` output.
  - `export type FaceDir = 'px' | 'nx' | 'pz' | 'nz'`; `wallFaceTargets(wall: WallSegment): WallFaceTarget[]` returns one entry per room-facing face: `{ faceKey: roomId, roomId, dir, materialIndex }` plus, for exterior walls, one `{ faceKey: OUTSIDE_FACE, roomId: null, dir: <opposite of the room's dir>, materialIndex }`.
  - Side → direction (room interior lies on that side of the wall centre-line): axis `x`: `top → +z`, `bottom → -z`; axis `z`: `left → +x`, `right → -x`.
  - BoxGeometry material-group order is `px=0, nx=1, py=2, ny=3, pz=4, nz=5`; export a `FACE_MATERIAL_INDEX` map and a reverse `faceFromMaterialIndex(wall, index)` (returns the target or `null` for top/bottom/jamb faces).
  - Handle edge cases: two entries with the same direction (overlapping rooms) → first wins deterministically; a segment with 0 or ≥3 `roomIds` → no crash, unfaced sides fall back to base material.
  - Done when: tests cover top/bottom/left/right sides, an interior shared wall (2 faces, opposite dirs), an exterior wall (inside + outside face), overlap case, and index round-trip.

- [ ] **5.2 (P0) Data contract + sanitizer (backward compatible)**
  - Files: `src/types.ts`, `finishes.ts`, `finishes.test.ts`.
  - Add `FloorPlanFinishes.wallFaces?: Record<string /*wallId*/, Record<string /*roomId or '@outside'*/, SurfaceFinish>>`. Keep `walls` unchanged (legacy / "whole wall").
  - Export `OUTSIDE_FACE = '@outside'` and `getWallFaceFinishOverride(finishes, wallId, faceKey)` with the same sanitizing rules as `getWallFinishOverride`. Invalid data is ignored, never thrown.
  - Resolution order for a face: `wallFaces[wallId][faceKey]` → `walls[wallId]` (legacy, applies to every face) → renderer default (`wall` interior, `exteriorWall` for the outside face of an exterior wall).
  - Done when: old payloads without `wallFaces` sanitize/resolve identically; unknown keys and malformed entries are dropped; tests green.

- [ ] **5.3 (P0) Immutable update helpers for faces**
  - Files: `finishTypes.ts`, `finishUpdates.ts`, `finishUpdates.test.ts`.
  - Extend `SelectedSurface` with `{ kind: 'wall-face'; wallId: string; faceKey: string }` (keep existing `wall` kind meaning "whole wall / legacy").
  - `setSurfaceFinish` / `resetSurfaceFinish` handle `wall-face`: validate `wallId` against `wallIds` **and** `faceKey` against that wall's `wallFaceTargets` (needs the model's walls, so pass `walls` instead of just ids, or an `isValidFace` callback); unknown targets return the same `plan` reference. Resetting the last face of a wall prunes empty `wallFaces[wallId]`; resetting everything leaves `finishes: undefined`.
  - Add `setWholeWallFinish(plan, wallId, finish)` that writes the same finish to each existing face of that wall (and clears `walls[wallId]`) — used by the "Both sides" apply option so the result is explicit per-face data.
  - Add `pruneOrphanFinishes(plan, model)` that drops `wallFaces`/`walls`/`rooms` entries whose wall/room no longer exists (wall ids are derived from geometry, see Risks). Called only when the plan geometry changes, never during normal edits.
  - Done when: tests prove editing Room A's face leaves Room B's face and `walls[...]` byte-identical (object identity for untouched entries), reset touches one face only, unknown targets are no-ops, input is not mutated.

- [ ] **5.4 (P0) Render per-face materials on the existing wall boxes**
  - Files: `Walls.tsx`, `materials.ts` (+ small helper), no change to `model/`, `wallPieces.ts`, `Doors.tsx`, `Windows.tsx`, `collision.ts`.
  - Keep one `<mesh>` per wall piece with the same `position`/`scale`/`boxGeometry` — **geometry stays bit-identical**. Change only `material` from a single instance to an **array of 6** in BoxGeometry order: room-facing faces get their resolved face finish; top, bottom and jamb/end faces (the cut faces beside openings) get the wall's base material (legacy `walls[wallId]` finish if set, else default). Reveals at openings therefore remain a neutral colour rather than an arbitrary side.
  - Texture repeat per face uses that face's real size: for the ±normal-to-thickness faces `width = piece.s1 - piece.s0`, `height = piece.y1 - piece.y0` (as today). Pieces above/below openings must not restart the pattern oddly: use the shared `s0`/`y0` as UV offset so adjacent pieces of the same face line up (depends on task 1.3).
  - Material lifecycle: create the array per piece, dispose all entries (dedupe shared instances) via `useDisposables`; cache by `(wallId, faceKey, finish signature, piece size)` so unchanged faces are reused and a colour drag on one face only rebuilds that face's materials (aligns with 1.1).
  - Done when: a wall with no finishes renders pixel-identical to today; painting one face of a shared wall changes only that side (checked from both rooms); doors/windows/openings and all piece positions are unchanged (`wallPieces`, `buildHouseModel`, `collision` tests unchanged and green).

- [ ] **5.5 (P0) Cutaway transparency with material arrays**
  - Files: `Walls.tsx`.
  - The `useFrame` loop currently does `if (Array.isArray(mesh.material)) return;` and mutates `transparent`/`opacity` on a single material. Update it to iterate all entries of the array (exterior walls only), set `transparent`/`opacity`, and flag `needsUpdate` only when the value actually flips to avoid shader recompiles every frame.
  - Done when: cutaway fades the camera-facing exterior walls exactly as before, including walls with per-face finishes and textures; no per-frame material churn.

- [ ] **5.6 (P0) Face selection and highlight**
  - Files: `Walls.tsx`, `FloorPlan3D.tsx`, `DesignPanel.tsx` (target picker from 2.3).
  - On click use `event.face?.materialIndex` → `faceFromMaterialIndex(wall, index)` → select `{ kind: 'wall-face', wallId, faceKey }`. Clicks on top/jamb faces (`faceFromMaterialIndex` → `null`) select the room-facing face on the camera's side of the wall (document this choice in a code comment).
  - Highlight uses the non-polluting overlay from 1.2: a thin translucent quad offset ~2 mm from the selected face, sized to the piece(s) of that face. Never write `emissive` to the real face material.
  - Panel: Walls tab lists each wall segment grouped by room, showing face names such as `Living Room side` / `Kitchen side` / `Outside`; selecting an entry selects the same face as clicking in 3D. Label the selected target clearly ("Wall · Living Room side"), plus a scope toggle: **This side only** (default) · **Both sides** (calls `setWholeWallFinish`) · **All walls in this room** (this room's faces only — never the neighbour's side).
  - Done when: clicking the Living Room side highlights/edits only that side; the panel and 3D selection stay in sync; no panel flicker when the selection changes.

- [ ] **5.7 (P1) Legacy migration + GLB export**
  - Files: `exportGlb.ts`, `exportGlb.test.ts`.
  - Legacy `walls[wallId]` finishes keep working (applied to every face of the wall) and are shown in the panel as "Both sides (legacy)"; editing a single face of such a wall first expands the legacy finish into explicit per-face entries, then changes only the chosen face, so the neighbour keeps its previous look.
  - GLB: `GLTFExporter` supports multi-material meshes (one primitive per group). Extend the test: build a box with 2 different face materials and assert two glTF primitives/materials exist; assert no highlight overlay mesh is exported.
  - Done when: a projects saved before this feature opens and looks identical; export of a wall with two different faces shows both finishes in a glTF viewer.

- [ ] **5.8 (P1) Reset controls**
  - Reset face, reset wall (all faces), reset room (its floor, ceiling and its wall faces only), reset all (confirm). Default scope is always the single selected surface.

- [ ] **5.9 (P1) Verification and QA**
  - Keep `npm run lint` and `npm test` green. Add a geometry-unchanged regression test (model + opening counts). Manual check: Chrome/Edge/Firefox, widths 360/768/1280, panel open/resize/close, all colour inputs, each surface type independent, doors/windows/labels/cutaway/ceilings/night/walk mode still work, save → reopen restores finishes, GLB export shows finishes with no highlight. **Wall faces:** paint each side of a shared wall differently and check from both rooms; exterior wall inside vs outside; walls with doors/windows (pieces above/below openings line up, jambs neutral); cutaway on textured walls; a legacy project with `walls[...]` finishes looks unchanged; `buildHouseModel` output is deep-equal before/after finish edits. Record results below.

## 3A. Independent wall faces — design (Option b)

**What the code does today (inspected)**
- `wallEdges.ts` turns each room rectangle into 4 edges (`top/bottom/left/right`); `mergeWalls.ts` merges edges on the same axis and line into `WallSegment`s split at every endpoint. A shared interior wall is **one** segment with `roomIds: [A, B]` and parallel `sides: [sideA, sideB]`; an exterior wall has one room. Ids are deterministic: `w-<axis>-<fixed>-<from>`.
- A segment is a centre-line (`a`→`b`) with `thickness` (0.15 m interior, 0.225 m exterior, set in `exterior.ts`). Room rectangles are not shrunk; the wall box straddles the shared line.
- `Walls.tsx` renders every `wallPieces(wall)` piece (the full wall, or sections beside/above/below door and window openings) as a unit `boxGeometry` scaled to size, with **one material per piece**. So a finish keyed by `wall.id` colours both faces.
- Cutaway (`useFrame`) and picking assume `mesh.material` is a single material; `Doors`, `Windows`, `collision` and `wallPieces` use only geometry data and never read materials.

**Face geometry (derived, no new data needed)**
- A room edge's `side` says where the room interior is relative to the wall: axis `x` → `top` = room on +z, `bottom` = room on −z; axis `z` → `left` = room on +x, `right` = room on −x. That direction is the outward normal of that room's visible face.
- A three.js `BoxGeometry` has six material groups in the order `+x, −x, +y, −y, +z, −z`. The two large faces perpendicular to the wall thickness are the room faces; the other four (top, bottom, and the two end/jamb faces beside openings) are not room-facing.

**Chosen approach (safest): multi-material boxes, not extra meshes**
1. Keep the existing meshes, positions, scale and `boxGeometry` untouched, so geometry, collision, openings, doors/windows and walkthrough cannot change.
2. Give each wall piece a **6-entry material array**: face finishes on the room-facing indices, the base wall material on the rest.
3. Store finishes at `finishes.wallFaces[wallId][roomId]` (plus `'@outside'` for the outer face of an exterior wall). Room ids are stable and already used by `rooms` finishes. Legacy `finishes.walls[wallId]` stays valid as the "both sides" fallback.
4. Picking uses `event.face.materialIndex` (provided by R3F) to identify the exact face, so clicking either side selects only that side.

**Rejected alternatives**
- *Two thin overlay skins per wall:* extra geometry that can z-fight, interferes with thickness/collision assumptions, doubles draw calls and GLB size.
- *Splitting shared walls into two segments in `buildHouseModel`:* changes geometry and ids, breaks `mergeWalls`/`wallPieces`/collision tests and saved wall-id finishes.
- *Shader/vertex-colour tricks:* harder to export to GLB and to texture.

**Key risks and mitigations**
- *Wall ids are geometry-derived:* if the layout changes, saved wall finishes can be orphaned. Orphans are ignored at render time and pruned on geometry change (5.3). Room ids are stable.
- *Cutaway assumes one material:* handled in 5.5.
- *Textures on stretched boxes:* depends on 1.3 (UV/repeat fix), so do it first.
- *Material count (6 per piece):* mitigated by caching/reuse and deduped disposal (5.4).
- *Highlight must not use emissive:* depends on 1.2.

## 4. Order of work

1. Phase 1 (rendering groundwork)
2. Phase 2 (visible panel, selection, view controls)
3. Phase 3 (colour picker)
4. Phase 4 (assets can start in parallel with Phase 2)
5. Phase 5 — within it: 5.1 → 5.2 → 5.3 (pure, tested, no UI) → 5.4 → 5.5 → 5.6 → 5.7 → 5.8 → 5.9. Requires 1.1–1.4 and 2.3 first.

**Suggested first milestone:** 1.1, 1.2, 2.1–2.3, 3.1–3.2, and a handful of materials from 4.1. That already delivers the visible editor, bottom panel and colour picker.

## 5. Later (deliberately out of this round)

Mini-map selector · undo/redo · floor rotation, gloss slider, grout options · trim/baseboard and accent-wall shortcuts · "apply to whole house" · normal/roughness maps for every material · hexagonal/herringbone layouts · "unsaved changes" indicator · docs polish.

## 6. Risks

- **Texture sourcing/licensing and size** is the biggest effort; keep the set small and lazy-load.
- **Camera refit** depends on how `cameraFit` uses aspect ratio; check before building the panel.
- **Wall-face approach:** wall ids depend on geometry (see 3A); render-time orphan handling is mandatory, pruning is optional.
- **Demand frameloop:** every live path (colour drag, texture load, zoom buttons) must call `invalidate()`.
- **Walk mode:** hide/collapse the panel while walking.

## Verification notes

_To be filled in during implementation._
