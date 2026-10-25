import React, { useMemo } from 'react';
import * as THREE from 'three';

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
