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
import { defaultRoomOpenings } from '../services/layoutOptimizer';

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

export const InteriorFloorPlan: React.FC<{
  result: InteriorDesignResult;
  selectedFurnitureId: string | null;
  onSelectFurniture: (id: string) => void;
}> = ({ result, selectedFurnitureId, onSelectFurniture }) => {
  const { roomWidth: w, roomLength: l } = result;
  const wall = 0.16;
  const openings = result.openings?.length ? result.openings : defaultRoomOpenings(w, l);
  const styleStroke = result.style === 'industrial' ? '#343638' : result.style === 'traditional' ? '#5b4533' : result.style === 'minimal' ? '#55544f' : '#292b2b';
  const floorFinish = result.colorPalette.find((swatch) => swatch.role === 'flooring')?.hex || '#cbb493';
  const renderWall = (side: 'north' | 'south' | 'east' | 'west') => {
    const horizontal = side === 'north' || side === 'south';
    const length = horizontal ? w : l;
    const y = side === 'north' ? 0 : side === 'south' ? l - wall : 0;
    const x = side === 'west' ? 0 : side === 'east' ? w - wall : 0;
    const sideOpenings = openings.filter((opening) => opening.wall === side).map((opening) => ({
      ...opening, start: Math.max(0, Math.min(length, opening.start)), end: Math.max(0, Math.min(length, opening.end)),
    })).filter((opening) => opening.end > opening.start).sort((a, b) => a.start - b.start);
    const segments: React.ReactNode[] = [];
    let cursor = 0;
    sideOpenings.forEach((opening, index) => {
      if (opening.start > cursor) segments.push(<rect key={`${side}-wall-${index}`} x={horizontal ? cursor : x} y={horizontal ? y : cursor} width={horizontal ? opening.start - cursor : wall} height={horizontal ? wall : opening.start - cursor} fill={styleStroke} />);
      cursor = Math.max(cursor, opening.end);
    });
    if (cursor < length) segments.push(<rect key={`${side}-wall-end`} x={horizontal ? cursor : x} y={horizontal ? y : cursor} width={horizontal ? length - cursor : wall} height={horizontal ? wall : length - cursor} fill={styleStroke} />);
    return segments;
  };
  const renderOpening = (opening: (typeof openings)[number], index: number) => {
    const horizontal = opening.wall === 'north' || opening.wall === 'south';
    const isDoor = opening.type === 'door';
    const span = opening.end - opening.start;
    const mid = (opening.start + opening.end) / 2;
    if (!isDoor) {
      const x = horizontal ? opening.start : opening.wall === 'west' ? 0 : w - wall;
      const y = horizontal ? opening.wall === 'north' ? 0 : l - wall : opening.start;
      const width = horizontal ? span : wall;
      const height = horizontal ? wall : span;
      return <g key={`opening-${index}`}>
        <rect x={x + .025} y={y + .025} width={Math.max(.04, width - .05)} height={Math.max(.04, height - .05)} fill="#d9eef2" stroke="#53656a" strokeWidth=".025" />
        {horizontal
          ? <path d={`M ${opening.start} ${y + wall / 2} H ${opening.end} M ${mid} ${y + .025} V ${y + wall - .025}`} stroke="#53656a" strokeWidth=".035" />
          : <path d={`M ${x + wall / 2} ${opening.start} V ${opening.end} M ${x + .025} ${mid} H ${x + wall - .025}`} stroke="#53656a" strokeWidth=".035" />}
        <path d={horizontal ? `M ${opening.start} ${y - .07} H ${opening.end}` : `M ${x - .07} ${opening.start} V ${opening.end}`} stroke="#38bdf8" strokeWidth=".055" />
        <text x={horizontal ? mid : opening.wall === 'west' ? -.14 : w + .14} y={horizontal ? opening.wall === 'north' ? -.16 : l + .28 : mid} textAnchor="middle" fontSize=".11" fill="#0369a1">WINDOW</text>
      </g>;
    }
    const doorWidth = span;
    let leaf: string;
    let arc: string;
    if (opening.wall === 'south') {
      const hingeY = l - wall;
      leaf = `M ${opening.start} ${hingeY} V ${hingeY - doorWidth}`;
      arc = `M ${opening.start} ${hingeY - doorWidth} A ${doorWidth} ${doorWidth} 0 0 1 ${opening.end} ${hingeY}`;
    } else if (opening.wall === 'north') {
      leaf = `M ${opening.start} ${wall} V ${wall + doorWidth}`;
      arc = `M ${opening.start} ${wall + doorWidth} A ${doorWidth} ${doorWidth} 0 0 0 ${opening.end} ${wall}`;
    } else if (opening.wall === 'west') {
      leaf = `M ${wall} ${opening.start} H ${wall + doorWidth}`;
      arc = `M ${wall + doorWidth} ${opening.start} A ${doorWidth} ${doorWidth} 0 0 0 ${wall} ${opening.end}`;
    } else {
      leaf = `M ${w - wall} ${opening.start} H ${w - wall - doorWidth}`;
      arc = `M ${w - wall - doorWidth} ${opening.start} A ${doorWidth} ${doorWidth} 0 0 1 ${w - wall} ${opening.end}`;
    }
    return <g key={`opening-${index}`}>
      <path d={leaf} stroke="#5c5145" strokeWidth=".055" />
      <path d={arc} fill="none" stroke="#877968" strokeWidth=".024" strokeDasharray=".07 .045" />
      <text x={horizontal ? mid : opening.wall === 'west' ? wall + .12 : w - wall - .12} y={horizontal ? opening.wall === 'south' ? l - .055 : wall + .18 : mid} textAnchor="middle" fontSize=".105" fill="#514b43">ENTRY</text>
    </g>;
  };
  const roomLabel = result.roomType.toUpperCase();
  const floorPattern = /kitchen|bath|powder|utility/i.test(result.roomType) || result.style === 'industrial'
    ? 'url(#stone-floor)'
    : result.style === 'traditional' ? 'url(#parquet-floor)' : 'url(#wood-plank)';
  const furnitureShape = (form: string, width: number, depth: number, color: string) => {
    const f = form.toLowerCase();
    const inset = Math.min(0.08, width * 0.08, depth * 0.08);
    const woodGrain = <g opacity=".32" stroke="#6f4e37" strokeWidth=".018" pointerEvents="none">
      {[0.25, 0.5, 0.75].map((p) => <path key={p} d={`M ${width * .12} ${depth * p} Q ${width * .5} ${depth * (p - .035)} ${width * .88} ${depth * p}`} />)}
    </g>;
    if (f.includes('rug')) return <>
      <rect x="0.015" y="0.015" width={width - .03} height={depth - .03} rx=".08" fill="url(#rug-weave)" stroke="#b4aa9a" strokeWidth=".035" />
      <rect x=".09" y=".09" width={width - .18} height={depth - .18} rx=".045" fill="none" stroke="#fffdf8" strokeOpacity=".74" strokeWidth=".025" />
      <rect x=".13" y=".13" width={width - .26} height={depth - .26} rx=".035" fill="none" stroke="#bdb3a4" strokeOpacity=".68" strokeWidth=".018" />
    </>;
    if (f.includes('kitchen cabinet') || f.includes('counter run')) return <>
      <rect x=".035" y=".035" width={width - .07} height={depth - .07} rx=".035" fill="#b8ac99" stroke="#776d5f" strokeWidth=".035" />
      <path d={`M .06 ${depth * .78} H ${width - .06}`} stroke="#777065" strokeWidth=".035" />
      {width > 1.55 && <><rect x={width * .12} y={depth * .13} width={Math.min(.48, width * .2)} height={depth * .48} rx=".08" fill="#eaf0ee" stroke="#7d8985" strokeWidth=".025"/><ellipse cx={width * .22} cy={depth * .37} rx={Math.min(.14, width * .06)} ry={Math.min(.1, depth * .17)} fill="#d3e2e0" stroke="#879390" strokeWidth=".02"/><rect x={width * .6} y={depth * .12} width={width * .28} height={depth * .52} rx=".035" fill="#343638" stroke="#5f605d" strokeWidth=".025"/>{[.68,.8].map((x)=>[.28,.48].map((y)=><circle key={`${x}-${y}`} cx={width*x} cy={depth*y} r={Math.min(.07,depth*.1)} fill="none" stroke="#c9c3b8" strokeWidth=".02"/>))}</>}
      {woodGrain}
    </>;
    if (f.includes('refrigerator') || f.includes('fridge')) return <>
      <rect x=".035" y=".035" width={width - .07} height={depth - .07} rx=".055" fill="#d8dcda" stroke="#747a78" strokeWidth=".035" />
      <path d={`M .05 ${depth * .55} H ${width - .05} M ${width * .72} ${depth * .12} V ${depth * .46} M ${width * .72} ${depth * .64} V ${depth * .88}`} stroke="#9ca3a0" strokeWidth=".025" />
      <path d={`M ${width * .64} ${depth * .16} V ${depth * .4} M ${width * .64} ${depth * .69} V ${depth * .84}`} stroke="#656c69" strokeWidth=".035" />
    </>;
    if (f.includes('toilet') || f.includes(' w.c') || /\bwc\b/i.test(f)) return <>
      <rect x={width * .25} y={depth * .08} width={width * .5} height={depth * .25} rx=".04" fill="#f7f7f3" stroke="#999c99" strokeWidth=".025" />
      <ellipse cx={width / 2} cy={depth * .62} rx={width * .34} ry={depth * .32} fill="#fafaf7" stroke="#999c99" strokeWidth=".03" />
      <ellipse cx={width / 2} cy={depth * .62} rx={width * .2} ry={depth * .2} fill="#dfe8e6" stroke="#a9b2af" strokeWidth=".02" />
    </>;
    if (f.includes('shower') || f.includes('bath')) return <>
      <rect x=".035" y=".035" width={width - .07} height={depth - .07} rx=".04" fill="#e2ebea" stroke="#899795" strokeWidth=".03" />
      <path d={`M .08 .08 L ${width - .08} ${depth - .08} M ${width - .08} .08 L .08 ${depth - .08}`} stroke="#b6c7c4" strokeWidth=".02" />
      <circle cx={width * .82} cy={depth * .82} r=".045" fill="#899795" />
    </>;
    if (f.includes('bed') || f.includes('sleep platform')) return <>
      <rect x={inset} y={inset} width={width - inset * 2} height={depth - inset * 2} rx=".1" fill="#a99277" stroke="#6d5d4b" strokeWidth=".035" />
      <rect x={inset + .055} y={inset + .18} width={width - inset * 2 - .11} height={depth - inset * 2 - .23} rx=".1" fill={color} stroke="#c4b7a6" strokeWidth=".025" />
      <rect x={inset + .055} y={inset + .18} width={width - inset * 2 - .11} height={depth - inset * 2 - .23} rx=".1" fill="url(#linen-fabric)" opacity=".38" />
      <rect x={inset + .1} y={inset + .12} width={(width - inset * 2 - .24) / 2} height={Math.min(.42, depth * .23)} rx=".07" fill="#fffdf8" stroke="#b7aa99" strokeWidth=".025" />
      <rect x={width / 2 + .02} y={inset + .12} width={(width - inset * 2 - .24) / 2} height={Math.min(.42, depth * .23)} rx=".07" fill="#fffdf8" stroke="#b7aa99" strokeWidth=".025" />
      <path d={`M ${inset + .1} ${Math.min(.68, depth * .34)} H ${width - inset - .1}`} stroke="#b8aa98" strokeWidth=".022" />
    </>;
    if (f.includes('sofa') || f.includes('couch') || f.includes('loveseat') || f.includes('sectional') || (f.includes('seating') && width > depth * 1.3)) {
      const arm = Math.min(.18, width * .12);
      const backDepth = depth * .31;
      const seatY = backDepth + .025;
      const seatH = Math.max(.18, depth - seatY - .1);
      const cushionGap = Math.min(.035, width * .015);
      const cushions = result.style === 'minimal' ? 2 : Math.max(2, Math.min(3, Math.round(width / 1.15)));
      return <>
        <rect x=".045" y=".045" width={width - .09} height={depth - .09} rx={result.style === 'traditional' ? '.1' : Math.min(.2, depth * .2)} fill={result.style === 'industrial' ? '#4b4945' : result.style === 'traditional' ? '#725743' : '#8b837a'} stroke="#514b44" strokeWidth=".04" />
        <rect x={arm} y=".09" width={width - arm * 2} height={backDepth} rx=".11" fill={color} stroke="#817a72" strokeWidth=".025" />
        {Array.from({ length: cushions }, (_, i) => {
          const cw = (width - arm * 2 - cushionGap * (cushions - 1) - .05) / cushions;
          const x = arm + .025 + i * (cw + cushionGap);
          return <g key={i}><rect x={x} y={seatY} width={cw} height={seatH} rx=".095" fill={color} stroke="#77716a" strokeWidth=".028"/><rect x={x} y={seatY} width={cw} height={seatH} rx=".095" fill="url(#linen-fabric)" opacity=".28"/><path d={`M ${x + .07} ${seatY + .055} V ${seatY + seatH - .055}`} stroke="#fff" strokeOpacity=".34" strokeWidth=".018" /></g>;
        })}
        <rect x=".075" y=".12" width={Math.max(.12, arm * .72)} height={depth - .24} rx=".07" fill={color} stroke="#6d665f" strokeWidth=".025" />
        <rect x={width - arm * .72 - .075} y=".12" width={Math.max(.12, arm * .72)} height={depth - .24} rx=".07" fill={color} stroke="#6d665f" strokeWidth=".025" />
        <path d={`M ${arm + .06} ${backDepth - .025} H ${width - arm - .06}`} stroke="#fff" strokeOpacity=".34" strokeWidth=".022" />
        {result.style === 'traditional' && Array.from({ length: cushions + 1 }, (_, i) => <circle key={`tuft-${i}`} cx={arm + (width - arm * 2) * (i + .5) / (cushions + 1)} cy={backDepth * .52} r=".025" fill="#6d5960" stroke="#e1c8b8" strokeWidth=".012" />)}
        {width > 2 && <>
          <path d={`M ${arm + .1} ${seatY + .12} l .34 -.08 .2 .2 -.26 .24 -.32 -.08z`} fill={result.colorPalette.find((swatch) => swatch.role === 'accent')?.hex || '#879477'} stroke="#766e62" strokeWidth=".02" />
          <path d={`M ${width - arm - .48} ${seatY + .1} l .32 -.08 .22 .2 -.26 .24 -.31 -.08z`} fill={result.style === 'industrial' ? '#9b6749' : '#858879'} stroke="#766e62" strokeWidth=".02" />
        </>}
      </>;
    }
    if (f.includes('chair') || f.includes('armchair') || f.includes('lounge') || f.includes('seating')) return <>
      <rect x=".06" y=".06" width={width - .12} height={depth - .12} rx={Math.min(.2, Math.min(width, depth) * .22)} fill="#73807c" stroke="#4d5855" strokeWidth=".045" />
      <rect x=".16" y=".16" width={width - .32} height={depth - .32} rx={Math.min(.16, Math.min(width, depth) * .18)} fill={color} stroke="#53605c" strokeWidth=".03" />
      <rect x=".22" y=".22" width={width - .44} height={depth - .44} rx=".12" fill={color} stroke="#fff" strokeOpacity=".4" strokeWidth=".02" />
      <path d={`M .18 ${depth * .67} Q ${width / 2} ${depth * .72} ${width - .18} ${depth * .67}`} fill="none" stroke="#596460" strokeWidth=".025" />
    </>;
    if (f.includes('table') || f.includes('desk') || f.includes('island') || f.includes('dining') || f.includes('coffee')) return <>
      <rect x=".055" y=".065" width={width - .11} height={depth - .12} rx={f.includes('coffee') ? Math.min(.16, depth * .18) : .045} fill="#70513a" opacity=".23" />
      <rect x=".035" y=".025" width={width - .07} height={depth - .07} rx={f.includes('coffee') ? Math.min(.16, depth * .18) : .045} fill="url(#wood-furniture)" stroke="#533d2c" strokeWidth=".04" />
      {woodGrain}
      <rect x=".09" y=".075" width={width - .18} height={depth - .17} rx=".06" fill="none" stroke="#e1c29c" strokeOpacity=".65" strokeWidth=".018" />
      <circle cx={width - .13} cy={depth - .13} r=".035" fill="#d5c4ad" stroke="#725b45" strokeWidth=".018" />
    </>;
    if (f.includes('sink') || f.includes('vanity') || f.includes('basin')) return <>
      <rect x=".035" y=".035" width={width - .07} height={depth - .07} rx=".05" fill="#e9e7e1" stroke="#77736b" strokeWidth=".035" />
      <rect x={width * .22} y={depth * .16} width={width * .56} height={depth * .62} rx=".12" fill="#f8fbfa" stroke="#9da7a5" strokeWidth=".03" />
      <ellipse cx={width / 2} cy={depth * .47} rx={width * .18} ry={depth * .2} fill="#dce6e5" stroke="#a5b2af" strokeWidth=".025" />
      <circle cx={width / 2} cy={depth * .12} r=".035" fill="#57534e" />
    </>;
    if (f.includes('stove') || f.includes('hob') || f.includes('range')) return <>
      <rect x=".035" y=".035" width={width - .07} height={depth - .07} rx=".045" fill="#dedbd4" stroke="#69665f" strokeWidth=".035" />
      {[.3, .7].map((x) => [.3, .7].map((y) => <g key={`${x}-${y}`}><circle cx={width * x} cy={depth * y} r={Math.min(width, depth) * .14} fill="#343638" stroke="#77736b" strokeWidth=".025" /><circle cx={width * x} cy={depth * y} r={Math.min(width, depth) * .08} fill="none" stroke="#b5b0a7" strokeWidth=".018" /></g>))}
    </>;
    if (f.includes('counter') || f.includes('wardrobe') || f.includes('bookcase') || f.includes('dresser') || f.includes('sideboard') || f.includes('tv-unit') || f.includes('console') || f.includes('media')) return <>
      <rect x=".045" y=".06" width={width - .09} height={depth - .1} rx=".045" fill="#5f4735" opacity=".23" />
      <rect x=".025" y=".025" width={width - .05} height={depth - .07} rx=".045" fill="url(#wood-furniture)" stroke="#594431" strokeWidth=".035" />
      {Array.from({ length: Math.max(2, Math.min(5, Math.round(width / .55))) }, (_, i) => {
        const count = Math.max(2, Math.min(5, Math.round(width / .55)));
        const x = (width - .08) * (i + 1) / (count + 1) + .04;
        return <g key={i}><path d={`M ${x} .06 V ${depth - .05}`} stroke="#71573e" strokeOpacity=".75" strokeWidth=".025" /><circle cx={x} cy={depth / 2} r=".025" fill="#d0b68f" /></g>;
      })}
      {woodGrain}
    </>;
    if (f.includes('lamp') || f.includes('luminaire')) return <>
      <circle cx={width / 2} cy={depth / 2} r={Math.min(width, depth) * .44} fill="#f5e8c9" fillOpacity=".45" />
      <circle cx={width / 2} cy={depth / 2} r={Math.min(width, depth) * .34} fill="#f0e1bb" stroke="#88785d" strokeWidth=".035" />
      <circle cx={width / 2} cy={depth / 2} r={Math.min(width, depth) * .2} fill="#fff9e9" stroke="#b4a17c" strokeWidth=".025" />
      <path d={`M ${width / 2} ${depth / 2} V ${depth * .08}`} stroke="#70604a" strokeWidth=".025" />
    </>;
    if (f.includes('plant') || f.includes('planter')) return <>
      <circle cx={width / 2} cy={depth / 2} r={Math.min(width, depth) * .38} fill="#c8b89e" stroke="#665846" strokeWidth=".03" />
      {Array.from({ length: 8 }, (_, i) => { const a = (Math.PI * 2 * i) / 8; return <ellipse key={i} cx={width / 2 + Math.cos(a) * width * .15} cy={depth / 2 + Math.sin(a) * depth * .15} rx={width * .11} ry={depth * .075} transform={`rotate(${i * 45} ${width / 2 + Math.cos(a) * width * .15} ${depth / 2 + Math.sin(a) * depth * .15})`} fill={i % 2 ? '#6f8068' : '#879477'} stroke="#53634e" strokeWidth=".018" />; })}
      <circle cx={width / 2} cy={depth / 2} r=".055" fill="#aebc9e" />
    </>;
    return <>
      <rect x={inset} y={inset} width={width - inset * 2} height={depth - inset * 2} rx=".07" fill={color} stroke="#62594e" strokeWidth=".035" />
      <path d={`M ${width * .18} ${depth * .3} H ${width * .82} M ${width * .18} ${depth * .68} H ${width * .82}`} stroke="#fff" strokeOpacity=".35" strokeWidth=".02" />
    </>;
  };

  return (
    <svg viewBox={`-0.9 -1.05 ${w + 1.8} ${l + 1.85}`} className="w-full max-h-[500px]" role="img" aria-label={`${result.roomType} floor plan, ${w} by ${l} meters`}>
      <defs>
        <linearGradient id="wood-floor-base" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={result.style === 'scandinavian' || result.style === 'minimal' ? '#e8deca' : result.style === 'traditional' ? '#b99670' : '#d8bd99'}/><stop offset=".48" stopColor={result.style === 'scandinavian' || result.style === 'minimal' ? '#f4ebd9' : result.style === 'traditional' ? '#d2b48e' : '#ead5b7'}/><stop offset="1" stopColor={result.style === 'industrial' ? '#b8b5ae' : result.style === 'traditional' ? '#aa8966' : '#d4b891'}/></linearGradient>
        <linearGradient id="wood-furniture" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={result.style === 'traditional' ? '#60412f' : result.style === 'industrial' ? '#514c45' : result.style === 'minimal' ? '#b8a98e' : result.style === 'scandinavian' ? '#bda17a' : result.style === 'japandi' ? '#927758' : '#9c7551'}/><stop offset=".45" stopColor={result.style === 'traditional' ? '#926a49' : result.style === 'industrial' ? '#876147' : result.style === 'minimal' ? '#d8cdbb' : result.style === 'scandinavian' ? '#e6d6bd' : result.style === 'japandi' ? '#b89973' : '#bd9367'}/><stop offset="1" stopColor={result.style === 'traditional' ? '#432e24' : result.style === 'industrial' ? '#383633' : result.style === 'minimal' ? '#9c8c73' : result.style === 'scandinavian' ? '#9b805d' : result.style === 'japandi' ? '#6f5942' : '#815d3e'}/></linearGradient>
        <pattern id="wood-plank" width="1.8" height=".42" patternUnits="userSpaceOnUse"><rect width="1.8" height=".42" fill="url(#wood-floor-base)"/><path d="M0 .015H1.8M0 .405H1.8M.52 .015V.405M1.43 .015V.405" stroke={floorFinish} strokeOpacity=".42" strokeWidth=".018"/><path d="M.08 .12H.42M.67 .29H1.27M1.51 .15H1.73" stroke="#fff8e9" strokeOpacity=".28" strokeWidth=".014"/></pattern>
        <pattern id="stone-floor" width=".6" height=".6" patternUnits="userSpaceOnUse"><rect width=".6" height=".6" fill="#d9d6cf"/><path d="M.6 0H0V.6" fill="none" stroke="#aaa69e" strokeWidth=".025"/><path d="M.08 .1H.4M.12 .48H.45" stroke="#fff" strokeOpacity=".2" strokeWidth=".012"/></pattern>
        <pattern id="parquet-floor" width=".8" height=".8" patternUnits="userSpaceOnUse"><rect width=".8" height=".8" fill="url(#wood-floor-base)"/><path d="M0 .2H.4V0M.4 .2V.6H.8M0 .6H.4V.8M.4 0H.8V.4H.4" fill="none" stroke={floorFinish} strokeOpacity=".55" strokeWidth=".025"/></pattern>
        <pattern id="rug-weave" width=".12" height=".12" patternUnits="userSpaceOnUse"><rect width=".12" height=".12" fill="#e9e3d8"/><path d="M0 .02H.12M0 .08H.12M.02 0V.12M.08 0V.12" stroke="#c9c0b2" strokeOpacity=".38" strokeWidth=".012"/><path d="M.03 .03l.025.025M.09 .09l.02.02" stroke="#fffdf8" strokeOpacity=".55" strokeWidth=".012"/></pattern>
        <pattern id="linen-fabric" width=".12" height=".12" patternUnits="userSpaceOnUse"><rect width=".12" height=".12" fill="#ded8ce"/><path d="M0 .025H.12M0 .085H.12M.025 0V.12M.085 0V.12" stroke="#a99f92" strokeOpacity=".28" strokeWidth=".012"/></pattern>
        <filter id="furniture-shadow" x="-25%" y="-25%" width="150%" height="165%"><feGaussianBlur in="SourceAlpha" stdDeviation=".045"/><feOffset dy=".07"/><feComponentTransfer><feFuncA type="linear" slope=".28"/></feComponentTransfer><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      <rect x="0" y="0" width={w} height={l} fill={floorPattern} />
      <rect x="0" y="0" width={w} height={l} fill={floorFinish} opacity=".08" />
      <text x={w / 2} y="0.43" textAnchor="middle" fontSize="0.2" fontWeight="700" letterSpacing="0.075" fill="#302d28">{roomLabel}</text>
      <text x={w / 2} y="0.64" textAnchor="middle" fontSize="0.13" fill="#78716c">{w.toFixed(2)} × {l.toFixed(2)} m · {result.style}</text>

      {/* Wall poche, with a real opening for the entry door and a glazed window. */}
      {(['north', 'south', 'east', 'west'] as const).flatMap((side) => renderWall(side))}
      {openings.map(renderOpening)}

      {/* Dimension strings and extension ticks */}
      <path d={`M 0 ${-0.54} H ${w} M 0 ${-0.61} V ${-0.45} M ${w} ${-0.61} V ${-0.45}`} stroke="#44403c" strokeWidth="0.025" />
      <path d={`M ${-0.5} 0 V ${l} M ${-0.58} 0 H ${-0.42} M ${-0.58} ${l} H ${-0.42}`} stroke="#44403c" strokeWidth="0.025" />
      <rect x={w / 2 - 0.32} y="-0.65" width="0.64" height="0.2" fill="#faf9f6" />
      <text x={w / 2} y="-0.51" textAnchor="middle" fontSize="0.16" fontWeight="600" fill="#292524">{w.toFixed(2)} m</text>
      <text x="-0.51" y={l / 2} textAnchor="middle" fontSize="0.16" fontWeight="600" fill="#292524" transform={`rotate(-90 -0.51 ${l / 2})`}>{l.toFixed(2)} m</text>

      {[...result.furniture].sort((a, b) => Number(!/rug/i.test(`${a.name} ${a.form || ''}`)) - Number(!/rug/i.test(`${b.name} ${b.form || ''}`))).map((item) => {
        const isSelected = selectedFurnitureId === item.id;
        const showLabel = /coffee table|dining table|desk|console|media|tv unit|rug|wardrobe|counter|sideboard|cabinet/i.test(item.name);
        const width = Math.max(0.08, Math.min(item.width, w - item.x));
        const depth = Math.max(0.08, Math.min(item.depth, l - item.y));
        const cx = item.x + width / 2;
        const cy = item.y + depth / 2;
        const rotation = item.rotation || 0;
        return <g key={item.id} onClick={() => onSelectFurniture(item.id)} className="cursor-pointer" filter="url(#furniture-shadow)" transform={rotation ? `rotate(${rotation} ${cx} ${cy})` : undefined}>
          <g transform={`translate(${item.x} ${item.y})`}>{furnitureShape(`${item.form || ''} ${item.name} ${item.category || ''}`, width, depth, item.color || '#d6d3d1')}</g>
          {isSelected && <rect x={item.x - .045} y={item.y - .045} width={width + .09} height={depth + .09} rx=".1" fill="none" stroke="#0f172a" strokeWidth=".045" strokeDasharray=".12 .07" pointerEvents="none" />}
          {showLabel && <text x={cx} y={cy + 0.035} textAnchor="middle" dominantBaseline="middle" fontSize={Math.min(0.13, Math.max(0.085, width / 12))} fontWeight="600" fill="#292524" stroke="#f7f2e9" strokeWidth=".025" paintOrder="stroke" pointerEvents="none">{item.name}</text>}
        </g>;
      })}
      <text x={w} y={l + 0.36} textAnchor="end" fontSize="0.12" fill="#78716c">FLOOR PLAN · METERS</text>
    </svg>
  );
};

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
  const [roomWidth, setRoomWidth] = useState<number>(initialResult?.roomWidth ?? 5.5);
  const [roomLength, setRoomLength] = useState<number>(initialResult?.roomLength ?? 6.5);
  const [roomType, setRoomType] = useState<string>(initialResult?.roomType ?? 'Living Room');
  const [style, setStyle] = useState<DesignStyle>(initialResult?.style || initialStyle || 'japandi');
  const [budget, setBudget] = useState<string>('$15,000 - $25,000');
  const [preferredColors, setPreferredColors] = useState('');
  const [additionalRequirements, setAdditionalRequirements] = useState('');
  const [phaseOneJson, setPhaseOneJson] = useState('');

  // Synchronize if initialStyle changes from props
  useEffect(() => {
    if (!initialResult && initialStyle) {
      setStyle(initialStyle);
    }
  }, [initialStyle, initialResult]);

  // UI State
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generationStep, setGenerationStep] = useState<string>('');
  const [result, setResult] = useState<InteriorDesignResult | null>(initialResult);
  const [error, setError] = useState<string | null>(null);
  const [copiedHex, setCopiedHex] = useState<string | null>(null);

  useEffect(() => {
    setResult(initialResult);
    if (!initialResult) return;
    setRoomWidth(initialResult.roomWidth);
    setRoomLength(initialResult.roomLength);
    setRoomType(initialResult.roomType);
    setStyle(initialResult.style);
  }, [initialResult]);

  const invalidateResult = () => {
    setResult(null);
    onSelectFurniture?.(null);
  };

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
        const normalizedRoomType = (value: unknown) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
        const selectedType = normalizedRoomType(roomType);
        const roomKeywords = /kitchen/.test(selectedType) ? ['kitchen', 'pantry']
          : /dining/.test(selectedType) ? ['dining']
          : /bath|powder|toilet|washroom/.test(selectedType) ? ['bath', 'powder', 'toilet', 'washroom']
          : /bed|sleep/.test(selectedType) ? ['bedroom', 'bed', 'sleep']
          : /study|office|work/.test(selectedType) ? ['study', 'office', 'work']
          : ['living', 'lounge', 'family'];
        const room = rooms.find((item: any) => normalizedRoomType(item.name) === selectedType || normalizedRoomType(item.type) === selectedType)
          || rooms.find((item: any) => roomKeywords.some((keyword) => `${normalizedRoomType(item.type)} ${normalizedRoomType(item.name)}`.includes(keyword)));
        const width = Number(room?.width);
        const depth = Number(room?.height ?? room?.length);
        if (width > 0 && depth > 0) { setRoomWidth(width); setRoomLength(depth); }
        for (const [side, kind, field] of [['doorSide', 'door', 'doorSide'], ['windowSide', 'window', 'windowSide']] as const) {
          const wall = room?.[field];
          if (!['top', 'bottom', 'left', 'right', 'north', 'south', 'east', 'west'].includes(wall)) continue;
          const normalized = ({ top: 'north', bottom: 'south', left: 'west', right: 'east', north: 'north', south: 'south', east: 'east', west: 'west' } as const)[wall as 'top'];
          const span = normalized === 'north' || normalized === 'south' ? width : depth;
          openings.push({ wall: normalized, start: span * 0.4, end: span * 0.6, type: kind });
        }
        const finalWidth = width > 0 ? width : roomWidth;
        const finalDepth = depth > 0 ? depth : roomLength;
        const generated = await generateInteriorApi({ roomWidth: finalWidth, roomLength: finalDepth, style, budget, roomType, preferredColors: preferredColors.split(',').map((value) => value.trim()).filter(Boolean), additionalRequirements, openings });
        setRoomWidth(generated.roomWidth);
        setRoomLength(generated.roomLength);
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

      setRoomWidth(generated.roomWidth);
      setRoomLength(generated.roomLength);
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
                  onChange={(e) => { setRoomType(e.target.value); invalidateResult(); }}
                  className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-xs font-medium text-stone-800 focus:border-stone-900 outline-hidden transition-colors"
                >
                  <option value="Living Room">Living Room & Lounge</option>
                  <option value="Master Bedroom Suite">Master Bedroom Suite</option>
                  <option value="Bedroom">Bedroom</option>
                  <option value="Kitchen">Kitchen</option>
                  <option value="Dining Room">Dining Room</option>
                  <option value="Bathroom">Bathroom</option>
                  <option value="Study Room">Study Room</option>
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
                    onChange={(e) => { setRoomWidth(Math.max(3, Number(e.target.value))); invalidateResult(); }}
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
                    onChange={(e) => { setRoomLength(Math.max(3, Number(e.target.value))); invalidateResult(); }}
                    required
                    className="w-full px-3 py-2 bg-white border border-stone-200 rounded-lg text-xs font-medium text-stone-800 focus:border-stone-900 outline-hidden transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] text-stone-500 block mb-1" htmlFor="interior-colors">Preferred colors</label>
                <input id="interior-colors" value={preferredColors} onChange={(e) => { setPreferredColors(e.target.value); invalidateResult(); }} placeholder="e.g. sage green, warm oak" className="w-full px-3 py-2 border border-stone-200 rounded-lg text-xs" />
              </div>
              <div>
                <label className="text-[11px] text-stone-500 block mb-1" htmlFor="interior-requirements">Additional requirements</label>
                <textarea id="interior-requirements" value={additionalRequirements} onChange={(e) => { setAdditionalRequirements(e.target.value); invalidateResult(); }} maxLength={1000} rows={2} placeholder="Accessibility, existing furniture, pets..." className="w-full px-3 py-2 border border-stone-200 rounded-lg text-xs resize-y" />
              </div>
              <details className="text-xs text-stone-600">
                <summary className="cursor-pointer font-medium">Use a Phase 1 floor plan JSON (optional)</summary>
                <p className="mt-2 text-[10px] text-stone-500">Paste the generated floor plan JSON to inherit the room dimensions and keep furniture clear of its door and window walls.</p>
                <textarea value={phaseOneJson} onChange={(e) => { setPhaseOneJson(e.target.value); invalidateResult(); }} rows={5} placeholder='{"plotWidth":8,"plotLength":10,"rooms":[...]}' className="mt-2 w-full px-3 py-2 border border-stone-200 rounded-lg text-[10px] font-mono" />
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
                      onClick={() => { setStyle(opt.id); invalidateResult(); }}
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
                      onClick={() => { setBudget(tier.id); invalidateResult(); }}
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
                  <InteriorFloorPlan
                    result={result}
                    selectedFurnitureId={selectedFurnitureId}
                    onSelectFurniture={(id) => onSelectFurniture?.(id)}
                  />
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
