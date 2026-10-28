import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, ChevronUp, X, Paintbrush } from 'lucide-react';
import type { FloorPlanFinishes, SurfaceFinish } from '../../types';
import type { HouseModel } from './model/types';
import type { SelectedSurface } from './finishTypes';
import { ColorPicker } from './ColorPicker';
import { getRoomFinishOverride, getWallFinishOverride, OUTSIDE_FACE, resolveWallFaceFinish } from './finishes';
import { wallFaceTargets } from './model/wallFaces';
import {
  defaultVariantFor,
  getMaterialVariant,
  materialsForSurface,
  variantsForSurface,
  type CatalogSurface,
} from './materialCatalog';

// ─── Constants ────────────────────────────────────────────────────────────────

const MIN_HEIGHT = 220;
const MIN_WIDTH = 300;
const MAX_WIDTH = 520;
const MAX_WIDTH_FRACTION = 0.5; // of the viewer
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
  isSmall?: boolean;
  /** Sidebar width in px (wide screens). */
  width?: number;
  onWidthChange?: (width: number) => void;
  onChange: (surface: SelectedSurface, finish: SurfaceFinish, scope: WallScope) => void;
  onReset: (surface: SelectedSurface) => void;
  onResetMore: (action: ResetAction) => void;
}

/** How far a wall edit reaches: the selected face, both faces of the wall, or this room's side of every wall. */
export type WallScope = 'face' | 'both' | 'room';

export type ResetAction =
  | { type: 'wall'; wallId: string }
  | { type: 'room'; roomId: string }
  | { type: 'all' };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getSelectedFinish(
  finishes: FloorPlanFinishes | undefined,
  surface: SelectedSurface | null,
): SurfaceFinish | undefined {
  if (!surface) return undefined;
  if (surface.kind === 'wall') return getWallFinishOverride(finishes, surface.wallId);
  if (surface.kind === 'wall-face') return resolveWallFaceFinish(finishes, surface.wallId, surface.faceKey);
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
  const wall = model.walls.find((w) => w.id === s.wallId);
  if (s.kind === 'wall-face' && s.faceKey !== OUTSIDE_FACE) return s.faceKey;
  // Whole wall or outside face: the first room that touches the wall.
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
  const isTextured = Boolean(variant.mapUrl);
  // Textured materials use the colour as a tint; neutral white means "no tint".
  const color = finish?.color ?? (isTextured ? '#ffffff' : variant.color);
  const scale = finish?.scale ?? variant.defaultScale ?? 1;
  const catalogSurface: CatalogSurface =
    surface.kind === 'room-floor' ? 'floor' : surface.kind === 'room-ceiling' ? 'ceiling' : 'wall';
  const materials = materialsForSurface(catalogSurface);
  // A saved finish may use a material that is no longer offered here; keep it selectable.
  if (!materials.includes(materialId)) materials.push(materialId);
  const variants = variantsForSurface(catalogSurface).filter((item) => item.materialId === materialId);

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
        <div className="flex flex-wrap gap-1.5">
          {materials.map((m) => (
            <button
              key={m}
              type="button"
              id={`btn-material-${m}`}
              onClick={() => update({ materialId: m, variantId: defaultVariantFor(m, catalogSurface).id, color: undefined, roughness: undefined, scale: undefined })}
              className={`min-h-11 rounded-lg border px-2 py-1.5 text-xs capitalize transition-all sm:min-h-0 duration-150 ${
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
              onClick={() => update({ materialId: item.materialId, variantId: item.id, color: undefined, roughness: undefined, scale: undefined })}
              className={`flex min-h-11 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-all sm:min-h-0 duration-150 ${
                variant.id === item.id
                  ? 'border-cyan-400 bg-cyan-400/15 text-cyan-200'
                  : 'border-stone-700 bg-stone-800/60 text-stone-300 hover:border-stone-500 hover:text-white'
              }`}
            >
              <span
                className="h-6 w-6 flex-shrink-0 rounded-sm border border-white/20 bg-cover bg-center"
                style={{
                  backgroundColor: item.color,
                  backgroundImage: item.thumbnailUrl ?? item.mapUrl ? `url(${item.thumbnailUrl ?? item.mapUrl})` : undefined,
                }}
              />
              {item.name}
            </button>
          ))}
        </div>
      </div>

      {/* Colour picker (a tint on textured materials) */}
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-stone-400">
            {isTextured ? 'Tint' : 'Colour'}
          </p>
          {isTextured && (
            <button
              type="button"
              id="btn-reset-tint"
              disabled={!finish?.color}
              onClick={() => update({ color: undefined })}
              className="rounded-md border border-stone-600 px-2 py-0.5 text-[11px] text-stone-300 hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Reset tint
            </button>
          )}
        </div>
        <ColorPicker value={color} onChange={(hex) => update({ color: hex })} />
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
        {surface.kind === 'wall-face' ? 'Reset face' : 'Reset surface'}
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
  isSmall = false,
  width = 340,
  onWidthChange,
  onChange,
  onReset,
  onResetMore,
}) => {
  const [scope, setScope] = useState<WallScope>('face');
  // 2.3 — Track the active room and surface-type tab independently of 3D selection
  const [activeRoomId, setActiveRoomId] = useState<string | null>(() => model.rooms[0]?.id ?? null);
  const [activeTab, setActiveTab] = useState<SurfaceTab>('floor');
  const [panelHeight, setPanelHeight] = useState(MIN_HEIGHT);
  const dragRef = useRef<{ startY: number; startH: number } | null>(null);
  const widthDragRef = useRef<{ startX: number; startW: number } | null>(null);
  const docked = !isSmall; // right sidebar on wide screens, bottom drawer on small ones

  // Sync panel selection with 3D click selection
  useEffect(() => {
    if (!selectedSurface) return;
    const rid = roomIdFor(selectedSurface, model);
    if (rid) setActiveRoomId(rid);
    setActiveTab(surfaceTabFor(selectedSurface));
  }, [selectedSurface, model]);

  // Ceilings hidden → the ceiling tab is disabled, so leave it.
  useEffect(() => {
    if (!showCeilings && activeTab === 'ceiling') setActiveTab('floor');
  }, [showCeilings, activeTab]);

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
        // walls: pick this room's side of the first wall touching it
        const wall = model.walls.find((w) => wallFaceTargets(w).some((t) => t.faceKey === roomId));
        if (wall) onSelectSurface({ kind: 'wall-face', wallId: wall.id, faceKey: roomId });
      }
    },
    [model, onSelectSurface],
  );

  // Derive the currently-active SelectedSurface from panel state (for editor)
  const panelSurface = React.useMemo((): SelectedSurface | null => {
    if (!activeRoomId) return null;
    if (activeTab === 'floor') return { kind: 'room-floor', roomId: activeRoomId };
    if (activeTab === 'ceiling') return { kind: 'room-ceiling', roomId: activeRoomId };
    // walls: follow a selected face (3D click or panel list), else this room's first wall side
    if ((selectedSurface?.kind === 'wall-face' || selectedSurface?.kind === 'wall') && roomIdFor(selectedSurface, model) === activeRoomId) {
      return selectedSurface;
    }
    const wall = model.walls.find((w) => wallFaceTargets(w).some((t) => t.faceKey === activeRoomId));
    return wall ? { kind: 'wall-face', wallId: wall.id, faceKey: activeRoomId } : null;
  }, [activeRoomId, activeTab, selectedSurface, model]);

  // Drag-to-resize handle
  const onDragStart = (e: React.PointerEvent) => {
    // Let header buttons (collapse) receive their click instead of starting a drag.
    if ((e.target as HTMLElement).closest('button')) return;
    dragRef.current = { startY: e.clientY, startH: panelHeight };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onDragMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const delta = dragRef.current.startY - e.clientY;
    const parentH = e.currentTarget.parentElement?.parentElement?.clientHeight ?? window.innerHeight;
    const maxH = Math.max(MIN_HEIGHT, parentH * MAX_HEIGHT_FRACTION);
    setPanelHeight(Math.min(maxH, Math.max(MIN_HEIGHT, dragRef.current.startH + delta)));
  };
  const onDragEnd = () => { dragRef.current = null; };

  // Sidebar: drag the left edge to resize.
  const onWidthDragStart = (e: React.PointerEvent) => {
    widthDragRef.current = { startX: e.clientX, startW: width };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onWidthDragMove = (e: React.PointerEvent) => {
    if (!widthDragRef.current) return;
    const parentW = e.currentTarget.parentElement?.parentElement?.clientWidth ?? window.innerWidth;
    const maxW = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, parentW * MAX_WIDTH_FRACTION));
    const next = widthDragRef.current.startW + (widthDragRef.current.startX - e.clientX);
    onWidthChange?.(Math.min(maxW, Math.max(MIN_WIDTH, next)));
  };
  const onWidthDragEnd = () => { widthDragRef.current = null; };

  // Get all walls for this room (for the walls sub-list)
  const roomWalls = React.useMemo(() =>
    model.walls.filter((w) => activeRoomId && wallFaceTargets(w).some((t) => t.faceKey === activeRoomId)),
    [model, activeRoomId],
  );

  const activeRoom = model.rooms.find((r) => r.id === activeRoomId);
  const faceName = (faceKey: string) =>
    faceKey === OUTSIDE_FACE ? 'Outside' : `${model.rooms.find((r) => r.id === faceKey)?.name ?? 'Room'} side`;
  const wallFaceSurface = panelSurface?.kind === 'wall-face' ? panelSurface : null;
  const isLegacyFace = wallFaceSurface !== null
    && !finishes?.wallFaces?.[wallFaceSurface.wallId]?.[wallFaceSurface.faceKey]
    && Boolean(getWallFinishOverride(finishes, wallFaceSurface.wallId));
  const scopeButton = (value: WallScope, label: string, disabled = false) => (
    <button
      key={value}
      type="button"
      id={`btn-scope-${value}`}
      aria-pressed={scope === value}
      disabled={disabled}
      onClick={() => setScope(value)}
      className={`min-h-11 flex-1 rounded-md border px-2 py-1 text-[11px] sm:min-h-0 ${
        scope === value && !disabled
          ? 'border-cyan-400 bg-cyan-400/15 text-cyan-200'
          : 'border-stone-700 text-stone-400 hover:border-stone-500 disabled:cursor-not-allowed disabled:opacity-40'
      }`}
    >
      {label}
    </button>
  );
  const confirmAction = (message: string, action: ResetAction) => {
    if (window.confirm(message)) onResetMore(action);
  };

  return (
    <div
      className={`relative flex flex-col bg-stone-950 select-none ${docked ? 'flex-shrink-0 border-l border-stone-800' : 'border-t border-stone-800'}`}
      style={docked
        ? { width: open ? width : 0, maxWidth: '50%', overflow: 'hidden' }
        : { height: open ? panelHeight : 0, maxHeight: '50%', transition: 'height 0.25s ease', overflow: 'hidden' }}
    >
      {docked && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize design panel"
          className="absolute inset-y-0 left-0 z-10 w-1.5 cursor-ew-resize hover:bg-cyan-400/40"
          style={{ touchAction: 'none' }}
          onPointerDown={onWidthDragStart}
          onPointerMove={onWidthDragMove}
          onPointerUp={onWidthDragEnd}
        />
      )}
      {/* Header (drag handle on small screens) */}
      <div
        className={`flex items-center justify-between px-4 py-1.5 bg-stone-900 border-b border-stone-800 flex-shrink-0 ${docked ? '' : 'cursor-ns-resize'}`}
        style={{ touchAction: 'none' }}
        onPointerDown={docked ? undefined : onDragStart}
        onPointerMove={docked ? undefined : onDragMove}
        onPointerUp={docked ? undefined : onDragEnd}
      >
        <div className="flex items-center gap-2">
          <Paintbrush className="h-3.5 w-3.5 text-cyan-400" />
          <span className="text-xs font-semibold text-stone-200">
            Design
            {activeRoom ? <span className="ml-1.5 font-normal text-stone-400">— {activeRoom.name}</span> : null}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {!docked && <div className="mx-auto h-1 w-8 rounded-full bg-stone-600" aria-hidden />}
          <button
            type="button"
            id="btn-design-panel-collapse"
            onClick={onToggle}
            className="flex h-11 w-11 items-center justify-center rounded text-stone-400 hover:bg-stone-800 hover:text-white sm:h-8 sm:w-8"
            aria-label="Collapse design panel"
          >
            {docked ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Right: Tab + editor */}
        <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
          {/* Room chips: wrap in the sidebar, scroll sideways in the bottom drawer */}
          {(
            <div className={`flex flex-shrink-0 gap-1.5 border-b border-stone-800 px-3 py-1.5 ${docked ? 'flex-wrap' : 'overflow-x-auto'}`}>
              {model.rooms.map((room) => (
                <button
                  key={room.id}
                  type="button"
                  id={`btn-room-chip-${room.id}`}
                  onClick={() => selectFromPanel(room.id, activeTab)}
                  className={`flex-shrink-0 rounded-full border px-3 py-1 text-xs ${isSmall ? 'min-h-11' : ''} ${
                    activeRoomId === room.id
                      ? 'border-cyan-400 bg-cyan-400/15 text-cyan-300'
                      : 'border-stone-700 text-stone-400'
                  }`}
                >
                  {room.name}
                </button>
              ))}
            </div>
          )}
          {/* Surface tabs */}
          <div className="flex flex-shrink-0 border-b border-stone-800">
            {(['floor', 'walls'] as SurfaceTab[]).map((tab) => {
              const disabled = tab === 'ceiling' && !showCeilings;
              return (
                <button
                  key={tab}
                  type="button"
                  id={`btn-tab-${tab}`}
                  aria-pressed={activeTab === tab}
                  disabled={disabled}
                  onClick={() => { if (activeRoomId) selectFromPanel(activeRoomId, tab); }}
                  className={`flex-1 py-2 min-h-11 sm:min-h-0 text-xs capitalize transition-colors ${
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

          {/* Wall list: each segment of this room with its selectable faces */}
          {activeTab === 'walls' && roomWalls.length > 0 && (
            <div className="flex flex-shrink-0 gap-3 overflow-x-auto border-b border-stone-800 px-3 py-1.5">
              {roomWalls.map((wall, wallIndex) => (
                <div key={wall.id} className="flex flex-shrink-0 flex-col gap-1">
                  <span className="text-[10px] text-stone-500">Wall {wallIndex + 1}{wall.exterior ? ' · exterior' : ''}</span>
                  <div className="flex gap-1">
                    {wallFaceTargets(wall).map((target) => {
                      const isSelected = panelSurface?.kind === 'wall-face'
                        && panelSurface.wallId === wall.id && panelSurface.faceKey === target.faceKey;
                      return (
                        <button
                          key={target.faceKey}
                          type="button"
                          id={`btn-wall-face-${wall.id}-${target.faceKey}`}
                          aria-pressed={isSelected}
                          onClick={() => onSelectSurface({ kind: 'wall-face', wallId: wall.id, faceKey: target.faceKey })}
                          className={`min-h-11 flex-shrink-0 rounded-md border px-2 py-1 text-[10px] sm:min-h-0 transition-colors ${
                            isSelected
                              ? 'border-cyan-400 bg-cyan-400/15 text-cyan-300'
                              : 'border-stone-700 text-stone-400 hover:border-stone-500 hover:text-stone-200'
                          }`}
                        >
                          {faceName(target.faceKey)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}


          {/* Finish editor */}
          <div className="flex-1 overflow-y-auto p-3">
            {panelSurface ? (
              <>
                {wallFaceSurface && (
                  <div className="mb-3">
                    <p className="mb-1.5 text-xs font-semibold text-stone-200" id="dp-target-label">
                      Wall · {faceName(wallFaceSurface.faceKey)}
                      {isLegacyFace && <span className="ml-2 font-normal text-amber-300">Both sides (legacy)</span>}
                    </p>
                    <div className="flex gap-1.5" role="group" aria-label="Apply to">
                      {scopeButton('face', 'This side only')}
                      {scopeButton('both', 'Both sides')}
                      {scopeButton('room', 'All walls in this room', wallFaceSurface.faceKey === OUTSIDE_FACE)}
                    </div>
                  </div>
                )}
                <FinishEditorContent
                  surface={panelSurface}
                  finishes={finishes}
                  onChange={(finish) => onChange(panelSurface, finish, wallFaceSurface ? scope : 'face')}
                  onReset={() => onReset(panelSurface)}
                />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {wallFaceSurface && (
                    <button type="button" id="btn-reset-wall" onClick={() => onResetMore({ type: 'wall', wallId: wallFaceSurface.wallId })} className="min-h-11 flex-1 rounded-lg border border-stone-700 px-2 py-1 text-[11px] text-stone-400 hover:bg-stone-800 sm:min-h-0">Reset wall</button>
                  )}
                  {activeRoomId && (
                    <button type="button" id="btn-reset-room" onClick={() => onResetMore({ type: 'room', roomId: activeRoomId })} className="min-h-11 flex-1 rounded-lg border border-stone-700 px-2 py-1 text-[11px] text-stone-400 hover:bg-stone-800 sm:min-h-0">Reset room</button>
                  )}
                  <button type="button" id="btn-reset-all" onClick={() => confirmAction('Remove every finish in this house?', { type: 'all' })} className="min-h-11 flex-1 rounded-lg border border-red-900 px-2 py-1 text-[11px] text-red-300 hover:bg-red-950 sm:min-h-0">Reset all</button>
                </div>
              </>
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
