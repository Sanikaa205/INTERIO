import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import type { HouseModel } from './model/types';
import { wallPieces } from './model/wallPieces';
import type { FloorPlanFinishes, SurfaceFinish } from '../../types';
import { getWallFinishOverride, resolveWallFaceFinish } from './finishes';
import type { SelectedSurface } from './finishTypes';
import { getMaterialVariant } from './materialCatalog';
import { createFinishMaterial, makeMaterials } from './materials';
import { wallFacesCamera } from './model/cutaway';
import { faceFromMaterialIndex, faceTowardPoint, faceUReversed, wallFaceTargets } from './model/wallFaces';
import { WallFaceSelectionOverlay, WallSelectionOverlay } from './SelectionOverlay';

interface WallsProps {
  model: HouseModel;
  cutaway: boolean;
  finishes?: FloorPlanFinishes;
  selectedSurface: SelectedSurface | null;
  onSelectSurface: (surface: SelectedSurface) => void;
}

type WallMaterialCache = Map<string, THREE.MeshStandardMaterial>;

export const Walls: React.FC<WallsProps> = ({ model, cutaway, finishes, selectedSurface, onSelectSurface }) => {
  const pieces = useMemo(
    () => model.walls.flatMap((wall) => wallPieces(wall).map((piece) => ({ wall, piece }))),
    [model],
  );

  const { invalidate, camera } = useThree();

  // Each wall piece is one box with a 6-entry material array (px, nx, py, ny,
  // pz, nz). Room-facing faces get their resolved face finish; top, bottom and
  // jamb faces use the wall's base material. Materials are cached per
  // (wall, face, finish, size, offset) so editing one face rebuilds only that
  // face and untouched faces are reused.
  const cache = useRef<WallMaterialCache>(new Map());
  const { arrays, used } = useMemo(() => {
    const used = new Set<string>();
    const get = (key: string, create: () => THREE.MeshStandardMaterial) => {
      used.add(key);
      let material = cache.current.get(key);
      if (!material) {
        material = create();
        cache.current.set(key, material);
      }
      return material;
    };
    const defaultMaterial = (exterior: boolean) => {
      const defaults = makeMaterials();
      const material = (exterior ? defaults.exteriorWall : defaults.wall).clone();
      Object.values(defaults).forEach((item) => item.dispose());
      return material;
    };

    const arrays = pieces.map(({ wall, piece }) => {
      const length = piece.s1 - piece.s0;
      const height = piece.y1 - piece.y0;
      const size = `${length.toFixed(4)}x${height.toFixed(4)}`;

      const build = (finish: SurfaceFinish | undefined, flavour: string, reversedU: boolean) => {
        const base = `${wall.id}|${flavour}|${size}|${reversedU ? 'r' : 'f'}|${piece.s0.toFixed(4)},${piece.y0.toFixed(4)}`;
        if (!finish) return get(`${base}|default`, () => defaultMaterial(wall.exterior));
        return get(`${base}|${JSON.stringify(finish)}`, () => createFinishMaterial(getMaterialVariant(finish.variantId, finish.materialId), {
          width: length,
          height,
          scale: finish.scale,
          color: finish.color,
          roughness: finish.roughness,
          // Keep the pattern continuous across neighbouring pieces of a face.
          offsetX: reversedU ? wall.length - piece.s1 : piece.s0,
          offsetY: piece.y0,
          onTextureLoad: invalidate,
        }));
      };

      const baseMaterial = build(getWallFinishOverride(finishes, wall.id), 'base', false);
      const array: THREE.MeshStandardMaterial[] = new Array(6).fill(baseMaterial);
      for (const target of wallFaceTargets(wall)) {
        array[target.materialIndex] = build(
          resolveWallFaceFinish(finishes, wall.id, target.faceKey),
          `face:${target.faceKey}`,
          faceUReversed(target.dir),
        );
      }
      return array;
    });
    return { arrays, used };
  }, [pieces, finishes, invalidate]);

  // Dispose materials that are no longer referenced, and all on unmount.
  useEffect(() => {
    cache.current.forEach((material, key) => {
      if (!used.has(key)) {
        material.dispose();
        cache.current.delete(key);
      }
    });
  }, [used]);
  useEffect(() => {
    const current = cache.current;
    return () => {
      current.forEach((material) => material.dispose());
      current.clear();
    };
  }, []);

  const meshes = useRef<Array<THREE.Mesh | null>>([]);
  const center = useMemo(() => ({
    x: (model.bounds.minX + model.bounds.maxX) / 2,
    z: (model.bounds.minZ + model.bounds.maxZ) / 2,
  }), [model]);

  // Cutaway: fade the camera-facing exterior walls across every face material.
  // Only a transparency flip needs a shader recompile; opacity changes do not.
  useFrame(() => {
    pieces.forEach(({ wall }, index) => {
      const mesh = meshes.current[index];
      if (!mesh || !wall.exterior) return;
      const facing = cutaway && wallFacesCamera(wall, { x: camera.position.x, z: camera.position.z }, center);
      const transparent = Boolean(cutaway);
      const opacity = facing ? 0.08 : 1;
      const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const material of list) {
        if (material.transparent !== transparent) {
          material.transparent = transparent;
          material.needsUpdate = true;
        }
        if (material.opacity !== opacity) material.opacity = opacity;
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
        const isWholeSelected = selectedSurface?.kind === 'wall' && selectedSurface.wallId === wall.id;
        const selectedFace = selectedSurface?.kind === 'wall-face' && selectedSurface.wallId === wall.id
          ? wallFaceTargets(wall).find((target) => target.faceKey === selectedSurface.faceKey)
          : undefined;
        return (
          <group key={`${wall.id}-${index}`}>
            <mesh
              ref={(mesh) => { meshes.current[index] = mesh; }}
              position={position}
              scale={size}
              material={arrays[index]}
              userData={{ wallId: wall.id, exterior: wall.exterior }}
              onClick={(event) => {
                event.stopPropagation();
                if (event.delta > 4) return;
                // The clicked box face picks the side. Top, bottom and jamb
                // faces belong to no room, so fall back to the face that looks
                // toward the camera.
                const target = faceFromMaterialIndex(wall, event.face?.materialIndex ?? -1)
                  ?? faceTowardPoint(wall, { x: event.camera.position.x, z: event.camera.position.z });
                onSelectSurface(target
                  ? { kind: 'wall-face', wallId: wall.id, faceKey: target.faceKey }
                  : { kind: 'wall', wallId: wall.id });
              }}
            >
              <boxGeometry args={[1, 1, 1]} />
            </mesh>
            {/* Selection overlays sit off the real materials, so colours stay true. */}
            {isWholeSelected && <WallSelectionOverlay position={position} size={size} />}
            {selectedFace && (
              <WallFaceSelectionOverlay
                position={position}
                length={piece.s1 - piece.s0}
                height={piece.y1 - piece.y0}
                thickness={wall.thickness}
                axis={wall.axis}
                dir={selectedFace.dir}
              />
            )}
          </group>
        );
      })}
    </group>
  );
};
