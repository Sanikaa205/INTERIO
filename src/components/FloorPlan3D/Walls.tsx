import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import type { HouseModel } from './model/types';
import { wallPieces } from './model/wallPieces';
import { makeMaterials } from './materials';
import { wallFacesCamera } from './model/cutaway';

export const Walls: React.FC<{ model: HouseModel; cutaway: boolean }> = ({ model, cutaway }) => {
  const materials = useMemo(makeMaterials, []);
  const pieces = useMemo(() => model.walls.flatMap((wall) => wallPieces(wall).map((piece) => ({ wall, piece }))), [model]);
  const meshes = useRef<Array<THREE.Mesh | null>>([]);
  const { camera } = useThree();
  const center = useMemo(() => ({
    x: (model.bounds.minX + model.bounds.maxX) / 2,
    z: (model.bounds.minZ + model.bounds.maxZ) / 2,
  }), [model]);
  useFrame(() => {
    pieces.forEach(({ wall }, index) => {
      const mesh = meshes.current[index];
      if (!mesh || !wall.exterior) return;
      if (Array.isArray(mesh.material)) return;
      const facing = cutaway && wallFacesCamera(wall, { x: camera.position.x, z: camera.position.z }, center);
      mesh.material.transparent = Boolean(cutaway);
      mesh.material.opacity = facing ? 0.08 : 1;
    });
  });
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
          <mesh ref={(mesh) => { meshes.current[index] = mesh; }} key={`${wall.id}-${index}`} position={position} scale={size} material={wall.exterior ? materials.exteriorWall.clone() : materials.wall} userData={{ wallId: wall.id, exterior: wall.exterior }}>
            <boxGeometry args={[1, 1, 1]} />
          </mesh>
        );
      })}
    </group>
  );
};
