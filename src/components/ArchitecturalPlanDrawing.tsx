import React from 'react';
import { FloorPlanResult, FloorPlanRoom } from '../types';

interface Props {
  plan: FloorPlanResult;
  selectedRoomId?: string;
  showGrid: boolean;
  showDimensions: boolean;
  onSelectRoom: (room: FloorPlanRoom) => void;
}

const ink = '#393630';
const wall = '#514c43';
const furnitureInk = '#62594e';

export const ArchitecturalPlanDrawing: React.FC<Props> = ({ plan, selectedRoomId, showGrid, showDimensions, onSelectRoom }) => {
  const { plotWidth: w, plotLength: h } = plan;
  const houseY = Math.min(...plan.rooms.map(room => room.y));
  const houseBottom = Math.max(...plan.rooms.map(room => room.y + room.height));
  return <svg viewBox={`-1.5 -1.55 ${w + 2.1} ${h + 2.15}`} className="w-full max-h-[560px] bg-[#fbfaf7] rounded-lg" role="img" aria-label={`Architectural floor plan, ${w} by ${h} meters`}>
    <defs>
      <pattern id="plan-grid" width="0.5" height="0.5" patternUnits="userSpaceOnUse"><path d="M .5 0H0V.5" fill="none" stroke="#e9e5dc" strokeWidth=".012" /></pattern>
      <pattern id="wood-floor" width="1.2" height=".18" patternUnits="userSpaceOnUse"><rect width="1.2" height=".18" fill="#eee8dc"/><path d="M0 .01H1.2M.32 .01V.18M.92 .01V.18" stroke="#d9d0c1" strokeWidth=".012"/><path d="M.08 .06H.28M.48 .12H.84M1 .06H1.13" stroke="#e3dbcd" strokeWidth=".012"/></pattern>
      <pattern id="tile-floor" width=".6" height=".6" patternUnits="userSpaceOnUse"><rect width=".6" height=".6" fill="#e9e7e1"/><path d="M.6 0H0V.6" fill="none" stroke="#d5d1c8" strokeWidth=".018"/></pattern>
      <pattern id="stone-floor" width=".8" height=".8" patternUnits="userSpaceOnUse"><rect width=".8" height=".8" fill="#e9e5dc"/><path d="M.8 0H0V.8" fill="none" stroke="#d5cfc3" strokeWidth=".016"/><circle cx=".18" cy=".23" r=".014" fill="#d9d3c8"/><circle cx=".58" cy=".62" r=".012" fill="#d9d3c8"/></pattern>
      <pattern id="hall-floor" width=".45" height=".45" patternUnits="userSpaceOnUse"><rect width=".45" height=".45" fill="#e7e3da"/><path d="M.45 0H0V.45" fill="none" stroke="#d4cec2" strokeWidth=".014"/></pattern>
      <filter id="furniture-shadow" x="-20%" y="-20%" width="140%" height="150%"><feGaussianBlur in="SourceAlpha" stdDeviation=".025"/><feOffset dy=".035"/><feComponentTransfer><feFuncA type="linear" slope=".16"/></feComponentTransfer><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>
    <rect x="0" y="0" width={w} height={h} fill="#f5f2eb" stroke="none"/>
    {showGrid && <rect x="0" y="0" width={w} height={h} fill="url(#plan-grid)"/>}
    {plan.circulationPaths?.map((path, index) => <g key={`path-${index}`} pointerEvents="none">
      <rect x={path.x} y={path.y} width={path.width} height={path.height} fill="url(#hall-floor)" stroke="#625e55" strokeWidth=".07"/>
      {path.width > path.height && <path d={`M${path.x+.18} ${path.y+path.height/2}H${path.x+path.width-.18}`} stroke="#a7a093" strokeWidth=".025" strokeDasharray=".12 .09"/>}
      {path.height > path.width * 1.5 && <path d={`M${path.x+path.width/2} ${path.y+.18}V${path.y+path.height-.18}`} stroke="#a7a093" strokeWidth=".025" strokeDasharray=".12 .09"/>}
      {path.width > path.height && path.width > 3.5 && <text x={path.x+path.width/2} y={path.y+path.height*.68} textAnchor="middle" fontFamily="Arial, sans-serif" fontSize=".12" fill="#777268">H A L L</text>}
    </g>)}
    {plan.rooms.map(room => <Room key={room.id} room={room} selected={selectedRoomId === room.id} onSelect={() => onSelectRoom(room)}/>)}
    {/* Building envelope and the lighter surveyed plot limit. */}
    <rect x=".3" y={houseY} width={Math.max(0,w-.6)} height={houseBottom-houseY} fill="none" stroke={wall} strokeWidth=".20" pointerEvents="none"/>
    <rect x="0" y="0" width={w} height={h} fill="none" stroke="#b9b3a8" strokeWidth=".035" strokeDasharray=".16 .11" pointerEvents="none"/>
    {plan.rooms.map(r => <OpeningSymbols key={`open-${r.id}`} room={r}/>)}
    {plan.entrance && <EntranceSymbol x={plan.entrance.x} y={plan.entrance.y} side={plan.entrance.side}/>}
    {showDimensions && <DimensionLines width={w} height={h}/>}
    <g transform={`translate(${Math.max(.35,w-.85)} .28)`} aria-label="North arrow"><path d="M0 .35V-.12M0-.12L-.12 .08M0-.12L.12 .08" fill="none" stroke={ink} strokeWidth=".045"/><text x="0" y="-.22" textAnchor="middle" fontSize=".18" fontFamily="sans-serif" fill={ink}>N</text></g>
  </svg>;
};

function Room({ room, selected, onSelect }: {room: FloorPlanRoom; selected: boolean; onSelect: () => void}) {
  const type = `${room.type} ${room.name}`.toLowerCase();
  const floor = /bath|powder|utility|laundry/.test(type) ? 'url(#tile-floor)' : /kitchen/.test(type) ? 'url(#stone-floor)' : 'url(#wood-floor)';
  const labelY = /bath|powder/.test(type) ? room.y + room.height * .68 : room.y + room.height - .22;
  return <g onClick={onSelect} className="cursor-pointer" role="button" aria-label={`${room.name}, ${room.width} by ${room.height} meters`}>
    <rect x={room.x} y={room.y} width={room.width} height={room.height} fill={floor}/>
    <Furniture room={room}/>
    {room.height > 1.8 && room.width > 2.5 && <g pointerEvents="none" textAnchor="middle" fontFamily="Arial, sans-serif">
      <rect x={room.x+room.width/2-.72} y={labelY-.17} width="1.44" height=".38" rx=".035" fill="#fbfaf7" fillOpacity=".92"/>
      <text x={room.x+room.width/2} y={labelY-.015} fontSize=".15" fontWeight="600" fill="#34322e">{truncate(room.name, 19)}</text>
      <text x={room.x+room.width/2} y={labelY+.13} fontSize=".105" fill="#777268">{(room.area || room.width*room.height).toFixed(1)} m²  ·  {room.width.toFixed(1)} × {room.height.toFixed(1)} m</text>
    </g>}
    {/* Internal partitions read as substantial cut masonry, with a fine reveal edge. */}
    <rect x={room.x} y={room.y} width={room.width} height={room.height} fill="none" stroke={selected ? '#282720' : wall} strokeWidth={selected ? '.13' : '.105'} strokeLinejoin="miter"/>
  </g>;
}

function Furniture({room}: {room: FloorPlanRoom}) {
  const t = `${room.type} ${room.name}`.toLowerCase();
  const x=room.x, y=room.y, w=room.width, h=room.height;
  if (/bath|powder/.test(t)) return <g filter="url(#furniture-shadow)" stroke={furnitureInk} strokeWidth=".025" fill="#faf9f5">
    {room.doorSide === 'left' ? <><rect x={x+w-.98} y={y+.16} width=".82" height={Math.min(1.18,h*.37)} rx=".08"/><ellipse cx={x+w-.57} cy={y+.39} rx=".23" ry=".13" fill="#e8f0ef"/><rect x={x+.18} y={y+.16} width=".72" height=".5" rx=".06"/><ellipse cx={x+.54} cy={y+.41} rx=".2" ry=".11" fill="#fff"/><ellipse cx={x+.5} cy={y+h-.48} rx=".27" ry=".36"/><ellipse cx={x+.5} cy={y+h-.48} rx=".16" ry=".2" fill="#e6ece9"/><path d={`M${x+.5} ${y+h-.84}v-.1`} fill="none"/></> : <><rect x={x+.16} y={y+.16} width={Math.min(.82,w*.32)} height={Math.min(1.18,h*.37)} rx=".08"/><ellipse cx={x+.57} cy={y+.39} rx=".23" ry=".13" fill="#e8f0ef"/><rect x={x+w-.9} y={y+.16} width=".72" height=".5" rx=".06"/><ellipse cx={x+w-.54} cy={y+.41} rx=".2" ry=".11" fill="#fff"/><ellipse cx={x+w-.48} cy={y+h-.48} rx=".27" ry=".36"/><ellipse cx={x+w-.48} cy={y+h-.48} rx=".16" ry=".2" fill="#e6ece9"/><path d={`M${x+w-.48} ${y+h-.84}v-.1`} fill="none"/></>}
  </g>;
  if (/kitchen/.test(t)) { const hasDining = /dining/.test(t); const fridgeX = room.doorSide === 'left' ? x+w-.86 : x+.18; return <g filter="url(#furniture-shadow)" stroke={furnitureInk} strokeWidth=".025">
    <path d={`M${x+.13} ${y+.14}h${Math.max(.3,w-.26)}v.62h-${Math.max(.3,w-.26)}z`} fill="#d8d1c4"/><path d={`M${x+.17} ${y+.19}h${Math.max(.2,w-.34)}v.48h-${Math.max(.2,w-.34)}z`} fill="#f4f1e9"/><rect x={x+.24} y={y+.26} width={Math.min(.62,w*.25)} height=".34" rx=".03" fill="#dce2df"/><circle cx={x+.55} cy={y+.43} r=".035" fill="none"/><path d={`M${x+w-.82} ${y+h*.48+.1}h.56`} fill="none"/>
    {!hasDining && <><rect x={x+w-.9} y={y+h*.48} width={Math.min(.72,w*.32)} height={Math.min(.52,h*.25)} rx=".06" fill="#d9d0c0"/><rect x={x+w-.39} y={y+.25} width=".05" height=".18" rx=".02" fill="#4f4c45"/><circle cx={x+w-.29} cy={y+.31} r=".05" fill="#4f4c45"/><circle cx={x+w-.29} cy={y+.48} r=".05" fill="#4f4c45"/></>}
    <rect x={fridgeX} y={y+h-.82} width=".68" height=".58" rx=".035" fill="#d4d0c6"/><path d={`M${fridgeX+.07} ${y+h-.72}h.54M${fridgeX+.07} ${y+h-.4}h.54`} stroke="#8d877d"/>
    {hasDining && <g><rect x={x+w*.32} y={y+h*.35} width={w*.36} height={h*.22} rx=".06" fill="#b99f80"/><rect x={x+w*.2} y={y+h*.36} width=".28" height=".3" rx=".07" fill="#d8cbb9"/><rect x={x+w*.8-.28} y={y+h*.36} width=".28" height=".3" rx=".07" fill="#d8cbb9"/><rect x={x+w*.2} y={y+h*.52} width=".28" height=".3" rx=".07" fill="#d8cbb9"/><rect x={x+w*.8-.28} y={y+h*.52} width=".28" height=".3" rx=".07" fill="#d8cbb9"/></g>}
  </g>; }
  if (/bedroom|master bedroom/.test(t)) { const bw=Math.min(1.65,w*.58), bh=Math.min(2.05,h*.58), wardrobeX=room.doorSide==='left'?x+w-.72:x+.18; return <g filter="url(#furniture-shadow)" stroke={furnitureInk} strokeWidth=".027"><rect x={x+(w-bw)/2} y={y+.16} width={bw} height={bh} rx=".07" fill="#c8b9a6"/><rect x={x+(w-bw)/2+.07} y={y+.23} width={bw-.14} height={bh-.2} rx=".06" fill="#e7e0d5"/><rect x={x+(w-bw)/2+.1} y={y+.29} width={bw*.38} height=".38" rx=".06" fill="#f8f6f0"/><rect x={x+(w-bw)/2+bw*.53} y={y+.29} width={bw*.38} height=".38" rx=".06" fill="#f8f6f0"/><path d={`M${x+(w-bw)/2+.12} ${y+.78}h${bw-.24}`} stroke="#c4b7a6" fill="none"/><rect x={x+.18} y={y+.2} width=".34" height=".42" rx=".03" fill="#d1c5b4"/><rect x={x+w-.52} y={y+.2} width=".34" height=".42" rx=".03" fill="#d1c5b4"/><rect x={wardrobeX} y={y+1.05} width=".5" height="1.4" rx=".025" fill="#b8a58e"/><path d={`M${wardrobeX+.25} ${y+1.08}v1.34`} stroke="#827461"/></g>; }
  if (/living|lounge|family/.test(t)) return <g filter="url(#furniture-shadow)" stroke={furnitureInk} strokeWidth=".027"><rect x={x+.18} y={y+.2} width={Math.min(2.15,w*.64)} height=".78" rx=".13" fill="#cbbca9"/><rect x={x+.25} y={y+.27} width={Math.min(2,w*.61)} height=".42" rx=".08" fill="#e5ddd1"/><path d={`M${x+.88} ${y+.28}v.39M${x+1.5} ${y+.28}v.39`} stroke="#c3b6a6"/><rect x={x+.55} y={y+1.25} width={Math.min(1.05,w*.34)} height=".58" rx=".05" fill="#b99d7e"/><path d={`M${x+.67} ${y+1.38}h${Math.min(.8,w*.28)}`} stroke="#d3c0a8"/></g>;
  if (/office|study/.test(t)) return <g filter="url(#furniture-shadow)" stroke={furnitureInk} strokeWidth=".027"><rect x={x+.25} y={y+.3} width={Math.min(1.55,w*.55)} height=".72" rx=".045" fill="#b99f80"/><path d={`M${x+.34} ${y+.38}h${Math.min(1.35,w*.48)}v.53h-${Math.min(1.35,w*.48)}z`} fill="#e6dfd3"/><rect x={x+.72} y={y+1.15} width=".42" height=".42" rx=".08" fill="#d5c9b8"/><rect x={x+w-.64} y={y+.28} width=".42" height="1.25" rx=".035" fill="#c2b19a"/><path d={`M${x+w-.57} ${y+.66}h.28M${x+w-.57} ${y+1.04}h.28`} stroke="#8d7f6c"/></g>;
  if (/hall|foyer/.test(t)) return <g filter="url(#furniture-shadow)" stroke={furnitureInk} strokeWidth=".025"><rect x={x+.18} y={y+.25} width={Math.min(.9,w*.4)} height=".32" rx=".03" fill="#b99f80"/><path d={`M${x+.25} ${y+.32}h${Math.min(.75,w*.32)}`} stroke="#d7c6af"/><circle cx={x+w-.34} cy={y+.42} r=".2" fill="#8b987e"/><circle cx={x+w-.34} cy={y+.42} r=".08" fill="#c8d0bb"/></g>;
  if (/dining/.test(t)) return <g filter="url(#furniture-shadow)" stroke={furnitureInk} strokeWidth=".027"><rect x={x+w*.34} y={y+h*.3} width={w*.32} height={h*.28} rx=".08" fill="#b99f80"/><path d={`M${x+w*.39} ${y+h*.35}h${w*.22}M${x+w*.39} ${y+h*.43}h${w*.22}M${x+w*.39} ${y+h*.51}h${w*.22}`} stroke="#d3c0a8"/><rect x={x+w*.2} y={y+h*.34} width=".28" height=".3" rx=".08" fill="#d8cbb9"/><rect x={x+w*.8-.28} y={y+h*.34} width=".28" height=".3" rx=".08" fill="#d8cbb9"/><rect x={x+w*.2} y={y+h*.51} width=".28" height=".3" rx=".08" fill="#d8cbb9"/><rect x={x+w*.8-.28} y={y+h*.51} width=".28" height=".3" rx=".08" fill="#d8cbb9"/></g>;
  return <g filter="url(#furniture-shadow)" stroke={furnitureInk} strokeWidth=".025"><rect x={x+.18} y={y+.18} width={Math.min(1.25,w*.48)} height={Math.min(.72,h*.25)} rx=".04" fill="#d6c8b4"/><rect x={x+.24} y={y+.24} width={Math.min(1.13,w*.44)} height={Math.min(.6,h*.21)} rx=".025" fill="#eee8dd"/><path d={`M${x+.3} ${y+.3}h${Math.min(1,w*.4)}`} stroke="#c9bdac"/></g>;
}

function OpeningSymbols({room}: {room: FloorPlanRoom}) {
  const doorSide=room.doorSide || 'bottom', windowSide=room.windowSide || 'top';
  const doorW=Math.min(.85, doorSide==='left'||doorSide==='right' ? room.height*.4 : room.width*.4, .95);
  const winW=Math.min(1.25, windowSide==='left'||windowSide==='right' ? room.height*.55 : room.width*.55);
  const door=opening(room,doorSide,doorW); const win=opening(room,windowSide,winW);
  return <g pointerEvents="none">
    <path d={door.gap} stroke="#fbfaf7" strokeWidth=".19" fill="none"/>
    <path d={door.leaf} stroke="#7b593d" strokeWidth=".045" fill="none"/>
    <path d={door.arc} stroke="#9b8064" strokeWidth=".022" fill="none" strokeDasharray=".045 .035"/>
    <path d={win.gap} stroke="#fbfaf7" strokeWidth=".18" fill="none"/>
    <path d={win.frame} stroke="#70838a" strokeWidth=".045" fill="none"/>
    <path d={win.glass} stroke="#a8c0c5" strokeWidth=".035" fill="none"/>
  </g>;
}
function opening(r:Pick<FloorPlanRoom,'x'|'y'|'width'|'height'>,side:string,len:number) {
  const x=r.x,y=r.y,w=r.width,h=r.height, inset=.012;
  if(side==='top'){const a=x+(w-len)/2,b=a+len;return {gap:`M${a} ${y}H${b}`,frame:`M${a} ${y-inset}H${b}M${a} ${y+.08}H${b}`,glass:`M${a} ${y+.04}H${b}`,leaf:`M${a} ${y}V${y+len}`,arc:`M${b} ${y}A${len} ${len} 0 0 1 ${a} ${y+len}`};}
  if(side==='bottom'){const a=x+(w-len)/2,b=a+len,Y=y+h;return {gap:`M${a} ${Y}H${b}`,frame:`M${a} ${Y+inset}H${b}M${a} ${Y-.08}H${b}`,glass:`M${a} ${Y-.04}H${b}`,leaf:`M${a} ${Y}V${Y-len}`,arc:`M${b} ${Y}A${len} ${len} 0 0 0 ${a} ${Y-len}`};}
  if(side==='left'){const a=y+(h-len)/2,b=a+len;return {gap:`M${x} ${a}V${b}`,frame:`M${x-inset} ${a}V${b}M${x+.08} ${a}V${b}`,glass:`M${x+.04} ${a}V${b}`,leaf:`M${x} ${a}H${x+len}`,arc:`M${x} ${b}A${len} ${len} 0 0 0 ${x+len} ${a}`};}
  const a=y+(h-len)/2,b=a+len,X=x+w;return {gap:`M${X} ${a}V${b}`,frame:`M${X+inset} ${a}V${b}M${X-.08} ${a}V${b}`,glass:`M${X-.04} ${a}V${b}`,leaf:`M${X} ${a}H${X-len}`,arc:`M${X} ${b}A${len} ${len} 0 0 1 ${X-len} ${a}`};
}
function EntranceSymbol({x,y,side}:{x:number;y:number;side:'top'|'bottom'|'left'|'right'}) {
  const host = side==='top' ? {x:x-.5,y,width:1,height:1} : side==='bottom' ? {x:x-.5,y:y-1,width:1,height:1} : side==='left' ? {x,y:y-.5,width:1,height:1} : {x:x-1,y:y-.5,width:1,height:1};
  const door=opening(host,side,.82);
  return <g pointerEvents="none"><path d={door.gap} stroke="#fbfaf7" strokeWidth=".20" fill="none"/><path d={door.leaf} stroke="#624a36" strokeWidth=".05" fill="none"/><path d={door.arc} stroke="#98795b" strokeWidth=".025" fill="none" strokeDasharray=".06 .04"/><text x={x} y={side==='top'?y-.13:side==='bottom'?y+.28:y-.12} textAnchor="middle" fontSize=".11" fontFamily="Arial, sans-serif" fill="#70695f">ENTRY</text></g>;
}
function DimensionLines({width:w,height:h}:{width:number;height:number}) {
  return <g fill="#655f55" stroke="#8b857b" strokeWidth=".018" fontFamily="Arial, sans-serif" fontSize=".16">
    <path d={`M0 -.72H${w}M0 -.82V-.62M${w} -.82V-.62`} fill="none"/><path d={`M-.08 -.8L.08 -.64M${w-.08} -.8L${w+.08} -.64`} />
    <rect x={w/2-.38} y="-.84" width=".76" height=".24" fill="#fbfaf7" stroke="none"/><text x={w/2} y="-.66" textAnchor="middle" stroke="none">{w.toFixed(2)} m</text>
    <path d={`M-.72 0V${h}M-.82 0H-.62M-.82 ${h}H-.62`} fill="none"/><path d={`M-.8 -.08L-.64 .08M-.8 ${h-.08}L-.64 ${h+.08}`}/>
    <text x="-.79" y={h/2} textAnchor="middle" stroke="none" transform={`rotate(-90 -.79 ${h/2})`}>{h.toFixed(2)} m</text>
  </g>;
}
function truncate(s:string,n:number){return s.length>n?`${s.slice(0,n-1)}…`:s;}
