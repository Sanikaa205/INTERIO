import React, { useMemo } from 'react';
import * as THREE from 'three';
import { faceNormal, type FaceDir } from './model/wallFaces';

/**
 * 1.2 — Selection highlight overlay.
 *
 * Renders a thin translucent plane (or box for walls) slightly offset from
 * the surface so the real material's emissive is never touched.  This means:
 *  - The displayed colour equals the chosen finish colour exactly.
 *  - GLB exports contain no emissive tinting (exportGlb uses `onlyVisible:true`
 *    and overlays are marked `userData.selectionOverlay = true` then hidden
 *    before export).
 */

const OVERLAY_MATERIAL = new THREE.MeshBasicMaterial({
  color: '#9ee8ff',
  transparent: true,
  opacity: 0.28,
  depthWrite: false,
  side: THREE.DoubleSide,
});

interface FloorOverlayProps {
  /** World-space center position. */
  position: [number, number, number];
  width: number;
  depth: number;
}

/** Highlight overlay for a floor or ceiling plane (PlaneGeometry). */
export const FloorSelectionOverlay: React.FC<FloorOverlayProps> = ({ position, width, depth }) => {
  const [x, y, z] = position;
  return (
    <mesh
      position={[x, y + 0.002, z]}
      rotation={[-Math.PI / 2, 0, 0]}
      material={OVERLAY_MATERIAL}
      renderOrder={1}
      userData={{ selectionOverlay: true }}
    >
      <planeGeometry args={[width, depth]} />
    </mesh>
  );
};

interface WallOverlayProps {
  /** World-space center position of the wall piece. */
  position: [number, number, number];
  size: [number, number, number];
}

/** Highlight overlay for a wall piece (BoxGeometry — covers all faces). */
export const WallSelectionOverlay: React.FC<WallOverlayProps> = ({ position, size }) => {
  // Inflate slightly so the overlay sits outside the wall geometry (2 mm).
  const inflated = useMemo<[number, number, number]>(
    () => [size[0] + 0.004, size[1] + 0.004, size[2] + 0.004],
    [size],
  );
  return (
    <mesh
      position={position}
      scale={inflated}
      material={OVERLAY_MATERIAL}
      renderOrder={1}
      userData={{ selectionOverlay: true }}
    >
      <boxGeometry args={[1, 1, 1]} />
    </mesh>
  );
};

interface FaceOverlayProps {
  /** World-space centre of the wall piece. */
  position: [number, number, number];
  /** Piece length along the wall, height, and wall thickness (metres). */
  length: number;
  height: number;
  thickness: number;
  axis: 'x' | 'z';
  /** Direction the selected face looks toward. */
  dir: FaceDir;
}

const FACE_ROTATION_Y: Record<FaceDir, number> = { pz: 0, nz: Math.PI, px: Math.PI / 2, nx: -Math.PI / 2 };

/**
 * Highlight for a single wall face: a thin translucent quad 2 mm in front of
 * the face, so the real material is never touched.
 */
export const WallFaceSelectionOverlay: React.FC<FaceOverlayProps> = ({ position, length, height, thickness, dir }) => {
  const n = faceNormal(dir);
  const offset = thickness / 2 + 0.002;
  return (
    <mesh
      position={[position[0] + n.x * offset, position[1], position[2] + n.z * offset]}
      rotation={[0, FACE_ROTATION_Y[dir], 0]}
      material={OVERLAY_MATERIAL}
      renderOrder={1}
      userData={{ selectionOverlay: true }}
    >
      <planeGeometry args={[length, height]} />
    </mesh>
  );
};
