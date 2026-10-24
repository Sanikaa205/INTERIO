import React from 'react';
import * as THREE from 'three';
import type { HouseModel } from './model/types';
import { WALL_HEIGHT } from './model/constants';

export const Ceilings: React.FC<{ model: HouseModel }> = ({ model }) => (
  <group>{model.floors.map((floor) => (
    <mesh key={floor.roomId} position={[floor.x + floor.width / 2, WALL_HEIGHT, floor.z + floor.depth / 2]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[floor.width, floor.depth]} />
      <meshStandardMaterial color="#f4f1ec" side={THREE.BackSide} />
    </mesh>
  ))}</group>
);
