import React, { useEffect, useRef } from 'react';
import { PointerLockControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { HouseModel } from './model/types';
import { buildColliders, moveWithCollision } from './model/collision';
import { findSpawn } from './model/spawn';
import { EYE_HEIGHT } from './model/constants';
import type { WalkInput } from './useWalkInput';

export const Walkthrough: React.FC<{ model: HouseModel; inputRef: React.MutableRefObject<WalkInput>; onExit: () => void }> = ({ model, inputRef, onExit }) => {
  const { camera, gl, invalidate } = useThree();
  const position = useRef(findSpawn(model));
  const yaw = useRef(position.current.yaw);
  const pitch = useRef(0);
  const colliders = useRef(buildColliders(model));
  const forward = useRef(new THREE.Vector3());
  const right = useRef(new THREE.Vector3());
  useEffect(() => {
    camera.position.set(position.current.x, EYE_HEIGHT, position.current.z);
    camera.rotation.set(0, position.current.yaw, 0);
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = 70;
      camera.updateProjectionMatrix();
    }
    const handleKey = (event: KeyboardEvent) => { if (event.key === 'Escape' && document.pointerLockElement !== gl.domElement) onExit(); };
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('keydown', handleKey);
      if (camera instanceof THREE.PerspectiveCamera) {
        camera.fov = 50;
        camera.updateProjectionMatrix();
      }
    };
  }, [camera, gl.domElement, onExit]);
  useFrame((_, delta) => {
    const input = inputRef.current;
    const speed = 1.6 * (input.run ? 2 : 1) * Math.min(delta, 0.05);
    forward.current.set(Math.sin(yaw.current), 0, Math.cos(yaw.current));
    right.current.set(Math.cos(yaw.current), 0, -Math.sin(yaw.current));
    const next = moveWithCollision(position.current, {
      x: (forward.current.x * input.forward + right.current.x * input.strafe) * speed,
      z: (forward.current.z * input.forward + right.current.z * input.strafe) * speed,
    }, colliders.current, 0.25, model.bounds);
    position.current.x = next.x;
    position.current.z = next.z;
    camera.position.set(next.x, EYE_HEIGHT, next.z);
    camera.rotation.set(pitch.current, yaw.current, 0, 'YXZ');
    invalidate();
  });
  return <PointerLockControls />;
};
