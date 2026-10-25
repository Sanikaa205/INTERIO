import React, { useMemo } from 'react';
import type { HouseModel, WallSegment, Opening } from './model/types';
import { makeMaterials } from './materials';
import { useDisposables } from './useDisposables';

export const Windows: React.FC<{ model: HouseModel }> = ({ model }) => {
  const materials = useMemo(makeMaterials, []);
  useDisposables(Object.values(materials));
  return <group>{model.walls.flatMap((wall) => wall.openings.filter((opening) => opening.kind === 'window').map((opening) => {
    const width = opening.end - opening.start;
    const horizontal = wall.axis === 'x';
    const center = (opening.start + opening.end) / 2;
    const position: [number, number, number] = horizontal
      ? [wall.a.x + center, (opening.sill + opening.head) / 2, wall.a.z]
      : [wall.a.x, (opening.sill + opening.head) / 2, wall.a.z + center];
    const glassSize: [number, number, number] = horizontal ? [width, opening.head - opening.sill, 0.025] : [0.025, opening.head - opening.sill, width];
    const bar = horizontal ? [0.05, opening.head - opening.sill, wall.thickness + 0.04] : [wall.thickness + 0.04, opening.head - opening.sill, 0.05];
    const cross = horizontal ? [width, 0.05, wall.thickness + 0.04] : [wall.thickness + 0.04, 0.05, width];
    return <group key={`${wall.id}-${opening.start}`}>
      <mesh position={position} scale={glassSize} material={materials.glass}><boxGeometry args={[1, 1, 1]} /></mesh>
      {[opening.start, opening.end].map((edge) => <mesh key={edge} position={horizontal ? [wall.a.x + edge, position[1], wall.a.z] : [wall.a.x, position[1], wall.a.z + edge]} scale={bar as [number, number, number]} material={materials.frame}><boxGeometry args={[1, 1, 1]} /></mesh>)}
      <mesh position={position} scale={cross as [number, number, number]} material={materials.frame}><boxGeometry args={[1, 1, 1]} /></mesh>
      <mesh position={horizontal ? [position[0], opening.sill, wall.a.z + (wall.exterior ? wall.thickness : -wall.thickness)] : [wall.a.x + (wall.exterior ? wall.thickness : -wall.thickness), opening.sill, position[2]]} scale={horizontal ? [width + 0.12, 0.08, 0.12] : [0.12, 0.08, width + 0.12]} material={materials.frame}><boxGeometry args={[1, 1, 1]} /></mesh>
    </group>;
  }))}</group>;
};
