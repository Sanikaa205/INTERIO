import React, { useMemo } from 'react';
import * as THREE from 'three';
import type { HouseModel } from './model/types';
import { floorMaterial } from './materials';

export const Floors: React.FC<{ model: HouseModel }> = ({ model }) => {
  const materials = useMemo(() => new Map(model.floors.map((floor) => [floor.roomId, floorMaterial(floor.color)])), [model]);
  return (
    <group>
      {model.floors.map((floor) => (
        <mesh key={floor.roomId} position={[floor.x + floor.width / 2, 0, floor.z + floor.depth / 2]} rotation={[-Math.PI / 2, 0, 0]} material={materials.get(floor.roomId)}>
          <planeGeometry args={[floor.width, floor.depth]} />
        </mesh>
      ))}
      <mesh position={[(model.bounds.minX + model.bounds.maxX) / 2, -0.02, (model.bounds.minZ + model.bounds.maxZ) / 2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[model.bounds.maxX - model.bounds.minX, model.bounds.maxZ - model.bounds.minZ]} />
        <meshStandardMaterial color="#aaa49a" roughness={1} />
      </mesh>
    </group>
  );
};
