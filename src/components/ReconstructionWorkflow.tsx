import React, { useRef, useState } from 'react';
import {
  ScanLine,
  UploadCloud,
  RefreshCw,
  Box,
  BookmarkPlus,
  RotateCcw,
  Check,
  Lightbulb,
  ArrowLeft,
} from 'lucide-react';
import { DesignStyle, Point2D, ReconstructionData } from '../types';
import { reconstructRoomApi } from '../services/api';

interface ReconstructionWorkflowProps {
  onView3D: (data: ReconstructionData) => void;
  onSaveProject: (data: ReconstructionData) => void;
  onBackToHome?: () => void;
}

// Built-in sample room images for 1-click testing
const SAMPLE_ROOMS = [
  {
    id: 'sample_living',
    name: 'Vintage Living Space',
    desc: 'Existing space with worn flooring & high ceiling',
    tag: 'Living Space',
    url: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1000&q=80',
    defaultCorners: [
      { x: 0.12, y: 0.78 }, // bottom-left
      { x: 0.88, y: 0.78 }, // bottom-right
      { x: 0.74, y: 0.44 }, // top-right
      { x: 0.26, y: 0.44 }, // top-left
    ],
  },
  {
    id: 'sample_empty',
    name: 'Raw Concrete Studio',
    desc: 'Unfinished concrete requiring structural curation',
    tag: 'Loft Studio',
    url: 'https://images.unsplash.com/photo-1502005229762-ee1b2b93e083?auto=format&fit=crop&w=1000&q=80',
    defaultCorners: [
      { x: 0.15, y: 0.85 },
      { x: 0.85, y: 0.85 },
      { x: 0.70, y: 0.38 },
      { x: 0.30, y: 0.38 },
    ],
  },
  {
    id: 'sample_bedroom',
    name: 'Mid-Century Bedroom',
    desc: 'Compact rectangular layout with single window',
    tag: 'Bed Suite',
    url: 'https://images.unsplash.com/photo-1540518614846-7ede433c4ef2?auto=format&fit=crop&w=1000&q=80',
    defaultCorners: [
      { x: 0.10, y: 0.82 },
      { x: 0.90, y: 0.82 },
      { x: 0.76, y: 0.48 },
      { x: 0.24, y: 0.48 },
    ],
  },
];

export const ReconstructionWorkflow: React.FC<ReconstructionWorkflowProps> = ({
  onView3D,
  onSaveProject,
  onBackToHome,
}) => {
  // Image & Canvas state
  const [selectedImage, setSelectedImage] = useState<string>(SAMPLE_ROOMS[0].url);
  const [cornerPoints, setCornerPoints] = useState<Point2D[]>(SAMPLE_ROOMS[0].defaultCorners);
  const imageContainerRef = useRef<HTMLDivElement>(null);

  // Renovation settings
  const [style, setStyle] = useState<DesignStyle>('modern');
  const [budget, setBudget] = useState<string>('$15,000 - $25,000');
  const [roomType, setRoomType] = useState<string>('Living Room');

  // Generation & Result state
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generationStep, setGenerationStep] = useState<string>('');
  const [result, setResult] = useState<ReconstructionData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // File Upload Handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const base64 = uploadEvent.target?.result as string;
      setSelectedImage(base64);
      // Reset corners to reasonable perspective default
      setCornerPoints([
        { x: 0.15, y: 0.85 },
        { x: 0.85, y: 0.85 },
        { x: 0.72, y: 0.42 },
        { x: 0.28, y: 0.42 },
      ]);
      setResult(null);
    };
    reader.readAsDataURL(file);
  };

  // Click on image to set / calibrate corner points
  const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!imageContainerRef.current) return;
    const rect = imageContainerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    if (cornerPoints.length >= 4) {
      // Find closest corner to reposition
      let closestIdx = 0;
      let minDistance = Infinity;
      cornerPoints.forEach((p, idx) => {
        const dist = Math.hypot(p.x - x, p.y - y);
        if (dist < minDistance) {
          minDistance = dist;
          closestIdx = idx;
        }
      });
      const updated = [...cornerPoints];
      updated[closestIdx] = { x, y };
      setCornerPoints(updated);
    } else {
      setCornerPoints([...cornerPoints, { x, y }]);
    }
  };

  // Reset to auto-detected corners
  const handleAutoDetect = () => {
    setCornerPoints([
      { x: 0.14, y: 0.84 }, // bottom-left
      { x: 0.86, y: 0.84 }, // bottom-right
      { x: 0.72, y: 0.42 }, // top-right
      { x: 0.28, y: 0.42 }, // top-left
    ]);
  };

  // Calculate estimated aspect ratio from points
  const calculateEstimatedMetrics = () => {
    if (cornerPoints.length < 4) return { width: 5.0, length: 6.0, area: 30.0 };
    const p = cornerPoints;
    const bottomW = Math.hypot(p[1].x - p[0].x, p[1].y - p[0].y);
    const topW = Math.hypot(p[2].x - p[3].x, p[2].y - p[3].y);
    const leftL = Math.hypot(p[3].x - p[0].x, p[3].y - p[0].y);
    const rightL = Math.hypot(p[2].x - p[1].x, p[2].y - p[1].y);

    const avgW = (bottomW + topW) / 2;
    const avgL = (leftL + rightL) / 2;
    const ratio = avgL > 0 ? avgW / avgL : 1;

    const w = Math.round(Math.max(3.2, Math.min(8.0, 5.0 * Math.sqrt(ratio))) * 10) / 10;
    const l = Math.round(Math.max(3.2, Math.min(8.5, w / (ratio || 1))) * 10) / 10;
    return { width: w, length: l, area: Math.round(w * l * 10) / 10 };
  };

  const estimated = calculateEstimatedMetrics();

  // Submit to Gemini API
  const handleGenerateRenovation = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    setError(null);

    const steps = [
      'Performing photogrammetric perspective rectification...',
      'Estimating structural wall planes, openings, and ceiling clearance...',
      'Analyzing architectural substrate and lighting orientation...',
      'Synthesizing full renovation design with furniture & finishes...',
    ];

    let stepIndex = 0;
    setGenerationStep(steps[0]);
    const stepInterval = setInterval(() => {
      stepIndex = (stepIndex + 1) % steps.length;
      setGenerationStep(steps[stepIndex]);
    }, 1200);

    try {
      const generated = await reconstructRoomApi({
        imageBase64: selectedImage,
        cornerPoints,
        style,
        budget,
        roomType,
      });

      setResult({
        ...generated,
        imageUrl: selectedImage,
        cornerPoints,
      });
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to analyze room reconstruction');
    } finally {
      clearInterval(stepInterval);
      setIsGenerating(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 space-y-8">
      {/* Header & Back Navigation */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          id="btn-reconstruction-back-home"
          onClick={onBackToHome}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-600 hover:text-stone-900 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Dashboard</span>
        </button>

        <div className="flex items-center gap-1.5 text-xs text-stone-400">
          <span>Workflows</span>
          <span>/</span>
          <span className="text-stone-900 font-medium">Renovation</span>
        </div>
      </div>

      {/* Page Title & Scope */}
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold text-stone-900 tracking-tight">
          Photogrammetric Renovation
        </h1>
        <p className="text-xs sm:text-sm text-stone-500 mt-1 max-w-2xl leading-relaxed">
          Upload or select a room photograph to calibrate floor corners and detect perspective geometry. 
          The system evaluates structural conditions and synthesizes a full renovation plan.
        </p>
      </div>

      {/* Main Grid: Left Setup & Photo, Right Transformation Plan */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Photo Upload, Corner Marking & Renovation Form */}
        <div className="lg:col-span-6 space-y-6">
          {/* Photo Upload & Sample Switcher */}
          <div className="bg-white rounded-2xl border border-stone-200/80 p-6 space-y-5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-stone-700">
                1. Room Photography
              </label>

              {/* Upload Input */}
              <label
                htmlFor="photo-upload"
                className="cursor-pointer text-xs font-medium text-stone-700 hover:text-stone-900 bg-stone-50 hover:bg-stone-100 px-2.5 py-1 rounded-md inline-flex items-center gap-1.5 transition-colors border border-stone-200"
              >
                <UploadCloud className="w-3.5 h-3.5 text-stone-500" />
                <span>Upload Photo</span>
              </label>
              <input
                id="photo-upload"
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>

            {/* Quick Sample Selector */}
            <div>
              <span className="text-[11px] text-stone-400 block mb-2">
                Or select an architectural reference space:
              </span>
              <div className="grid grid-cols-3 gap-2">
                {SAMPLE_ROOMS.map((sample) => {
                  const isSelected = selectedImage === sample.url;
                  return (
                    <button
                      key={sample.id}
                      type="button"
                      onClick={() => {
                        setSelectedImage(sample.url);
                        setCornerPoints(sample.defaultCorners);
                        setResult(null);
                      }}
                      className={`p-1.5 rounded-xl border text-left transition-colors cursor-pointer overflow-hidden ${
                        isSelected
                          ? 'border-stone-900 bg-stone-50'
                          : 'border-stone-200/80 hover:border-stone-300 bg-white'
                      }`}
                    >
                      <div className="aspect-[4/3] w-full rounded-lg overflow-hidden mb-1.5 bg-stone-100">
                        <img
                          src={sample.url}
                          alt={sample.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <span className="text-[11px] font-medium text-stone-800 block truncate">
                        {sample.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Interactive Image & Corner Marking Area */}
            <div className="border-t border-stone-100 pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-stone-700">
                  Floor Corners (Click to reposition)
                </span>
                <button
                  type="button"
                  onClick={handleAutoDetect}
                  className="text-xs text-stone-500 hover:text-stone-900 flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset</span>
                </button>
              </div>

              <div
                ref={imageContainerRef}
                onClick={handleImageClick}
                className="relative w-full h-[280px] rounded-xl overflow-hidden border border-stone-200 cursor-crosshair select-none bg-stone-900"
              >
                <img
                  src={selectedImage}
                  alt="Existing Room"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover opacity-90"
                />

                {/* SVG Overlay for drawing connecting boundary lines */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none">
                  {cornerPoints.length >= 2 && (
                    <polygon
                      points={cornerPoints
                        .map((p) => `${p.x * 100}%,${p.y * 100}%`)
                        .join(' ')}
                      fill="rgba(255, 255, 255, 0.15)"
                      stroke="#ffffff"
                      strokeWidth="1.5"
                      strokeDasharray="4,2"
                    />
                  )}
                </svg>

                {/* Corner Handles */}
                {cornerPoints.map((point, idx) => (
                  <div
                    key={idx}
                    className="absolute -translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-stone-900 border-2 border-white shadow-sm flex items-center justify-center text-[9px] font-medium text-white pointer-events-none"
                    style={{
                      left: `${point.x * 100}%`,
                      top: `${point.y * 100}%`,
                    }}
                  >
                    {idx + 1}
                  </div>
                ))}
              </div>

              {/* Perspective Dimensions Calculation */}
              <div className="flex items-center justify-between text-xs text-stone-500 pt-1">
                <span>Estimated footprint</span>
                <span className="font-medium text-stone-800">
                  ~{estimated.width}m × {estimated.length}m ({estimated.area} m²)
                </span>
              </div>
            </div>
          </div>

          {/* Renovation Target Form */}
          <form
            onSubmit={handleGenerateRenovation}
            className="bg-white rounded-2xl border border-stone-200/80 p-6 space-y-4"
          >
            <label className="block text-xs font-medium text-stone-700">
              2. Renovation Targets
            </label>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-[11px] text-stone-500 block mb-1">
                  Target Style
                </span>
                <select
                  value={style}
                  onChange={(e) => setStyle(e.target.value as DesignStyle)}
                  className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-xs font-medium text-stone-800 focus:border-stone-900 outline-hidden transition-colors"
                >
                  <option value="modern">Modern Architectural</option>
                  <option value="japandi">Japandi Organic Calm</option>
                  <option value="scandinavian">Nordic Scandinavian</option>
                  <option value="minimal">Pure Minimalist</option>
                  <option value="industrial">Urban Loft Atelier</option>
                  <option value="traditional">Classic Heritage</option>
                </select>
              </div>

              <div>
                <span className="text-[11px] text-stone-500 block mb-1">
                  Budget Tier
                </span>
                <select
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-xs font-medium text-stone-800 focus:border-stone-900 outline-hidden transition-colors"
                >
                  <option value="$5,000 - $10,000">$5k - $10k (Cosmetic)</option>
                  <option value="$15,000 - $25,000">$15k - $25k (Full Interior)</option>
                  <option value="$35,000 - $60,000">$35k - $60k (Structural)</option>
                </select>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isGenerating}
                className="w-full py-2.5 bg-stone-900 hover:bg-stone-800 disabled:bg-stone-300 text-white rounded-lg text-xs font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Analyzing Room...</span>
                  </>
                ) : (
                  <span>Generate Renovation Plan</span>
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

        {/* Right Column: Architectural Renovation Transformation Plan */}
        <div className="lg:col-span-6 space-y-6">
          {result ? (
            <div className="space-y-6">
              {/* Header Card with 3D Navigation */}
              <div className="bg-white rounded-2xl border border-stone-200/80 p-5 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-stone-900">
                    Renovation Blueprint Ready
                  </h3>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Estimated volume: {result.estimatedDimensions.width}m × {result.estimatedDimensions.length}m (H: 2.7m)
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    id="btn-reconstruction-save"
                    onClick={() => onSaveProject(result)}
                    className="px-2.5 py-1 rounded-md bg-white border border-stone-200 hover:bg-stone-50 text-stone-800 text-xs font-medium transition-colors flex items-center gap-1"
                  >
                    <BookmarkPlus className="w-3 h-3" />
                    <span>Save</span>
                  </button>

                  <button
                    type="button"
                    id="btn-reconstruction-view-3d"
                    onClick={() => onView3D(result)}
                    className="px-3 py-1 bg-stone-900 hover:bg-stone-800 text-white text-xs font-medium rounded-md flex items-center gap-1 transition-colors"
                  >
                    <Box className="w-3 h-3" />
                    <span>View in 3D</span>
                  </button>
                </div>
              </div>

              {/* Structural Observations */}
              <div className="bg-white rounded-2xl border border-stone-200/80 p-5 space-y-3">
                <h4 className="text-xs font-semibold text-stone-900">
                  Structural Diagnostics
                </h4>
                <p className="text-xs text-stone-500 leading-relaxed">
                  {result.structuralObservations}
                </p>

                {result.detectedFeatures && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {result.detectedFeatures.map((feat, idx) => (
                      <div
                        key={idx}
                        className="p-2 rounded-lg bg-stone-50 border border-stone-200/70 text-xs text-stone-700 flex items-center gap-2"
                      >
                        <Check className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                        <span className="truncate">{feat}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Renovation Color Scheme */}
              {result.renovationDesign?.colorPalette && (
                <div className="bg-white rounded-2xl border border-stone-200/80 p-5 space-y-3">
                  <h4 className="text-xs font-semibold text-stone-900">
                    Transformed Palette
                  </h4>
                  <div className="grid grid-cols-5 gap-2">
                    {result.renovationDesign.colorPalette.map((swatch, idx) => (
                      <div key={idx} className="p-2 rounded-xl border border-stone-200/80 text-center bg-stone-50/50">
                        <div
                          className="w-full h-8 rounded-lg mb-1.5 border border-stone-200/60"
                          style={{ backgroundColor: swatch.hex }}
                        />
                        <span className="text-[10px] font-medium text-stone-900 block truncate">
                          {swatch.name}
                        </span>
                        <span className="text-[9px] font-mono text-stone-400 block mt-0.5">
                          {swatch.hex}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Curated Furniture List */}
              {result.renovationDesign?.furniture && (
                <div className="bg-white rounded-2xl border border-stone-200/80 p-5 space-y-3">
                  <h4 className="text-xs font-semibold text-stone-900">
                    Layout Furniture ({result.renovationDesign.furniture.length} Pieces)
                  </h4>
                  <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                    {result.renovationDesign.furniture.map((item) => (
                      <div
                        key={item.id}
                        className="p-3 rounded-xl border border-stone-200/80 bg-stone-50/50 flex items-center justify-between text-xs"
                      >
                        <div>
                          <span className="font-medium text-stone-900 block">{item.name}</span>
                          <span className="text-[11px] text-stone-500">
                            {item.width}m W × {item.depth}m D · {item.material || 'Engineered'}
                          </span>
                        </div>
                        <span className="text-[11px] text-stone-600 bg-stone-100 px-2 py-0.5 rounded-md">
                          {item.estimatedPrice || 'Included'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Lighting Upgrade Plan */}
              {result.renovationDesign?.lightingSuggestions && (
                <div className="bg-white rounded-2xl border border-stone-200/80 p-5 space-y-2">
                  <div className="flex items-start gap-2.5">
                    <Lightbulb className="w-4 h-4 text-stone-400 mt-0.5 shrink-0" />
                    <div>
                      <h4 className="text-xs font-semibold text-stone-900">
                        Lighting Upgrade Plan
                      </h4>
                      <p className="text-xs text-stone-500 mt-0.5 leading-relaxed">
                        {result.renovationDesign.lightingSuggestions}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-stone-200/80 p-8 text-center bg-white flex flex-col items-center justify-center min-h-[380px] space-y-2">
              <div className="w-10 h-10 rounded-xl bg-stone-100 flex items-center justify-center mx-auto text-stone-400">
                <ScanLine className="w-5 h-5" />
              </div>
              <h4 className="text-xs font-semibold text-stone-900">
                Awaiting Diagnostics
              </h4>
              <p className="text-xs text-stone-500 max-w-xs leading-relaxed">
                Confirm your room photograph and floor boundary corners on the left, then click Generate Renovation Plan.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
