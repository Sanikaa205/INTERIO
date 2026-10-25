import React, { useMemo } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import type { FloorPlanFinishes } from '../../types';
import type { HouseModel } from './model/types';
import { WALL_HEIGHT } from './model/constants';
import { getRoomFinishOverride } from './finishes';
import type { SelectedSurface } from './finishTypes';
import { getMaterialVariant } from './materialCatalog';
import { createFinishMaterial } from './materials';
import { useDisposables } from './useDisposables';
import { FloorSelectionOverlay } from './SelectionOverlay';

interface CeilingsProps {
  model: HouseModel;
  finishes?: FloorPlanFinishes;
  selectedSurface: SelectedSurface | null;
  onSelectSurface: (surface: SelectedSurface) => void;
}

export const Ceilings: React.FC<CeilingsProps> = ({ model, finishes, selectedSurface, onSelectSurface }) => {
  const { invalidate } = useThree();
  // 1.2 — Materials no longer set emissive; selection shown via overlay mesh.
  const materials = useMemo(() => new Map(model.floors.map((floor) => {
    const finish = getRoomFinishOverride(finishes, floor.roomId, 'ceiling');
    const material = finish
      ? createFinishMaterial(getMaterialVariant(finish.variantId, finish.materialId), {
        width: floor.width,
        height: floor.depth,
        scale: finish.scale,
        color: finish.color,
        roughness: finish.roughness,
        onTextureLoad: invalidate, // 1.4
      })
      : new THREE.MeshStandardMaterial({ color: '#f4f1ec', side: THREE.BackSide });
    material.side = THREE.BackSide;
    return [floor.roomId, material] as const;
  })), [model, finishes]);
  useDisposables([...materials.values()]);
  return (
    <group>
      {model.floors.map((floor) => {
        const isSelected = selectedSurface?.kind === 'room-ceiling' && selectedSurface.roomId === floor.roomId;
        const cx = floor.x + floor.width / 2;
        const cz = floor.z + floor.depth / 2;
        return (
          <group key={floor.roomId}>
            <mesh
              position={[cx, WALL_HEIGHT, cz]}
              rotation={[-Math.PI / 2, 0, 0]}
              material={materials.get(floor.roomId)}
              onClick={(event) => {
                event.stopPropagation();
                if (event.delta <= 4) onSelectSurface({ kind: 'room-ceiling', roomId: floor.roomId });
              }}
            >
              <planeGeometry args={[floor.width, floor.depth]} />
            </mesh>
            {/* 1.2 — Ceiling selection overlay (offset downward so it's inside the room) */}
            {isSelected && (
              <FloorSelectionOverlay position={[cx, WALL_HEIGHT, cz]} width={floor.width} depth={floor.depth} />
            )}
          </group>
        );
      })}
    </group>
  );
};
