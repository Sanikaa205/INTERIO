import React, { useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import type { FloorPlanFinishes } from '../../types';
import type { HouseModel } from './model/types';
import { getRoomFinishOverride } from './finishes';
import { getMaterialVariant } from './materialCatalog';
import { createFinishMaterial, floorMaterial } from './materials';
import type { SelectedSurface } from './finishTypes';
import { useDisposables } from './useDisposables';
import { FloorSelectionOverlay } from './SelectionOverlay';

interface FloorsProps {
  model: HouseModel;
  finishes?: FloorPlanFinishes;
  focusedRoomId: string | null;
  selectedSurface: SelectedSurface | null;
  onFocus: (roomId: string) => void;
  onSelectSurface: (surface: SelectedSurface) => void;
  onClearFocus: () => void;
}

export const Floors: React.FC<FloorsProps> = ({ model, finishes, focusedRoomId, selectedSurface, onFocus, onSelectSurface, onClearFocus }) => {
  const { invalidate } = useThree();
  // 1.2 — Materials no longer set emissive; selection is shown via overlay mesh.
  const materials = useMemo(() => new Map(model.floors.map((floor) => {
    const finish = getRoomFinishOverride(finishes, floor.roomId, 'floor');
    const material = finish
      ? createFinishMaterial(getMaterialVariant(finish.variantId, finish.materialId), {
        width: floor.width,
        height: floor.depth,
        scale: finish.scale,
        color: finish.color,
        roughness: finish.roughness,
        onTextureLoad: invalidate, // 1.4
      })
      : floorMaterial(floor.color);
    return [floor.roomId, material] as const;
  })), [model, finishes]);
  useDisposables([...materials.values()]);
  return (
    <group>
      {model.floors.map((floor) => {
        const isSelected = selectedSurface?.kind === 'room-floor' && selectedSurface.roomId === floor.roomId;
        const isFocused = floor.roomId === focusedRoomId;
        const cx = floor.x + floor.width / 2;
        const cz = floor.z + floor.depth / 2;
        return (
          <group key={floor.roomId}>
            <mesh
              position={[cx, 0, cz]}
              rotation={[-Math.PI / 2, 0, 0]}
              material={materials.get(floor.roomId)}
              onClick={(event) => {
                event.stopPropagation();
                if (event.delta <= 4) {
                  onFocus(floor.roomId);
                  onSelectSurface({ kind: 'room-floor', roomId: floor.roomId });
                }
              }}
            >
              <planeGeometry args={[floor.width, floor.depth]} />
            </mesh>
            {/* 1.2 — Selection/focus overlays replace emissive tinting */}
            {isSelected && (
              <FloorSelectionOverlay position={[cx, 0, cz]} width={floor.width} depth={floor.depth} />
            )}
            {isFocused && !isSelected && (
              <mesh
                position={[cx, 0.002, cz]}
                rotation={[-Math.PI / 2, 0, 0]}
                renderOrder={1}
                userData={{ selectionOverlay: true }}
              >
                <planeGeometry args={[floor.width, floor.depth]} />
                <meshBasicMaterial color="#fff0a0" transparent opacity={0.22} depthWrite={false} />
              </mesh>
            )}
          </group>
        );
      })}
      <mesh onClick={onClearFocus} visible={false}>
        <planeGeometry args={[1, 1]} />
      </mesh>
      <mesh position={[(model.bounds.minX + model.bounds.maxX) / 2, -0.02, (model.bounds.minZ + model.bounds.maxZ) / 2]} rotation={[-Math.PI / 2, 0, 0]} onClick={(event) => { event.stopPropagation(); onClearFocus(); }}>
        <planeGeometry args={[model.bounds.maxX - model.bounds.minX, model.bounds.maxZ - model.bounds.minZ]} />
        <meshStandardMaterial color="#aaa49a" roughness={1} />
      </mesh>
    </group>
  );
};
