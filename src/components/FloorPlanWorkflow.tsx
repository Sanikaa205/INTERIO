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
} from 'lucide-react';
import { FloorPlanResult, FloorPlanRoom } from '../types';
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
    setIsGenerating(true);
    setError(null);

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
  const tryMoveRoom = (roomId: string, rawX: number, rawY: number) => {
    setResult((prev) => {
      if (!prev) return prev;
      const room = prev.rooms.find((r) => r.id === roomId);
      if (!room) return prev;

      const maxX = Math.max(0, roundTo(prev.plotWidth - room.width));
      const maxY = Math.max(0, roundTo(prev.plotLength - room.height));

      const x = roundTo(Math.min(Math.max(snapToGrid(rawX), 0), maxX));
      const y = roundTo(Math.min(Math.max(snapToGrid(rawY), 0), maxY));

      if (x === room.x && y === room.y) return prev;

      const candidate: FloorPlanRoom = { ...room, x, y };
      const overlaps = prev.rooms.some(
        (other) => other.id !== room.id && rectsOverlap(candidate, other)
      );
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
                          <option value="kitchen">Kitchen & Dining</option>
                          <option value="bathroom">Bathroom</option>
                          <option value="office">Office / Study</option>
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
                    viewBox={`-1 -1 ${result.plotWidth + 2} ${result.plotLength + 2}`}
                    className="w-full max-h-[480px] border border-stone-200 rounded-lg bg-white"
                    style={{ touchAction: 'none' }}
                  >
                    <defs>
                      <pattern id="cad-grid" width="1" height="1" patternUnits="userSpaceOnUse">
                        <path d="M 1 0 L 0 0 0 1" fill="none" stroke="#f5f5f4" strokeWidth="0.04" />
                      </pattern>
                    </defs>

                    {showGrid && (
                      <rect
                        x="0"
                        y="0"
                        width={result.plotWidth}
                        height={result.plotLength}
                        fill="url(#cad-grid)"
                      />
                    )}

                    {/* Outer Boundary Wall */}
                    <rect
                      x="0"
                      y="0"
                      width={result.plotWidth}
                      height={result.plotLength}
                      fill="none"
                      stroke="#292524"
                      strokeWidth="0.2"
                      strokeLinejoin="round"
                    />

                    {/* Dimensions */}
                    {showDimensions && (
                      <g className="text-[0.42px] font-medium fill-stone-500">
                        <text x={result.plotWidth / 2} y="-0.3" textAnchor="middle">
                          {result.plotWidth}m
                        </text>
                        <text
                          x="-0.3"
                          y={result.plotLength / 2}
                          textAnchor="middle"
                          transform={`rotate(-90, -0.3, ${result.plotLength / 2})`}
                        >
                          {result.plotLength}m
                        </text>
                      </g>
                    )}

                    {/* Placed Rooms */}
                    {result.rooms.map((room) => {
                      const isSelected = selectedRoomId === room.id;
                      const isDragging = draggingRoomId === room.id;
                      const area = room.area || Math.round(room.width * room.height * 10) / 10;
                      return (
                        <g
                          key={room.id}
                          onPointerDown={(e) => handleRoomPointerDown(e, room)}
                          onPointerMove={handleRoomPointerMove}
                          onPointerUp={handleRoomPointerUp}
                          onPointerCancel={handleRoomPointerUp}
                          className={`transition-colors ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                        >
                          <rect
                            x={room.x}
                            y={room.y}
                            width={room.width}
                            height={room.height}
                            fill={room.color || '#e7e5e4'}
                            fillOpacity={isSelected ? '0.35' : '0.18'}
                            stroke={isSelected ? '#1c1917' : '#78716c'}
                            strokeWidth={isSelected ? '0.16' : '0.1'}
                            className="transition-colors"
                          />

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

                          <g className="pointer-events-none select-none">
                            <text
                              x={room.x + room.width / 2}
                              y={room.y + room.height / 2 - (room.height > 2.5 ? 0.2 : 0)}
                              textAnchor="middle"
                              className="text-[0.4px] font-semibold fill-stone-900"
                            >
                              {room.name}
                            </text>
                            <text
                              x={room.x + room.width / 2}
                              y={room.y + room.height / 2 + 0.3}
                              textAnchor="middle"
                              className="text-[0.3px] font-normal fill-stone-500"
                            >
                              {area} m² · ({room.width}m × {room.height}m)
                            </text>
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

// Manual repositioning tuning: snap increment and arrow-key step sizes (meters).
const GRID_SNAP = 0.1;
const ARROW_STEP = 0.1;
const ARROW_STEP_SHIFT = 0.5;

function snapToGrid(value: number, step: number = GRID_SNAP): number {
  return Math.round(value / step) * step;
}

function roundTo(value: number, decimals: number = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

// Two axis-aligned rectangles overlap only if they share more than a touching edge.
function rectsOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number }
): boolean {
  const EPS = 1e-6;
  return (
    a.x < b.x + b.width - EPS &&
    a.x + a.width > b.x + EPS &&
    a.y < b.y + b.height - EPS &&
    a.y + a.height > b.y + EPS
  );
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
function renderDoorSwing(room: FloorPlanRoom) {
  const doorW = 0.8;
  const side = room.doorSide || 'bottom';

  if (side === 'bottom') {
    const startX = room.x + 0.3;
    const startY = room.y + room.height;
    return (
      <g>
        <line x1={startX} y1={startY} x2={startX + doorW} y2={startY} stroke="#ffffff" strokeWidth="0.2" />
        <path
          d={`M ${startX} ${startY} A ${doorW} ${doorW} 0 0 1 ${startX + doorW} ${startY - doorW}`}
          fill="none"
          stroke="#b45309"
          strokeWidth="0.04"
          strokeDasharray="0.08,0.04"
        />
        <line x1={startX} y1={startY} x2={startX + doorW} y2={startY - doorW} stroke="#b45309" strokeWidth="0.05" />
      </g>
    );
  }

  return null;
}
