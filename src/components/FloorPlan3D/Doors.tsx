import React, { useMemo } from 'react';
import * as THREE from 'three';
import type { HouseModel, WallSegment, Opening } from './model/types';
import { DOOR_HEIGHT, WALL_HEIGHT } from './model/constants';
import { makeMaterials } from './materials';
import { useDisposables } from './useDisposables';

function openingPosition(wall: WallSegment, opening: Opening, y: number, inset = 0): [number, number, number] {
  const along = (opening.start + opening.end) / 2;
  return wall.axis === 'x' ? [wall.a.x + along, y, wall.a.z + inset] : [wall.a.x + inset, y, wall.a.z + along];
}

export const Doors: React.FC<{ model: HouseModel }> = ({ model }) => {
  const materials = useMemo(makeMaterials, []);
  useDisposables(Object.values(materials));
  return <group>{model.walls.flatMap((wall) => wall.openings.filter((opening) => opening.kind === 'door').map((opening) => {
    const width = opening.end - opening.start;
    const horizontal = wall.axis === 'x';
    const frameSize: [number, number, number] = horizontal ? [0.06, DOOR_HEIGHT, wall.thickness + 0.04] : [wall.thickness + 0.04, DOOR_HEIGHT, 0.06];
    const barSize: [number, number, number] = horizontal ? [0.06, DOOR_HEIGHT, wall.thickness + 0.04] : [wall.thickness + 0.04, DOOR_HEIGHT, 0.06];
    const left = openingPosition(wall, { ...opening, end: opening.start }, DOOR_HEIGHT / 2);
    const right = openingPosition(wall, { ...opening, start: opening.end }, DOOR_HEIGHT / 2);
    const head = openingPosition(wall, opening, DOOR_HEIGHT - 0.03);
    const leafPosition = openingPosition(wall, opening, DOOR_HEIGHT / 2, wall.axis === 'x' ? wall.thickness / 2 : wall.thickness / 2);
    const leafSize: [number, number, number] = horizontal ? [width, DOOR_HEIGHT, 0.04] : [0.04, DOOR_HEIGHT, width];
    return <group key={`${wall.id}-${opening.start}`}>
      <mesh position={left} scale={frameSize} material={materials.frame}><boxGeometry args={[1, 1, 1]} /></mesh>
      <mesh position={right} scale={barSize} material={materials.frame}><boxGeometry args={[1, 1, 1]} /></mesh>
      <mesh position={head} scale={horizontal ? [width, 0.06, wall.thickness + 0.04] : [wall.thickness + 0.04, 0.06, width]} material={materials.frame}><boxGeometry args={[1, 1, 1]} /></mesh>
      {width <= 1.5 && <mesh position={leafPosition} rotation={[0, opening.isMainEntry ? -0.35 : -1.2, 0]} scale={leafSize} material={opening.isMainEntry ? materials.mainDoor : materials.door}><boxGeometry args={[1, 1, 1]} /></mesh>}
    </group>;
  }))}</group>;
};
