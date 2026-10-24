import React, { useRef, useState } from 'react';
import {
  Compass,
  Plus,
  Trash2,
  Box,
  BookmarkPlus,
  RefreshCw,
  RotateCcw,
  Grid,
  Info,
  ArrowLeft,
  Home,
  Download,
} from 'lucide-react';
import { FloorPlanResult, FloorPlanRoom, FloorPlanDoor, FloorPlanWindow } from '../types';
import { generateFloorPlanApi } from '../services/api';

interface FloorPlanWorkflowProps {
  onView3D: (result: FloorPlanResult) => void;
  onSaveProject: (result: FloorPlanResult) => void;
  onBackToHome?: () => void;
}

interface RoomInput {
  id: string;
  name: string;
  type: string;
  minSize: number;
}

export const FloorPlanWorkflow: React.FC<FloorPlanWorkflowProps> = ({
  onView3D,
  onSaveProject,
  onBackToHome,
}) => {
  // Plot Dimensions (Meters)
  const [plotWidth, setPlotWidth] = useState<number>(15);
  const [plotLength, setPlotLength] = useState<number>(20);
  const [userRequirements, setUserRequirements] = useState<string>('');

  // Dynamic Room List Input
  const [rooms, setRooms] = useState<RoomInput[]>([
    { id: '1', name: 'Living Room', type: 'living', minSize: 24 },
    { id: '2', name: 'Master Bedroom', type: 'bedroom', minSize: 18 },
    { id: '3', name: 'Guest Bedroom', type: 'bedroom', minSize: 14 },
    { id: '4', name: 'Kitchen & Dining', type: 'kitchen', minSize: 16 },
    { id: '5', name: 'Master Bathroom', type: 'bathroom', minSize: 6 },
    { id: '6', name: 'Powder Room', type: 'bathroom', minSize: 4 },
  ]);

  // UI / Generation State
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generationStep, setGenerationStep] = useState<string>('');
  const [result, setResult] = useState<FloorPlanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // View Options on SVG Blueprint
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [showDimensions, setShowDimensions] = useState<boolean>(true);

  // Manual Room Repositioning: original layout kept for "Reset Layout",
  // selection tracked by id (not a stale room snapshot), plus drag state.
  const [originalRooms, setOriginalRooms] = useState<FloorPlanRoom[] | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [draggingRoomId, setDraggingRoomId] = useState<string | null>(null);
  const selectedRoom = result?.rooms.find((r) => r.id === selectedRoomId) || null;

  const svgRef = useRef<SVGSVGElement | null>(null);
  const blueprintRef = useRef<HTMLDivElement | null>(null);
  const dragInfoRef = useRef<{
    roomId: string;
    offsetX: number;
    offsetY: number;
    startClientX: number;
    startClientY: number;
    moved: boolean;
  } | null>(null);

  // Presets
  const handlePreset = (type: '3bhk' | '2bhk' | 'studio' | 'villa') => {
    switch (type) {
      case '3bhk':
        setPlotWidth(16);
        setPlotLength(22);
        setRooms([
          { id: '1', name: 'Great Living Room', type: 'living', minSize: 26 },
          { id: '2', name: 'Master Bedroom Suite', type: 'bedroom', minSize: 18 },
          { id: '3', name: 'Bedroom 2', type: 'bedroom', minSize: 14 },
          { id: '4', name: 'Bedroom 3', type: 'bedroom', minSize: 12 },
          { id: '5', name: 'Kitchen & Dining', type: 'kitchen', minSize: 18 },
          { id: '6', name: 'En-suite Bath', type: 'bathroom', minSize: 6 },
          { id: '7', name: 'Common Bath', type: 'bathroom', minSize: 5 },
        ]);
        break;
      case '2bhk':
        setPlotWidth(12);
        setPlotLength(16);
        setRooms([
          { id: '1', name: 'Living & Lounge', type: 'living', minSize: 20 },
          { id: '2', name: 'Master Bedroom', type: 'bedroom', minSize: 16 },
          { id: '3', name: 'Guest Bedroom', type: 'bedroom', minSize: 12 },
          { id: '4', name: 'Kitchen Area', type: 'kitchen', minSize: 12 },
          { id: '5', name: 'Bathroom', type: 'bathroom', minSize: 5 },
        ]);
        break;
      case 'studio':
        setPlotWidth(9);
        setPlotLength(12);
        setRooms([
          { id: '1', name: 'Studio Living & Bed', type: 'living', minSize: 28 },
          { id: '2', name: 'Kitchenette', type: 'kitchen', minSize: 8 },
          { id: '3', name: 'Modern Bath', type: 'bathroom', minSize: 5 },
        ]);
        break;
      case 'villa':
        setPlotWidth(22);
        setPlotLength(28);
        setRooms([
          { id: '1', name: 'Formal Living Room', type: 'living', minSize: 34 },
          { id: '2', name: 'Family Lounge', type: 'living', minSize: 22 },
          { id: '3', name: 'Master Suite', type: 'bedroom', minSize: 24 },
          { id: '4', name: 'Junior Suite', type: 'bedroom', minSize: 18 },
          { id: '5', name: 'Guest Room', type: 'bedroom', minSize: 16 },
          { id: '6', name: 'Chef Kitchen', type: 'kitchen', minSize: 22 },
          { id: '7', name: 'Formal Dining', type: 'dining', minSize: 16 },
          { id: '8', name: 'Spa Bathroom', type: 'bathroom', minSize: 9 },
          { id: '9', name: 'Powder Room', type: 'bathroom', minSize: 4 },
        ]);
        break;
    }
  };

  // Add Room
  const handleAddRoom = () => {
    const newId = (rooms.length + 1).toString();
    setRooms([
      ...rooms,
      {
        id: newId,
        name: `Room ${newId}`,
        type: 'bedroom',
        minSize: 12,
      },
    ]);
  };

  // Update Room
  const handleUpdateRoom = (id: string, field: keyof RoomInput, value: any) => {
    setRooms(
      rooms.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  };

  // Remove Room
  const handleRemoveRoom = (id: string) => {
    if (rooms.length <= 1) return;
    setRooms(rooms.filter((r) => r.id !== id));
  };

  // Submit to Gemini API
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!Number.isFinite(plotWidth) || plotWidth <= 0 || !Number.isFinite(plotLength) || plotLength <= 0) {
      setError('Enter a plot width and length greater than zero before generating.');
      return;
    }
    if (rooms.length === 0) {
      setError('Add at least one room before generating a floor plan.');
      return;
    }
    const invalidRoom = rooms.find((r) => !r.name.trim() || !Number.isFinite(r.minSize) || r.minSize <= 0);
    if (invalidRoom) {
      setError(`"${invalidRoom.name || 'Untitled room'}" needs a name and a minimum size greater than zero.`);
      return;
    }

    setIsGenerating(true);

    const steps = [
      'Validating plot boundaries and setback easements...',
      'Calculating solar angles and non-overlapping adjacency rules...',
      'Calling Gemini architectural model for CAD coordinates...',
      'Synthesizing wall structural thicknesses and door swings...',
    ];

    let stepIndex = 0;
    setGenerationStep(steps[0]);
    const stepInterval = setInterval(() => {
      stepIndex = (stepIndex + 1) % steps.length;
      setGenerationStep(steps[stepIndex]);
    }, 1200);

    try {
      const generated = await generateFloorPlanApi({
        plotWidth,
        plotLength,
        userRequirements,
        rooms: rooms.map((r) => ({
          name: r.name,
          type: r.type,
          minSize: r.minSize,
        })),
      });

      setResult(generated);
      setOriginalRooms(generated.rooms ? generated.rooms.map((r) => ({ ...r })) : []);
      setSelectedRoomId(generated.rooms && generated.rooms.length > 0 ? generated.rooms[0].id : null);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to generate floor plan');
    } finally {
      clearInterval(stepInterval);
      setIsGenerating(false);
    }
  };

  // Attempt to move a room to a raw (unsnapped) position: snaps to the grid,
  // clamps to the plot boundary, and rejects the move entirely if it would
  // overlap another room (simplest reliable way to enforce non-overlap).
  // Moves a room to (rawX, rawY) if that position is valid, used by both
  // pointer-drag and arrow-key nudging. Never commits an invalid position --
  // an out-of-bounds or overlapping candidate is simply rejected (`return
  // prev`), so the room always stays at its last valid spot rather than
  // ending a drag frozen somewhere invalid. Since walls/doors/windows/
  // furniture icons/labels are all plain functions of `result.rooms`
  // recomputed fresh on every render, committing the new position here is
  // all that's needed for them to update too.
  const tryMoveRoom = (roomId: string, rawX: number, rawY: number) => {
    setResult((prev) => {
      if (!prev) return prev;
      const room = prev.rooms.find((r) => r.id === roomId);
      if (!room) return prev;

      const others = prev.rooms.filter((r) => r.id !== roomId);
      const maxX = Math.max(0, roundTo(prev.plotWidth - room.width));
      const maxY = Math.max(0, roundTo(prev.plotLength - room.height));

      // Snap to the plot edges and every other room's edges within
      // EDGE_SNAP_TOLERANCE first, so a flush-tiled layout clicks back
      // together instead of leaving a visible gap; fall back to the finer
      // grid snap when nothing is close enough to snap to.
      const xTargets = [0, prev.plotWidth, ...others.flatMap((r) => [r.x, r.x + r.width])];
      const yTargets = [0, prev.plotLength, ...others.flatMap((r) => [r.y, r.y + r.height])];
      const snappedX = snapAxis(snapToGrid(rawX), room.width, xTargets, EDGE_SNAP_TOLERANCE);
      const snappedY = snapAxis(snapToGrid(rawY), room.height, yTargets, EDGE_SNAP_TOLERANCE);

      const x = roundTo(Math.min(Math.max(snappedX, 0), maxX));
      const y = roundTo(Math.min(Math.max(snappedY, 0), maxY));

      if (x === room.x && y === room.y) return prev;

      const candidate: FloorPlanRoom = { ...room, x, y };
      // Rooms that only share an edge -- the normal flush-tiled layout --
      // are not an overlap; only genuine area overlap beyond a small
      // tolerance blocks the move.
      const overlaps = others.some((other) => rectsOverlap(candidate, other, OVERLAP_TOLERANCE));
      if (overlaps) return prev;

      return {
        ...prev,
        rooms: prev.rooms.map((r) => (r.id === roomId ? candidate : r)),
      };
    });
  };

  const handleResetLayout = () => {
    if (!originalRooms) return;
    setResult((prev) => (prev ? { ...prev, rooms: originalRooms.map((r) => ({ ...r })) } : prev));
  };

  // The interactive canvas intentionally stays lightweight.  Exporting uses a
  // separate, print-ready SVG so the downloaded image always has architectural
  // line weights, opening symbols, labels and dimensions (regardless of the
  // current selection or grid setting in the editor).
  const handleDownloadFloorPlan = () => {
    if (!result) return;
    downloadFloorPlanPng(result);
  };

  // Drag-to-reposition: pointer events + native SVG coordinate conversion so
  // dragging stays accurate regardless of how the SVG is scaled on screen.
  const handleRoomPointerDown = (e: React.PointerEvent<SVGGElement>, room: FloorPlanRoom) => {
    e.stopPropagation();
    setSelectedRoomId(room.id);
    blueprintRef.current?.focus();

    const svg = svgRef.current;
    if (!svg) return;

    const svgPoint = clientToSvgPoint(svg, e.clientX, e.clientY);
    dragInfoRef.current = {
      roomId: room.id,
      offsetX: svgPoint.x - room.x,
      offsetY: svgPoint.y - room.y,
      startClientX: e.clientX,
      startClientY: e.clientY,
      moved: false,
    };
    setDraggingRoomId(room.id);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleRoomPointerMove = (e: React.PointerEvent<SVGGElement>) => {
    const drag = dragInfoRef.current;
    const svg = svgRef.current;
    if (!drag || !svg) return;

    // Ignore tiny jitter so a plain click doesn't nudge the room.
    if (!drag.moved) {
      const dxPx = e.clientX - drag.startClientX;
      const dyPx = e.clientY - drag.startClientY;
      if (Math.hypot(dxPx, dyPx) < 3) return;
      drag.moved = true;
    }

    const svgPoint = clientToSvgPoint(svg, e.clientX, e.clientY);
    tryMoveRoom(drag.roomId, svgPoint.x - drag.offsetX, svgPoint.y - drag.offsetY);
  };

  const handleRoomPointerUp = (e: React.PointerEvent<SVGGElement>) => {
    if (dragInfoRef.current && e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    dragInfoRef.current = null;
    setDraggingRoomId(null);
  };

  // Arrow-key nudging of the selected room (Shift = larger step).
  const handleBlueprintKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!selectedRoomId || !result) return;

    const step = e.shiftKey ? ARROW_STEP_SHIFT : ARROW_STEP;
    let dx = 0;
    let dy = 0;
    if (e.key === 'ArrowUp') dy = -step;
    else if (e.key === 'ArrowDown') dy = step;
    else if (e.key === 'ArrowLeft') dx = -step;
    else if (e.key === 'ArrowRight') dx = step;
    else return;

    e.preventDefault();
    const room = result.rooms.find((r) => r.id === selectedRoomId);
    if (!room) return;
    tryMoveRoom(selectedRoomId, room.x + dx, room.y + dy);
  };

  // Keep both bounds available: the building box keeps the plan styling
  // focused, while the plot box is the measured architectural datum used
  // for the site boundary and overall dimensions.
  const buildingBBox = result ? getBuildingBoundingBox(result.rooms, result.circulation) : null;
  const plotBBox = result ? { minX: 0, minY: 0, width: result.plotWidth, height: result.plotLength } : null;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 space-y-8">
      {/* Header & Back Navigation */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          id="btn-floorplan-back-home"
          onClick={onBackToHome}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-600 hover:text-stone-900 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Dashboard</span>
        </button>

        <div className="flex items-center gap-1.5 text-xs text-stone-400">
          <span>Workflows</span>
          <span>/</span>
          <span className="text-stone-900 font-medium">CAD Floor Plan</span>
        </div>
      </div>

      {/* Page Title & Scope */}
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold text-stone-900 tracking-tight">
          CAD Floor Plan Blueprint
        </h1>
        <p className="text-xs sm:text-sm text-stone-500 mt-1 max-w-2xl leading-relaxed">
          Specify your plot dimensions and room requirements. The system calculates non-overlapping room boundaries, 
          circulation corridors, and door positions.
        </p>
      </div>

      {/* Main Grid: Form Left, Blueprint Canvas Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Form & Room Inventory */}
        <div className="lg:col-span-5 space-y-6">
          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-2xl border border-stone-200/80 p-6 space-y-6"
          >
            {/* Presets Bar */}
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-2">
                Templates
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: '3bhk', label: '3 BHK', area: '16×22m' },
                  { id: '2bhk', label: '2 BHK', area: '12×16m' },
                  { id: 'studio', label: 'Studio', area: '9×12m' },
                  { id: 'villa', label: 'Villa', area: '22×28m' },
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handlePreset(p.id as any)}
                    className="p-2 bg-stone-50 hover:bg-stone-100 border border-stone-200/70 rounded-lg text-left transition-colors cursor-pointer"
                  >
                    <span className="text-xs font-medium text-stone-800 block">
                      {p.label}
                    </span>
                    <span className="text-[10px] text-stone-400 block mt-0.5">
                      {p.area}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Plot Dimensions */}
            <div className="border-t border-stone-100 pt-5 space-y-3">
              <label className="block text-xs font-medium text-stone-700">
                Plot Boundaries
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[11px] text-stone-500 block mb-1">
                    Width (m)
                  </span>
                  <input
                    id="input-plot-width"
                    type="number"
                    min="5"
                    max="40"
                    step="0.5"
                    value={plotWidth}
                    onChange={(e) => setPlotWidth(Math.max(5, Number(e.target.value)))}
                    required
                    className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-xs font-medium text-stone-800 focus:border-stone-900 outline-hidden transition-colors"
                  />
                </div>

                <div>
                  <span className="text-[11px] text-stone-500 block mb-1">
                    Length (m)
                  </span>
                  <input
                    id="input-plot-length"
                    type="number"
                    min="5"
                    max="50"
                    step="0.5"
                    value={plotLength}
                    onChange={(e) => setPlotLength(Math.max(5, Number(e.target.value)))}
                    required
                    className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-xs font-medium text-stone-800 focus:border-stone-900 outline-hidden transition-colors"
                  />
                </div>
              </div>

              <div className="text-xs text-stone-500 flex justify-between pt-1">
                <span>Footprint area</span>
                <span className="font-medium text-stone-800">
                  {(plotWidth * plotLength).toFixed(1)} m² (~{(plotWidth * plotLength * 10.764).toFixed(0)} sq ft)
                </span>
              </div>
            </div>

            {/* Dynamic Room List */}
            <div className="border-t border-stone-100 pt-5">
              <div className="flex items-center justify-between mb-3">
                <label className="text-xs font-medium text-stone-700">
                  Rooms ({rooms.length})
                </label>
                <button
                  type="button"
                  id="btn-add-room"
                  onClick={handleAddRoom}
                  className="inline-flex items-center gap-1 text-xs font-medium text-stone-700 hover:text-stone-900 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Room</span>
                </button>
              </div>

              <div className="border-t border-stone-100 pt-5 space-y-2">
                <label htmlFor="input-floorplan-requirements" className="block text-xs font-medium text-stone-700">
                  User requirements
                </label>
                <textarea
                  id="input-floorplan-requirements"
                  value={userRequirements}
                  onChange={(e) => setUserRequirements(e.target.value)}
                  placeholder="For example: entry from the south, kitchen near living room, privacy for bedrooms, utility access..."
                  rows={3}
                  maxLength={1000}
                  className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-xs text-stone-800 focus:border-stone-900 outline-hidden transition-colors resize-y"
                />
              </div>

              <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
                {rooms.map((room) => (
                  <div
                    key={room.id}
                    className="p-3 bg-stone-50/60 border border-stone-200/70 rounded-xl space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <input
                        type="text"
                        value={room.name}
                        onChange={(e) => handleUpdateRoom(room.id, 'name', e.target.value)}
                        className="text-xs font-medium text-stone-900 bg-transparent border-b border-transparent hover:border-stone-300 focus:border-stone-900 outline-hidden px-1 py-0.5 flex-1"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveRoom(room.id)}
                        disabled={rooms.length <= 1}
                        className="text-stone-400 hover:text-stone-700 p-1 rounded-md transition-colors disabled:opacity-30 cursor-pointer"
                        title="Delete Room"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-[10px] text-stone-400 block mb-0.5">
                          Type
                        </span>
                        <select
                          value={room.type}
                          onChange={(e) => handleUpdateRoom(room.id, 'type', e.target.value)}
                          className="w-full px-2 py-1 bg-white border border-stone-200 rounded-md text-xs text-stone-800 focus:border-stone-900 outline-hidden"
                        >
                          <option value="living">Living & Family</option>
                          <option value="bedroom">Bedroom</option>
                          <option value="kitchen">Kitchen</option>
                          <option value="dining-room">Dining Room</option>
                          <option value="bathroom">Bathroom</option>
                          <option value="office">Office / Study</option>
                          <option value="laundry">Laundry / Utility</option>
                        </select>
                      </div>

                      <div>
                        <span className="text-[10px] text-stone-400 block mb-0.5">
                          Min Area (m²)
                        </span>
                        <input
                          type="number"
                          min="4"
                          max="80"
                          value={room.minSize}
                          onChange={(e) =>
                            handleUpdateRoom(room.id, 'minSize', Math.max(4, Number(e.target.value)))
                          }
                          className="w-full px-2 py-1 bg-white border border-stone-200 rounded-md text-xs text-stone-800 focus:border-stone-900 outline-hidden"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Submit Action */}
            <div className="pt-2">
              <button
                type="submit"
                id="btn-submit-floorplan"
                disabled={isGenerating}
                className="w-full py-2.5 bg-stone-900 hover:bg-stone-800 disabled:bg-stone-300 text-white rounded-lg text-xs font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Generating Blueprint...</span>
                  </>
                ) : (
                  <span>Generate Floor Plan</span>
                )}
              </button>

              {isGenerating && (
                <p className="text-center text-[11px] text-stone-500 mt-2 font-normal">
                  {generationStep}
                </p>
              )}

              {error && (
                <div className="mt-3 p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                  {error}
                </div>
              )}
            </div>
          </form>
        </div>

        {/* Right Column: Blueprint Rendering & Inspector */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white rounded-2xl border border-stone-200/80 p-6 space-y-4">
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-stone-900">
                  Blueprint Preview
                </h3>
                <p className="text-xs text-stone-500">
                  Architectural 2D layout with non-overlapping zones
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowGrid(!showGrid)}
                  className={`px-2.5 py-1 rounded-md border text-xs font-medium transition-colors ${
                    showGrid
                      ? 'bg-stone-100 text-stone-900 border-stone-300'
                      : 'bg-white text-stone-600 border-stone-200'
                  }`}
                >
                  <Grid className="w-3 h-3 inline mr-1" />
                  Grid
                </button>

                <button
                  type="button"
                  onClick={() => setShowDimensions(!showDimensions)}
                  className={`px-2.5 py-1 rounded-md border text-xs font-medium transition-colors ${
                    showDimensions
                      ? 'bg-stone-100 text-stone-900 border-stone-300'
                      : 'bg-white text-stone-600 border-stone-200'
                  }`}
                >
                  Dimensions
                </button>

                {result && (
                  <>
                    <button
                      type="button"
                      id="btn-reset-floorplan-layout"
                      onClick={handleResetLayout}
                      disabled={!originalRooms}
                      title="Restore the originally generated room positions"
                      className="px-2.5 py-1 rounded-md bg-white border border-stone-200 hover:bg-stone-50 disabled:opacity-40 text-stone-700 text-xs font-medium transition-colors flex items-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Reset Layout</span>
                    </button>

                    <button
                      type="button"
                      id="btn-save-floorplan"
                      onClick={() => onSaveProject(result)}
                      className="px-2.5 py-1 rounded-md bg-white border border-stone-200 hover:bg-stone-50 text-stone-800 text-xs font-medium transition-colors flex items-center gap-1"
                    >
                      <BookmarkPlus className="w-3 h-3" />
                      <span>Save</span>
                    </button>

                    <button
                      type="button"
                      id="btn-download-floorplan-png"
                      onClick={handleDownloadFloorPlan}
                      title="Download a clean architectural PNG for floor-plan upload"
                      className="px-2.5 py-1 rounded-md bg-white border border-stone-200 hover:bg-stone-50 text-stone-800 text-xs font-medium transition-colors flex items-center gap-1"
                    >
                      <Download className="w-3 h-3" />
                      <span>Download PNG</span>
                    </button>

                    <button
                      type="button"
                      id="btn-open-floorplan-3d"
                      onClick={() => onView3D(result)}
                      className="px-3 py-1 rounded-md bg-stone-900 hover:bg-stone-800 text-white text-xs font-medium transition-colors flex items-center gap-1"
                    >
                      <Box className="w-3 h-3" />
                      <span>View in 3D</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* SVG Canvas or Blueprint Placeholder */}
            <div
              ref={blueprintRef}
              tabIndex={result ? 0 : -1}
              onKeyDown={handleBlueprintKeyDown}
              className="bg-stone-50/60 border border-stone-200/70 rounded-xl min-h-[400px] flex items-center justify-center p-4 relative overflow-hidden outline-hidden focus-visible:ring-2 focus-visible:ring-stone-400"
            >
              {result ? (
                <div className="w-full flex flex-col items-center">
                  <p className="text-[11px] text-stone-400 mb-2 text-center">
                    Drag a room to reposition it · Click a room, then use arrow keys to nudge (hold Shift for larger steps)
                  </p>
                  <svg
                    ref={svgRef}
                    viewBox={`${plotBBox!.minX - PLAN_MARGIN_M} ${plotBBox!.minY - PLAN_MARGIN_M} ${plotBBox!.width + PLAN_MARGIN_M * 2} ${plotBBox!.height + PLAN_MARGIN_M * 2}`}
                    className="w-full max-h-[480px] border border-stone-200 rounded-lg bg-white"
                    style={{ touchAction: 'none' }}
                  >
                    <defs>
                      <pattern id="cad-grid" width="1" height="1" patternUnits="userSpaceOnUse">
                        <path d="M 1 0 L 0 0 0 1" fill="none" stroke="#f5f5f4" strokeWidth="0.04" />
                      </pattern>
                      {/* Subtle drop shadow beneath the whole plan footprint --
                          kept small so it reads cleanly at both preview and
                          zoomed-in scale instead of smudging fine wall lines. */}
                      <filter id="plan-shadow" x="-20%" y="-20%" width="140%" height="140%">
                        <feDropShadow dx="0" dy="0.05" stdDeviation="0.07" floodColor="#000000" floodOpacity="0.18" />
                      </filter>
                      <FloorPatternDefs />
                    </defs>

                    {/* Backing plate: carries the drop shadow for the whole
                        plan footprint so individual rooms/walls stay crisp. */}
                    <rect
                      x={buildingBBox!.minX}
                      y={buildingBBox!.minY}
                      width={buildingBBox!.width}
                      height={buildingBBox!.height}
                      fill="#ffffff"
                      filter="url(#plan-shadow)"
                    />

                    {/* Faint plot boundary -- kept visible only where it
                        falls within the building-fitted viewBox, as a quiet
                        property-line reference rather than a dominant frame. */}
                    <rect
                      x="0"
                      y="0"
                      width={result.plotWidth}
                      height={result.plotLength}
                      fill="none"
                      stroke="#d6d3d1"
                      strokeWidth="0.03"
                      strokeDasharray="0.2 0.15"
                    />

                    {showGrid && (
                      <rect
                        x={buildingBBox!.minX}
                        y={buildingBBox!.minY}
                        width={buildingBBox!.width}
                        height={buildingBBox!.height}
                        fill="url(#cad-grid)"
                      />
                    )}

                    {/* Open circulation space: no border, matching the
                        reference plan's unbordered hallway -- the
                        surrounding rooms' own walls already read as its
                        boundary. */}
                    {result.circulation?.map((space, index) => (
                      <text
                        key={`circulation-${index}`}
                        x={space.x + space.width / 2}
                        y={space.y + space.height / 2}
                        textAnchor="middle"
                        className="text-[0.3px] font-medium"
                        fill={CIRCULATION_TEXT}
                        pointerEvents="none"
                      >
                        {space.name}
                      </text>
                    ))}

                    {/* Overall dimensions only (total plot width along the
                        top, total height along the left) -- no more
                        per-room dimension chains. */}
                    {showDimensions && (
                      <>
                        {renderOverallDimension(plotBBox!, 'top')}
                        {renderOverallDimension(plotBBox!, 'left')}
                      </>
                    )}

                    {/* Entry marker: a grey landing pad with an inward arrow
                        and "Entry" label, outside whichever exterior wall
                        holds the plan's main entry door. */}
                    {(() => {
                      const entry = findMainEntryDoor(result.rooms, result.plotWidth, result.plotLength);
                      return entry ? <EntryMarkerGroup room={entry.room} door={entry.door} /> : null;
                    })()}

                    {/* Placed Rooms: floor fill + drag hit-target. Walls are
                        rendered as one merged network below (not per room)
                        so a shared edge between two rooms paints once, at
                        its real thickness, instead of each room doubling it
                        up with its own independent wall. */}
                    {result.rooms.map((room) => {
                      const isSelected = selectedRoomId === room.id;
                      const isDragging = draggingRoomId === room.id;
                      return (
                        <g key={room.id}>
                          <rect
                            x={room.x}
                            y={room.y}
                            width={room.width}
                            height={room.height}
                            fill={`url(#${floorPatternIdForRoomType(room.type)})`}
                            stroke="none"
                            className={`transition-colors ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                            onPointerDown={(e) => handleRoomPointerDown(e, room)}
                            onPointerMove={handleRoomPointerMove}
                            onPointerUp={handleRoomPointerUp}
                            onPointerCancel={handleRoomPointerUp}
                          />
                          {/* Selection affordance as a tint overlay, kept
                              separate from the floor pattern so the pattern
                              itself always reads at full, undimmed opacity. */}
                          {isSelected && (
                            <rect
                              x={room.x}
                              y={room.y}
                              width={room.width}
                              height={room.height}
                              fill="#2563eb"
                              fillOpacity="0.12"
                              pointerEvents="none"
                            />
                          )}
                        </g>
                      );
                    })}

                    {/* Merged wall network: filled dark-charcoal bands at
                        real thickness (exterior ~0.23m, interior ~0.12m),
                        with clean corner/T-junction joins from square-capped
                        strokes meeting at shared endpoints, and a genuine
                        gap wherever a door or window opens. */}
                    {buildWallSegments(result.rooms, result.plotWidth, result.plotLength).map((seg, idx) => (
                      <line
                        key={idx}
                        x1={seg.x1}
                        y1={seg.y1}
                        x2={seg.x2}
                        y2={seg.y2}
                        stroke={PLAN_INK}
                        strokeWidth={seg.thickness}
                        strokeLinecap="square"
                        pointerEvents="none"
                      />
                    ))}

                    {/* Per-room overlay: selection outline, door swings,
                        windows, furniture icons and labels -- on top of the
                        wall network so openings and icons stay visible. */}
                    {result.rooms.map((room) => {
                      const isSelected = selectedRoomId === room.id;
                      const area = room.area || Math.round(room.width * room.height * 10) / 10;
                      const areaText = `${area} m²`;
                      const labelCenter = computeRoomLabelCenter(room, areaText);
                      const labelStyle = computeRoomLabelStyle(room, areaText);
                      const placedFurniture = buildPlacedFurnitureForRoom(room, result.plotWidth, result.plotLength);
                      return (
                        <g
                          key={room.id}
                          onPointerDown={(e) => handleRoomPointerDown(e, room)}
                          onPointerMove={handleRoomPointerMove}
                          onPointerUp={handleRoomPointerUp}
                          onPointerCancel={handleRoomPointerUp}
                        >
                          {isSelected && (
                            <rect
                              x={room.x - 0.06}
                              y={room.y - 0.06}
                              width={room.width + 0.12}
                              height={room.height + 0.12}
                              fill="none"
                              stroke="#2563eb"
                              strokeWidth="0.05"
                              strokeDasharray="0.14,0.08"
                              pointerEvents="none"
                            />
                          )}

                          {renderDoorSwing(room)}
                          {renderWindowSymbol(room)}

                          {/* Room-type furniture: filled, individually
                              placed pieces for every room type (see
                              buildPlacedFurnitureForRoom). */}
                          {placedFurniture && (
                            <g pointerEvents="none">
                              {placedFurniture.map((item, idx) => <PlacedFurnitureGroup key={idx} item={item} />)}
                            </g>
                          )}

                          {/* Name centered in a clean sans-serif font, with
                              the approximate area smaller beneath it (omitted
                              entirely, and the name shortened, for very small
                              rooms). The anchor point is picked by
                              computeRoomLabelCenter above to steer clear of
                              furniture and door swings whenever the room has
                              room to do so; text size scales with room size
                              via computeRoomLabelStyle. */}
                          <g className="pointer-events-none select-none font-sans">
                            <text
                              x={labelCenter.x}
                              y={labelCenter.y - (labelStyle.showArea ? labelStyle.areaSizeM * 0.55 : 0)}
                              textAnchor="middle"
                              fontSize={labelStyle.nameSizeM}
                              className="font-semibold fill-stone-900"
                            >
                              {labelStyle.displayName}
                            </text>
                            {labelStyle.showArea && (
                              <text
                                x={labelCenter.x}
                                y={labelCenter.y + labelStyle.nameSizeM * 0.65}
                                textAnchor="middle"
                                fontSize={labelStyle.areaSizeM}
                                className="font-normal fill-stone-500"
                              >
                                {areaText}
                              </text>
                            )}
                          </g>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              ) : (
                <div className="text-center p-8 space-y-2 max-w-xs">
                  <div className="w-10 h-10 rounded-xl bg-stone-100 flex items-center justify-center mx-auto text-stone-400">
                    <Compass className="w-5 h-5" />
                  </div>
                  <h4 className="text-xs font-semibold text-stone-900">
                    Awaiting Generation
                  </h4>
                  <p className="text-xs text-stone-500 leading-relaxed">
                    Set your plot dimensions and room specifications on the left, then click Generate Floor Plan.
                  </p>
                </div>
              )}
            </div>

            {/* Metrics Bar */}
            {result && (
              <div className="pt-2 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-2.5 bg-stone-50 rounded-lg border border-stone-100">
                  <span className="text-[10px] text-stone-400 block">
                    Built Area
                  </span>
                  <span className="text-xs font-semibold text-stone-900">
                    {result.totalBuiltArea} m²
                  </span>
                </div>
                <div className="p-2.5 bg-stone-50 rounded-lg border border-stone-100">
                  <span className="text-[10px] text-stone-400 block">
                    Plot Area
                  </span>
                  <span className="text-xs font-semibold text-stone-900">
                    {result.plotArea ?? (result.plotWidth * result.plotLength).toFixed(1)} m²
                  </span>
                </div>
                <div className="p-2.5 bg-stone-50 rounded-lg border border-stone-100">
                  <span className="text-[10px] text-stone-400 block">
                    Space Utilization
                  </span>
                  <span className="text-xs font-semibold text-stone-900">
                    {computeSpaceUtilization(result)}%
                  </span>
                </div>
                <div className="p-2.5 bg-stone-50 rounded-lg border border-stone-100">
                  <span className="text-[10px] text-stone-400 block">
                    Open Space
                  </span>
                  <span className="text-xs font-semibold text-stone-900">
                    {result.openSpaceArea || (result.plotWidth * result.plotLength - result.totalBuiltArea).toFixed(1)} m²
                  </span>
                </div>
                <div className="p-2.5 bg-stone-50 rounded-lg border border-stone-100">
                  <span className="text-[10px] text-stone-400 block">
                    Style
                  </span>
                  <span className="text-xs font-semibold text-stone-900 truncate block">
                    {result.architecturalStyle || 'Modern'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Architectural Notes & Selected Room Inspector */}
          {result && (
            <div className="bg-white rounded-2xl border border-stone-200/80 p-5 space-y-3">
              <div className="flex items-start gap-2.5">
                <Info className="w-4 h-4 text-stone-400 mt-0.5 shrink-0" />
                <div>
                  <h4 className="text-xs font-semibold text-stone-900">
                    Layout Notes
                  </h4>
                  <p className="text-xs text-stone-500 mt-0.5 leading-relaxed">
                    {result.designNotes ||
                      'Zoning connects the living and kitchen areas while preserving acoustic privacy for bedroom clusters.'}
                  </p>
                </div>
              </div>

              {selectedRoom && (
                <div className="p-3 bg-stone-50 border border-stone-200/70 rounded-xl flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-stone-900">
                      {selectedRoom.name}
                    </span>
                    <span className="text-stone-500 block text-[11px]">
                      {selectedRoom.width}m × {selectedRoom.height}m ({selectedRoom.area || (selectedRoom.width * selectedRoom.height).toFixed(1)} m²)
                    </span>
                  </div>
                  <span className="text-[11px] text-stone-500">
                    Door: {selectedRoom.doorSide || 'standard'}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Manual repositioning tuning (meters): fine grid snap, arrow-key step
// sizes, how close to a plot/room edge a drag snaps flush against it, and
// how much genuine area-overlap (beyond just touching) is tolerated --
// rooms in this layout engine's output tile with zero gap, so without this
// tolerance any drag toward a flush neighbor would be rejected instantly.
const GRID_SNAP = 0.1;
const ARROW_STEP = 0.1;
const ARROW_STEP_SHIFT = 0.5;
const EDGE_SNAP_TOLERANCE = 0.3;
const OVERLAP_TOLERANCE = 0.02;

function snapToGrid(value: number, step: number = GRID_SNAP): number {
  return Math.round(value / step) * step;
}

function roundTo(value: number, decimals: number = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

// Pulls either edge of a room (its start, or start+size) toward the nearest
// snap target -- a plot edge or another room's edge -- when within
// `tolerance`, so dragging a room back next to a neighbor clicks it flush
// instead of leaving a sliver gap or requiring pixel-perfect placement.
function snapAxis(start: number, size: number, targets: number[], tolerance: number): number {
  let best = start;
  let bestDist = tolerance;
  for (const target of targets) {
    const startDist = Math.abs(target - start);
    if (startDist < bestDist) {
      bestDist = startDist;
      best = target;
    }
    const endDist = Math.abs(target - (start + size));
    if (endDist < bestDist) {
      bestDist = endDist;
      best = target - size;
    }
  }
  return best;
}

// Two axis-aligned rectangles overlap only if they intersect by more than
// `tolerance` on both axes -- rooms that merely touch (the normal
// flush-tiled layout) or differ by a hair of rounding noise are not treated
// as a collision.
function rectsOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
  tolerance: number = 1e-6
): boolean {
  const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return overlapX > tolerance && overlapY > tolerance;
}

// Convert a pointer's screen coordinates into the SVG's own user-space
// coordinates (meters), accounting for however the SVG is currently scaled.
function clientToSvgPoint(svg: SVGSVGElement, clientX: number, clientY: number): { x: number; y: number } {
  const point = svg.createSVGPoint();
  point.x = clientX;
  point.y = clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  const transformed = point.matrixTransform(ctm.inverse());
  return { x: transformed.x, y: transformed.y };
}

// Helper: Percentage of the plot actually covered by placed rooms,
// computed directly from the rendered room rectangles (not an AI estimate).
function computeSpaceUtilization(result: FloorPlanResult): number {
  const plotArea = result.plotWidth * result.plotLength;
  if (plotArea <= 0) return 0;

  const roomArea = result.rooms.reduce(
    (sum, room) => sum + (room.area ?? room.width * room.height),
    0
  );

  return Math.round(Math.min(100, (roomArea / plotArea) * 100));
}

// Helper: Render architectural door swing arc on SVG
// Renders every door, each at its own real offset/width (not a recomputed
// arbitrary size) so the swing symbol always lines up with the actual gap
// cut into the wall band above.
// A room's own doors/windows, with the single-opening legacy fields
// (doorSide/windowSide) computed into the same shape on the fly -- so a
// project saved before the multi-opening doors/windows arrays existed still
// renders correctly with no migration needed.
function getRoomDoors(room: FloorPlanRoom): FloorPlanDoor[] {
  return room.doors && room.doors.length ? room.doors : room.doorSide ? [{ side: room.doorSide, offset: 0.3, width: 0.9, swing: 'in' }] : [];
}
function getRoomWindows(room: FloorPlanRoom): FloorPlanWindow[] {
  return room.windows && room.windows.length ? room.windows : room.windowSide ? [{ side: room.windowSide, offset: 0.4, width: 1.2 }] : [];
}

const DOOR_LINE_WIDTH_M = 0.035;

function renderDoorSwing(room: FloorPlanRoom) {
  return <>{getRoomDoors(room).map((door, idx) => renderSingleDoorSwing(room, door, idx))}</>;
}

// Real architectural door symbol: a straight leaf from the hinge jamb and a
// solid quarter-circle arc tracing its swing back to the opposite jamb --
// the wall itself is already cut open here by buildWallSegments, so this is
// drawn into a genuine gap rather than painted over a solid wall.
// Hinge H is the jamb at `offset`; J is the other jamb (doorW further along
// the wall); T is the leaf's open-position tip, doorW from H perpendicular
// to the wall into the room. The leaf is drawn H->T and the arc traces the
// swing from J to T, so leaf and arc share their tip point instead of the
// leaf pointing at an unrelated diagonal corner the arc never touches
// (which is what made the old symbol look like a crossing "X").
function doorSwingGeometry(room: FloorPlanRoom, side: OpeningSide, offset: number, doorW: number) {
  if (side === 'top') {
    const hx = room.x + offset, hy = room.y;
    return { hx, hy, jx: hx + doorW, jy: hy, tx: hx, ty: hy + doorW, sweep: 1 as const };
  }
  if (side === 'bottom') {
    const hx = room.x + offset, hy = room.y + room.height;
    return { hx, hy, jx: hx + doorW, jy: hy, tx: hx, ty: hy - doorW, sweep: 0 as const };
  }
  if (side === 'left') {
    const hx = room.x, hy = room.y + offset;
    return { hx, hy, jx: hx, jy: hy + doorW, tx: hx + doorW, ty: hy, sweep: 0 as const };
  }
  const hx = room.x + room.width, hy = room.y + offset;
  return { hx, hy, jx: hx, jy: hy + doorW, tx: hx - doorW, ty: hy, sweep: 1 as const };
}

function renderSingleDoorSwing(room: FloorPlanRoom, door: { side?: string; offset?: number; width?: number }, key: number) {
  const side = (door.side || 'bottom') as OpeningSide;
  const doorW = door.width ?? 0.9;
  const offset = door.offset ?? 0.3;
  const common = { fill: 'none', stroke: PLAN_INK, strokeWidth: DOOR_LINE_WIDTH_M };
  const { hx, hy, jx, jy, tx, ty, sweep } = doorSwingGeometry(room, side, offset, doorW);
  return (
    <g key={key}>
      <line {...common} x1={hx} y1={hy} x2={tx} y2={ty} />
      <path {...common} d={`M ${jx} ${jy} A ${doorW} ${doorW} 0 0 ${sweep} ${tx} ${ty}`} />
    </g>
  );
}

const WINDOW_FILL_COLOR = '#bfe3f5';
const WINDOW_FRAME_COLOR = '#2d2a26'; // same value as PLAN_INK (declared later in the file)
const WINDOW_GLAZING_COLOR = '#6fa3bd';
const WINDOW_GLAZING_BARS = 2; // 2 bars -> 3 glazing panes, matching the reference

// Renders every window, each at its own real offset/width.
function renderWindowSymbol(room: FloorPlanRoom) {
  return <>{getRoomWindows(room).map((win, idx) => renderSingleWindowSymbol(room, win, idx))}</>;
}

// A real light-blue glazed opening spanning the exterior wall's full
// thickness (windows are always on an exterior wall, which
// buildWallSegments has already cut open here), with a couple of thin
// glazing bars across it instead of the old double-stroke line symbol.
function renderSingleWindowSymbol(room: FloorPlanRoom, win: { side?: string; offset?: number; width?: number }, key: number) {
  const side = win.side as OpeningSide | undefined;
  if (!side) return null;
  const opening = win.width ?? 1.2;
  const offset = win.offset ?? 0.4;
  const t = EXTERIOR_WALL_THICKNESS;

  if (side === 'top' || side === 'bottom') {
    const x = room.x + offset;
    const rectY = (side === 'top' ? room.y : room.y + room.height) - t / 2;
    const bars = Array.from({ length: WINDOW_GLAZING_BARS }, (_, i) => {
      const lx = x + (opening * (i + 1)) / (WINDOW_GLAZING_BARS + 1);
      return <line key={i} x1={lx} y1={rectY} x2={lx} y2={rectY + t} stroke={WINDOW_GLAZING_COLOR} strokeWidth="0.02" />;
    });
    return <g key={key} pointerEvents="none"><rect x={x} y={rectY} width={opening} height={t} fill={WINDOW_FILL_COLOR} stroke={WINDOW_FRAME_COLOR} strokeWidth="0.015" />{bars}</g>;
  }
  const y = room.y + offset;
  const rectX = (side === 'left' ? room.x : room.x + room.width) - t / 2;
  const bars = Array.from({ length: WINDOW_GLAZING_BARS }, (_, i) => {
    const ly = y + (opening * (i + 1)) / (WINDOW_GLAZING_BARS + 1);
    return <line key={i} x1={rectX} y1={ly} x2={rectX + t} y2={ly} stroke={WINDOW_GLAZING_COLOR} strokeWidth="0.02" />;
  });
  return <g key={key} pointerEvents="none"><rect x={rectX} y={y} width={t} height={opening} fill={WINDOW_FILL_COLOR} stroke={WINDOW_FRAME_COLOR} strokeWidth="0.015" />{bars}</g>;
}

type OpeningSide = 'top' | 'bottom' | 'left' | 'right';

// Visual wall thicknesses (metres) used for rendering -- independent of
// whatever thickness value the backend happened to store, so exterior vs.
// interior always reads clearly regardless of the data's own values.
const EXTERIOR_WALL_THICKNESS = 0.23;
const INTERIOR_WALL_THICKNESS = 0.12;
// How close a room's edge has to be to the plot boundary to count as
// "exterior" -- matches the ~0.3m planning margin the backend keeps
// between a room and the true plot edge (server.ts's isPlotExteriorSide).
const PLOT_EDGE_TOLERANCE = 0.35;

function isRoomSideExterior(room: FloorPlanRoom, side: OpeningSide, plotWidth: number, plotLength: number): boolean {
  if (side === 'top') return room.y <= PLOT_EDGE_TOLERANCE;
  if (side === 'bottom') return room.y + room.height >= plotLength - PLOT_EDGE_TOLERANCE;
  if (side === 'left') return room.x <= PLOT_EDGE_TOLERANCE;
  return room.x + room.width >= plotWidth - PLOT_EDGE_TOLERANCE;
}

// Is `other` the room sharing room's given edge? Tolerant of a small
// mismatch (manual dragging in the interactive editor can leave two rooms a
// few centimetres out of exact alignment) rather than requiring an exact
// coordinate match.
function sidesAreAdjacentClient(room: { x: number; y: number; width: number; height: number }, side: OpeningSide, other: { x: number; y: number; width: number; height: number }): boolean {
  const TOUCH_EPS = 0.1;
  const OVERLAP_EPS = 0.02;
  const overlaps1D = (aS: number, aE: number, bS: number, bE: number) => aS < bE - OVERLAP_EPS && aE > bS + OVERLAP_EPS;
  if (side === 'top') return Math.abs(other.y + other.height - room.y) <= TOUCH_EPS && overlaps1D(room.x, room.x + room.width, other.x, other.x + other.width);
  if (side === 'bottom') return Math.abs(other.y - (room.y + room.height)) <= TOUCH_EPS && overlaps1D(room.x, room.x + room.width, other.x, other.x + other.width);
  if (side === 'left') return Math.abs(other.x + other.width - room.x) <= TOUCH_EPS && overlaps1D(room.y, room.y + room.height, other.y, other.y + other.height);
  return Math.abs(other.x - (room.x + room.width)) <= TOUCH_EPS && overlaps1D(room.y, room.y + room.height, other.y, other.y + other.height);
}

function findAdjacentRoom(room: FloorPlanRoom, side: OpeningSide, rooms: FloorPlanRoom[]): FloorPlanRoom | null {
  return rooms.find((other) => other !== room && sidesAreAdjacentClient(room, side, other)) || null;
}

// A door/window's [start, end] in absolute plot coordinates along the axis
// that side runs on (x for top/bottom, y for left/right) -- offsets are
// stored relative to the room's own corner, so converting to absolute
// coordinates is what lets two different rooms' openings on the same shared
// wall be combined correctly regardless of which room's data holds them.
function absoluteOpeningsForSide(room: FloorPlanRoom, side: OpeningSide): [number, number][] {
  const base = side === 'top' || side === 'bottom' ? room.x : room.y;
  const ranges: [number, number][] = [];
  for (const d of getRoomDoors(room)) if (d.side === side) ranges.push([base + (d.offset ?? 0), base + (d.offset ?? 0) + (d.width ?? 0)]);
  for (const w of getRoomWindows(room)) if (w.side === side) ranges.push([base + (w.offset ?? 0), base + (w.offset ?? 0) + (w.width ?? 0)]);
  return ranges;
}

function subtractRanges(start: number, end: number, openings: [number, number][]): [number, number][] {
  const sorted = openings.slice().sort((a, b) => a[0] - b[0]);
  const segments: [number, number][] = [];
  let cursor = start;
  for (const [os, oe] of sorted) {
    const s = Math.max(start, Math.min(end, os));
    const e = Math.max(start, Math.min(end, oe));
    if (s > cursor) segments.push([cursor, s]);
    cursor = Math.max(cursor, e);
  }
  if (cursor < end) segments.push([cursor, end]);
  return segments;
}

interface WallSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  thickness: number;
  isExterior: boolean;
}

const OPPOSITE_SIDE: Record<OpeningSide, OpeningSide> = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };

function sharedEdgeKey(roomA: FloorPlanRoom, side: OpeningSide, roomB: FloorPlanRoom): string {
  const ids = [roomA.id, roomB.id].sort();
  return `${ids[0]}|${ids[1]}|${side === 'top' || side === 'bottom' ? 'h' : 'v'}`;
}

// Builds the whole plan's wall network as centreline segments (drawn with a
// thick, square-capped stroke, so two segments that share an endpoint join
// into one clean corner/T-junction without needing separate corner-fill
// pieces). Two adjacent rooms' shared edge is merged into ONE interior wall
// centred on the party line -- each room used to independently paint its
// own full-thickness wall just outside its own rectangle, which doubled the
// visual thickness of every shared partition. A wall with no neighbouring
// room (the plot's exterior boundary, or an edge facing open circulation
// space) still sits just outside that room's rectangle, exactly as before,
// so a room's stored width/height stay its clear interior dimension. Door
// and window gaps are cut from whichever room's data actually holds them,
// gathered from both sides of a shared wall so it doesn't matter which room
// the opening happens to be stored on.
function buildWallSegments(rooms: FloorPlanRoom[], plotWidth: number, plotLength: number): WallSegment[] {
  const segments: WallSegment[] = [];
  const sharedKeys = new Set<string>();
  const sides: OpeningSide[] = ['top', 'bottom', 'left', 'right'];

  const thicknessFor = (room: FloorPlanRoom, side: OpeningSide) =>
    isRoomSideExterior(room, side, plotWidth, plotLength) ? EXTERIOR_WALL_THICKNESS : INTERIOR_WALL_THICKNESS;

  for (const room of rooms) {
    for (const side of sides) {
      const exterior = isRoomSideExterior(room, side, plotWidth, plotLength);
      const neighbor = exterior ? null : findAdjacentRoom(room, side, rooms);
      const horizontal = side === 'top' || side === 'bottom';
      const perpStart = horizontal ? thicknessFor(room, 'left') : thicknessFor(room, 'top');
      const perpEnd = horizontal ? thicknessFor(room, 'right') : thicknessFor(room, 'bottom');

      let rangeStart: number;
      let rangeEnd: number;
      let openings: [number, number][];
      let fixed: number;
      let thickness: number;

      if (neighbor) {
        const key = sharedEdgeKey(room, side, neighbor);
        if (sharedKeys.has(key)) continue;
        sharedKeys.add(key);
        rangeStart = horizontal ? Math.max(room.x, neighbor.x) : Math.max(room.y, neighbor.y);
        rangeEnd = horizontal ? Math.min(room.x + room.width, neighbor.x + neighbor.width) : Math.min(room.y + room.height, neighbor.y + neighbor.height);
        openings = [...absoluteOpeningsForSide(room, side), ...absoluteOpeningsForSide(neighbor, OPPOSITE_SIDE[side])];
        fixed = side === 'top' ? room.y : side === 'bottom' ? room.y + room.height : side === 'left' ? room.x : room.x + room.width;
        thickness = INTERIOR_WALL_THICKNESS;
      } else {
        rangeStart = horizontal ? room.x : room.y;
        rangeEnd = horizontal ? room.x + room.width : room.y + room.height;
        openings = absoluteOpeningsForSide(room, side);
        thickness = exterior ? EXTERIOR_WALL_THICKNESS : INTERIOR_WALL_THICKNESS;
        fixed = side === 'top' ? room.y - thickness / 2
          : side === 'bottom' ? room.y + room.height + thickness / 2
          : side === 'left' ? room.x - thickness / 2
          : room.x + room.width + thickness / 2;
      }

      if (rangeEnd - rangeStart <= 0.001) continue;

      for (const [s, e] of subtractRanges(rangeStart, rangeEnd, openings)) {
        let start = s;
        let end = e;
        // Extend a piece that touches the room's true corner (not an
        // opening cut) by half the perpendicular wall's thickness, so its
        // square cap has solid wall to butt against instead of leaving a
        // notch at the corner/T-junction.
        if (!neighbor) {
          if (Math.abs(s - rangeStart) < 0.005) start -= perpStart / 2;
          if (Math.abs(e - rangeEnd) < 0.005) end += perpEnd / 2;
        }
        if (end - start <= 0.001) continue;
        segments.push(
          horizontal
            ? { x1: start, y1: fixed, x2: end, y2: fixed, thickness, isExterior: exterior }
            : { x1: fixed, y1: start, x2: fixed, y2: end, thickness, isExterior: exterior }
        );
      }
    }
  }

  return segments;
}

// Shared palette for the architectural plan look: dark charcoal (never pure
// black) for walls and primary text, a muted charcoal for secondary text and
// dimension lines -- used by both the interactive SVG and the
// createArchitecturalPlanSvg export so the two renderers stay visually
// identical.
const PLAN_INK = '#2d2a26';
const PLAN_INK_MUTED = '#6b6660';
const CIRCULATION_TEXT = '#78716c';

// ----------------------------------------------------
// FLOOR PATTERNS
// ----------------------------------------------------
// Subtle, low-contrast SVG pattern fills by room category, replacing the
// old flat pastel room tints so the floor reads as a material instead of a
// colour-coded zone -- walls/doors/furniture stay the visual focus. Defined
// once as plain data (tile size + shapes, all in METRES) so both the
// interactive SVG (meter-space viewBox, rendered directly as JSX) and the
// exported SVG string (pixel-space, scaled by the export's own p() helper)
// render from exactly the same source and can't drift apart.
type FloorPatternShape =
  | { kind: 'line'; x1: number; y1: number; x2: number; y2: number; stroke: string; strokeWidth: number; opacity?: number }
  | { kind: 'rect'; x: number; y: number; width: number; height: number; fill?: string; stroke?: string; strokeWidth?: number; opacity?: number }
  | { kind: 'circle'; cx: number; cy: number; r: number; fill: string; opacity?: number };

interface FloorPatternSpec {
  id: string;
  tileWidth: number;
  tileHeight: number;
  background: string;
  shapes: FloorPatternShape[];
}

const FLOOR_PATTERNS: FloorPatternSpec[] = [
  // Bedrooms & study: warm wood plank rows.
  {
    id: 'floor-wood',
    tileWidth: 1,
    tileHeight: 0.18,
    background: '#ecd9bb',
    shapes: [
      { kind: 'line', x1: 0, y1: 0.18, x2: 1, y2: 0.18, stroke: '#d9c19d', strokeWidth: 0.012 },
      { kind: 'line', x1: 0.5, y1: 0, x2: 0.5, y2: 0.18, stroke: '#d9c19d', strokeWidth: 0.008, opacity: 0.6 },
    ],
  },
  // Living, dining, hallway, entry, balcony: light cream with a faint dot texture.
  {
    id: 'floor-cream',
    tileWidth: 0.4,
    tileHeight: 0.4,
    background: '#f6f0e2',
    shapes: [
      { kind: 'circle', cx: 0.1, cy: 0.1, r: 0.012, fill: '#e8dfcb', opacity: 0.6 },
      { kind: 'circle', cx: 0.3, cy: 0.3, r: 0.012, fill: '#e8dfcb', opacity: 0.6 },
    ],
  },
  // Kitchen: pale tone, small light tile grid.
  {
    id: 'floor-kitchen',
    tileWidth: 0.3,
    tileHeight: 0.3,
    background: '#f2f1ec',
    shapes: [
      { kind: 'rect', x: 0, y: 0, width: 0.3, height: 0.3, fill: 'none', stroke: '#e1ded2', strokeWidth: 0.012 },
    ],
  },
  // Bathrooms & laundry: light blue tile grid.
  {
    id: 'floor-bath',
    tileWidth: 0.25,
    tileHeight: 0.25,
    background: '#dcedf7',
    shapes: [
      { kind: 'rect', x: 0, y: 0, width: 0.25, height: 0.25, fill: 'none', stroke: '#b9d7e8', strokeWidth: 0.015 },
    ],
  },
];

function floorPatternIdForRoomType(type: string | undefined): string {
  const t = String(type || '').toLowerCase();
  if (t.includes('bath') || t.includes('powder') || t.includes('laundry') || t.includes('utility')) return 'floor-bath';
  if (t.includes('kitchen')) return 'floor-kitchen';
  if (t.includes('bed') || t.includes('office')) return 'floor-wood';
  return 'floor-cream'; // living, dining, hallway, balcony, and any other type
}

function FloorPatternDefs() {
  return (
    <>
      {FLOOR_PATTERNS.map((pattern) => (
        <pattern key={pattern.id} id={pattern.id} patternUnits="userSpaceOnUse" width={pattern.tileWidth} height={pattern.tileHeight}>
          <rect width={pattern.tileWidth} height={pattern.tileHeight} fill={pattern.background} />
          {pattern.shapes.map((shape, idx) => {
            if (shape.kind === 'line') return <line key={idx} x1={shape.x1} y1={shape.y1} x2={shape.x2} y2={shape.y2} stroke={shape.stroke} strokeWidth={shape.strokeWidth} opacity={shape.opacity} />;
            if (shape.kind === 'rect') return <rect key={idx} x={shape.x} y={shape.y} width={shape.width} height={shape.height} fill={shape.fill || 'none'} stroke={shape.stroke} strokeWidth={shape.strokeWidth} opacity={shape.opacity} />;
            return <circle key={idx} cx={shape.cx} cy={shape.cy} r={shape.r} fill={shape.fill} opacity={shape.opacity} />;
          })}
        </pattern>
      ))}
    </>
  );
}

// Same patterns as FloorPatternDefs, but scaled into the export's own pixel
// space via its p() helper (patternUnits="userSpaceOnUse" is in whatever
// user-space units the containing <svg> uses -- metres in the interactive
// view, pixels here -- so a 1m tile has to become `p(1)` pixels or it would
// tile at an illegible sub-pixel size).
function floorPatternDefsSvg(p: (value: number) => number): string {
  return FLOOR_PATTERNS.map((pattern) => {
    const shapesSvg = pattern.shapes.map((shape) => {
      if (shape.kind === 'line') {
        return `<line x1="${p(shape.x1)}" y1="${p(shape.y1)}" x2="${p(shape.x2)}" y2="${p(shape.y2)}" stroke="${shape.stroke}" stroke-width="${p(shape.strokeWidth)}"${shape.opacity !== undefined ? ` opacity="${shape.opacity}"` : ''}/>`;
      }
      if (shape.kind === 'rect') {
        const strokeAttr = shape.stroke ? ` stroke="${shape.stroke}" stroke-width="${p(shape.strokeWidth || 0)}"` : '';
        return `<rect x="${p(shape.x)}" y="${p(shape.y)}" width="${p(shape.width)}" height="${p(shape.height)}" fill="${shape.fill || 'none'}"${strokeAttr}${shape.opacity !== undefined ? ` opacity="${shape.opacity}"` : ''}/>`;
      }
      return `<circle cx="${p(shape.cx)}" cy="${p(shape.cy)}" r="${p(shape.r)}" fill="${shape.fill}"${shape.opacity !== undefined ? ` opacity="${shape.opacity}"` : ''}/>`;
    }).join('');
    return `<pattern id="${pattern.id}" patternUnits="userSpaceOnUse" width="${p(pattern.tileWidth)}" height="${p(pattern.tileHeight)}"><rect width="${p(pattern.tileWidth)}" height="${p(pattern.tileHeight)}" fill="${pattern.background}"/>${shapesSvg}</pattern>`;
  }).join('');
}

type IconCategory = 'bedroom' | 'living' | 'kitchen' | 'bathroom' | 'dining' | 'laundry' | 'study' | 'entry';

function classifyRoomForIcons(type: string | undefined): IconCategory | null {
  const t = String(type || '').toLowerCase();
  if (t.includes('bath') || t.includes('powder') || t.includes('toilet') || t.includes('wc')) return 'bathroom';
  if (t.includes('laundry') || t.includes('utility')) return 'laundry';
  if (t.includes('dining')) return 'dining';
  if (t.includes('kitchen')) return 'kitchen';
  if (t.includes('living') || t.includes('family') || t.includes('lounge')) return 'living';
  if (t.includes('office') || t.includes('study')) return 'study';
  if (t.includes('hallway') || t.includes('entry') || t.includes('foyer')) return 'entry';
  if (t.includes('bed')) return 'bedroom';
  return null;
}

// ----------------------------------------------------
// FURNITURE LIBRARY (filled, shaded, wall-anchored placement)
// ----------------------------------------------------
// Every classified room type gets real, individually-placed furniture --
// filled shapes with soft two-tone shading and a thin dark outline,
// matching the reference's rendered-furniture style. The older
// stroke-outline single-icon system this replaced is gone; a room whose
// type classifyRoomForIcons doesn't recognise (e.g. a balcony) simply gets
// no furniture, same as it got no icon before.
//
// A piece is authored once, in local coordinates with its "back" along
// local y=0, as if placed against the room's TOP wall. Placing it against
// a different wall only changes a rotation + an axis-aligned world bbox;
// the shapes themselves are never re-authored per wall (see
// placeAgainstWall / PlacedFurnitureGroup's render transform).

type FurnitureShape =
  | { kind: 'rect'; x: number; y: number; width: number; height: number; rx?: number; fill: string; stroke?: string; strokeWidth?: number; opacity?: number }
  | { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number; fill: string; stroke?: string; strokeWidth?: number; opacity?: number }
  | { kind: 'circle'; cx: number; cy: number; r: number; fill: string; stroke?: string; strokeWidth?: number; opacity?: number }
  | { kind: 'line'; x1: number; y1: number; x2: number; y2: number; stroke: string; strokeWidth: number; opacity?: number };

interface FurniturePieceDef {
  width: number; // along-wall extent when authored (i.e. placed against 'top')
  height: number; // depth into the room when authored
  shapes: FurnitureShape[];
}

// Palette: warm wood for case goods, soft cream/tan upholstery, white/grey
// bathroom fixtures, pale countertop tones -- all kept close in value to
// their neighbours (soft shading, not high contrast) so walls, doors and
// the furniture's own outline stay the dominant linework, per the
// reference.
const WOOD = '#c9a679', WOOD_DARK = '#8a6a45', WOOD_EDGE = '#6b5137';
const FABRIC = '#d7cab5', FABRIC_DARK = '#c2b39c', FABRIC_EDGE = '#6b5a42';
const LINEN = '#eae4d6', LINEN_EDGE = '#6b5a42';
const PILLOW = '#f8f6ef', PILLOW_EDGE = '#cfc7b4';
const FIXTURE = '#f5f5f3', FIXTURE_EDGE = '#9a9a92';
const COUNTER = '#e8e4d8', COUNTER_EDGE = '#8a8276';
const STEEL = '#c7c7c2';
const WATER = '#cfe6f2';

const FURNITURE_PIECES: Record<string, FurniturePieceDef> = {
  'bed-double': {
    width: 1.4, height: 2.0,
    shapes: [
      { kind: 'rect', x: 0, y: 0, width: 1.4, height: 0.1, fill: WOOD_DARK, stroke: WOOD_EDGE, strokeWidth: 0.015 },
      { kind: 'rect', x: 0.03, y: 0.1, width: 1.34, height: 1.87, rx: 0.08, fill: LINEN, stroke: LINEN_EDGE, strokeWidth: 0.02 },
      { kind: 'rect', x: 0.1, y: 1.25, width: 1.2, height: 0.58, rx: 0.06, fill: FABRIC_DARK },
      { kind: 'line', x1: 0.1, y1: 1.25, x2: 1.3, y2: 1.25, stroke: FABRIC_EDGE, strokeWidth: 0.018 },
      { kind: 'rect', x: 0.12, y: 0.17, width: 0.5, height: 0.32, rx: 0.08, fill: PILLOW, stroke: PILLOW_EDGE, strokeWidth: 0.012 },
      { kind: 'rect', x: 0.78, y: 0.17, width: 0.5, height: 0.32, rx: 0.08, fill: PILLOW, stroke: PILLOW_EDGE, strokeWidth: 0.012 },
    ],
  },
  'bed-king': {
    width: 1.8, height: 2.1,
    shapes: [
      { kind: 'rect', x: 0, y: 0, width: 1.8, height: 0.1, fill: WOOD_DARK, stroke: WOOD_EDGE, strokeWidth: 0.015 },
      { kind: 'rect', x: 0.03, y: 0.1, width: 1.74, height: 1.97, rx: 0.08, fill: LINEN, stroke: LINEN_EDGE, strokeWidth: 0.02 },
      { kind: 'rect', x: 0.12, y: 1.32, width: 1.56, height: 0.6, rx: 0.06, fill: FABRIC_DARK },
      { kind: 'line', x1: 0.12, y1: 1.32, x2: 1.68, y2: 1.32, stroke: FABRIC_EDGE, strokeWidth: 0.018 },
      { kind: 'rect', x: 0.16, y: 0.17, width: 0.66, height: 0.34, rx: 0.08, fill: PILLOW, stroke: PILLOW_EDGE, strokeWidth: 0.012 },
      { kind: 'rect', x: 0.98, y: 0.17, width: 0.66, height: 0.34, rx: 0.08, fill: PILLOW, stroke: PILLOW_EDGE, strokeWidth: 0.012 },
    ],
  },
  'bedside-table': {
    width: 0.45, height: 0.4,
    shapes: [
      { kind: 'rect', x: 0, y: 0, width: 0.45, height: 0.4, rx: 0.03, fill: WOOD, stroke: WOOD_DARK, strokeWidth: 0.015 },
      { kind: 'line', x1: 0.06, y1: 0.2, x2: 0.39, y2: 0.2, stroke: WOOD_DARK, strokeWidth: 0.01 },
    ],
  },
  wardrobe: {
    width: 1.2, height: 0.6,
    shapes: [
      { kind: 'rect', x: 0, y: 0, width: 1.2, height: 0.6, fill: WOOD, stroke: WOOD_DARK, strokeWidth: 0.018 },
      { kind: 'line', x1: 0.6, y1: 0.04, x2: 0.6, y2: 0.56, stroke: WOOD_DARK, strokeWidth: 0.012 },
      { kind: 'circle', cx: 0.52, cy: 0.3, r: 0.02, fill: WOOD_EDGE },
      { kind: 'circle', cx: 0.68, cy: 0.3, r: 0.02, fill: WOOD_EDGE },
    ],
  },
  sofa: {
    width: 2.1, height: 0.85,
    shapes: [
      { kind: 'rect', x: 0, y: 0.05, width: 0.16, height: 0.75, rx: 0.05, fill: FABRIC_DARK, stroke: FABRIC_EDGE, strokeWidth: 0.015 },
      { kind: 'rect', x: 1.94, y: 0.05, width: 0.16, height: 0.75, rx: 0.05, fill: FABRIC_DARK, stroke: FABRIC_EDGE, strokeWidth: 0.015 },
      { kind: 'rect', x: 0.1, y: 0, width: 1.9, height: 0.22, rx: 0.04, fill: FABRIC_DARK, stroke: FABRIC_EDGE, strokeWidth: 0.018 },
      { kind: 'rect', x: 0.1, y: 0.18, width: 1.9, height: 0.62, rx: 0.07, fill: FABRIC, stroke: FABRIC_EDGE, strokeWidth: 0.018 },
      { kind: 'line', x1: 0.77, y1: 0.22, x2: 0.77, y2: 0.78, stroke: FABRIC_DARK, strokeWidth: 0.012, opacity: 0.7 },
      { kind: 'line', x1: 1.43, y1: 0.22, x2: 1.43, y2: 0.78, stroke: FABRIC_DARK, strokeWidth: 0.012, opacity: 0.7 },
    ],
  },
  armchair: {
    width: 0.8, height: 0.8,
    shapes: [
      { kind: 'rect', x: 0, y: 0.05, width: 0.14, height: 0.7, rx: 0.05, fill: FABRIC_DARK, stroke: FABRIC_EDGE, strokeWidth: 0.014 },
      { kind: 'rect', x: 0.66, y: 0.05, width: 0.14, height: 0.7, rx: 0.05, fill: FABRIC_DARK, stroke: FABRIC_EDGE, strokeWidth: 0.014 },
      { kind: 'rect', x: 0.08, y: 0, width: 0.64, height: 0.22, rx: 0.04, fill: FABRIC_DARK, stroke: FABRIC_EDGE, strokeWidth: 0.016 },
      { kind: 'rect', x: 0.08, y: 0.18, width: 0.64, height: 0.56, rx: 0.06, fill: FABRIC, stroke: FABRIC_EDGE, strokeWidth: 0.016 },
    ],
  },
  'coffee-table': {
    width: 0.9, height: 0.5,
    shapes: [
      { kind: 'rect', x: 0, y: 0, width: 0.9, height: 0.5, rx: 0.05, fill: WOOD, stroke: WOOD_DARK, strokeWidth: 0.016 },
      { kind: 'rect', x: 0.08, y: 0.08, width: 0.74, height: 0.34, rx: 0.04, fill: '#efe6cf', opacity: 0.8 },
    ],
  },
  rug: {
    width: 2.2, height: 1.6,
    shapes: [
      { kind: 'rect', x: 0, y: 0, width: 2.2, height: 1.6, rx: 0.1, fill: '#ded0b4', stroke: FABRIC_DARK, strokeWidth: 0.015 },
      { kind: 'rect', x: 0.16, y: 0.16, width: 1.88, height: 1.28, rx: 0.08, fill: 'none', stroke: FABRIC_DARK, strokeWidth: 0.01, opacity: 0.6 },
    ],
  },
  'tv-unit': {
    width: 1.4, height: 0.4,
    shapes: [
      { kind: 'rect', x: 0, y: 0, width: 1.4, height: 0.4, fill: WOOD, stroke: WOOD_DARK, strokeWidth: 0.016 },
      { kind: 'line', x1: 0.47, y1: 0.06, x2: 0.47, y2: 0.34, stroke: WOOD_DARK, strokeWidth: 0.01 },
      { kind: 'line', x1: 0.93, y1: 0.06, x2: 0.93, y2: 0.34, stroke: WOOD_DARK, strokeWidth: 0.01 },
    ],
  },
  'counter-sink': {
    width: 2.0, height: 0.6,
    shapes: [
      { kind: 'rect', x: 0, y: 0, width: 2.0, height: 0.6, fill: COUNTER, stroke: COUNTER_EDGE, strokeWidth: 0.018 },
      { kind: 'rect', x: 0.15, y: 0.12, width: 0.5, height: 0.36, rx: 0.04, fill: STEEL, stroke: COUNTER_EDGE, strokeWidth: 0.012 },
      { kind: 'circle', cx: 1.35, cy: 0.18, r: 0.08, fill: '#2d2a26' },
      { kind: 'circle', cx: 1.6, cy: 0.18, r: 0.08, fill: '#2d2a26' },
      { kind: 'circle', cx: 1.35, cy: 0.42, r: 0.08, fill: '#2d2a26' },
      { kind: 'circle', cx: 1.6, cy: 0.42, r: 0.08, fill: '#2d2a26' },
    ],
  },
  'counter-plain': {
    width: 1.2, height: 0.6,
    shapes: [
      { kind: 'rect', x: 0, y: 0, width: 1.2, height: 0.6, fill: COUNTER, stroke: COUNTER_EDGE, strokeWidth: 0.018 },
      { kind: 'line', x1: 0.06, y1: 0.09, x2: 1.14, y2: 0.09, stroke: '#d8d2c2', strokeWidth: 0.01 },
    ],
  },
  'kitchen-island': {
    width: 1.2, height: 0.8,
    shapes: [
      { kind: 'rect', x: 0, y: 0, width: 1.2, height: 0.8, rx: 0.04, fill: COUNTER, stroke: COUNTER_EDGE, strokeWidth: 0.018 },
      { kind: 'rect', x: 0.1, y: 0.1, width: 1.0, height: 0.6, rx: 0.03, fill: 'none', stroke: '#d8d2c2', strokeWidth: 0.01 },
    ],
  },
  toilet: {
    width: 0.45, height: 0.65,
    shapes: [
      { kind: 'rect', x: 0.05, y: 0, width: 0.35, height: 0.2, rx: 0.04, fill: FIXTURE, stroke: FIXTURE_EDGE, strokeWidth: 0.015 },
      { kind: 'ellipse', cx: 0.225, cy: 0.46, rx: 0.2, ry: 0.19, fill: FIXTURE, stroke: FIXTURE_EDGE, strokeWidth: 0.015 },
      { kind: 'ellipse', cx: 0.225, cy: 0.46, rx: 0.11, ry: 0.1, fill: WATER },
    ],
  },
  vanity: {
    width: 0.7, height: 0.45,
    shapes: [
      { kind: 'rect', x: 0, y: 0, width: 0.7, height: 0.45, rx: 0.04, fill: FIXTURE, stroke: FIXTURE_EDGE, strokeWidth: 0.016 },
      { kind: 'ellipse', cx: 0.35, cy: 0.2, rx: 0.22, ry: 0.13, fill: '#ffffff', stroke: FIXTURE_EDGE, strokeWidth: 0.012 },
    ],
  },
  shower: {
    width: 0.9, height: 0.9,
    shapes: [
      { kind: 'rect', x: 0, y: 0, width: 0.9, height: 0.9, fill: '#e5f1f8', stroke: FIXTURE_EDGE, strokeWidth: 0.018 },
      { kind: 'rect', x: 0.1, y: 0.1, width: 0.7, height: 0.7, fill: 'none', stroke: '#b9d7e8', strokeWidth: 0.012 },
      { kind: 'circle', cx: 0.75, cy: 0.15, r: 0.05, fill: FIXTURE_EDGE },
    ],
  },
  tub: {
    width: 1.5, height: 0.7,
    shapes: [
      { kind: 'rect', x: 0, y: 0, width: 1.5, height: 0.7, rx: 0.15, fill: '#f0f7fb', stroke: FIXTURE_EDGE, strokeWidth: 0.018 },
      { kind: 'rect', x: 0.12, y: 0.1, width: 1.26, height: 0.5, rx: 0.12, fill: '#dceef6', stroke: '#b9d7e8', strokeWidth: 0.01 },
    ],
  },
  // Part 2 --------------------------------------------------------------
  // Dining sets are the one piece type NOT authored "back against a wall"
  // -- they're centred in free floor space, chairs on both long sides, so
  // local y=0 is just an arbitrary top edge, not a wall-facing back.
  'dining-set-4': {
    width: 1.8, height: 1.6,
    shapes: [
      { kind: 'rect', x: 0.3, y: 0.45, width: 1.2, height: 0.7, rx: 0.04, fill: WOOD, stroke: WOOD_DARK, strokeWidth: 0.018 },
      { kind: 'rect', x: 0.45, y: 0.05, width: 0.35, height: 0.32, rx: 0.06, fill: FABRIC, stroke: FABRIC_EDGE, strokeWidth: 0.012 },
      { kind: 'rect', x: 1.0, y: 0.05, width: 0.35, height: 0.32, rx: 0.06, fill: FABRIC, stroke: FABRIC_EDGE, strokeWidth: 0.012 },
      { kind: 'rect', x: 0.45, y: 1.23, width: 0.35, height: 0.32, rx: 0.06, fill: FABRIC, stroke: FABRIC_EDGE, strokeWidth: 0.012 },
      { kind: 'rect', x: 1.0, y: 1.23, width: 0.35, height: 0.32, rx: 0.06, fill: FABRIC, stroke: FABRIC_EDGE, strokeWidth: 0.012 },
    ],
  },
  'dining-set-6': {
    width: 2.2, height: 1.6,
    shapes: [
      { kind: 'rect', x: 0.3, y: 0.45, width: 1.6, height: 0.7, rx: 0.04, fill: WOOD, stroke: WOOD_DARK, strokeWidth: 0.018 },
      { kind: 'rect', x: 0.42, y: 0.05, width: 0.32, height: 0.32, rx: 0.06, fill: FABRIC, stroke: FABRIC_EDGE, strokeWidth: 0.012 },
      { kind: 'rect', x: 0.94, y: 0.05, width: 0.32, height: 0.32, rx: 0.06, fill: FABRIC, stroke: FABRIC_EDGE, strokeWidth: 0.012 },
      { kind: 'rect', x: 1.46, y: 0.05, width: 0.32, height: 0.32, rx: 0.06, fill: FABRIC, stroke: FABRIC_EDGE, strokeWidth: 0.012 },
      { kind: 'rect', x: 0.42, y: 1.23, width: 0.32, height: 0.32, rx: 0.06, fill: FABRIC, stroke: FABRIC_EDGE, strokeWidth: 0.012 },
      { kind: 'rect', x: 0.94, y: 1.23, width: 0.32, height: 0.32, rx: 0.06, fill: FABRIC, stroke: FABRIC_EDGE, strokeWidth: 0.012 },
      { kind: 'rect', x: 1.46, y: 1.23, width: 0.32, height: 0.32, rx: 0.06, fill: FABRIC, stroke: FABRIC_EDGE, strokeWidth: 0.012 },
    ],
  },
  desk: {
    width: 1.2, height: 0.65,
    shapes: [
      { kind: 'rect', x: 0, y: 0, width: 1.2, height: 0.5, fill: WOOD, stroke: WOOD_DARK, strokeWidth: 0.018 },
      { kind: 'rect', x: 0.45, y: 0.5, width: 0.4, height: 0.15, rx: 0.05, fill: FABRIC, stroke: FABRIC_EDGE, strokeWidth: 0.012 },
    ],
  },
  bookshelf: {
    width: 1.0, height: 0.35,
    shapes: [
      { kind: 'rect', x: 0, y: 0, width: 1.0, height: 0.35, fill: WOOD, stroke: WOOD_DARK, strokeWidth: 0.016 },
      { kind: 'line', x1: 0.25, y1: 0.04, x2: 0.25, y2: 0.31, stroke: WOOD_DARK, strokeWidth: 0.01 },
      { kind: 'line', x1: 0.5, y1: 0.04, x2: 0.5, y2: 0.31, stroke: WOOD_DARK, strokeWidth: 0.01 },
      { kind: 'line', x1: 0.75, y1: 0.04, x2: 0.75, y2: 0.31, stroke: WOOD_DARK, strokeWidth: 0.01 },
    ],
  },
  washer: {
    width: 0.65, height: 0.65,
    shapes: [
      { kind: 'rect', x: 0, y: 0, width: 0.65, height: 0.65, rx: 0.03, fill: '#e3e1da', stroke: COUNTER_EDGE, strokeWidth: 0.016 },
      { kind: 'circle', cx: 0.325, cy: 0.35, r: 0.22, fill: 'none', stroke: COUNTER_EDGE, strokeWidth: 0.02 },
      { kind: 'circle', cx: 0.325, cy: 0.35, r: 0.14, fill: STEEL, opacity: 0.6 },
    ],
  },
  dryer: {
    width: 0.65, height: 0.65,
    shapes: [
      { kind: 'rect', x: 0, y: 0, width: 0.65, height: 0.65, rx: 0.03, fill: '#ded9c9', stroke: COUNTER_EDGE, strokeWidth: 0.016 },
      { kind: 'circle', cx: 0.325, cy: 0.35, r: 0.22, fill: 'none', stroke: COUNTER_EDGE, strokeWidth: 0.02 },
      { kind: 'circle', cx: 0.325, cy: 0.35, r: 0.14, fill: STEEL, opacity: 0.6 },
    ],
  },
  'laundry-sink': {
    width: 0.5, height: 0.4,
    shapes: [
      { kind: 'rect', x: 0, y: 0, width: 0.5, height: 0.4, rx: 0.03, fill: COUNTER, stroke: COUNTER_EDGE, strokeWidth: 0.015 },
      { kind: 'rect', x: 0.1, y: 0.08, width: 0.3, height: 0.24, rx: 0.03, fill: STEEL, stroke: COUNTER_EDGE, strokeWidth: 0.01 },
    ],
  },
  bench: {
    width: 1.0, height: 0.4,
    shapes: [
      { kind: 'rect', x: 0, y: 0, width: 1.0, height: 0.4, rx: 0.05, fill: WOOD, stroke: WOOD_DARK, strokeWidth: 0.016 },
      { kind: 'rect', x: 0.08, y: 0.06, width: 0.84, height: 0.2, rx: 0.04, fill: FABRIC, opacity: 0.7 },
    ],
  },
  'shoe-rack': {
    width: 0.8, height: 0.3,
    shapes: [
      { kind: 'rect', x: 0, y: 0, width: 0.8, height: 0.3, fill: WOOD, stroke: WOOD_DARK, strokeWidth: 0.014 },
      { kind: 'line', x1: 0, y1: 0.15, x2: 0.8, y2: 0.15, stroke: WOOD_DARK, strokeWidth: 0.01 },
    ],
  },
  plant: {
    width: 0.4, height: 0.4,
    shapes: [
      { kind: 'circle', cx: 0.2, cy: 0.2, r: 0.16, fill: '#e8e1d0', stroke: '#b9ac90', strokeWidth: 0.012 },
      { kind: 'circle', cx: 0.2, cy: 0.2, r: 0.1, fill: '#7a9b6e' },
      { kind: 'circle', cx: 0.14, cy: 0.14, r: 0.05, fill: '#8fae82', opacity: 0.8 },
      { kind: 'circle', cx: 0.26, cy: 0.15, r: 0.045, fill: '#6f8f64', opacity: 0.8 },
    ],
  },
};

// Scales only the along-wall (X) extent of a piece -- used to stretch a
// wardrobe or counter run to fill whatever free wall length is actually
// available, without distorting its depth.
function scalePieceWidth(def: FurniturePieceDef, newWidth: number): FurniturePieceDef {
  const factor = newWidth / def.width;
  const scaleShape = (s: FurnitureShape): FurnitureShape => {
    if (s.kind === 'rect') return { ...s, x: s.x * factor, width: s.width * factor };
    if (s.kind === 'line') return { ...s, x1: s.x1 * factor, x2: s.x2 * factor };
    if (s.kind === 'circle') return { ...s, cx: s.cx * factor };
    return { ...s, cx: s.cx * factor, rx: s.rx * factor };
  };
  return { width: newWidth, height: def.height, shapes: def.shapes.map(scaleShape) };
}

interface PlacedFurniture {
  pieceId: string;
  localWidth: number; // as-authored (or resized) dims, BEFORE rotation
  localHeight: number;
  rotation: 0 | 90 | 180 | 270;
  worldX: number; // final axis-aligned world bbox (AFTER rotation)
  worldY: number;
  shapes: FurnitureShape[];
}

interface Rect { x: number; y: number; width: number; height: number; }

// A piece authored "against the top wall" (back at local y=0) needs this
// rotation to end up with its back against each wall instead.
const WALL_ROTATION: Record<OpeningSide, 0 | 90 | 180 | 270> = { top: 0, right: 90, bottom: 180, left: 270 };

function furnitureBBox(item: PlacedFurniture): Rect {
  const swapped = item.rotation === 90 || item.rotation === 270;
  return {
    x: item.worldX,
    y: item.worldY,
    width: swapped ? item.localHeight : item.localWidth,
    height: swapped ? item.localWidth : item.localHeight,
  };
}

function rectsOverlapPad(a: Rect, b: Rect, pad = 0): boolean {
  return a.x < b.x + b.width + pad && a.x + a.width + pad > b.x && a.y < b.y + b.height + pad && a.y + a.height + pad > b.y;
}

function withinRoom(bbox: Rect, room: FloorPlanRoom): boolean {
  return bbox.x >= room.x - 0.01 && bbox.y >= room.y - 0.01 && bbox.x + bbox.width <= room.x + room.width + 0.01 && bbox.y + bbox.height <= room.y + room.height + 0.01;
}

// Places a piece (its own local width = along-wall extent, height = depth
// into the room) against `wall`, `along` metres from that wall's own start
// corner (top/left corner for top & left walls, matching how door/window
// offsets are already measured elsewhere in this file) -- returns the
// FINAL axis-aligned world bbox (already swapped for a side wall) plus the
// rotation needed to render it there.
function placeAgainstWall(room: FloorPlanRoom, wall: OpeningSide, itemW: number, itemH: number, along: number): { x: number; y: number; width: number; height: number; rotation: 0 | 90 | 180 | 270 } {
  const rotation = WALL_ROTATION[wall];
  if (wall === 'top') return { x: room.x + along, y: room.y, width: itemW, height: itemH, rotation };
  if (wall === 'bottom') return { x: room.x + along, y: room.y + room.height - itemH, width: itemW, height: itemH, rotation };
  if (wall === 'left') return { x: room.x, y: room.y + along, width: itemH, height: itemW, rotation };
  return { x: room.x + room.width - itemH, y: room.y + along, width: itemH, height: itemW, rotation };
}

// Accepts the candidate bbox only if it's within the room, doesn't overlap
// a door/window exclusion zone, and doesn't overlap any item already
// placed -- "never block a door or its swing, never cover a window, never
// overlap furniture" are all enforced here, once, for every piece.
function tryPlace(pieceId: string, def: FurniturePieceDef, bbox: { x: number; y: number; width: number; height: number; rotation: 0 | 90 | 180 | 270 }, room: FloorPlanRoom, obstructions: Rect[], placed: PlacedFurniture[]): PlacedFurniture | null {
  if (!withinRoom(bbox, room)) return null;
  for (const o of obstructions) if (rectsOverlapPad(bbox, o)) return null;
  for (const p of placed) if (rectsOverlapPad(bbox, furnitureBBox(p))) return null;
  return { pieceId, localWidth: def.width, localHeight: def.height, rotation: bbox.rotation, worldX: bbox.x, worldY: bbox.y, shapes: def.shapes };
}

// A door's swing square (matches buildRoomLabelObstructions' approximation)
// plus a little clearance padding -- furniture must stay clear of this, not
// just the literal door gap, to leave the door usable.
function doorExclusionZone(door: { side?: string; offset?: number; width?: number }, roomW: number, roomH: number): Rect {
  const side = (door.side || 'bottom') as OpeningSide;
  const w = (door.width ?? 0.9) + 0.3;
  const o = Math.max(0, (door.offset ?? 0.3) - 0.15);
  if (side === 'top') return { x: o, y: 0, width: w, height: w };
  if (side === 'bottom') return { x: o, y: Math.max(0, roomH - w), width: w, height: w };
  if (side === 'left') return { x: 0, y: o, width: w, height: w };
  return { x: Math.max(0, roomW - w), y: o, width: w, height: w };
}

// A strip along the exterior wall spanning the window, so nothing sits
// directly in front of (covering) it.
function windowExclusionZone(win: { side?: string; offset?: number; width?: number }, roomW: number, roomH: number): Rect | null {
  const side = win.side as OpeningSide | undefined;
  if (!side) return null;
  const w = win.width ?? 1.2;
  const o = win.offset ?? 0.4;
  const depth = 0.45;
  if (side === 'top') return { x: o, y: 0, width: w, height: depth };
  if (side === 'bottom') return { x: o, y: Math.max(0, roomH - depth), width: w, height: depth };
  if (side === 'left') return { x: 0, y: o, width: depth, height: w };
  return { x: Math.max(0, roomW - depth), y: o, width: depth, height: w };
}

function roomObstructionsWorld(room: FloorPlanRoom): Rect[] {
  const list: Rect[] = [];
  for (const d of getRoomDoors(room)) {
    const z = doorExclusionZone(d, room.width, room.height);
    list.push({ x: z.x + room.x, y: z.y + room.y, width: z.width, height: z.height });
  }
  for (const w of getRoomWindows(room)) {
    const z = windowExclusionZone(w, room.width, room.height);
    if (z) list.push({ x: z.x + room.x, y: z.y + room.y, width: z.width, height: z.height });
  }
  return list;
}

const OPPOSITE_WALL: Record<OpeningSide, OpeningSide> = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };
const ALL_WALLS: OpeningSide[] = ['top', 'bottom', 'left', 'right'];

function wallLengthOf(room: FloorPlanRoom, wall: OpeningSide): number {
  return wall === 'top' || wall === 'bottom' ? room.width : room.height;
}
function perpLengthOf(room: FloorPlanRoom, wall: OpeningSide): number {
  return wall === 'top' || wall === 'bottom' ? room.height : room.width;
}

// Bedroom: bed against the wall opposite the door (falling back to a side
// wall, then the door's own wall, if it doesn't fit there), bedside tables
// flanking it, and a wardrobe along a different wall sized to whatever free
// run is available. Returns null if even the bed alone can't fit anywhere
// with a 0.6m walkway left over, so the caller can fall back to the old
// single-icon system for a closet-sized room.
function placeBedroomFurniture(room: FloorPlanRoom): PlacedFurniture[] | null {
  const bedDef = FURNITURE_PIECES[room.type === 'master-bedroom' ? 'bed-king' : 'bed-double'];
  const doorSide = (getRoomDoors(room)[0]?.side || 'bottom') as OpeningSide;
  const obstructions = roomObstructionsWorld(room);
  const placed: PlacedFurniture[] = [];
  const wallOrder: OpeningSide[] = [OPPOSITE_WALL[doorSide], ...ALL_WALLS.filter((s) => s !== doorSide && s !== OPPOSITE_WALL[doorSide]), doorSide];

  let bed: PlacedFurniture | null = null;
  let bedWall: OpeningSide | null = null;
  for (const wall of wallOrder) {
    const wallLen = wallLengthOf(room, wall);
    const perpLen = perpLengthOf(room, wall);
    if (bedDef.width > wallLen || perpLen - bedDef.height < 0.6) continue;
    const centered = (wallLen - bedDef.width) / 2;
    for (const along of [centered, 0.1, Math.max(0.1, wallLen - bedDef.width - 0.1)]) {
      const bbox = placeAgainstWall(room, wall, bedDef.width, bedDef.height, along);
      const result = tryPlace('bed', bedDef, bbox, room, obstructions, placed);
      if (result) { bed = result; bedWall = wall; break; }
    }
    if (bed) break;
  }
  if (!bed || !bedWall) return null;
  placed.push(bed);

  // Bedside tables flanking the headboard.
  const tableDef = FURNITURE_PIECES['bedside-table'];
  const bedBBox = furnitureBBox(bed);
  const horizontal = bedWall === 'top' || bedWall === 'bottom';
  const wallLen = wallLengthOf(room, bedWall);
  const bedAlongStart = (horizontal ? bedBBox.x - room.x : bedBBox.y - room.y);
  const bedAlongSize = horizontal ? bedBBox.width : bedBBox.height;
  for (const along of [bedAlongStart - tableDef.width - 0.05, bedAlongStart + bedAlongSize + 0.05]) {
    if (along < 0 || along + tableDef.width > wallLen) continue;
    const bbox = placeAgainstWall(room, bedWall, tableDef.width, tableDef.height, along);
    const result = tryPlace('bedside-table', tableDef, bbox, room, obstructions, placed);
    if (result) placed.push(result);
  }

  // Wardrobe along a different wall, stretched to fit whatever run is free.
  const wardrobeDef = FURNITURE_PIECES.wardrobe;
  for (const wall of ALL_WALLS.filter((s) => s !== bedWall)) {
    const wl = wallLengthOf(room, wall);
    const pl = perpLengthOf(room, wall);
    if (pl - wardrobeDef.height < 0.6) continue;
    const width = Math.min(wardrobeDef.width, wl - 0.3);
    if (width < 0.7) continue;
    const scaled = scalePieceWidth(wardrobeDef, width);
    const bbox = placeAgainstWall(room, wall, width, wardrobeDef.height, (wl - width) / 2);
    const result = tryPlace('wardrobe', scaled, bbox, room, obstructions, placed);
    if (result) { placed.push(result); break; }
  }

  addCornerPlants(room, placed, obstructions, 1);
  return placed;
}

// Living room: sofa against the wall opposite the door, TV unit facing it,
// coffee table in front of the sofa, an armchair in a free corner, and a
// rug under the coffee table (checked only against doors/windows, not
// other furniture, since a rug is meant to sit under a table/sofa). Drop
// order when space is tight: rug, then armchair (sofa/table/TV are kept as
// long as the sofa itself fits at all).
function placeLivingFurniture(room: FloorPlanRoom): PlacedFurniture[] | null {
  const sofaDef = FURNITURE_PIECES.sofa;
  const doorSide = (getRoomDoors(room)[0]?.side || 'bottom') as OpeningSide;
  const obstructions = roomObstructionsWorld(room);
  const placed: PlacedFurniture[] = [];
  const wallOrder: OpeningSide[] = [OPPOSITE_WALL[doorSide], ...ALL_WALLS.filter((s) => s !== doorSide && s !== OPPOSITE_WALL[doorSide]), doorSide];

  let sofa: PlacedFurniture | null = null;
  let sofaWall: OpeningSide | null = null;
  for (const wall of wallOrder) {
    const wallLen = wallLengthOf(room, wall);
    const perpLen = perpLengthOf(room, wall);
    if (sofaDef.width > wallLen || perpLen - sofaDef.height < 0.6) continue;
    const bbox = placeAgainstWall(room, wall, sofaDef.width, sofaDef.height, (wallLen - sofaDef.width) / 2);
    const result = tryPlace('sofa', sofaDef, bbox, room, obstructions, placed);
    if (result) { sofa = result; sofaWall = wall; break; }
  }
  if (!sofa || !sofaWall) return null;
  placed.push(sofa);
  const sofaBBox = furnitureBBox(sofa);

  // TV unit on the opposite wall.
  const tvDef = FURNITURE_PIECES['tv-unit'];
  const tvWall = OPPOSITE_WALL[sofaWall];
  const tvWallLen = wallLengthOf(room, tvWall);
  if (tvDef.width <= tvWallLen) {
    const bbox = placeAgainstWall(room, tvWall, tvDef.width, tvDef.height, (tvWallLen - tvDef.width) / 2);
    const result = tryPlace('tv-unit', tvDef, bbox, room, obstructions, placed);
    if (result) placed.push(result);
  }

  // Coffee table out from the sofa, toward the room's centre.
  const tableDef = FURNITURE_PIECES['coffee-table'];
  const gap = 0.3;
  const tableBBox: Rect =
    sofaWall === 'top' ? { x: sofaBBox.x + (sofaBBox.width - tableDef.width) / 2, y: sofaBBox.y + sofaBBox.height + gap, width: tableDef.width, height: tableDef.height }
    : sofaWall === 'bottom' ? { x: sofaBBox.x + (sofaBBox.width - tableDef.width) / 2, y: sofaBBox.y - gap - tableDef.height, width: tableDef.width, height: tableDef.height }
    : sofaWall === 'left' ? { x: sofaBBox.x + sofaBBox.width + gap, y: sofaBBox.y + (sofaBBox.height - tableDef.height) / 2, width: tableDef.width, height: tableDef.height }
    : { x: sofaBBox.x - gap - tableDef.width, y: sofaBBox.y + (sofaBBox.height - tableDef.height) / 2, width: tableDef.width, height: tableDef.height };
  const tableResult = tryPlace('coffee-table', tableDef, { ...tableBBox, rotation: 0 }, room, obstructions, placed);
  if (tableResult) placed.push(tableResult);

  // Armchair in a free corner (any wall other than the sofa's own).
  const chairDef = FURNITURE_PIECES.armchair;
  for (const wall of ALL_WALLS.filter((s) => s !== sofaWall)) {
    const wallLen = wallLengthOf(room, wall);
    const perpLen = perpLengthOf(room, wall);
    if (chairDef.width > wallLen || perpLen - chairDef.height < 0.6) continue;
    let placedChair: PlacedFurniture | null = null;
    for (const along of [0.1, Math.max(0.1, wallLen - chairDef.width - 0.1)]) {
      const bbox = placeAgainstWall(room, wall, chairDef.width, chairDef.height, along);
      const result = tryPlace('armchair', chairDef, bbox, room, obstructions, placed);
      if (result) { placedChair = result; break; }
    }
    if (placedChair) { placed.push(placedChair); break; }
  }

  // Rug under the coffee table -- lowest priority, and deliberately only
  // checked against doors/windows/room bounds (not other furniture), since
  // a rug is meant to sit under the coffee table and sofa feet.
  const rugDef = FURNITURE_PIECES.rug;
  const rugBBox: Rect =
    sofaWall === 'top' ? { x: sofaBBox.x + sofaBBox.width / 2 - rugDef.width / 2, y: sofaBBox.y + sofaBBox.height + 0.15, width: rugDef.width, height: rugDef.height }
    : sofaWall === 'bottom' ? { x: sofaBBox.x + sofaBBox.width / 2 - rugDef.width / 2, y: sofaBBox.y - 0.15 - rugDef.height, width: rugDef.width, height: rugDef.height }
    : sofaWall === 'left' ? { x: sofaBBox.x + sofaBBox.width + 0.15, y: sofaBBox.y + sofaBBox.height / 2 - rugDef.height / 2, width: rugDef.width, height: rugDef.height }
    : { x: sofaBBox.x - 0.15 - rugDef.width, y: sofaBBox.y + sofaBBox.height / 2 - rugDef.height / 2, width: rugDef.width, height: rugDef.height };
  if (withinRoom(rugBBox, room) && !obstructions.some((o) => rectsOverlapPad(rugBBox, o))) {
    placed.unshift({ pieceId: 'rug', localWidth: rugDef.width, localHeight: rugDef.height, rotation: 0, worldX: rugBBox.x, worldY: rugBBox.y, shapes: rugDef.shapes });
  }

  addCornerPlants(room, placed, obstructions, 2);
  return placed;
}

// Kitchen: a sink+cooktop counter run along the longest free wall (sized to
// that wall), a second plain counter along an adjacent wall if there's room
// (the "L" in "linear or L-shaped"), and an island only if the room is
// roomy enough to keep a clear walkway all the way around it.
function placeKitchenFurniture(room: FloorPlanRoom): PlacedFurniture[] | null {
  const obstructions = roomObstructionsWorld(room);
  const placed: PlacedFurniture[] = [];
  const doorSide = (getRoomDoors(room)[0]?.side || 'bottom') as OpeningSide;

  const sinkDef = FURNITURE_PIECES['counter-sink'];
  const wallsByLength = [...ALL_WALLS].sort((a, b) => wallLengthOf(room, b) - wallLengthOf(room, a));
  let primaryWall: OpeningSide | null = null;
  for (const wall of wallsByLength) {
    const wallLen = wallLengthOf(room, wall);
    const perpLen = perpLengthOf(room, wall);
    if (perpLen - sinkDef.height < 0.6) continue;
    const width = Math.min(sinkDef.width, wallLen - 0.3);
    if (width < 1.2) continue;
    const scaled = scalePieceWidth(sinkDef, width);
    const bbox = placeAgainstWall(room, wall, width, sinkDef.height, (wallLen - width) / 2);
    const result = tryPlace('counter-sink', scaled, bbox, room, obstructions, placed);
    if (result) { placed.push(result); primaryWall = wall; break; }
  }
  if (!primaryWall) return null;

  const plainDef = FURNITURE_PIECES['counter-plain'];
  for (const wall of ALL_WALLS.filter((s) => s !== primaryWall && s !== OPPOSITE_WALL[primaryWall!])) {
    const wallLen = wallLengthOf(room, wall);
    const perpLen = perpLengthOf(room, wall);
    if (perpLen - plainDef.height < 0.6) continue;
    const width = Math.min(plainDef.width, wallLen - 0.3);
    if (width < 0.7) continue;
    const scaled = scalePieceWidth(plainDef, width);
    const bbox = placeAgainstWall(room, wall, width, plainDef.height, 0.1);
    const result = tryPlace('counter-plain', scaled, bbox, room, obstructions, placed);
    if (result) { placed.push(result); break; }
  }

  if (room.width * room.height >= 16) {
    const islandDef = FURNITURE_PIECES['kitchen-island'];
    const clearance = 0.6;
    const bbox = { x: room.x + room.width / 2 - islandDef.width / 2, y: room.y + room.height / 2 - islandDef.height / 2, width: islandDef.width, height: islandDef.height, rotation: 0 as const };
    const expanded = { x: bbox.x - clearance, y: bbox.y - clearance, width: bbox.width + clearance * 2, height: bbox.height + clearance * 2 };
    if (withinRoom(expanded, room)) {
      const result = tryPlace('kitchen-island', islandDef, bbox, room, obstructions, placed);
      if (result) placed.push(result);
    }
  }

  void doorSide; // kitchens don't special-case the door wall beyond the normal exclusion zone
  return placed;
}

// Bathroom: toilet, vanity+sink, and a tub (if the room is roomy enough) or
// otherwise a shower stall. Exterior walls are tried before an interior
// (shared) one, and each fixture prefers whichever candidate wall has had
// the fewest fixtures placed on it so far -- without this, two adjacent
// bathrooms in a shallow row both gravitate to the same wall nearest their
// shared partition and end up visually clustered together instead of
// reading as two distinct rooms. plotWidth/plotLength are optional only so
// buildRoomLabelObstructions (which doesn't have them handy) can still get
// an approximate furniture layout for label-avoidance purposes; the real
// render paths always pass them.
function placeBathroomFurniture(room: FloorPlanRoom, plotWidth?: number, plotLength?: number): PlacedFurniture[] | null {
  const obstructions = roomObstructionsWorld(room);
  const placed: PlacedFurniture[] = [];
  const doorSide = (getRoomDoors(room)[0]?.side || 'bottom') as OpeningSide;
  const exteriorWalls = plotWidth !== undefined && plotLength !== undefined
    ? ALL_WALLS.filter((s) => isRoomSideExterior(room, s, plotWidth, plotLength))
    : ALL_WALLS;
  const rank = (s: OpeningSide) => (s === doorSide ? 2 : exteriorWalls.includes(s) ? 0 : 1);
  const wallOrder = [...ALL_WALLS].sort((a, b) => rank(a) - rank(b));
  const wallUseCounts = new Map<OpeningSide, number>();

  const place = (pieceId: string): PlacedFurniture | null => {
    const def = FURNITURE_PIECES[pieceId];
    const sorted = [...wallOrder].sort((a, b) => rank(a) - rank(b) || (wallUseCounts.get(a) || 0) - (wallUseCounts.get(b) || 0));
    for (const wall of sorted) {
      const wallLen = wallLengthOf(room, wall);
      const perpLen = perpLengthOf(room, wall);
      if (def.width > wallLen || perpLen - def.height < 0.5) continue;
      for (const along of [0.08, (wallLen - def.width) / 2, Math.max(0.08, wallLen - def.width - 0.08)]) {
        if (along < 0 || along + def.width > wallLen) continue;
        const bbox = placeAgainstWall(room, wall, def.width, def.height, along);
        const result = tryPlace(pieceId, def, bbox, room, obstructions, placed);
        if (result) {
          wallUseCounts.set(wall, (wallUseCounts.get(wall) || 0) + 1);
          return result;
        }
      }
    }
    return null;
  };

  const toilet = place('toilet');
  if (toilet) placed.push(toilet);
  const vanity = place('vanity');
  if (vanity) placed.push(vanity);
  const wetFixture = room.width * room.height >= 5.5 ? (place('tub') || place('shower')) : place('shower');
  if (wetFixture) placed.push(wetFixture);

  if (!toilet && !vanity && !wetFixture) return null;
  return placed;
}

// Dining: a table+chairs set (6 chairs once the room is roomy, otherwise
// 4), centred in whatever floor space is left clear of doors/windows --
// the one furniture group that isn't wall-anchored, since a dining set
// belongs in the middle of the room, not against a wall.
function placeDiningFurniture(room: FloorPlanRoom): PlacedFurniture[] {
  const obstructions = roomObstructionsWorld(room);
  const placed: PlacedFurniture[] = [];
  const preferredId = room.width * room.height >= 14 ? 'dining-set-6' : 'dining-set-4';

  const tryCenterSet = (id: string): PlacedFurniture | null => {
    const def = FURNITURE_PIECES[id];
    if (def.width + 0.6 > room.width || def.height + 0.6 > room.height) return null;
    const bbox = { x: room.x + (room.width - def.width) / 2, y: room.y + (room.height - def.height) / 2, width: def.width, height: def.height, rotation: 0 as const };
    return tryPlace(id, def, bbox, room, obstructions, placed);
  };

  const result = tryCenterSet(preferredId) || (preferredId === 'dining-set-6' ? tryCenterSet('dining-set-4') : null);
  if (result) placed.push(result);

  addCornerPlants(room, placed, obstructions, 2);
  return placed;
}

// Study/office: a desk (with its chair) against one wall, a bookshelf
// against a different wall.
function placeStudyFurniture(room: FloorPlanRoom): PlacedFurniture[] {
  const obstructions = roomObstructionsWorld(room);
  const placed: PlacedFurniture[] = [];
  const doorSide = (getRoomDoors(room)[0]?.side || 'bottom') as OpeningSide;
  const wallOrder: OpeningSide[] = [OPPOSITE_WALL[doorSide], ...ALL_WALLS.filter((s) => s !== doorSide && s !== OPPOSITE_WALL[doorSide]), doorSide];

  const deskDef = FURNITURE_PIECES.desk;
  let deskWall: OpeningSide | null = null;
  for (const wall of wallOrder) {
    const wallLen = wallLengthOf(room, wall);
    const perpLen = perpLengthOf(room, wall);
    if (deskDef.width > wallLen || perpLen - deskDef.height < 0.6) continue;
    const bbox = placeAgainstWall(room, wall, deskDef.width, deskDef.height, (wallLen - deskDef.width) / 2);
    const result = tryPlace('desk', deskDef, bbox, room, obstructions, placed);
    if (result) { placed.push(result); deskWall = wall; break; }
  }

  const shelfDef = FURNITURE_PIECES.bookshelf;
  for (const wall of ALL_WALLS.filter((s) => s !== deskWall)) {
    const wallLen = wallLengthOf(room, wall);
    const perpLen = perpLengthOf(room, wall);
    if (shelfDef.width > wallLen || perpLen - shelfDef.height < 0.6) continue;
    const bbox = placeAgainstWall(room, wall, shelfDef.width, shelfDef.height, 0.1);
    const result = tryPlace('bookshelf', shelfDef, bbox, room, obstructions, placed);
    if (result) { placed.push(result); break; }
  }

  return placed;
}

// Laundry/utility: washer and dryer side by side against one wall, a small
// sink against a different wall if there's room for it.
function placeLaundryFurniture(room: FloorPlanRoom): PlacedFurniture[] {
  const obstructions = roomObstructionsWorld(room);
  const placed: PlacedFurniture[] = [];
  const doorSide = (getRoomDoors(room)[0]?.side || 'bottom') as OpeningSide;
  const wallOrder: OpeningSide[] = [OPPOSITE_WALL[doorSide], ...ALL_WALLS.filter((s) => s !== doorSide && s !== OPPOSITE_WALL[doorSide]), doorSide];

  const washerDef = FURNITURE_PIECES.washer;
  const dryerDef = FURNITURE_PIECES.dryer;
  const pairWidth = washerDef.width + dryerDef.width + 0.04;
  let pairWall: OpeningSide | null = null;
  for (const wall of wallOrder) {
    const wallLen = wallLengthOf(room, wall);
    const perpLen = perpLengthOf(room, wall);
    if (pairWidth > wallLen || perpLen - washerDef.height < 0.6) continue;
    const along = (wallLen - pairWidth) / 2;
    const washerBbox = placeAgainstWall(room, wall, washerDef.width, washerDef.height, along);
    const washerResult = tryPlace('washer', washerDef, washerBbox, room, obstructions, placed);
    if (!washerResult) continue;
    const dryerBbox = placeAgainstWall(room, wall, dryerDef.width, dryerDef.height, along + washerDef.width + 0.04);
    const dryerResult = tryPlace('dryer', dryerDef, dryerBbox, room, obstructions, [...placed, washerResult]);
    if (dryerResult) { placed.push(washerResult, dryerResult); pairWall = wall; break; }
  }

  const sinkDef = FURNITURE_PIECES['laundry-sink'];
  for (const wall of ALL_WALLS.filter((s) => s !== pairWall)) {
    const wallLen = wallLengthOf(room, wall);
    const perpLen = perpLengthOf(room, wall);
    if (sinkDef.width > wallLen || perpLen - sinkDef.height < 0.6) continue;
    const bbox = placeAgainstWall(room, wall, sinkDef.width, sinkDef.height, 0.1);
    const result = tryPlace('laundry-sink', sinkDef, bbox, room, obstructions, placed);
    if (result) { placed.push(result); break; }
  }

  return placed;
}

// Entry/foyer: a bench, or otherwise a shoe rack, along a wall -- only
// attempted at all once the room is big enough to take one comfortably.
function placeEntryFurniture(room: FloorPlanRoom): PlacedFurniture[] {
  const obstructions = roomObstructionsWorld(room);
  const placed: PlacedFurniture[] = [];
  if (room.width * room.height < 3) return placed;
  const doorSide = (getRoomDoors(room)[0]?.side || 'bottom') as OpeningSide;
  const wallOrder: OpeningSide[] = [OPPOSITE_WALL[doorSide], ...ALL_WALLS.filter((s) => s !== doorSide && s !== OPPOSITE_WALL[doorSide])];

  for (const pieceId of ['bench', 'shoe-rack']) {
    const def = FURNITURE_PIECES[pieceId];
    let placedItem: PlacedFurniture | null = null;
    for (const wall of wallOrder) {
      const wallLen = wallLengthOf(room, wall);
      const perpLen = perpLengthOf(room, wall);
      if (def.width > wallLen || perpLen - def.height < 0.6) continue;
      const bbox = placeAgainstWall(room, wall, def.width, def.height, (wallLen - def.width) / 2);
      const result = tryPlace(pieceId, def, bbox, room, obstructions, placed);
      if (result) { placedItem = result; break; }
    }
    if (placedItem) { placed.push(placedItem); break; }
  }
  return placed;
}

// Tucks a plant into up to `maxCount` of the room's corners, skipping any
// corner that's already occupied (by an obstruction or another placed
// item) -- called last, after every higher-priority piece, so a tight room
// naturally ends up with fewer (or no) plants instead of them displacing
// anything else. The lowest-priority item, per the drop order.
function addCornerPlants(room: FloorPlanRoom, placed: PlacedFurniture[], obstructions: Rect[], maxCount: number): void {
  const def = FURNITURE_PIECES.plant;
  const inset = 0.1;
  const corners: { x: number; y: number }[] = [
    { x: room.x + inset, y: room.y + inset },
    { x: room.x + room.width - inset - def.width, y: room.y + inset },
    { x: room.x + inset, y: room.y + room.height - inset - def.height },
    { x: room.x + room.width - inset - def.width, y: room.y + room.height - inset - def.height },
  ];
  let count = 0;
  for (const corner of corners) {
    if (count >= maxCount) break;
    const bbox = { x: corner.x, y: corner.y, width: def.width, height: def.height, rotation: 0 as const };
    const result = tryPlace('plant', def, bbox, room, obstructions, placed);
    if (result) { placed.push(result); count++; }
  }
}

function buildPlacedFurnitureForRoom(room: FloorPlanRoom, plotWidth?: number, plotLength?: number): PlacedFurniture[] | null {
  const category = classifyRoomForIcons(room.type);
  if (category === 'bedroom') return placeBedroomFurniture(room);
  if (category === 'living') return placeLivingFurniture(room);
  if (category === 'kitchen') return placeKitchenFurniture(room);
  if (category === 'bathroom') return placeBathroomFurniture(room, plotWidth, plotLength);
  if (category === 'dining') return placeDiningFurniture(room);
  if (category === 'study') return placeStudyFurniture(room);
  if (category === 'laundry') return placeLaundryFurniture(room);
  if (category === 'entry') return placeEntryFurniture(room);
  return null; // balcony and anything else: no furniture
}

function renderFurnitureShapeJSX(shape: FurnitureShape, key: number) {
  if (shape.kind === 'rect') return <rect key={key} x={shape.x} y={shape.y} width={shape.width} height={shape.height} rx={shape.rx} fill={shape.fill} stroke={shape.stroke} strokeWidth={shape.strokeWidth} opacity={shape.opacity} />;
  if (shape.kind === 'ellipse') return <ellipse key={key} cx={shape.cx} cy={shape.cy} rx={shape.rx} ry={shape.ry} fill={shape.fill} stroke={shape.stroke} strokeWidth={shape.strokeWidth} opacity={shape.opacity} />;
  if (shape.kind === 'circle') return <circle key={key} cx={shape.cx} cy={shape.cy} r={shape.r} fill={shape.fill} stroke={shape.stroke} strokeWidth={shape.strokeWidth} opacity={shape.opacity} />;
  return <line key={key} x1={shape.x1} y1={shape.y1} x2={shape.x2} y2={shape.y2} stroke={shape.stroke} strokeWidth={shape.strokeWidth} opacity={shape.opacity} />;
}

// Renders a placed item's local shapes rotated/translated into its final
// world position -- the rotation happens around the LOCAL footprint's own
// centre, which maps to the same world point regardless of rotation, so
// translating to (worldCenter - localSize/2) and rotating around
// (localSize/2) always lands the piece exactly on its computed bbox.
function PlacedFurnitureGroup({ item }: { item: PlacedFurniture }) {
  const bbox = furnitureBBox(item);
  const centerX = bbox.x + bbox.width / 2;
  const centerY = bbox.y + bbox.height / 2;
  const tx = centerX - item.localWidth / 2;
  const ty = centerY - item.localHeight / 2;
  return (
    <g transform={`translate(${tx} ${ty}) rotate(${item.rotation} ${item.localWidth / 2} ${item.localHeight / 2})`}>
      {item.shapes.map((s, idx) => renderFurnitureShapeJSX(s, idx))}
    </g>
  );
}

interface LabelObstruction {
  x: number;
  y: number;
  width: number;
  height: number;
}

// The room-type furniture icon's bounding box, plus an approximate
// door-swing obstruction square at each door's position, in plot
// coordinates -- the set of things a centered room label must avoid.
function buildRoomLabelObstructions(room: FloorPlanRoom): LabelObstruction[] {
  const obstructions: LabelObstruction[] = [];

  const placedFurniture = buildPlacedFurnitureForRoom(room);
  if (placedFurniture) {
    for (const item of placedFurniture) obstructions.push(furnitureBBox(item));
  }

  // Each door's swing sweeps roughly a doorWidth x doorWidth square inward
  // from its wall position (matching the quarter-circle arc drawn by
  // renderDoorSwing/door() closely enough for avoidance purposes).
  (room.doors || []).forEach((d) => {
    const side = (d.side || 'bottom') as OpeningSide;
    const doorW = d.width ?? 0.9;
    const offset = d.offset ?? 0.3;
    if (side === 'top') obstructions.push({ x: room.x + offset, y: room.y, width: doorW, height: doorW });
    else if (side === 'bottom') obstructions.push({ x: room.x + offset, y: room.y + room.height - doorW, width: doorW, height: doorW });
    else if (side === 'left') obstructions.push({ x: room.x, y: room.y + offset, width: doorW, height: doorW });
    else obstructions.push({ x: room.x + room.width - doorW, y: room.y + offset, width: doorW, height: doorW });
  });

  return obstructions;
}

function labelRectsOverlap(a: LabelObstruction, b: LabelObstruction): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

// Font sizes (metres, matching the interactive SVG's viewBox units -- the
// export converts through its own p() helper) scale with the room's
// shorter dimension, same ratio the export used on its own before this was
// shared: clamp(min, max, shorterSide / 5). Below LABEL_HIDE_AREA_BELOW_M2
// the area line is dropped entirely; below LABEL_SHORTEN_BELOW_M (or the
// same small-area threshold) the name itself is truncated to whatever
// roughly fits across the room's own width, so a label never visually
// overflows a small room.
const LABEL_NAME_SIZE_MAX_M = 0.4;
const LABEL_NAME_SIZE_MIN_M = 0.2;
const LABEL_AREA_SIZE_MIN_M = 0.13;
const LABEL_CHAR_WIDTH_FACTOR = 0.58;
const LABEL_HIDE_AREA_BELOW_M2 = 3;
const LABEL_SHORTEN_BELOW_M = 1.6;

function computeRoomLabelStyle(room: FloorPlanRoom, areaText: string): { nameSizeM: number; areaSizeM: number; showArea: boolean; displayName: string } {
  const minDim = Math.min(room.width, room.height);
  let nameSizeM = Math.max(LABEL_NAME_SIZE_MIN_M, Math.min(LABEL_NAME_SIZE_MAX_M, minDim / 5));
  const area = room.area ?? room.width * room.height;
  const showArea = area >= LABEL_HIDE_AREA_BELOW_M2;
  const availableWidth = room.width * 0.85;
  const displayName = room.name;
  const widthAt = (size: number) => displayName.length * LABEL_CHAR_WIDTH_FACTOR * size;

  // A room doesn't have to be narrow to have a name too long for it --
  // "Laundry / Utility" overflows a perfectly normal-sized room just from
  // sheer character count. Shrink the font first (down to the minimum)
  // whenever the full name doesn't fit at the room-size-driven font size.
  if (widthAt(nameSizeM) > availableWidth) {
    nameSizeM = Math.max(LABEL_NAME_SIZE_MIN_M, availableWidth / (displayName.length * LABEL_CHAR_WIDTH_FACTOR));
  }

  // Only once shrinking the font can't make it fit (or the room is simply
  // too small/too narrow for a name at all) do we fall back to a shortened
  // name instead.
  let shortName = displayName;
  if (minDim < LABEL_SHORTEN_BELOW_M || !showArea || widthAt(nameSizeM) > availableWidth) {
    const maxChars = Math.max(4, Math.floor(availableWidth / (nameSizeM * LABEL_CHAR_WIDTH_FACTOR)));
    if (shortName.length > maxChars) shortName = `${shortName.slice(0, Math.max(3, maxChars - 1))}…`;
  }

  return { nameSizeM, areaSizeM: Math.max(LABEL_AREA_SIZE_MIN_M, nameSizeM * 0.6), showArea, displayName: shortName };
}

// Approximate footprint (in metres) of the stacked name + area label block,
// used only to decide where it can fit without touching furniture/doors --
// not meant to be pixel-exact, just a conservative estimate.
function estimateLabelFootprint(style: { nameSizeM: number; areaSizeM: number; showArea: boolean; displayName: string }, areaText: string): { width: number; height: number } {
  const nameWidth = style.displayName.length * LABEL_CHAR_WIDTH_FACTOR * style.nameSizeM;
  const areaWidth = style.showArea ? areaText.length * LABEL_CHAR_WIDTH_FACTOR * style.areaSizeM : 0;
  return {
    width: Math.max(nameWidth, areaWidth) * 1.08,
    height: style.nameSizeM * 1.25 + (style.showArea ? style.areaSizeM * 1.25 : 0),
  };
}

// Picks where the name+area label should sit inside a room so it never
// overlaps furniture or a door swing. Tries the true room centre first
// (standard convention), then a few alternative vertical positions, and
// only falls back to the centre anyway if every candidate is obstructed
// (keeping the label somewhere sane rather than disappearing).
function computeRoomLabelCenter(room: FloorPlanRoom, areaText: string): { x: number; y: number } {
  const style = computeRoomLabelStyle(room, areaText);
  const { width: labelW, height: labelH } = estimateLabelFootprint(style, areaText);
  const obstructions = buildRoomLabelObstructions(room);
  const cx = room.x + room.width / 2;
  // Ordered nearest-to-centre-first so the label prefers the conventional
  // middle of the room whenever that's clear, but dense enough to still
  // find a narrow clear strip when furniture covers most of the room.
  const verticalFractions = [0.5, 0.4, 0.6, 0.3, 0.7, 0.2, 0.8, 0.15, 0.85, 0.1, 0.9];

  for (const frac of verticalFractions) {
    const cy = room.y + room.height * frac;
    const box: LabelObstruction = { x: cx - labelW / 2, y: cy - labelH / 2, width: labelW, height: labelH };
    const fitsInRoom = box.x >= room.x && box.x + box.width <= room.x + room.width && box.y >= room.y && box.y + box.height <= room.y + room.height;
    if (!fitsInRoom) continue;
    if (!obstructions.some((o) => labelRectsOverlap(box, o))) return { x: cx, y: cy };
  }
  return { x: cx, y: room.y + room.height / 2 };
}

// ----------------------------------------------------
// ANNOTATIONS: overall dimensions + entry marker
// ----------------------------------------------------
// Plot-wide margin (metres) around the interactive viewBox -- large enough
// that the overall dimension line + its label, AND the entry marker's
// landing pad + arrow + text (on whichever exterior wall the main door
// happens to be on), are never clipped regardless of which side they land
// on. The export's own pixel margin is independently generous enough
// already (checked against this same geometry at its smallest effective
// scale), so only the interactive viewBox needs this constant.
const PLAN_MARGIN_M = 1.6;

interface BuildingBBox { minX: number; minY: number; width: number; height: number; }

// The smallest axis-aligned box containing every room and circulation
// space -- used to fit the view (and the overall dimension lines) to the
// actual built mass instead of the whole plot, since a plan's building no
// longer always fills the full plot (stepped/L footprints intentionally
// leave yard outside it). Shared by the interactive view (which fits its
// viewBox to this box) and the export (which converts it into pixel space).
function getBuildingBoundingBox(rooms: FloorPlanRoom[], circulation?: { x: number; y: number; width: number; height: number }[]): BuildingBBox {
  const rects: { x: number; y: number; width: number; height: number }[] = [...rooms, ...(circulation || [])];
  if (!rects.length) return { minX: 0, minY: 0, width: 0, height: 0 };
  const minX = Math.min(...rects.map((r) => r.x));
  const minY = Math.min(...rects.map((r) => r.y));
  const maxX = Math.max(...rects.map((r) => r.x + r.width));
  const maxY = Math.max(...rects.map((r) => r.y + r.height));
  return { minX, minY, width: maxX - minX, height: maxY - minY };
}

type Axis = 'x' | 'y';
interface Line2D { x1: number; y1: number; x2: number; y2: number; }
interface ArrowTip { x: number; y: number; pointDir: 1 | -1; axis: Axis; }

// Geometry for one arrowhead triangle: a tip point plus two base points,
// still in whatever coordinate space the caller's ArrowTip was expressed
// in -- the interactive renderer draws these directly as metres, the
// export renderer runs them through its own p()+margin transform.
const ARROW_LEN = 0.16;
const ARROW_WIDTH = 0.075;

function arrowheadPoints(tip: ArrowTip): { tipX: number; tipY: number; b1X: number; b1Y: number; b2X: number; b2Y: number } {
  if (tip.axis === 'x') {
    const baseX = tip.x - tip.pointDir * ARROW_LEN;
    return { tipX: tip.x, tipY: tip.y, b1X: baseX, b1Y: tip.y - ARROW_WIDTH, b2X: baseX, b2Y: tip.y + ARROW_WIDTH };
  }
  const baseY = tip.y - tip.pointDir * ARROW_LEN;
  return { tipX: tip.x, tipY: tip.y, b1X: tip.x - ARROW_WIDTH, b1Y: baseY, b2X: tip.x + ARROW_WIDTH, b2Y: baseY };
}

const OVERALL_DIM_OFFSET = 0.75;
const OVERALL_DIM_WITNESS_GAP = 0.12;
const OVERALL_DIM_LABEL_GAP = 0.16;

interface OverallDimensionGeometry {
  witnessStart: Line2D;
  witnessEnd: Line2D;
  mainLine: Line2D;
  arrowStart: ArrowTip;
  arrowEnd: ArrowTip;
  labelX: number;
  labelY: number;
  labelRotation: number;
  label: string;
}

// A single overall-span dimension (the BUILDING's width along the top edge,
// its height along the left edge -- not the whole plot, which can now be
// larger than the built mass) with arrowheads at both ends -- replaces the
// old per-room dimension chains, which is the one thing that changes with
// the layout; this reads only the building bounding box, so it's identical
// regardless of how the rooms inside are arranged.
function buildOverallDimensionGeometry(bbox: BuildingBBox, edge: 'top' | 'left'): OverallDimensionGeometry {
  const { minX, minY, width, height } = bbox;
  if (edge === 'top') {
    const lineY = minY - OVERALL_DIM_OFFSET;
    return {
      witnessStart: { x1: minX, y1: minY - OVERALL_DIM_WITNESS_GAP, x2: minX, y2: lineY },
      witnessEnd: { x1: minX + width, y1: minY - OVERALL_DIM_WITNESS_GAP, x2: minX + width, y2: lineY },
      mainLine: { x1: minX, y1: lineY, x2: minX + width, y2: lineY },
      arrowStart: { x: minX, y: lineY, pointDir: -1, axis: 'x' },
      arrowEnd: { x: minX + width, y: lineY, pointDir: 1, axis: 'x' },
      labelX: minX + width / 2,
      labelY: lineY - OVERALL_DIM_LABEL_GAP,
      labelRotation: 0,
      label: `${width.toFixed(2)} m`,
    };
  }
  const lineX = minX - OVERALL_DIM_OFFSET;
  return {
    witnessStart: { x1: minX - OVERALL_DIM_WITNESS_GAP, y1: minY, x2: lineX, y2: minY },
    witnessEnd: { x1: minX - OVERALL_DIM_WITNESS_GAP, y1: minY + height, x2: lineX, y2: minY + height },
    mainLine: { x1: lineX, y1: minY, x2: lineX, y2: minY + height },
    arrowStart: { x: lineX, y: minY, pointDir: -1, axis: 'y' },
    arrowEnd: { x: lineX, y: minY + height, pointDir: 1, axis: 'y' },
    labelX: lineX - OVERALL_DIM_LABEL_GAP,
    labelY: minY + height / 2,
    labelRotation: -90,
    label: `${height.toFixed(2)} m`,
  };
}

function renderOverallDimension(bbox: BuildingBBox, edge: 'top' | 'left') {
  const g = buildOverallDimensionGeometry(bbox, edge);
  const a1 = arrowheadPoints(g.arrowStart);
  const a2 = arrowheadPoints(g.arrowEnd);
  const labelTransform = g.labelRotation ? `rotate(${g.labelRotation}, ${g.labelX}, ${g.labelY})` : undefined;
  return (
    <g stroke={PLAN_INK_MUTED} fill="none">
      <line {...g.witnessStart} strokeWidth="0.022" />
      <line {...g.witnessEnd} strokeWidth="0.022" />
      <line {...g.mainLine} strokeWidth="0.03" />
      <path d={`M ${a1.tipX} ${a1.tipY} L ${a1.b1X} ${a1.b1Y} L ${a1.b2X} ${a1.b2Y} Z`} fill={PLAN_INK_MUTED} stroke="none" />
      <path d={`M ${a2.tipX} ${a2.tipY} L ${a2.b1X} ${a2.b1Y} L ${a2.b2X} ${a2.b2Y} Z`} fill={PLAN_INK_MUTED} stroke="none" />
      <text x={g.labelX} y={g.labelY} textAnchor="middle" stroke="none" fill={PLAN_INK_MUTED} className="text-[0.32px] font-semibold" transform={labelTransform}>
        {g.label}
      </text>
    </g>
  );
}

const ENTRY_PAD_DEPTH = 0.6;
const ENTRY_PAD_EXTRA_WIDTH = 0.3;
const ENTRY_WALL_GAP = 0.1;
const ENTRY_PAD_FILL = '#d9d6cd';

interface EntryMarkerGeometry {
  pad: { x: number; y: number; width: number; height: number };
  arrowShaft: Line2D;
  arrowTip: ArrowTip;
  textX: number;
  textY: number;
}

// The main entry: the door the backend explicitly flagged (isMainEntry,
// set by server.ts's ensureMainEntryDoor -- every freshly generated plan
// has exactly one). Old saved projects from before that flag existed won't
// have one, so fall back to the previous heuristic -- the first door found
// on a genuinely exterior wall -- computed on the fly here rather than
// requiring a data migration.
function findMainEntryDoor(rooms: FloorPlanRoom[], plotWidth: number, plotLength: number): { room: FloorPlanRoom; door: FloorPlanDoor } | null {
  for (const room of rooms) {
    for (const door of getRoomDoors(room)) {
      if (door.isMainEntry) return { room, door };
    }
  }
  for (const room of rooms) {
    for (const door of getRoomDoors(room)) {
      const side = (door.side || 'bottom') as OpeningSide;
      if (isRoomSideExterior(room, side, plotWidth, plotLength)) return { room, door };
    }
  }
  return null;
}

// A landing pad centred on the door, just outside its exterior wall, with
// an arrow pointing inward (toward the door) and room for an "Entry" label
// -- oriented to whichever side the door is actually on via a single
// outward-normal sign per side, rather than four separately-derived cases.
function buildEntryMarkerGeometry(room: FloorPlanRoom, door: { side?: string; offset?: number; width?: number }): EntryMarkerGeometry {
  const side = (door.side || 'bottom') as OpeningSide;
  const doorW = door.width ?? 0.9;
  const offset = door.offset ?? 0.3;
  const padWidth = doorW + ENTRY_PAD_EXTRA_WIDTH;

  const horizontalWall = side === 'top' || side === 'bottom';
  const normalSign: 1 | -1 = side === 'bottom' || side === 'right' ? 1 : -1;
  const wallPos = side === 'top' ? room.y : side === 'bottom' ? room.y + room.height : side === 'left' ? room.x : room.x + room.width;
  const center = horizontalWall ? room.x + offset + doorW / 2 : room.y + offset + doorW / 2;

  const padStart = Math.min(wallPos, wallPos + normalSign * ENTRY_PAD_DEPTH);
  const pad = horizontalWall
    ? { x: center - padWidth / 2, y: padStart, width: padWidth, height: ENTRY_PAD_DEPTH }
    : { x: padStart, y: center - padWidth / 2, width: ENTRY_PAD_DEPTH, height: padWidth };

  const tipPos = wallPos + normalSign * ENTRY_WALL_GAP;
  const shaftFarPos = wallPos + normalSign * (ENTRY_PAD_DEPTH - 0.08);
  const pointDir = (-normalSign) as 1 | -1;
  const axis: Axis = horizontalWall ? 'y' : 'x';

  const arrowShaft: Line2D = horizontalWall
    ? { x1: center, y1: shaftFarPos, x2: center, y2: tipPos }
    : { x1: shaftFarPos, y1: center, x2: tipPos, y2: center };
  const arrowTip: ArrowTip = horizontalWall ? { x: center, y: tipPos, pointDir, axis } : { x: tipPos, y: center, pointDir, axis };

  const textPos = wallPos + normalSign * (ENTRY_PAD_DEPTH - 0.16);
  return {
    pad,
    arrowShaft,
    arrowTip,
    textX: horizontalWall ? center : textPos,
    textY: horizontalWall ? textPos : center,
  };
}

function EntryMarkerGroup({ room, door }: { room: FloorPlanRoom; door: { side?: string; offset?: number; width?: number } }) {
  const g = buildEntryMarkerGeometry(room, door);
  const a = arrowheadPoints(g.arrowTip);
  return (
    <g pointerEvents="none">
      <rect x={g.pad.x} y={g.pad.y} width={g.pad.width} height={g.pad.height} rx="0.05" fill={ENTRY_PAD_FILL} stroke={PLAN_INK_MUTED} strokeWidth="0.015" />
      <line x1={g.arrowShaft.x1} y1={g.arrowShaft.y1} x2={g.arrowShaft.x2} y2={g.arrowShaft.y2} stroke={PLAN_INK_MUTED} strokeWidth="0.03" />
      <path d={`M ${a.tipX} ${a.tipY} L ${a.b1X} ${a.b1Y} L ${a.b2X} ${a.b2Y} Z`} fill={PLAN_INK_MUTED} />
      <text x={g.textX} y={g.textY} textAnchor="middle" className="text-[0.22px] font-semibold" fill={PLAN_INK_MUTED}>
        Entry
      </text>
    </g>
  );
}

/**
 * Renders the generated geometry as a conventional black-and-white plan.
 * This is deliberately independent of the interactive SVG: selections,
 * drag affordances and coloured room fills never leak into a file intended
 * for an image-based floor-plan processor.
 */
function createArchitecturalPlanSvg(result: FloorPlanResult): string {
  // Fit the canvas and scale to the BUILDING's own bounding box, not the
  // whole plot -- see getBuildingBoundingBox. px()/py() then convert an
  // absolute plot-space coordinate into this canvas's pixel space, shifted
  // by the building's own origin instead of the plot's (0,0).
  const buildingBBox = getBuildingBoundingBox(result.rooms, result.circulation);
  const pxPerMeter = Math.max(42, Math.min(72, 1800 / Math.max(buildingBBox.width, buildingBBox.height)));
  const margin = 140;
  const planW = Math.round(buildingBBox.width * pxPerMeter);
  const planH = Math.round(buildingBBox.height * pxPerMeter);
  const canvasW = planW + margin * 2;
  const canvasH = planH + margin * 2 + 70;
  const p = (value: number) => Number((value * pxPerMeter).toFixed(1));
  const px = (value: number) => margin + p(value - buildingBBox.minX);
  const py = (value: number) => margin + p(value - buildingBBox.minY);
  const esc = (value: string) => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[char] || char));
  const title = `${result.plotWidth}m × ${result.plotLength}m FLOOR PLAN`;
  const plotArea = result.plotArea ?? Math.round(result.plotWidth * result.plotLength * 10) / 10;

  const line = (x1: number, y1: number, x2: number, y2: number, width = 3) =>
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${PLAN_INK}" stroke-width="${width}" stroke-linecap="square"/>`;

  // The merged wall network -- one segment per shared edge instead of each
  // room painting its own, with real gaps already cut for every door and
  // window (see buildWallSegments). Computed once for the whole plan.
  const wallsSvg = buildWallSegments(result.rooms, result.plotWidth, result.plotLength)
    .map((seg) => `<line x1="${px(seg.x1)}" y1="${py(seg.y1)}" x2="${px(seg.x2)}" y2="${py(seg.y2)}" stroke="${PLAN_INK}" stroke-width="${p(seg.thickness)}" stroke-linecap="square"/>`)
    .join('');

  // Real architectural door symbol: a straight leaf from the hinge jamb and
  // a solid quarter-circle swing arc, drawn into the genuine wall gap
  // buildWallSegments already cut.
  const doorLineWidthPx = p(DOOR_LINE_WIDTH_M);
  const door = (room: FloorPlanRoom, doorOpening: { side?: string; offset?: number; width?: number }) => {
    const side = (doorOpening.side || 'bottom') as OpeningSide;
    const width = p(doorOpening.width ?? 0.9);
    const offset = p(doorOpening.offset ?? 0.3);
    const pseudoRoom = { x: px(room.x), y: py(room.y), width: p(room.width), height: p(room.height) } as FloorPlanRoom;
    const { hx, hy, jx, jy, tx, ty, sweep } = doorSwingGeometry(pseudoRoom, side, offset, width);
    return `<line x1="${hx}" y1="${hy}" x2="${tx}" y2="${ty}" stroke="${PLAN_INK}" stroke-width="${doorLineWidthPx}"/>
      <path d="M ${jx} ${jy} A ${width} ${width} 0 0 ${sweep} ${tx} ${ty}" fill="none" stroke="${PLAN_INK}" stroke-width="${doorLineWidthPx}"/>`;
  };

  // A real light-blue glazed opening spanning the exterior wall's full
  // thickness, with a couple of thin glazing bars -- matches the reference
  // plan's window style instead of the old double-stroke line symbol.
  const windowSymbol = (room: FloorPlanRoom, win: { side?: string; offset?: number; width?: number }) => {
    const side = win.side as OpeningSide | undefined;
    if (!side) return '';
    const x = px(room.x);
    const y = py(room.y);
    const w = p(room.width);
    const h = p(room.height);
    const opening = p(win.width ?? 1.2);
    const offset = p(win.offset ?? 0.4);
    const t = p(EXTERIOR_WALL_THICKNESS);
    const barAt = (ratio: number) => offset + opening * ratio;
    const bars = [1, 2, 3].map((n) => barAt(n / (WINDOW_GLAZING_BARS + 1)));
    if (side === 'top' || side === 'bottom') {
      const start = x + offset;
      const rectY = (side === 'top' ? y : y + h) - t / 2;
      const glazing = bars.slice(0, WINDOW_GLAZING_BARS).map((bo) => `<line x1="${x + bo}" y1="${rectY}" x2="${x + bo}" y2="${rectY + t}" stroke="${WINDOW_GLAZING_COLOR}" stroke-width="1"/>`).join('');
      return `<rect x="${start}" y="${rectY}" width="${opening}" height="${t}" fill="${WINDOW_FILL_COLOR}" stroke="${WINDOW_FRAME_COLOR}" stroke-width="0.8"/>${glazing}`;
    }
    const start = y + offset;
    const rectX = (side === 'left' ? x : x + w) - t / 2;
    const glazing = bars.slice(0, WINDOW_GLAZING_BARS).map((bo) => `<line x1="${rectX}" y1="${y + bo}" x2="${rectX + t}" y2="${y + bo}" stroke="${WINDOW_GLAZING_COLOR}" stroke-width="1"/>`).join('');
    return `<rect x="${rectX}" y="${start}" width="${t}" height="${opening}" fill="${WINDOW_FILL_COLOR}" stroke="${WINDOW_FRAME_COLOR}" stroke-width="0.8"/>${glazing}`;
  };

  // Filled, individually-placed furniture for every room type (see
  // buildPlacedFurnitureForRoom), using the SAME item definitions and
  // placement as the interactive view, scaled into this export's pixel
  // space.
  const furnitureShapeSvg = (shape: FurnitureShape): string => {
    const strokeAttr = shape.stroke ? ` stroke="${shape.stroke}" stroke-width="${p(shape.strokeWidth || 0)}"` : '';
    const opacityAttr = shape.opacity !== undefined ? ` opacity="${shape.opacity}"` : '';
    if (shape.kind === 'rect') {
      const rxAttr = shape.rx ? ` rx="${p(shape.rx)}"` : '';
      return `<rect x="${p(shape.x)}" y="${p(shape.y)}" width="${p(shape.width)}" height="${p(shape.height)}"${rxAttr} fill="${shape.fill}"${strokeAttr}${opacityAttr}/>`;
    }
    if (shape.kind === 'ellipse') return `<ellipse cx="${p(shape.cx)}" cy="${p(shape.cy)}" rx="${p(shape.rx)}" ry="${p(shape.ry)}" fill="${shape.fill}"${strokeAttr}${opacityAttr}/>`;
    if (shape.kind === 'circle') return `<circle cx="${p(shape.cx)}" cy="${p(shape.cy)}" r="${p(shape.r)}" fill="${shape.fill}"${strokeAttr}${opacityAttr}/>`;
    return `<line x1="${p(shape.x1)}" y1="${p(shape.y1)}" x2="${p(shape.x2)}" y2="${p(shape.y2)}" stroke="${shape.stroke}" stroke-width="${p(shape.strokeWidth)}"${opacityAttr}/>`;
  };
  const placedFurnitureSvg = (item: PlacedFurniture): string => {
    const bbox = furnitureBBox(item);
    const centerXPx = px(bbox.x) + p(bbox.width) / 2;
    const centerYPx = py(bbox.y) + p(bbox.height) / 2;
    const localWPx = p(item.localWidth);
    const localHPx = p(item.localHeight);
    const tx = centerXPx - localWPx / 2;
    const ty = centerYPx - localHPx / 2;
    return `<g transform="translate(${tx} ${ty}) rotate(${item.rotation} ${localWPx / 2} ${localHPx / 2})">${item.shapes.map(furnitureShapeSvg).join('')}</g>`;
  };
  const furniture = result.rooms.map((room) => {
    const placedFurniture = buildPlacedFurnitureForRoom(room, result.plotWidth, result.plotLength);
    return placedFurniture ? placedFurniture.map(placedFurnitureSvg).join('') : '';
  }).join('');

  // Open circulation space: no border, matching the reference plan's
  // unbordered hallway -- the surrounding rooms' own walls already read as
  // its boundary.
  const circulation = (result.circulation || []).map((space) => {
    const x = px(space.x);
    const y = py(space.y);
    const w = p(space.width);
    const h = p(space.height);
    return `<text x="${x + w / 2}" y="${y + h / 2}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="10" fill="${CIRCULATION_TEXT}">${esc(space.name)}</text>`;
  }).join('');

  // Floor fills first, then the merged wall network on top, then doors/
  // windows/labels on top of that -- otherwise a room's own floor rect
  // would paint over the inner half of a shared wall centred on its
  // boundary. Each room's floor is a low-contrast pattern fill by room
  // type (see FLOOR_PATTERNS) instead of a flat colour.
  const roomFloors = result.rooms.map((room) => {
    const x = px(room.x);
    const y = py(room.y);
    const w = p(room.width);
    const h = p(room.height);
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#${floorPatternIdForRoomType(room.type)})"/>`;
  }).join('');

  const roomOverlay = result.rooms.map((room) => {
    const area = room.area ?? Math.round(room.width * room.height * 10) / 10;
    const areaText = `${area} m²`;
    // Same label sizing/shortening and obstruction-avoiding anchor the
    // interactive editor uses (computeRoomLabelStyle / computeRoomLabelCenter),
    // just converted from plot metres into this export's pixel space.
    const style = computeRoomLabelStyle(room, areaText);
    const nameSize = p(style.nameSizeM);
    const detailsSize = p(style.areaSizeM);
    const labelCenterM = computeRoomLabelCenter(room, areaText);
    const labelCx = px(labelCenterM.x);
    const labelCyBase = py(labelCenterM.y);
    const nameY = labelCyBase - (style.showArea ? detailsSize * 0.55 : 0);
    const areaLabelSvg = style.showArea
      ? `<text x="${labelCx}" y="${labelCyBase + nameSize * 0.65}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${detailsSize}" fill="${PLAN_INK_MUTED}">${esc(areaText)}</text>`
      : '';
    return `<g>
      ${getRoomDoors(room).map((d) => door(room, d)).join('')}
      ${getRoomWindows(room).map((win) => windowSymbol(room, win)).join('')}
      <text x="${labelCx}" y="${nameY}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${nameSize}" font-weight="700" fill="${PLAN_INK}">${esc(style.displayName)}</text>
      ${areaLabelSvg}
    </g>`;
  }).join('');

  // Overall dimension (the BUILDING's width along the top, its height along
  // the left -- not the whole plot) with arrowheads at both ends -- the SAME
  // geometry builder the interactive view uses (buildOverallDimensionGeometry),
  // just scaled through this export's p()+margin instead of drawn directly
  // in metres.
  const overallDimensionSvg = (edge: 'top' | 'left'): string => {
    const g = buildOverallDimensionGeometry(buildingBBox, edge);
    const a1 = arrowheadPoints(g.arrowStart);
    const a2 = arrowheadPoints(g.arrowEnd);
    const ln = (l: Line2D, w: number) => `<line x1="${px(l.x1)}" y1="${py(l.y1)}" x2="${px(l.x2)}" y2="${py(l.y2)}" stroke="${PLAN_INK_MUTED}" stroke-width="${w}"/>`;
    const tri = (a: ReturnType<typeof arrowheadPoints>) => `<path d="M ${px(a.tipX)} ${py(a.tipY)} L ${px(a.b1X)} ${py(a.b1Y)} L ${px(a.b2X)} ${py(a.b2Y)} Z" fill="${PLAN_INK_MUTED}"/>`;
    const transformAttr = g.labelRotation ? ` transform="rotate(${g.labelRotation} ${px(g.labelX)} ${py(g.labelY)})"` : '';
    return `${ln(g.witnessStart, 1.1)}${ln(g.witnessEnd, 1.1)}${ln(g.mainLine, 1.6)}${tri(a1)}${tri(a2)}
      <text x="${px(g.labelX)}" y="${py(g.labelY)}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="14" font-weight="700" fill="${PLAN_INK_MUTED}"${transformAttr}>${g.label}</text>`;
  };

  // Faint plot boundary -- same idea as the interactive view, visible only
  // where it falls within this export's building-fitted canvas.
  const plotOutlineSvg = `<rect x="${px(0)}" y="${py(0)}" width="${p(result.plotWidth)}" height="${p(result.plotLength)}" fill="none" stroke="#d6d3d1" stroke-width="1.2" stroke-dasharray="9 7"/>`;

  // Entry marker: same geometry builder as the interactive view
  // (buildEntryMarkerGeometry), scaled into pixel space.
  const entry = findMainEntryDoor(result.rooms, result.plotWidth, result.plotLength);
  const entryMarkerSvg = entry ? (() => {
    const g = buildEntryMarkerGeometry(entry.room, entry.door);
    const a = arrowheadPoints(g.arrowTip);
    return `<rect x="${px(g.pad.x)}" y="${py(g.pad.y)}" width="${p(g.pad.width)}" height="${p(g.pad.height)}" rx="${p(0.05)}" fill="${ENTRY_PAD_FILL}" stroke="${PLAN_INK_MUTED}" stroke-width="1"/>
      <line x1="${px(g.arrowShaft.x1)}" y1="${py(g.arrowShaft.y1)}" x2="${px(g.arrowShaft.x2)}" y2="${py(g.arrowShaft.y2)}" stroke="${PLAN_INK_MUTED}" stroke-width="2"/>
      <path d="M ${px(a.tipX)} ${py(a.tipY)} L ${px(a.b1X)} ${py(a.b1Y)} L ${px(a.b2X)} ${py(a.b2Y)} Z" fill="${PLAN_INK_MUTED}"/>
      <text x="${px(g.textX)}" y="${py(g.textY)}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="11" font-weight="700" fill="${PLAN_INK_MUTED}">Entry</text>`;
  })() : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasW}" height="${canvasH}" viewBox="0 0 ${canvasW} ${canvasH}">
    <defs>
      <filter id="plan-shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="3" stdDeviation="5" flood-color="#000000" flood-opacity="0.18"/>
      </filter>
      ${floorPatternDefsSvg(p)}
    </defs>
    <rect width="100%" height="100%" fill="#ffffff"/>
    <text x="${canvasW / 2}" y="36" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="700" fill="${PLAN_INK}">${title}</text>
    <text x="${canvasW / 2}" y="58" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="11" fill="${PLAN_INK_MUTED}">ARCHITECTURAL PLAN • PLOT AREA ${plotArea} m² • DIMENSIONS IN METERS</text>
    ${overallDimensionSvg('top')}
    ${overallDimensionSvg('left')}
    <rect x="${margin}" y="${margin}" width="${planW}" height="${planH}" fill="#ffffff" filter="url(#plan-shadow)"/>
    ${plotOutlineSvg}
    ${circulation}
    ${roomFloors}
    ${wallsSvg}
    ${roomOverlay}
    ${furniture}
    ${entryMarkerSvg}
    <g transform="translate(${canvasW - 98}, ${canvasH - 75})" font-family="Arial, Helvetica, sans-serif" fill="${PLAN_INK}"><path d="M 18 0 L 30 32 L 18 25 L 6 32 Z" fill="${PLAN_INK}"/><text x="18" y="49" text-anchor="middle" font-size="12" font-weight="700">N</text><text x="18" y="65" text-anchor="middle" font-size="9">NORTH</text></g>
  </svg>`;
}

function downloadFloorPlanPng(result: FloorPlanResult) {
  const svg = createArchitecturalPlanSvg(result);
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const image = new Image();
  image.onload = () => {
    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = image.width * scale;
    canvas.height = image.height * scale;
    const context = canvas.getContext('2d');
    if (!context) return URL.revokeObjectURL(url);
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    const link = document.createElement('a');
    link.download = `INTERIO_${result.plotWidth}x${result.plotLength}_architectural_floor_plan.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };
  image.onerror = () => URL.revokeObjectURL(url);
  image.src = url;
}
