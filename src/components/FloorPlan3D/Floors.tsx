import React, { useMemo } from 'react';
import * as THREE from 'three';
import type { HouseModel } from './model/types';
import { floorMaterial } from './materials';
import { useDisposables } from './useDisposables';

export const Floors: React.FC<{ model: HouseModel; focusedRoomId: string | null; onFocus: (roomId: string) => void; onClearFocus: () => void }> = ({ model, focusedRoomId, onFocus, onClearFocus }) => {
  const materials = useMemo(() => new Map(model.floors.map((floor) => {
    const material = floorMaterial(floor.color);
    if (floor.roomId === focusedRoomId) {
      material.emissive.set('#fff0a0');
      material.emissiveIntensity = 0.35;
    }
    return [floor.roomId, material] as const;
  })), [model, focusedRoomId]);
  useDisposables([...materials.values()]);
  return (
    <group>
      {model.floors.map((floor) => (
        <mesh key={floor.roomId} position={[floor.x + floor.width / 2, 0, floor.z + floor.depth / 2]} rotation={[-Math.PI / 2, 0, 0]} material={materials.get(floor.roomId)} onClick={(event) => { event.stopPropagation(); if (event.delta <= 4) onFocus(floor.roomId); }}>
          <planeGeometry args={[floor.width, floor.depth]} />
        </mesh>
      ))}
      <mesh onClick={onClearFocus} visible={false}>
        <planeGeometry args={[1, 1]} />
      </mesh>
      <mesh position={[(model.bounds.minX + model.bounds.maxX) / 2, -0.02, (model.bounds.minZ + model.bounds.maxZ) / 2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[model.bounds.maxX - model.bounds.minX, model.bounds.maxZ - model.bounds.minZ]} />
        <meshStandardMaterial color="#aaa49a" roughness={1} />
      </mesh>
    </group>
  );
};
