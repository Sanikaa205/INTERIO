import React, { useRef } from 'react';
import type { WalkInput } from './useWalkInput';

export const VirtualJoystick: React.FC<{ inputRef: React.MutableRefObject<WalkInput> }> = ({ inputRef }) => {
  const base = useRef<HTMLDivElement>(null);
  const update = (event: React.PointerEvent) => {
    const rect = base.current?.getBoundingClientRect();
    if (!rect) return;
    const dx = event.clientX - (rect.left + rect.width / 2);
    const dy = event.clientY - (rect.top + rect.height / 2);
    const distance = Math.min(28, Math.hypot(dx, dy));
    const angle = Math.atan2(dy, dx);
    const x = distance ? (Math.cos(angle) * distance) / 28 : 0;
    const y = distance ? (Math.sin(angle) * distance) / 28 : 0;
    const dead = Math.hypot(x, y) < 0.15;
    inputRef.current.strafe = dead ? 0 : x;
    inputRef.current.forward = dead ? 0 : -y;
  };
  const reset = () => {
    inputRef.current.forward = 0;
    inputRef.current.strafe = 0;
  };
  return (
    <div ref={base} className="absolute bottom-6 left-6 z-20 h-24 w-24 rounded-full bg-stone-900/45 touch-none" onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); update(event); }} onPointerMove={update} onPointerUp={reset} onPointerCancel={reset}>
      <div className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-stone-200/80" />
    </div>
  );
};
