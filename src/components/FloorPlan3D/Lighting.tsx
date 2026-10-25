import React from 'react';
import type { HouseModel } from './model/types';
import { WALL_HEIGHT } from './model/constants';

export const Lighting: React.FC<{ model: HouseModel; night: boolean; isSmall?: boolean }> = ({ model, night, isSmall = false }) => {
  if (night) {
    const step = Math.max(1, Math.ceil(model.rooms.length / 12));
    return (
      <group>
        <ambientLight color="#233b68" intensity={0.18} />
        {model.rooms.filter((_, index) => index % step === 0).slice(0, isSmall ? 6 : 12).map((room) => (
          <pointLight key={room.id} position={[room.center.x, WALL_HEIGHT - 0.2, room.center.z]} color="#ffc27a" intensity={1.1} distance={8} />
        ))}
      </group>
    );
  }
  return (
    <group>
      <hemisphereLight args={['#b9d9f2', '#6c6256', 1.2]} />
      <directionalLight
        castShadow
        position={[model.bounds.maxX, WALL_HEIGHT * 3, model.bounds.maxZ]}
        intensity={1.5}
        shadow-mapSize={[isSmall ? 1024 : 2048, isSmall ? 1024 : 2048]}
        shadow-radius={isSmall ? 1 : 2}
        shadow-camera-left={model.bounds.minX}
        shadow-camera-right={model.bounds.maxX}
        shadow-camera-top={model.bounds.minZ}
        shadow-camera-bottom={model.bounds.maxZ}
      />
    </group>
  );
};
