import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import type { HouseModel } from './model/types';
import { wallPieces } from './model/wallPieces';
import type { FloorPlanFinishes } from '../../types';
import { getWallFinishOverride } from './finishes';
import type { SelectedSurface } from './finishTypes';
import { getMaterialVariant } from './materialCatalog';
import { createFinishMaterial, makeMaterials } from './materials';
import { wallFacesCamera } from './model/cutaway';
import { useDisposables } from './useDisposables';
import { WallSelectionOverlay } from './SelectionOverlay';

interface WallsProps {
  model: HouseModel;
  cutaway: boolean;
  finishes?: FloorPlanFinishes;
  selectedSurface: SelectedSurface | null;
  onSelectSurface: (surface: SelectedSurface) => void;
}

export const Walls: React.FC<WallsProps> = ({ model, cutaway, finishes, selectedSurface, onSelectSurface }) => {
  const pieces = useMemo(
    () => model.walls.flatMap((wall) => wallPieces(wall).map((piece) => ({ wall, piece }))),
    [model],
  );

  // 1.2 — Materials no longer set emissive; selection shown via WallSelectionOverlay.
  // 1.3 — UV repeat is computed from the actual piece's physical size in metres
  //        so textures keep correct proportions on long, short, or partial pieces.
  const { invalidate } = useThree();
  const materials = useMemo(() => {
    const defaults = makeMaterials();
    const result = pieces.map(({ wall, piece }) => {
      const finish = getWallFinishOverride(finishes, wall.id);
      // 1.3: piece dimensions in metres for correct UV tiling.
      const pieceWidth = piece.s1 - piece.s0;
      const pieceHeight = piece.y1 - piece.y0;
      const material = finish
        ? createFinishMaterial(getMaterialVariant(finish.variantId, finish.materialId), {
          width: pieceWidth,
          height: pieceHeight,
          scale: finish.scale,
          color: finish.color,
          roughness: finish.roughness,
          onTextureLoad: invalidate, // 1.4
        })
        : (wall.exterior ? defaults.exteriorWall.clone() : defaults.wall.clone());
      return material;
    });
    Object.values(defaults).forEach((material) => material.dispose());
    return result;
  }, [pieces, finishes]); // 1.2: selectedSurface removed from deps — emissive gone

  useDisposables(materials);

  const meshes = useRef<Array<THREE.Mesh | null>>([]);
  const { camera } = useThree();
  const center = useMemo(() => ({
    x: (model.bounds.minX + model.bounds.maxX) / 2,
    z: (model.bounds.minZ + model.bounds.maxZ) / 2,
  }), [model]);

  // 1.5 (part of 1.2) — Cutaway: iterate all entries if material is an array.
  useFrame(() => {
    pieces.forEach(({ wall }, index) => {
      const mesh = meshes.current[index];
      if (!mesh || !wall.exterior) return;
      const mat = mesh.material;
      const facing = cutaway && wallFacesCamera(wall, { x: camera.position.x, z: camera.position.z }, center);
      const transparent = Boolean(cutaway);
      const opacity = facing ? 0.08 : 1;
      if (Array.isArray(mat)) {
        mat.forEach((m) => {
          if (m.transparent !== transparent || m.opacity !== opacity) {
            m.transparent = transparent;
            m.opacity = opacity;
            m.needsUpdate = true;
          }
        });
      } else {
        mat.transparent = transparent;
        mat.opacity = opacity;
      }
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
        const isSelected = selectedSurface?.kind === 'wall' && selectedSurface.wallId === wall.id;
        return (
          <group key={`${wall.id}-${index}`}>
            <mesh
              ref={(mesh) => { meshes.current[index] = mesh; }}
              position={position}
              scale={size}
              material={materials[index]}
              userData={{ wallId: wall.id, exterior: wall.exterior }}
              onClick={(event) => {
                event.stopPropagation();
                if (event.delta <= 4) onSelectSurface({ kind: 'wall', wallId: wall.id });
              }}
            >
              <boxGeometry args={[1, 1, 1]} />
            </mesh>
            {/* 1.2 — Selection overlay replaces emissive tinting */}
            {isSelected && (
              <WallSelectionOverlay position={position} size={size} />
            )}
          </group>
        );
      })}
    </group>
  );
};
