import React from 'react';
import { Html } from '@react-three/drei';
import type { HouseModel } from './model/types';

export const RoomLabels: React.FC<{ model: HouseModel }> = ({ model }) => (
  <group>
    {model.rooms.filter((room) => room.width >= 1.5 && room.depth >= 1.5).map((room) => (
      <Html key={room.id} center position={[room.center.x, 0.1, room.center.z]} distanceFactor={10} occlude={false} zIndexRange={[1, 10]}>
        <div className="text-[11px] bg-white/80 rounded px-1.5 py-0.5 pointer-events-none select-none whitespace-nowrap">
          {room.name} · {(room.width * room.depth).toFixed(1)} m²
        </div>
      </Html>
    ))}
  </group>
);
