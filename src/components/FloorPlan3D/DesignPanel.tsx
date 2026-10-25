import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, X, Paintbrush } from 'lucide-react';
import type { FloorPlanFinishes, SurfaceFinish } from '../../types';
import type { HouseModel } from './model/types';
import type { SelectedSurface } from './finishTypes';
import { getRoomFinishOverride, getWallFinishOverride } from './finishes';
import {
  MATERIAL_CATALOG,
  DEFAULT_VARIANT_BY_MATERIAL,
  getMaterialVariant,
  type BuiltInMaterialId,
} from './materialCatalog';

// ─── Constants ────────────────────────────────────────────────────────────────

const MATERIALS: readonly BuiltInMaterialId[] = ['paint', 'tile', 'marble', 'wood'];
const SWATCHES = [
  '#f9f6f0', '#f0ead6', '#e2d9c5', '#d6cdb3',
  '#c5b9a0', '#b9c5b1', '#9ba9b8', '#8fa0a8',
  '#b08464', '#8a6244', '#765640', '#4f5355',
];

const MIN_HEIGHT = 220;
const MAX_HEIGHT_FRACTION = 0.5; // 50% of viewport

// ─── Types ────────────────────────────────────────────────────────────────────

type SurfaceTab = 'floor' | 'walls' | 'ceiling';

interface DesignPanelProps {
  model: HouseModel;
  finishes?: FloorPlanFinishes;
  open: boolean;
  selectedSurface: SelectedSurface | null;
  showCeilings: boolean;
  onToggle: () => void;
  onSelectSurface: (s: SelectedSurface) => void;
  onChange: (finish: SurfaceFinish) => void;
  onReset: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getSelectedFinish(
  finishes: FloorPlanFinishes | undefined,
  surface: SelectedSurface | null,
): SurfaceFinish | undefined {
  if (!surface) return undefined;
  if (surface.kind === 'wall') return getWallFinishOverride(finishes, surface.wallId);
  return getRoomFinishOverride(
    finishes,
    surface.roomId,
    surface.kind === 'room-floor' ? 'floor' : 'ceiling',
  );
}

function surfaceTabFor(s: SelectedSurface | null): SurfaceTab {
  if (!s) return 'floor';
  if (s.kind === 'room-floor') return 'floor';
  if (s.kind === 'room-ceiling') return 'ceiling';
  return 'walls';
}

function roomIdFor(s: SelectedSurface | null, model: HouseModel): string | null {
  if (!s) return model.rooms[0]?.id ?? null;
  if (s.kind === 'room-floor' || s.kind === 'room-ceiling') return s.roomId;
  // For wall, find first room that touches this wall
  const wall = model.walls.find((w) => w.id === s.wallId);
  return wall?.roomIds[0] ?? model.rooms[0]?.id ?? null;
}

// ─── Sub-component: Finish editor content ─────────────────────────────────────

interface FinishEditorContentProps {
  surface: SelectedSurface;
  finishes?: FloorPlanFinishes;
  onChange: (finish: SurfaceFinish) => void;
  onReset: () => void;
}

const FinishEditorContent: React.FC<FinishEditorContentProps> = ({ surface, finishes, onChange, onReset }) => {
  const finish = getSelectedFinish(finishes, surface);
  const materialId = finish?.materialId ?? 'paint';
  const variant = getMaterialVariant(finish?.variantId, materialId);
  const color = finish?.color ?? variant.color;
  const scale = finish?.scale ?? 1;
  const variants = MATERIAL_CATALOG.filter((item) => item.materialId === materialId);
  const isTextured = Boolean(variant.mapUrl);

  const update = (patch: Partial<SurfaceFinish>) => onChange({
    materialId,
    variantId: variant.id,
    ...finish,
    ...patch,
  });

  return (
    <div className="flex flex-col gap-3">
      {/* Material selector */}
      <div>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-stone-400">Material</p>
        <div className="grid grid-cols-4 gap-1.5">
          {MATERIALS.map((m) => (
            <button
              key={m}
              type="button"
              id={`btn-material-${m}`}
              onClick={() => update({ materialId: m, variantId: DEFAULT_VARIANT_BY_MATERIAL[m] })}
              className={`rounded-lg border px-2 py-1.5 text-xs capitalize transition-all duration-150 ${
                materialId === m
                  ? 'border-cyan-400 bg-cyan-400/15 text-cyan-200 shadow-sm shadow-cyan-400/20'
                  : 'border-stone-700 bg-stone-800/60 text-stone-300 hover:border-stone-500 hover:text-white'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Variants */}
      <div>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-stone-400">Style</p>
        <div className="flex flex-wrap gap-1.5">
          {variants.map((item) => (
            <button
              key={item.id}
              type="button"
              id={`btn-variant-${item.id}`}
              onClick={() => update({ materialId: item.materialId, variantId: item.id, color: undefined, roughness: undefined })}
              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-all duration-150 ${
                variant.id === item.id
                  ? 'border-cyan-400 bg-cyan-400/15 text-cyan-200'
                  : 'border-stone-700 bg-stone-800/60 text-stone-300 hover:border-stone-500 hover:text-white'
              }`}
            >
              <span
                className="h-3.5 w-3.5 flex-shrink-0 rounded-sm border border-white/20"
                style={{ backgroundColor: item.color }}
              />
              {item.name}
            </button>
          ))}
        </div>
      </div>

      {/* Colour swatches + picker */}
      <div>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-stone-400">Colour</p>
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="dp-finish-color">Custom colour</label>
          <input
            id="dp-finish-color"
            type="color"
            value={color}
            onChange={(e) => update({ color: e.target.value })}
            className="h-8 w-10 cursor-pointer rounded-lg border border-stone-600 bg-transparent p-0.5"
          />
          <div className="flex flex-1 flex-wrap gap-1">
            {SWATCHES.map((s) => (
              <button
                key={s}
                type="button"
                aria-label={`Use ${s}`}
                title={s}
                onClick={() => update({ color: s })}
                className={`h-5 w-5 rounded-full border transition-all ${
                  color.toLowerCase() === s
                    ? 'border-cyan-300 ring-2 ring-cyan-300 scale-110'
                    : 'border-white/20 hover:scale-110'
                }`}
                style={{ backgroundColor: s }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Texture scale */}
      {isTextured && (
        <label className="block text-xs text-stone-300" htmlFor="dp-finish-scale">
          <span className="font-medium">Texture scale</span>
          <span className="ml-1 text-stone-500">(m/repeat)</span>
          <input
            id="dp-finish-scale"
            type="number"
            min="0.1"
            step="0.1"
            value={scale}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (Number.isFinite(v) && v > 0) update({ scale: v });
            }}
            className="mt-1 w-full rounded-lg border border-stone-700 bg-stone-800 px-2 py-1.5 text-sm text-white outline-none focus:border-cyan-400"
          />
        </label>
      )}

      {/* Reset */}
      <button
        type="button"
        id="btn-reset-surface"
        onClick={onReset}
        className="w-full rounded-lg border border-stone-600 px-2 py-1.5 text-xs font-medium text-stone-300 transition-colors hover:bg-stone-700 hover:text-white"
      >
        Reset surface
      </button>
    </div>
  );
};

// ─── Main DesignPanel ──────────────────────────────────────────────────────────

export const DesignPanel: React.FC<DesignPanelProps> = ({
  model,
  finishes,
  open,
  selectedSurface,
  showCeilings,
  onToggle,
  onSelectSurface,
  onChange,
  onReset,
}) => {
  // 2.3 — Track the active room and surface-type tab independently of 3D selection
  const [activeRoomId, setActiveRoomId] = useState<string | null>(() => model.rooms[0]?.id ?? null);
  const [activeTab, setActiveTab] = useState<SurfaceTab>('floor');
  const [panelHeight, setPanelHeight] = useState(MIN_HEIGHT);
  const dragRef = useRef<{ startY: number; startH: number } | null>(null);

  // Sync panel selection with 3D click selection
  useEffect(() => {
    if (!selectedSurface) return;
    const rid = roomIdFor(selectedSurface, model);
    if (rid) setActiveRoomId(rid);
    setActiveTab(surfaceTabFor(selectedSurface));
  }, [selectedSurface, model]);

  // When user picks a room/tab in the panel, select that surface in 3D
  const selectFromPanel = useCallback(
    (roomId: string, tab: SurfaceTab) => {
      setActiveRoomId(roomId);
      setActiveTab(tab);
      if (tab === 'floor') {
        onSelectSurface({ kind: 'room-floor', roomId });
      } else if (tab === 'ceiling') {
        onSelectSurface({ kind: 'room-ceiling', roomId });
      } else {
        // walls: pick the first wall segment touching this room
        const wall = model.walls.find((w) => w.roomIds.includes(roomId));
        if (wall) onSelectSurface({ kind: 'wall', wallId: wall.id });
      }
    },
    [model, onSelectSurface],
  );

  // Derive the currently-active SelectedSurface from panel state (for editor)
  const panelSurface = React.useMemo((): SelectedSurface | null => {
    if (!activeRoomId) return null;
    if (activeTab === 'floor') return { kind: 'room-floor', roomId: activeRoomId };
    if (activeTab === 'ceiling') return { kind: 'room-ceiling', roomId: activeRoomId };
    // walls: use panel selection or 3D selection
    if (selectedSurface?.kind === 'wall') return selectedSurface;
    const wall = model.walls.find((w) => w.roomIds.includes(activeRoomId));
    return wall ? { kind: 'wall', wallId: wall.id } : null;
  }, [activeRoomId, activeTab, selectedSurface, model]);

  // Drag-to-resize handle
  const onDragStart = (e: React.PointerEvent) => {
    dragRef.current = { startY: e.clientY, startH: panelHeight };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onDragMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const delta = dragRef.current.startY - e.clientY;
    const maxH = window.innerHeight * MAX_HEIGHT_FRACTION;
    setPanelHeight(Math.min(maxH, Math.max(MIN_HEIGHT, dragRef.current.startH + delta)));
  };
  const onDragEnd = () => { dragRef.current = null; };

  // Get all walls for this room (for the walls sub-list)
  const roomWalls = React.useMemo(() =>
    model.walls.filter((w) => activeRoomId && w.roomIds.includes(activeRoomId)),
    [model, activeRoomId],
  );

  const activeRoom = model.rooms.find((r) => r.id === activeRoomId);

  return (
    <div
      className="flex flex-col border-t border-stone-800 bg-stone-950 select-none"
      style={{ height: open ? panelHeight : 0, transition: 'height 0.25s ease', overflow: 'hidden' }}
    >
      {/* Drag handle + header */}
      <div
        className="flex cursor-ns-resize items-center justify-between px-4 py-1.5 bg-stone-900 border-b border-stone-800 flex-shrink-0"
        style={{ touchAction: 'none' }}
        onPointerDown={onDragStart}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
      >
        <div className="flex items-center gap-2">
          <Paintbrush className="h-3.5 w-3.5 text-cyan-400" />
          <span className="text-xs font-semibold text-stone-200">
            Design
            {activeRoom ? <span className="ml-1.5 font-normal text-stone-400">— {activeRoom.name}</span> : null}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="mx-auto h-1 w-8 rounded-full bg-stone-600" aria-hidden />
          <button
            type="button"
            id="btn-design-panel-collapse"
            onClick={onToggle}
            className="rounded p-1 text-stone-400 hover:bg-stone-800 hover:text-white"
            aria-label="Collapse design panel"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Left: Room list */}
        <div className="w-36 flex-shrink-0 overflow-y-auto border-r border-stone-800 py-2">
          <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-stone-500">Rooms</p>
          {model.rooms.map((room) => (
            <button
              key={room.id}
              type="button"
              id={`btn-room-${room.id}`}
              onClick={() => selectFromPanel(room.id, activeTab)}
              className={`w-full px-3 py-1.5 text-left text-xs transition-colors ${
                activeRoomId === room.id
                  ? 'bg-cyan-400/10 text-cyan-300 font-medium'
                  : 'text-stone-400 hover:bg-stone-800 hover:text-stone-200'
              }`}
            >
              {room.name}
            </button>
          ))}
        </div>

        {/* Right: Tab + editor */}
        <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
          {/* Surface tabs */}
          <div className="flex flex-shrink-0 border-b border-stone-800">
            {(['floor', 'walls', 'ceiling'] as SurfaceTab[]).map((tab) => {
              const disabled = tab === 'ceiling' && !showCeilings;
              return (
                <button
                  key={tab}
                  type="button"
                  id={`btn-tab-${tab}`}
                  aria-pressed={activeTab === tab}
                  disabled={disabled}
                  onClick={() => { if (activeRoomId) selectFromPanel(activeRoomId, tab); }}
                  className={`flex-1 py-2 text-xs capitalize transition-colors ${
                    activeTab === tab
                      ? 'border-b-2 border-cyan-400 text-cyan-300 font-semibold'
                      : disabled
                      ? 'text-stone-600 cursor-not-allowed'
                      : 'text-stone-400 hover:text-stone-200'
                  }`}
                  title={disabled ? 'Enable ceiling visibility to edit ceilings' : undefined}
                >
                  {tab}
                  {disabled && <span className="ml-1 text-[9px]">(hidden)</span>}
                </button>
              );
            })}
          </div>

          {/* Wall segment list (only shown when on Walls tab) */}
          {activeTab === 'walls' && roomWalls.length > 1 && (
            <div className="flex flex-shrink-0 gap-1.5 overflow-x-auto border-b border-stone-800 px-3 py-1.5">
              {roomWalls.map((wall) => {
                const isSelected = selectedSurface?.kind === 'wall' && selectedSurface.wallId === wall.id;
                const label = wall.exterior ? 'Exterior' : `Wall ${wall.id.slice(-4)}`;
                return (
                  <button
                    key={wall.id}
                    type="button"
                    id={`btn-wall-${wall.id}`}
                    onClick={() => onSelectSurface({ kind: 'wall', wallId: wall.id })}
                    className={`flex-shrink-0 rounded-md border px-2 py-1 text-[10px] transition-colors ${
                      isSelected
                        ? 'border-cyan-400 bg-cyan-400/15 text-cyan-300'
                        : 'border-stone-700 text-stone-400 hover:border-stone-500 hover:text-stone-200'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}

          {/* Finish editor */}
          <div className="flex-1 overflow-y-auto p-3">
            {panelSurface ? (
              <FinishEditorContent
                surface={panelSurface}
                finishes={finishes}
                onChange={onChange}
                onReset={onReset}
              />
            ) : (
              <p className="text-center text-xs text-stone-500 pt-6">
                Select a room to start editing finishes.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Collapsed trigger bar ─────────────────────────────────────────────────────

interface DesignPanelTriggerProps {
  onClick: () => void;
}

export const DesignPanelTrigger: React.FC<DesignPanelTriggerProps> = ({ onClick }) => (
  <button
    type="button"
    id="btn-design-panel-open"
    aria-pressed={false}
    onClick={onClick}
    className="w-full flex items-center justify-center gap-2 border-t border-stone-800 bg-stone-900 py-2 text-xs font-semibold text-stone-300 hover:bg-stone-800 hover:text-white transition-colors"
  >
    <Paintbrush className="h-3.5 w-3.5 text-cyan-400" />
    Design
    <ChevronUp className="h-3.5 w-3.5" />
  </button>
);
