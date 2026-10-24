import React, { useMemo } from 'react';
import * as THREE from 'three';
import type { HouseModel } from './model/types';
import { wallPieces } from './model/wallPieces';
import { makeMaterials } from './materials';

export const Walls: React.FC<{ model: HouseModel }> = ({ model }) => {
  const materials = useMemo(makeMaterials, []);
  const pieces = useMemo(() => model.walls.flatMap((wall) => wallPieces(wall).map((piece) => ({ wall, piece }))), [model]);
  return (
    <group>
      {pieces.map(({ wall, piece }, index) => {
        const along = (piece.s0 + piece.s1) / 2;
        const position: [number, number, number] = wall.axis === 'x'
          ? [wall.a.x + along, (piece.y0 + piece.y1) / 2, wall.a.z]
          : [wall.a.x, (piece.y0 + piece.y1) / 2, wall.a.z + along];
        const size: [number, number, number] = wall.axis === 'x'
          ? [piece.s1 - piece.s0, piece.y1 - piece.y0, wall.thickness]
          : [wall.thickness, piece.y1 - piece.y0, piece.s1 - piece.s0];
        return (
          <mesh key={`${wall.id}-${index}`} position={position} scale={size} material={wall.exterior ? materials.exteriorWall : materials.wall} userData={{ wallId: wall.id, exterior: wall.exterior }}>
            <boxGeometry args={[1, 1, 1]} />
          </mesh>
        );
      })}
    </group>
  );
};
