import React, { useState, useEffect } from 'react';
import {
  Palette,
  Box,
  BookmarkPlus,
  RefreshCw,
  Copy,
  Check,
  Lightbulb,
  Armchair,
  Info,
  ArrowLeft,
} from 'lucide-react';
import { DesignStyle, InteriorDesignResult } from '../types';
import { generateInteriorApi } from '../services/api';

interface InteriorDesignWorkflowProps {
  onView3D: (result: InteriorDesignResult) => void;
  onSaveProject: (result: InteriorDesignResult) => void;
  onBackToHome?: () => void;
  initialStyle?: DesignStyle;
  // Result carried back from the 3D Studio (e.g. after moving furniture
  // there), so re-opening this workflow shows the latest edited layout
  // instead of resetting to blank.
  initialResult?: InteriorDesignResult | null;
  // Shared with the 3D Studio so selecting a piece in one view is reflected
  // in the other.
  selectedFurnitureId?: string | null;
  onSelectFurniture?: (id: string | null) => void;
}

const STYLE_OPTIONS: {
  id: DesignStyle;
  label: string;
  desc: string;
  image: string;
}[] = [
  {
    id: 'modern',
    label: 'Modern Architectural',
    desc: 'Sleek geometric lines, monolithic planes & refined contrast',
    image: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'japandi',
    label: 'Japandi Organic Calm',
    desc: 'Wabi-sabi balance of Japanese craft & Nordic functional simplicity',
    image: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'scandinavian',
    label: 'Nordic Scandinavian',
    desc: 'Airy natural light, blonde ash timber & warm bouclé textiles',
    image: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'minimal',
    label: 'Pure Minimalist',
    desc: 'Uncluttered negative space, tactile limewash & essential forms',
    image: 'https://images.unsplash.com/photo-1598928506311-c55ded91a20c?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'industrial',
    label: 'Urban Loft Atelier',
    desc: 'Forged steel framing, patinated masonry & cognac saddle leather',
    image: 'https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'traditional',
    label: 'Classic Heritage',
    desc: 'Timeless crown millwork, rich walnut & double-woven upholstery',
    image: 'https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?auto=format&fit=crop&w=600&q=80',
  },
];

const BUDGET_TIERS = [
  { id: '$5,000 - $10,000', label: '$5k - $10k', sub: 'Essential Quality' },
  { id: '$15,000 - $25,000', label: '$15k - $25k', sub: 'Designer Balanced' },
  { id: '$35,000 - $60,000', label: '$35k - $60k', sub: 'High-End Bespoke' },
  { id: '$75,000+', label: '$75k+', sub: 'Luxury Masterpiece' },
];

export const InteriorDesignWorkflow: React.FC<InteriorDesignWorkflowProps> = ({
  onView3D,
  onSaveProject,
  onBackToHome,
  initialStyle,
  initialResult = null,
  selectedFurnitureId = null,
  onSelectFurniture,
}) => {
  // Form State
  const [roomWidth, setRoomWidth] = useState<number>(5.5);
  const [roomLength, setRoomLength] = useState<number>(6.5);
  const [roomType, setRoomType] = useState<string>('Living Room');
  const [style, setStyle] = useState<DesignStyle>(initialStyle || 'japandi');
  const [budget, setBudget] = useState<string>('$15,000 - $25,000');
  const [preferredColors, setPreferredColors] = useState('');
  const [additionalRequirements, setAdditionalRequirements] = useState('');
  const [phaseOneJson, setPhaseOneJson] = useState('');

  // Synchronize if initialStyle changes from props
  useEffect(() => {
    if (initialStyle) {
      setStyle(initialStyle);
    }
  }, [initialStyle]);

  // UI State
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generationStep, setGenerationStep] = useState<string>('');
  const [result, setResult] = useState<InteriorDesignResult | null>(initialResult);
  const [error, setError] = useState<string | null>(null);
  const [copiedHex, setCopiedHex] = useState<string | null>(null);

  // Submit to Gemini API
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!Number.isFinite(roomWidth) || roomWidth <= 0 || !Number.isFinite(roomLength) || roomLength <= 0) {
      setError('Enter a room width and length greater than zero before generating.');
      return;
    }

    setIsGenerating(true);

    const steps = [
      'Analyzing spatial clearance and circulation walkways...',
      'Selecting curated furniture pieces matching aesthetic style...',
      'Computing harmonic 5-color architectural palette...',
      'Synthesizing multi-tier circadian lighting strategy...',
    ];

    let stepIndex = 0;
    setGenerationStep(steps[0]);
    const stepInterval = setInterval(() => {
      stepIndex = (stepIndex + 1) % steps.length;
      setGenerationStep(steps[stepIndex]);
    }, 1100);

    try {
      let openings: { wall: 'north' | 'south' | 'east' | 'west'; start: number; end: number; type: 'door' | 'window' }[] = [];
      if (phaseOneJson.trim()) {
        let plan: any;
        try { plan = JSON.parse(phaseOneJson); } catch { throw new Error('Phase 1 floor plan must be valid JSON.'); }
        const source = plan?.data && typeof plan.data === 'object' ? plan.data : plan;
        const rooms = Array.isArray(source?.rooms) ? source.rooms : [];
        if (!rooms.length) throw new Error('Phase 1 JSON must contain a rooms array.');
        const room = rooms.find((item: any) => String(item.type || item.name).toLowerCase().includes(roomType.split(' ')[0].toLowerCase())) || rooms[0];
        const width = Number(room.width);
        const depth = Number(room.height ?? room.length);
        if (width > 0 && depth > 0) { setRoomWidth(width); setRoomLength(depth); }
        for (const [side, kind, field] of [['doorSide', 'door', 'doorSide'], ['windowSide', 'window', 'windowSide']] as const) {
          const wall = room[field];
          if (!['top', 'bottom', 'left', 'right', 'north', 'south', 'east', 'west'].includes(wall)) continue;
          const normalized = ({ top: 'north', bottom: 'south', left: 'west', right: 'east', north: 'north', south: 'south', east: 'east', west: 'west' } as const)[wall as 'top'];
          const span = normalized === 'north' || normalized === 'south' ? width : depth;
          openings.push({ wall: normalized, start: span * 0.4, end: span * 0.6, type: kind });
        }
        const finalWidth = width > 0 ? width : roomWidth;
        const finalDepth = depth > 0 ? depth : roomLength;
        const generated = await generateInteriorApi({ roomWidth: finalWidth, roomLength: finalDepth, style, budget, roomType: room.name || roomType, preferredColors: preferredColors.split(',').map((value) => value.trim()).filter(Boolean), additionalRequirements, openings });
        setResult(generated);
        if (generated.furniture.length) onSelectFurniture?.(generated.furniture[0].id);
        return;
      }
      const generated = await generateInteriorApi({
        roomWidth,
        roomLength,
        style,
        budget,
        roomType,
        preferredColors: preferredColors.split(',').map((value) => value.trim()).filter(Boolean),
        additionalRequirements,
        openings,
      });

      setResult(generated);
      if (generated.furniture && generated.furniture.length > 0) {
        onSelectFurniture?.(generated.furniture[0].id);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to generate interior design');
    } finally {
      clearInterval(stepInterval);
      setIsGenerating(false);
    }
  };

  const copyToClipboard = (hex: string) => {
    navigator.clipboard.writeText(hex);
    setCopiedHex(hex);
    setTimeout(() => setCopiedHex(null), 2500);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 space-y-8">
      {/* Header & Back Navigation */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          id="btn-interior-back-home"
          onClick={onBackToHome}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-600 hover:text-stone-900 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Dashboard</span>
        </button>

        <div className="flex items-center gap-1.5 text-xs text-stone-400">
          <span>Workflows</span>
          <span>/</span>
          <span className="text-stone-900 font-medium">Interior Design</span>
        </div>
      </div>

      {/* Page Title & Scope */}
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold text-stone-900 tracking-tight">
          Interior Spatial Curation
        </h1>
        <p className="text-xs sm:text-sm text-stone-500 mt-1 max-w-2xl leading-relaxed">
          Configure room dimensions, architectural aesthetic, and budget. The curation engine generates 
          furniture layouts, harmonic color palettes, and circadian lighting plans.
        </p>
      </div>

      {/* Main Grid: Form Left, Blueprint Canvas Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Form Parameters */}
        <div className="lg:col-span-5 space-y-6">
          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-2xl border border-stone-200/80 p-6 space-y-6"
          >
            {/* Room Type & Dimensions */}
            <div className="space-y-3">
              <label className="block text-xs font-medium text-stone-700">
                Space & Dimensions
              </label>

              <div>
                <span className="text-[11px] text-stone-500 block mb-1">
                  Room Purpose
                </span>
                <select
                  value={roomType}
                  onChange={(e) => setRoomType(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-xs font-medium text-stone-800 focus:border-stone-900 outline-hidden transition-colors"
                >
                  <option value="Living Room">Living Room & Lounge</option>
                  <option value="Master Bedroom Suite">Master Bedroom Suite</option>
                  <option value="Kitchen & Dining">Kitchen & Dining</option>
                  <option value="Executive Home Office">Home Office / Study</option>
                  <option value="Studio Apartment">Open Studio Concept</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <span className="text-[11px] text-stone-500 block mb-1">
                    Width (m)
                  </span>
                  <input
                    type="number"
                    min="3"
                    max="20"
                    step="0.1"
                    value={roomWidth}
                    onChange={(e) => setRoomWidth(Math.max(3, Number(e.target.value)))}
                    required
                    className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-xs font-medium text-stone-800 focus:border-stone-900 outline-hidden transition-colors"
                  />
                </div>

                <div>
                  <span className="text-[11px] text-stone-500 block mb-1">
                    Length (m)
                  </span>
                  <input
                    type="number"
                    min="3"
                    max="25"
                    step="0.1"
                    value={roomLength}
                    onChange={(e) => setRoomLength(Math.max(3, Number(e.target.value)))}
                    required
                    className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-xs font-medium text-stone-800 focus:border-stone-900 outline-hidden transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] text-stone-500 block mb-1" htmlFor="interior-colors">Preferred colors</label>
                <input id="interior-colors" value={preferredColors} onChange={(e) => setPreferredColors(e.target.value)} placeholder="e.g. sage green, warm oak" className="w-full px-3 py-2 border border-stone-200 rounded-lg text-xs" />
              </div>
              <div>
                <label className="text-[11px] text-stone-500 block mb-1" htmlFor="interior-requirements">Additional requirements</label>
                <textarea id="interior-requirements" value={additionalRequirements} onChange={(e) => setAdditionalRequirements(e.target.value)} maxLength={1000} rows={2} placeholder="Accessibility, existing furniture, pets..." className="w-full px-3 py-2 border border-stone-200 rounded-lg text-xs resize-y" />
              </div>
              <details className="text-xs text-stone-600">
                <summary className="cursor-pointer font-medium">Use a Phase 1 floor plan JSON (optional)</summary>
                <p className="mt-2 text-[10px] text-stone-500">Paste the generated floor plan JSON to inherit the room dimensions and keep furniture clear of its door and window walls.</p>
                <textarea value={phaseOneJson} onChange={(e) => setPhaseOneJson(e.target.value)} rows={5} placeholder='{"plotWidth":8,"plotLength":10,"rooms":[...]}' className="mt-2 w-full px-3 py-2 border border-stone-200 rounded-lg text-[10px] font-mono" />
              </details>

              <div className="text-xs text-stone-500 flex justify-between pt-1">
                <span>Floor area</span>
                <span className="font-medium text-stone-800">
                  {(roomWidth * roomLength).toFixed(1)} m² (~{(roomWidth * roomLength * 10.764).toFixed(0)} sq ft)
                </span>
              </div>
            </div>

            {/* Visual Photographic Style Selector */}
            <div className="border-t border-stone-100 pt-5">
              <div className="flex items-center justify-between mb-3">
                <label className="text-xs font-medium text-stone-700">
                  Design Aesthetic
                </label>
                <span className="text-[11px] text-stone-400 capitalize">
                  {style}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                {STYLE_OPTIONS.map((opt) => {
                  const isSelected = style === opt.id;
                  return (
                    <div
                      key={opt.id}
                      onClick={() => setStyle(opt.id)}
                      className={`group rounded-xl border p-2 cursor-pointer transition-all ${
                        isSelected
                          ? 'border-stone-900 bg-stone-50'
                          : 'border-stone-200/80 hover:border-stone-300 bg-white'
                      }`}
                    >
                      <div className="aspect-[16/10] w-full rounded-lg overflow-hidden mb-1.5 bg-stone-100">
                        <img
                          src={opt.image}
                          alt={opt.label}
                          className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-300"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <span className={`text-xs font-medium block truncate ${isSelected ? 'text-stone-900' : 'text-stone-700'}`}>
                        {opt.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Budget Range */}
            <div className="border-t border-stone-100 pt-5 space-y-2">
              <label className="block text-xs font-medium text-stone-700">
                Budget Tier
              </label>

              <div className="grid grid-cols-2 gap-2">
                {BUDGET_TIERS.map((tier) => {
                  const isSelected = budget === tier.id;
                  return (
                    <button
                      key={tier.id}
                      type="button"
                      onClick={() => setBudget(tier.id)}
                      className={`p-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
                        isSelected
                          ? 'border-stone-900 bg-stone-50 text-stone-900 font-medium'
                          : 'border-stone-200/80 hover:border-stone-300 text-stone-600 bg-white'
                      }`}
                    >
                      <span className="text-xs font-medium block">{tier.label}</span>
                      <span className="text-[10px] text-stone-400 block mt-0.5">{tier.sub}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Submit Action */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isGenerating}
                className="w-full py-2.5 bg-stone-900 hover:bg-stone-800 disabled:bg-stone-300 text-white rounded-lg text-xs font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Generating Interior Plan...</span>
                  </>
                ) : (
                  <span>{result ? 'Regenerate Design' : 'Generate Interior Design'}</span>
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

        {/* Right Column: Spatial Layout, Palette & Details */}
        <div className="lg:col-span-7 space-y-6">
          {/* Spatial 2D Furniture Blueprint */}
          <div className="bg-white rounded-2xl border border-stone-200/80 p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-stone-900">
                  Spatial Furniture Layout
                </h3>
                <p className="text-xs text-stone-500">
                  Top-down view with circulation clearance
                </p>
              </div>

              {result && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onSaveProject(result)}
                    className="px-2.5 py-1 rounded-md bg-white border border-stone-200 hover:bg-stone-50 text-stone-800 text-xs font-medium transition-colors flex items-center gap-1"
                  >
                    <BookmarkPlus className="w-3 h-3" />
                    <span>Save</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onView3D(result)}
                    className="px-3 py-1 rounded-md bg-stone-900 hover:bg-stone-800 text-white text-xs font-medium transition-colors flex items-center gap-1"
                  >
                    <Box className="w-3 h-3" />
                    <span>View in 3D</span>
                  </button>
                </div>
              )}
            </div>

            {/* SVG Canvas or Placeholder */}
            <div className="bg-stone-50/60 border border-stone-200/70 rounded-xl min-h-[380px] flex items-center justify-center p-4 relative overflow-hidden">
              {result ? (
                <div className="w-full flex items-center justify-center">
                  <svg
                    viewBox={`-0.8 -0.8 ${result.roomWidth + 1.6} ${result.roomLength + 1.6}`}
                    className="w-full max-h-[380px]"
                  >
                    <defs>
                      <pattern id="interior-grid" width="1" height="1" patternUnits="userSpaceOnUse">
                        <path d="M 1 0 L 0 0 0 1" fill="none" stroke="#e7e5e4" strokeWidth="0.04" />
                      </pattern>
                    </defs>
                    <rect
                      x="0"
                      y="0"
                      width={result.roomWidth}
                      height={result.roomLength}
                      fill="url(#interior-grid)"
                    />

                    {/* Outer Room Walls */}
                    <rect
                      x="0"
                      y="0"
                      width={result.roomWidth}
                      height={result.roomLength}
                      fill="url(#interior-grid)"
                      stroke="#292524"
                      strokeWidth="0.12"
                      rx="0.05"
                    />

                    {/* Window on North Wall */}
                    <line
                      x1={result.roomWidth * 0.3}
                      y1="0"
                      x2={result.roomWidth * 0.7}
                      y2="0"
                      stroke="#78716c"
                      strokeWidth="0.18"
                    />

                    {/* Furniture rects */}
                    {[...result.furniture].sort((a, b) => Number(a.category !== 'decor') - Number(b.category !== 'decor')).map((item) => {
                      const isSelected = selectedFurnitureId === item.id;
                      const rot = item.rotation || 0;
                      const turned = (item.rotation || 0) % 180 !== 0;
                      const footprintWidth = turned ? item.depth : item.width;
                      const footprintDepth = turned ? item.width : item.depth;
                      const cx = item.x + footprintWidth / 2;
                      const cy = item.y + footprintDepth / 2;
                      const itemNumber = result.furniture.findIndex((candidate) => candidate.id === item.id) + 1;
                      return (
                        <g
                          key={item.id}
                          onClick={() => onSelectFurniture?.(item.id)}
                          className="cursor-pointer"
                        >
                          <title>{`${item.name} · ${item.width}m × ${item.depth}m`}</title>
                          <rect
                            x={cx - item.width / 2}
                            y={cy - item.depth / 2}
                            width={item.width}
                            height={item.depth}
                            transform={rot !== 0 ? `rotate(${rot}, ${cx}, ${cy})` : undefined}
                            fill={item.color || '#a8a29e'}
                            fillOpacity={isSelected ? '0.85' : '0.45'}
                            stroke={isSelected ? '#1c1917' : '#78716c'}
                            strokeWidth={isSelected ? '0.08' : '0.04'}
                            rx="0.08"
                            className="transition-all"
                          />
                          {item.category !== 'decor' && (
                            <g className="pointer-events-none">
                              <circle cx={item.x + footprintWidth - 0.2} cy={item.y + 0.2} r="0.16" fill={isSelected ? '#292524' : '#ffffff'} stroke="#57534e" strokeWidth="0.035" />
                              <text x={item.x + footprintWidth - 0.2} y={item.y + 0.25} textAnchor="middle" fontSize="0.14" fontWeight="700" fill={isSelected ? '#ffffff' : '#292524'}>
                                {String(itemNumber).padStart(2, '0')}
                              </text>
                            </g>
                          )}
                        </g>
                      );
                    })}
                  </svg>
                </div>
              ) : (
                <div className="text-center p-8 space-y-2 max-w-xs">
                  <div className="w-10 h-10 rounded-xl bg-stone-100 flex items-center justify-center mx-auto text-stone-400">
                    <Armchair className="w-5 h-5" />
                  </div>
                  <h4 className="text-xs font-semibold text-stone-900">
                    Awaiting Generation
                  </h4>
                  <p className="text-xs text-stone-500 leading-relaxed">
                    Select your room dimensions, style, and budget, then click Generate Interior Design.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Color Palette Swatches */}
          {result && (
            <div className="bg-white rounded-2xl border border-stone-200/80 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-stone-900">
                    Architectural Color Palette
                  </h4>
                  <p className="text-xs text-stone-500">
                    Click any swatch to copy hexadecimal value
                  </p>
                </div>
                {copiedHex && (
                  <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    Copied {copiedHex}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                {result.colorPalette.map((swatch, idx) => (
                  <div
                    key={idx}
                    onClick={() => copyToClipboard(swatch.hex)}
                    className="p-2 rounded-xl border border-stone-200 hover:border-stone-400 bg-stone-50/50 cursor-pointer transition-colors"
                  >
                    <div
                      className="w-full h-10 rounded-lg mb-1.5 border border-stone-200/60"
                      style={{ backgroundColor: swatch.hex }}
                    />
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-stone-900 truncate">
                        {swatch.name}
                      </span>
                      <Copy className="w-2.5 h-2.5 text-stone-400 shrink-0" />
                    </div>
                    <span className="text-[10px] font-mono text-stone-500 block mt-0.5">
                      {swatch.hex}
                    </span>
                    <span className="text-[9px] text-stone-600 bg-stone-200/70 px-1 py-0.5 rounded-sm inline-block mt-1">
                      {swatch.role}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result?.designSuggestions?.length ? (
            <div className="bg-white rounded-2xl border border-stone-200/80 p-5 space-y-2">
              <h4 className="text-xs font-semibold text-stone-900">Design Suggestions</h4>
              <ul className="list-disc pl-4 space-y-1 text-xs text-stone-600">
                {result.designSuggestions.map((suggestion, index) => <li key={index}>{suggestion}</li>)}
              </ul>
              <p className="text-[10px] text-stone-400">Local 3D asset matching is used when a library model is available; other items use the built-in fallback model.</p>
            </div>
          ) : null}

          {result?.layoutWarnings?.map((warning, index) => (
            <div key={index} role="status" className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-900">{warning}</div>
          ))}

          {/* Curated Furniture Cards */}
          {result && (
            <div className="bg-white rounded-2xl border border-stone-200/80 p-5 space-y-3">
              <h4 className="text-xs font-semibold text-stone-900">
                Curated Furniture ({result.furniture.length} Items)
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[340px] overflow-y-auto pr-1">
                {result.furniture.map((item, index) => {
                  const isSelected = selectedFurnitureId === item.id;
                  return (
                    <div
                      key={item.id}
                      onClick={() => onSelectFurniture?.(item.id)}
                      className={`p-3.5 rounded-xl border transition-colors cursor-pointer ${
                        isSelected
                          ? 'border-stone-900 bg-stone-50'
                          : 'border-stone-200/80 hover:border-stone-300 bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <span className="flex items-start gap-2 min-w-0 text-xs font-medium text-stone-900">
                          <span className="shrink-0 rounded-full bg-stone-100 px-1.5 py-0.5 text-[9px] tabular-nums text-stone-600">{String(index + 1).padStart(2, '0')}</span>
                          <span className="break-words">{item.name}</span>
                        </span>
                        <span className="text-[10px] text-stone-600 bg-stone-100 px-1.5 py-0.5 rounded-md shrink-0">
                          {item.estimatedPrice || 'Curated'}
                        </span>
                      </div>

                      <div className="text-[11px] text-stone-500 space-y-0.5">
                        <p>
                          <span>Dimensions:</span> {item.width}m W × {item.depth}m D
                        </p>
                        {item.material && (
                          <p>
                            <span>Material:</span> {item.material}
                          </p>
                        )}
                        {item.notes && (
                          <p className="text-[10px] text-stone-400 mt-1">
                            {item.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Lighting & Philosophy Guidance */}
          {result && (
            <div className="bg-white rounded-2xl border border-stone-200/80 p-5 space-y-3">
              <div className="flex items-start gap-2.5">
                <Lightbulb className="w-4 h-4 text-stone-400 mt-0.5 shrink-0" />
                <div>
                  <h4 className="text-xs font-semibold text-stone-900">
                    Lighting Strategy
                  </h4>
                  <p className="text-xs text-stone-500 mt-0.5 leading-relaxed">
                    {result.lightingSuggestions}
                  </p>
                </div>
              </div>

              {result.designPhilosophy && (
                <div className="flex items-start gap-2.5 pt-3 border-t border-stone-100">
                  <Info className="w-4 h-4 text-stone-400 mt-0.5 shrink-0" />
                  <div>
                    <h4 className="text-xs font-semibold text-stone-900">
                      Spatial Philosophy
                    </h4>
                    <p className="text-xs text-stone-500 mt-0.5 leading-relaxed">
                      {result.designPhilosophy}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
