# Interior 3D editor: QA checklist (Phase 7)

Run in headless Chrome against the dev server (software renderer, so slow but representative of behaviour).

| Check | Result | Evidence |
|---|---|---|
| Default design opens in 3D with the Design panel | Pass | 01-default-design.png |
| Floor + 4 different wall finishes (marble, damask wallpaper, whitewashed brick, slat wood, stacked stone) | Pass | 02-textures-floor-and-4-walls.png, 03-textures-other-side.png |
| Texture edits do not rebuild the scene | Pass (scene builds stayed at 2) | script output |
| Recoloured furniture (body preset + dark walnut frame) | Pass | 04-recoloured-furniture.png |
| Add 2 pieces, delete 1 (7 -> 9 -> 8), Undo and the Delete key | Pass | 05-added-and-deleted-pieces.png |
| Phone 390 px: no horizontal scroll, no touch target under 40 px, panel as bottom drawer | Pass | 06-phone-viewer.png, 07-phone-walls-tab.png |
| Tablet 768 px: same checks, side panel | Pass | 06-tablet-viewer.png, 07-tablet-walls-tab.png |
| Keyboard: sidebar tabs with Arrow keys / Home / End (roving tabindex), Escape deselects, Delete removes the selected piece | Pass | script output |
| Page errors | None (one unidentified 404 for a static resource, present before this work) | script output |

## Not covered here
- Overlap / blocked-opening warning after a drag (4.5), plant and lamp decor parity (5.5), the bump-map look (6.2) and real-GPU frame rates (6.6) were not checked on screen.
- Performance was only measured on a machine without a GPU (about 3 fps), so absolute numbers are not meaningful.
