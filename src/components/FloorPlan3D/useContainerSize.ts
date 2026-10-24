import { useEffect, useState } from 'react';

export interface ContainerSize {
  width: number;
  height: number;
}

export function useContainerSize(element: HTMLElement | null): ContainerSize {
  const [size, setSize] = useState<ContainerSize>({ width: 0, height: 0 });
  useEffect(() => {
    if (!element) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = element.getBoundingClientRect();
        setSize({ width: Math.round(rect.width), height: Math.round(rect.height) });
      });
    };
    const observer = new ResizeObserver(update);
    observer.observe(element);
    update();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [element]);
  return size;
}
