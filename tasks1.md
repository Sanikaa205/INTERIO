# INTERIO Floor-Plan Finish Editor — Implementation Tasks

Progress: 15 / 22 tasks

This task list adds an interactive, non-destructive finish editor to the existing 3D floor-plan experience. It must not alter floor-plan generation, room geometry, wall merging, openings, walkthrough collision, or existing interior/renovation workflows.

## Scope and guardrails

**In scope:** selecting room floors and wall segments; paint, tile, marble, and wood presets; color overrides; live previews; persisted finish data; texture assets bundled with the app; GLB export verification.

**Out of scope:** changing generated layouts, user uploads, remote texture URLs, pricing/catalog search, undo/redo, wall-side-specific finishes, and changes to `FloorPlanWorkflow.tsx`.

**Non-negotiable rules**

- Treat finishes as optional display overrides. An existing project with no finish data must render exactly as it does today.
- Keep `buildHouseModel` responsible only for geometry and topology. Do not add Three.js imports to `model/`.
- Do not mutate `plan` or Three.js material instances in place.
- Do not change the current save semantics during this feature: Save may continue creating a new project. A separate update-project feature can be planned later.
- Do not modify `server.ts` for phase 1. It already persists the `data` payload as JSON.
- Do not modify `FloorPlanWorkflow.tsx`. The feature is introduced in the 3D studio only.
- Use local, version-controlled material assets only. No arbitrary remote texture URL entered by a user.

## Target data contract

Add the following optional types in `src/types.ts`. Keep names and defaults stable so old project payloads remain compatible.

```ts
export type FinishMaterialId = 'paint' | 'tile' | 'marble' | 'wood';

export interface SurfaceFinish {
  materialId: FinishMaterialId;
  color?: string;       // #rrggbb only
  variantId?: string;   // points to a built-in catalog entry
  scale?: number;       // metres per texture repeat; positive finite number
  rotation?: number;    // degrees; optional for first release
  roughness?: number;   // 0..1; optional catalog override
}

export interface RoomFinishOverrides {
  floor?: SurfaceFinish;
  ceiling?: SurfaceFinish;
}

export interface FloorPlanFinishes {
  rooms?: Record<string, RoomFinishOverrides>;
  walls?: Record<string, SurfaceFinish>; // key = generated WallSegment.id
}
```

Add `finishes?: FloorPlanFinishes` to `FloorPlanResult`. Do not remove or repurpose `FloorPlanRoom.color`; it remains the legacy/default room-floor color.

## Resolution order

Every render path must use this deterministic precedence:

`surface override → current legacy/default color/material → current renderer default`

For phase 1, `walls[wall.id]` applies to the entire merged wall segment. This intentionally means an interior shared wall has one finish on both visible faces. Per-room wall-side finishes are a later, separate geometry/rendering enhancement.

---

## Phase 0 — Baseline and types

- [x] **0.1 Record the baseline**
  - Run `git status --short`, `npm run lint`, and `npm test`.
  - Record pre-existing failures in this file under “Baseline notes.” Do not fix unrelated failures.
  - Verify: baseline notes include command outcomes.

- [x] **0.2 Add backward-compatible finish types**
  - Files: `src/types.ts`.
  - Add the target data contract above, including `FloorPlanResult.finishes?`.
  - Do not make finish fields required and do not change existing property names or room color behavior.
  - Verify: `npm run lint`.

- [x] **0.3 Add finish validation/resolution helpers with unit tests**
  - Files: create `src/components/FloorPlan3D/finishes.ts`, `src/components/FloorPlan3D/finishes.test.ts`; edit `package.json` only to include the test file.
  - Implement pure helpers for valid hex colors, valid scale/roughness, reading a room or wall override safely, and resolving to a default.
  - Invalid/missing saved data must be ignored rather than throwing.
  - Verify: `npx tsx --test src/components/FloorPlan3D/finishes.test.ts`; `npm run lint`; `npm test`.

---done--

## Phase 1 — Built-in material catalog and texture handling

- [x] **1.1 Define a static material catalog**
  - Files: create `src/components/FloorPlan3D/materialCatalog.ts`.
  - Define a typed catalog with paint variants plus a small fixed set of tile, marble, and wood variants. Each entry specifies a display name, default color, roughness, and optional local map paths.
  - Catalog IDs must be stable, URL-free identifiers (for example `tile-white-matte`), not file paths entered by users.
  - Verify: TypeScript compiles and unknown `variantId` resolves safely to the material-type default.

- [x] **1.2 Add only licensed local texture assets**
  - Files: create `public/assets/materials/` and a short `README.md` recording source/license and map purpose.
  - Use small tileable assets appropriate for a web preview. Include only maps actually used (base color first; normal/roughness optional).
  - Keep asset sizes modest; do not add a network dependency or image upload endpoint.
  - Verify: production build completes and each referenced asset returns HTTP 200 under the development server.

- [x] **1.3 Create texture/material factories**
  - Files: edit `src/components/FloorPlan3D/materials.ts`; optionally create `textureCache.ts` beside it.
  - Add a factory that turns a resolved finish into `MeshStandardMaterial`, setting color, roughness, texture color space, wrap mode, and repeat from the physical mesh dimensions and `scale`.
  - Reuse loaded textures; create per-surface material instances where selection/cutaway opacity requires independent mutations.
  - Dispose owned materials and textures correctly without disposing shared cache textures while still in use.
  - Verify: `npm run lint`; manual check that no WebGL texture/material disposal warnings appear after changing selections repeatedly.

---

## Phase 2 — Surface selection and preview

- [x] **2.1 Introduce an explicit selected-surface state**
  - Files: create `src/components/FloorPlan3D/finishTypes.ts`; edit `FloorPlan3D.tsx`.
  - Model selection as a discriminated union: no selection, room floor, room ceiling, or wall by `wallId`.
  - Clicking empty canvas clears the selection. Preserve the existing room focus/camera behavior independently.
  - Verify: `npm run lint`; room focus and reset view still work.

- [x] **2.2 Make floors selectable for editing**
  - Files: edit `Floors.tsx`, `FloorPlan3D.tsx`.
  - Extend the existing floor click handler to select `{ kind: 'room-floor', roomId }` while retaining the current focus behavior.
  - Render a clear but unobtrusive selected outline/emissive state; it must not permanently alter the resolved floor material.
  - Verify: selecting a floor highlights only that room and still focuses the camera as before.

- [x] **2.3 Make wall segments selectable for editing**
  - Files: edit `Walls.tsx`, `FloorPlan3D.tsx`.
  - Add pointer handling to each rendered wall piece, propagating its stable `wall.id`; clicking any piece of the same wall selects the same wall.
  - Ensure interaction still works with wall openings and cutaway mode. Stop event propagation only as needed so background click clears selection.
  - Verify: exterior and interior wall selection works; walls with door/window openings can be selected; cutaway continues to fade camera-facing exterior walls.

- [x] **2.4 Add ceiling selection only when ceilings are visible**
  - Files: edit `Ceilings.tsx`, `FloorPlan3D.tsx`.
  - Add selection callbacks for ceiling meshes. Hidden ceilings must not create an inaccessible selection state.
  - Verify: ceiling selection works when visible and clears/resets safely when ceilings are hidden.

- [x] **2.5 Apply resolved finishes in all supported renderers**
  - Files: edit `Floors.tsx`, `Walls.tsx`, `Ceilings.tsx`, `FloorPlan3D.tsx`.
  - Pass the optional `plan.finishes` through the render layer and use the factories from Phase 1.
  - Existing plans without `finishes` must visually match the baseline (including room type floor colors and default wall/ceiling colors).
  - Verify: compare a saved legacy plan before/after; use a plan containing a color override and confirm it applies only to the intended surface.

---

## Phase 3 — Finish editor UI and state propagation

- [x] **3.1 Build an accessible FinishEditor panel**
  - Files: create `src/components/FloorPlan3D/FinishEditor.tsx`.
  - Show the selected surface name/type, material category buttons, material variants, preset swatches, native color input, scale control for textured materials, Reset Surface, and Close/Clear Selection.
  - On small screens, render it in the existing mobile control pattern without obscuring core camera controls.
  - Do not introduce a new package for color picking.
  - Verify: keyboard-accessible controls have labels; panel handles no selection gracefully; mobile layout remains usable.

- [x] **3.2 Apply edits immutably and preview immediately**
  - Files: edit `FloorPlan3D.tsx`; create `finishUpdates.ts` plus unit tests.
  - Implement pure immutable updates keyed by room ID or wall ID. Preserve unrelated overrides and make reset remove only the targeted override.
  - The panel change must update the viewer synchronously, without rebuilding plan geometry.
  - Verify: tests cover add, replace, reset, unknown IDs, and no mutation; `npm test` passes.

- [x] **3.3 Lift edited plan data to App state**
  - Files: edit `FloorPlan3D.tsx`, `src/App.tsx`.
  - Add an `onPlanChange(updatedPlan)` callback. In `App`, replace only the active floor-plan data with the returned immutable value.
  - Keep this edit additive and scoped to `active3DType === 'floorplan'`; do not alter interior or renovation behavior.
  - Verify: edit a finish, leave/re-enter the 3D studio within the current session, and confirm the preview remains applied.

- [x] **3.4 Preserve finish data when saving**
  - Files: `FloorPlan3D.tsx`, `App.tsx`; no `server.ts` change.
  - Confirm Save uses the updated `active3DData` payload, so `finishes` serializes with the project’s existing `data` JSON.
  - Verify: save a finished plan, reload projects, reopen it, and confirm all assigned finishes render.

---done--

## Phase 4 — Quality, export, and regression coverage

- [x] **4.1 Verify GLB export with finishes**
  - Files: edit `exportGlb.ts` only if required after a reproducible failure.
  - Export a plan using paint and at least one texture-based finish. Inspect the GLB in a compatible viewer and confirm materials/maps are present.
  - If local texture maps are not embedded by the current exporter configuration, make the narrowest documented exporter change necessary; do not change geometry.
  - Verify: exported GLB opens and preserves distinct floor/wall finishes.

- [x] **4.2 Add regression tests for compatibility and wall IDs**
  - Files: `finishes.test.ts`, relevant existing `model/*.test.ts` only if a stable wall-ID guarantee is not already tested.
  - Assert legacy plans resolve to the current defaults, malformed persisted finish data cannot crash rendering helpers, and a plan rebuild yields stable wall IDs for unchanged geometry.
  - Verify: `npm test` and `npm run lint`.

- [ ] **4.3 Manual regression pass**
  - Test desktop and narrow/mobile widths.
  - Test: old saved plan; newly generated plan; room-floor color; interior wall; exterior wall with window; wall with door; ceiling; cutaway; walkthrough; labels; night mode; reset camera; Save; GLB export.
  - Verify: no regression in the listed existing controls and no console errors.

- [x] **4.4 Final diff and build review**
  - Run `npm run lint`, `npm test`, and `npm run build`.
  - Inspect `git diff --check` and ensure no unrelated files or generated runtime data are included.
  - Verify: all checks pass or documented pre-existing failures are unchanged.

---

## Deferred follow-up (not part of this implementation)

- Per-room wall-face finishes for shared walls. This requires rendering separate faces/surfaces keyed by `{ wallId, roomId }`, not just applying a material to a merged wall segment.
- Bulk apply “all walls in this room” once room-to-wall-face targeting exists.
- Project update/overwrite API rather than creating a duplicate on every Save.
- User-uploaded material libraries, remote catalogs, usage/licensing management, and image moderation.
- Undo/redo history and comparison modes.
- PBR upgrades: normal, roughness, ambient occlusion, and displacement maps where performance allows.

## Baseline notes

- `git status --short`: pre-existing untracked `tasks1.md`.
- `npm run lint`: passed.
- `npm test`: passed (baseline suite completed successfully).

## Decisions made

- Finish overrides are optional and live on `FloorPlanResult`, so saved project JSON requires no server schema migration.
- A phase-1 wall finish targets a merged `WallSegment.id`; it is not a room-facing wall finish.
- Static, local catalog assets avoid CORS, availability, export, and licensing ambiguity from arbitrary remote URLs.
- The bitmap texture generator returned HTTP 403 in this environment. The initial local assets are original repeatable SVG base-colour maps, documented in `public/assets/materials/README.md`; the catalog API supports replacing them with licensed bitmap/PBR maps later.
- Phase 4.3 remains a visual/manual check: the isolated browser surface was unavailable, and existing user Chrome windows were left untouched. Automated export, compatibility, lint, test, build, diff, and local-asset HTTP checks passed.
