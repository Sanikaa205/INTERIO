import React, { useRef } from 'react';
import { ChevronDown, ChevronRight, Copy, Paintbrush, Plus, Search, Trash2 } from 'lucide-react';
import type { FurnitureItem, InteriorDesignResult, InteriorWallSide, SurfaceFinish } from '../../types';
import { ColorPicker } from '../FloorPlan3D/ColorPicker';
import { variantsForSurface } from '../FloorPlan3D/materialCatalog';
import {
  resetFloor,
  resetWalls,
  resolveWallFinish,
  setFloorFinish,
  setWallFinish,
  type WallScope,
} from '../../services/interiorFinishes';
import {
  isRecoloured,
  resetFurnitureColors,
  setBodyColor,
  setFrameColor,
  setFrameFinish,
} from '../../services/furnitureColors';
import { CATALOG_GROUPS, searchCatalog, type CatalogGroup } from '../../services/furnitureCatalog';
import type { RoomKind } from '../../services/styleProfiles';
import { SurfaceFinishEditor } from './SurfaceFinishEditor';

export type PanelTab = 'floor' | 'walls' | 'furniture';

export const PANEL_MIN_WIDTH = 300;
export const PANEL_MAX_WIDTH = 520;
const MIN_HEIGHT = 220;
const WALL_SIDES: InteriorWallSide[] = ['north', 'south', 'east', 'west'];
const TAB_LABEL: Record<PanelTab, string> = { floor: 'Floor', walls: 'Walls', furniture: 'Furniture' };
const focusRing = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-cyan-300';

interface InteriorDesignPanelProps {
  data: InteriorDesignResult;
  open: boolean;
  onToggle: () => void;
  /** Small screens get a bottom drawer instead of a side panel. */
  isSmall?: boolean;
  width: number;
  onWidthChange: (width: number) => void;
  tab: PanelTab;
  onTab: (tab: PanelTab) => void;
  wallScope: WallScope;
  onWallScope: (scope: WallScope) => void;
  selectedFurnitureId: string | null;
  onChange: (next: InteriorDesignResult) => void;
  onFurnitureChange: (furniture: FurnitureItem[]) => void;
  onAddFurniture: (catalogId: string) => void;
  onDuplicateFurniture: (id: string) => void;
  onDeleteFurniture: (id: string) => void;
}

function roomKindOf(roomType: string): RoomKind {
  return /bed|sleep/i.test(roomType) ? 'bedroom' : /dining/i.test(roomType) ? 'dining' : /study|office|work/i.test(roomType) ? 'study' : 'living';
}

const swatch = (data: InteriorDesignResult, role: 'wall' | 'flooring', fallback: string) =>
  data.colorPalette?.find((entry) => entry.role === role)?.hex || fallback;

export const InteriorDesignPanel: React.FC<InteriorDesignPanelProps> = ({
  data, open, onToggle, isSmall = false, width, onWidthChange, tab, onTab, wallScope, onWallScope,
  selectedFurnitureId, onChange, onFurnitureChange, onAddFurniture, onDuplicateFurniture, onDeleteFurniture,
}) => {
  const [query, setQuery] = React.useState('');
  const [group, setGroup] = React.useState<CatalogGroup | 'All'>('All');
  const [roomOnly, setRoomOnly] = React.useState(false);
  const docked = !isSmall;
  const widthDrag = useRef<{ startX: number; startW: number } | null>(null);
  const heightDrag = useRef<{ startY: number; startH: number } | null>(null);
  const [height, setHeight] = React.useState(MIN_HEIGHT + 60);

  const onWidthDown = (e: React.PointerEvent) => {
    widthDrag.current = { startX: e.clientX, startW: width };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onWidthMove = (e: React.PointerEvent) => {
    if (!widthDrag.current) return;
    const parentW = e.currentTarget.parentElement?.parentElement?.clientWidth ?? window.innerWidth;
    const max = Math.max(PANEL_MIN_WIDTH, Math.min(PANEL_MAX_WIDTH, parentW * 0.5));
    onWidthChange(Math.min(max, Math.max(PANEL_MIN_WIDTH, widthDrag.current.startW + (widthDrag.current.startX - e.clientX))));
  };
  const onHeightDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    heightDrag.current = { startY: e.clientY, startH: height };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onHeightMove = (e: React.PointerEvent) => {
    if (!heightDrag.current) return;
    const parentH = e.currentTarget.parentElement?.parentElement?.clientHeight ?? window.innerHeight;
    setHeight(Math.min(parentH * 0.7, Math.max(MIN_HEIGHT, heightDrag.current.startH + (heightDrag.current.startY - e.clientY))));
  };

  const openings = data.openings ?? [];
  const sideNote = (side: InteriorWallSide) => {
    const kinds = [...new Set(openings.filter((o) => o.wall === side).map((o) => o.type))];
    return kinds.length ? kinds.join(' + ') : '';
  };

  const selected = data.furniture?.find((item) => item.id === selectedFurnitureId);
  const updateFurniture = (next: FurnitureItem) =>
    onFurnitureChange(data.furniture.map((item) => (item.id === next.id ? next : item)));

  const floorFinish = data.finishes?.floor;
  const wallFinishes = data.finishes?.walls;
  const shownWallFinish: SurfaceFinish | undefined = wallScope === 'all' ? wallFinishes?.all : resolveWallFinish(data.finishes, wallScope);
  const inheritsAll = wallScope !== 'all' && !wallFinishes?.[wallScope] && Boolean(wallFinishes?.all);

  const renderFloor = () => (
    <SurfaceFinishEditor
      surface="floor"
      idPrefix="floor"
      finish={floorFinish}
      baseColor={swatch(data, 'flooring', '#b99569')}
      onChange={(finish) => onChange(setFloorFinish(data, finish))}
      onReset={() => onChange(resetFloor(data))}
      resetLabel="Reset floor"
    >
      <p className="text-[11px] leading-snug text-stone-500">The 2D plan shows the floor's base colour; textures appear in 3D.</p>
    </SurfaceFinishEditor>
  );

  const renderWalls = () => (
    <div className="flex flex-col gap-3">
      <div>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-stone-400">Apply to</p>
        <div className="grid grid-cols-2 gap-1.5" role="group" aria-label="Which walls">
          {(['all', ...WALL_SIDES] as WallScope[]).map((scope) => {
            const own = scope === 'all' ? wallFinishes?.all : wallFinishes?.[scope];
            return (
              <button
                key={scope}
                type="button"
                id={`walls-scope-${scope}`}
                aria-pressed={wallScope === scope}
                onClick={() => onWallScope(scope)}
                className={`flex min-h-11 flex-col items-start justify-center rounded-lg border px-2.5 py-1 text-left text-xs transition-colors ${focusRing} ${scope === 'all' ? 'col-span-2' : ''} ${
                  wallScope === scope
                    ? 'border-cyan-400 bg-cyan-400/15 text-cyan-200'
                    : 'border-stone-700 bg-stone-800/60 text-stone-300 hover:border-stone-500 hover:text-white'
                }`}
              >
                <span className="font-medium">{scope === 'all' ? 'All walls' : `${scope[0].toUpperCase()}${scope.slice(1)} wall`}</span>
                <span className="text-[10px] text-stone-400">
                  {scope === 'all' ? 'Applies unless a wall has its own' : sideNote(scope) || 'solid wall'}
                  {own ? ' · edited' : ''}
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-1.5 text-[11px] leading-snug text-stone-500">North is the top wall in the 2D plan; east is the right. The 2D plan shows the base wall colour; textures appear in 3D.</p>
      </div>
      {inheritsAll && <p className="rounded-md bg-stone-800/80 px-2 py-1.5 text-[11px] text-stone-300">Using the "All walls" finish. Changing it here gives this wall its own.</p>}
      <SurfaceFinishEditor
        surface="wall"
        idPrefix="walls"
        finish={shownWallFinish}
        baseColor={swatch(data, 'wall', '#eee9df')}
        onChange={(finish) => onChange(setWallFinish(data, wallScope, finish))}
        onReset={() => onChange(wallScope === 'all' ? resetWalls(data) : setWallFinish(data, wallScope, undefined))}
        resetLabel={wallScope === 'all' ? 'Reset all walls' : `Reset ${wallScope} wall`}
      >
        {wallScope !== 'all' && (
          <button
            type="button"
            id="walls-reset-all"
            onClick={() => onChange(resetWalls(data))}
            className={`w-full rounded-lg border border-stone-700 px-2 py-1.5 text-[11px] text-stone-400 hover:bg-stone-800 ${focusRing}`}
          >
            Reset all walls
          </button>
        )}
      </SurfaceFinishEditor>
    </div>
  );

  const renderAddSection = () => {
    const matches = searchCatalog(query, group, roomOnly ? roomKindOf(data.roomType) : undefined);
    return (
      <section aria-label="Add furniture" className="flex flex-col gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-stone-400">Add furniture</p>
        <label className="relative block">
          <span className="sr-only">Search furniture</span>
          <Search className="pointer-events-none absolute left-2 top-2.5 h-3.5 w-3.5 text-stone-500" aria-hidden />
          <input
            id="furniture-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search: sofa, bed, lamp…"
            className={`w-full rounded-lg border border-stone-700 bg-stone-800 py-2 pl-7 pr-2 text-xs text-white outline-none focus:border-cyan-400 ${focusRing}`}
          />
        </label>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Furniture type">
          {(['All', ...CATALOG_GROUPS] as const).map((name) => (
            <button
              key={name}
              type="button"
              id={`furniture-group-${name}`}
              aria-pressed={group === name}
              onClick={() => setGroup(name)}
              className={`rounded-full border px-2.5 py-1 text-[11px] ${focusRing} ${group === name ? 'border-cyan-400 bg-cyan-400/15 text-cyan-200' : 'border-stone-700 text-stone-400 hover:border-stone-500'}`}
            >
              {name}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-[11px] text-stone-400">
          <input type="checkbox" checked={roomOnly} onChange={(e) => setRoomOnly(e.target.checked)} className="accent-cyan-400" />
          Only pieces that suit a {data.roomType.toLowerCase()}
        </label>
        <ul className="flex flex-col gap-1" aria-label="Furniture catalogue">
          {matches.map((piece) => (
            <li key={piece.id}>
              <button
                type="button"
                id={`furniture-add-${piece.id}`}
                onClick={() => onAddFurniture(piece.id)}
                aria-label={`Add ${piece.name}, ${piece.width} by ${piece.depth} metres`}
                className={`flex min-h-11 w-full items-center justify-between gap-2 rounded-lg border border-stone-800 bg-stone-900 px-3 py-1.5 text-left text-xs text-stone-200 hover:border-cyan-500/60 hover:bg-stone-800 ${focusRing}`}
              >
                <span>
                  <span className="block font-medium">{piece.name}</span>
                  <span className="block text-[10px] text-stone-500">{piece.width} × {piece.depth} m · {piece.group}</span>
                </span>
                <Plus className="h-4 w-4 flex-shrink-0 text-cyan-400" aria-hidden />
              </button>
            </li>
          ))}
          {matches.length === 0 && <li className="py-3 text-center text-xs text-stone-500">Nothing matches "{query}".</li>}
        </ul>
      </section>
    );
  };

  const renderFurniture = () => {
    if (!selected) {
      return (
        <div className="flex flex-col gap-4">
          <p className="rounded-lg bg-stone-900 px-3 py-2 text-xs leading-relaxed text-stone-400">
            Click a piece of furniture in the 3D view to change its colours, or add a new piece below.
          </p>
          {renderAddSection()}
        </div>
      );
    }
    const woodVariants = variantsForSurface('floor').filter((variant) => variant.materialId === 'wood');
    return (
      <div className="flex flex-col gap-3">
        <div>
          <p className="truncate text-sm font-semibold text-stone-100" id="furniture-name">{selected.name}</p>
          <p className="text-[11px] capitalize text-stone-500">{selected.category}{selected.material ? ` · ${selected.material}` : ''}</p>
        </div>
        <details open className="rounded-lg border border-stone-800 p-2">
          <summary className={`cursor-pointer text-[11px] font-semibold uppercase tracking-widest text-stone-400 ${focusRing}`}>Body / upholstery colour</summary>
          <div className="mt-2">
            <ColorPicker value={selected.color || '#b8a58d'} onChange={(hex) => updateFurniture(setBodyColor(selected, hex))} />
          </div>
        </details>
        <details className="rounded-lg border border-stone-800 p-2">
          <summary className={`cursor-pointer text-[11px] font-semibold uppercase tracking-widest text-stone-400 ${focusRing}`}>Frame / wood colour</summary>
          <div className="mt-2 flex flex-col gap-2">
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Wood finish">
              {woodVariants.map((variant) => (
                <button
                  key={variant.id}
                  type="button"
                  id={`furniture-finish-${variant.id}`}
                  aria-pressed={selected.finishId === variant.id && !selected.frameColor}
                  onClick={() => updateFurniture(setFrameColor(setFrameFinish(selected, variant.id), undefined))}
                  className={`flex min-h-9 items-center gap-1.5 rounded-lg border px-2 py-1 text-xs ${focusRing} ${
                    selected.finishId === variant.id && !selected.frameColor
                      ? 'border-cyan-400 bg-cyan-400/15 text-cyan-200'
                      : 'border-stone-700 bg-stone-800/60 text-stone-300 hover:border-stone-500'
                  }`}
                >
                  <span className="h-4 w-4 rounded-full border border-white/20" style={{ backgroundColor: variant.color }} aria-hidden />
                  {variant.name}
                </button>
              ))}
            </div>
            <ColorPicker value={selected.frameColor || '#8a6244'} onChange={(hex) => updateFurniture(setFrameColor(selected, hex))} />
          </div>
        </details>
        <div className="flex gap-1.5">
          <button
            type="button"
            id="furniture-reset"
            disabled={!isRecoloured(selected)}
            onClick={() => updateFurniture(resetFurnitureColors(selected))}
            className={`flex-1 rounded-lg border border-stone-600 px-2 py-2 text-xs font-medium text-stone-300 hover:bg-stone-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 ${focusRing}`}
          >
            Reset to generated
          </button>
          <button
            type="button"
            id="furniture-delete"
            aria-label={`Delete ${selected.name}`}
            onClick={() => onDeleteFurniture(selected.id)}
            className={`flex items-center gap-1 rounded-lg border border-red-900 px-3 py-2 text-xs text-red-300 hover:bg-red-950 ${focusRing}`}
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
        </div>
        <button
          type="button"
          id="furniture-duplicate"
          onClick={() => onDuplicateFurniture(selected.id)}
          className={`flex w-full items-center justify-center gap-1.5 rounded-lg border border-stone-600 px-2 py-2 text-xs font-medium text-stone-300 hover:bg-stone-700 hover:text-white ${focusRing}`}
        >
          <Copy className="h-3.5 w-3.5" /> Duplicate
        </button>
        <p className="text-[11px] leading-snug text-stone-500">The 2D plan shows the body colour. Delete also works with the Delete key.</p>
        <hr className="border-stone-800" />
        {renderAddSection()}
      </div>
    );
  };

  return (
    <aside
      id="interior-design-panel"
      aria-label="Design panel"
      className={`relative flex flex-col bg-stone-950 text-stone-200 ${docked ? 'flex-shrink-0 border-l border-stone-800' : 'border-t border-stone-800'}`}
      style={docked
        ? { width: open ? width : 0, maxWidth: '50%', overflow: 'hidden' }
        : { height: open ? height : 0, maxHeight: '60%', transition: 'height 0.2s ease', overflow: 'hidden' }}
    >
      {docked && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize design panel"
          className="absolute inset-y-0 left-0 z-10 w-1.5 cursor-ew-resize hover:bg-cyan-400/40"
          style={{ touchAction: 'none' }}
          onPointerDown={onWidthDown}
          onPointerMove={onWidthMove}
          onPointerUp={() => { widthDrag.current = null; }}
        />
      )}
      <div
        className={`flex flex-shrink-0 items-center justify-between border-b border-stone-800 bg-stone-900 px-4 py-1.5 ${docked ? '' : 'cursor-ns-resize'}`}
        style={{ touchAction: 'none' }}
        onPointerDown={docked ? undefined : onHeightDown}
        onPointerMove={docked ? undefined : onHeightMove}
        onPointerUp={docked ? undefined : () => { heightDrag.current = null; }}
      >
        <div className="flex items-center gap-2">
          <Paintbrush className="h-3.5 w-3.5 text-cyan-400" />
          <span className="text-xs font-semibold text-stone-200">Design</span>
        </div>
        <button
          type="button"
          id="interior-panel-collapse"
          onClick={onToggle}
          aria-label="Collapse design panel"
          className={`flex h-10 w-10 items-center justify-center rounded text-stone-400 hover:bg-stone-800 hover:text-white ${focusRing}`}
        >
          {docked ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      <div className="flex flex-shrink-0 border-b border-stone-800" role="tablist" aria-label="What to edit">
        {(Object.keys(TAB_LABEL) as PanelTab[]).map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`interior-tab-${id}`}
            aria-selected={tab === id}
            aria-controls="interior-tabpanel"
            tabIndex={tab === id ? 0 : -1}
            onKeyDown={(e) => {
              // Roving tabindex: one Tab stop for the group, arrow keys move between tabs.
              const ids = Object.keys(TAB_LABEL) as PanelTab[];
              const at = ids.indexOf(id);
              const next = e.key === 'ArrowRight' ? ids[(at + 1) % ids.length]
                : e.key === 'ArrowLeft' ? ids[(at + ids.length - 1) % ids.length]
                : e.key === 'Home' ? ids[0]
                : e.key === 'End' ? ids[ids.length - 1] : null;
              if (!next) return;
              e.preventDefault();
              onTab(next);
              document.getElementById(`interior-tab-${next}`)?.focus();
            }}
            onClick={() => onTab(id)}
            className={`min-h-11 flex-1 py-2 text-xs transition-colors ${focusRing} ${
              tab === id ? 'border-b-2 border-cyan-400 font-semibold text-cyan-300' : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            {TAB_LABEL[id]}
          </button>
        ))}
      </div>

      <div id="interior-tabpanel" className="min-h-0 flex-1 overflow-y-auto p-3" role="tabpanel" aria-labelledby={`interior-tab-${tab}`}>
        {tab === 'floor' && renderFloor()}
        {tab === 'walls' && renderWalls()}
        {tab === 'furniture' && renderFurniture()}
      </div>
    </aside>
  );
};
