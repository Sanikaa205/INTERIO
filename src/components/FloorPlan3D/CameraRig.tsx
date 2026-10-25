import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { OrbitControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { HouseModel } from './model/types';
import { fitCamera } from './model/cameraFit';
import { focusFor } from './model/roomFocus';
import { WALL_HEIGHT } from './model/constants';

interface CameraRigProps {
  model: HouseModel;
  focusedRoomId: string | null;
  resetToken: number;
  enabled?: boolean;
  onInteraction?: () => void;
}

/** Imperative handle for external camera commands (view controls, panel open/close). */
export interface CameraRigHandle {
  fit(): void;
  topDown(): void;
  zoomIn(): void;
  zoomOut(): void;
}

export const CameraRig = forwardRef<CameraRigHandle, CameraRigProps>(
  ({ model, focusedRoomId, resetToken, enabled = true, onInteraction }, ref) => {
    const controls = useRef<React.ElementRef<typeof OrbitControls>>(null);
    const { camera, size, invalidate } = useThree();
    const target = useRef(new THREE.Vector3());
    const animated = useRef(false);
    const lastAspect = useRef(size.width / Math.max(1, size.height));
    // Track whether user has manually moved the camera (2.4: don't jump on panel resize)
    const userMoved = useRef(false);
    const fit = useMemo(() => fitCamera(model.bounds, 50, size.width / Math.max(1, size.height)), [model, size.width, size.height]);

    const applyFit = (nextFit = fit) => {
      camera.position.set(...nextFit.position);
      target.current.set(...nextFit.target);
      if (controls.current) {
        controls.current.target.copy(target.current);
        controls.current.update();
      }
      invalidate();
    };

    // 2.4 — Expose imperative commands to parent via ref.
    useImperativeHandle(ref, () => ({
      fit() {
        userMoved.current = false;
        applyFit();
      },
      topDown() {
        const cx = (model.bounds.minX + model.bounds.maxX) / 2;
        const cz = (model.bounds.minZ + model.bounds.maxZ) / 2;
        const w = model.bounds.maxX - model.bounds.minX;
        const d = model.bounds.maxZ - model.bounds.minZ;
        const dist = Math.max(w, d) * 1.2;
        camera.position.set(cx, WALL_HEIGHT + dist, cz);
        target.current.set(cx, 0, cz);
        if (controls.current) {
          controls.current.target.copy(target.current);
          controls.current.update();
        }
        invalidate();
      },
      zoomIn() {
        const dir = new THREE.Vector3().subVectors(
          controls.current ? controls.current.target : target.current,
          camera.position,
        ).normalize();
        camera.position.addScaledVector(dir, fit.minDistance * 0.4);
        invalidate();
      },
      zoomOut() {
        const dir = new THREE.Vector3().subVectors(
          camera.position,
          controls.current ? controls.current.target : target.current,
        ).normalize();
        camera.position.addScaledVector(dir, fit.minDistance * 0.4);
        invalidate();
      },
    }));

    useEffect(() => {
      applyFit();
      userMoved.current = false;
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
        // 2.4: only refit on aspect change if user hasn't manually moved
        if (!userMoved.current) applyFit(fitCamera(model.bounds, 50, aspect));
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
      userMoved.current = true;
      onInteraction?.();
      invalidate();
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
        touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }}
        onChange={clampTarget}
      />
    );
  },
);

CameraRig.displayName = 'CameraRig';
