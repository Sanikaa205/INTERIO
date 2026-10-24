import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';

export const RendererDiagnostics: React.FC = () => {
  const { gl } = useThree();
  useEffect(() => {
    if (typeof process !== 'undefined' && process.env.NODE_ENV === 'production') return;
    const key = '__FP3D_INFO__';
    (window as Window & { __FP3D_INFO__?: () => typeof gl.info })[key] = () => gl.info;
    return () => {
      delete (window as Window & { __FP3D_INFO__?: () => typeof gl.info })[key];
    };
  }, [gl]);
  return null;
};
