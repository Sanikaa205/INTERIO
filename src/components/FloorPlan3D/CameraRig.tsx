import React, { useEffect, useMemo, useRef } from 'react';
import { OrbitControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { HouseModel } from './model/types';
import { fitCamera } from './model/cameraFit';
import { focusFor } from './model/roomFocus';

interface CameraRigProps {
  model: HouseModel;
  focusedRoomId: string | null;
  resetToken: number;
  enabled?: boolean;
}

export const CameraRig: React.FC<CameraRigProps> = ({ model, focusedRoomId, resetToken, enabled = true }) => {
  const controls = useRef<React.ElementRef<typeof OrbitControls>>(null);
  const { camera, size, invalidate } = useThree();
  const target = useRef(new THREE.Vector3());
  const animated = useRef(false);
  const lastAspect = useRef(size.width / Math.max(1, size.height));
  const fit = useMemo(() => fitCamera(model.bounds, 50, size.width / Math.max(1, size.height)), [model, size.width, size.height]);

  const applyFit = (nextFit = fit) => {
    camera.position.set(...nextFit.position);
    target.current.set(...nextFit.target);
    if (controls.current) {
      controls.current.target.copy(target.current);
      controls.current.update();
    }
  };

  useEffect(() => {
    applyFit();
  }, [model, resetToken, fit]);

  useEffect(() => {
    const room = focusedRoomId ? model.rooms.find((item) => item.id === focusedRoomId) : undefined;
    if (!room) {
      animated.current = false;
      return;
    }
    const next = focusFor(room, 50, size.width / Math.max(1, size.height));
    camera.position.set(...next.position);
    target.current.set(...next.target);
    animated.current = true;
    invalidate();
  }, [focusedRoomId, model, size.width, size.height, camera, invalidate]);

  useFrame(() => {
    const aspect = size.width / Math.max(1, size.height);
    if (Math.abs(aspect / lastAspect.current - 1) > 0.1) {
      lastAspect.current = aspect;
      applyFit(fitCamera(model.bounds, 50, aspect));
    }
    if (animated.current && controls.current) {
      controls.current.target.lerp(target.current, 0.08);
      camera.position.lerp(new THREE.Vector3(
        target.current.x + (camera.position.x - controls.current.target.x),
        target.current.y + (camera.position.y - controls.current.target.y),
        target.current.z + (camera.position.z - controls.current.target.z),
      ), 0.08);
      if (controls.current.target.distanceTo(target.current) < 0.02) animated.current = false;
      controls.current.update();
      invalidate();
    }
  });

  const clampTarget = () => {
    if (!controls.current) return;
    controls.current.target.x = THREE.MathUtils.clamp(controls.current.target.x, model.bounds.minX, model.bounds.maxX);
    controls.current.target.z = THREE.MathUtils.clamp(controls.current.target.z, model.bounds.minZ, model.bounds.maxZ);
  };

  return (
    <OrbitControls
      enabled={enabled}
      ref={controls}
      makeDefault
      minDistance={fit.minDistance}
      maxDistance={fit.maxDistance}
      maxPolarAngle={Math.PI / 2 - 0.05}
      enableDamping
      panSpeed={0.65}
      onChange={clampTarget}
    />
  );
};
