import { useEffect } from 'react';

interface Disposable {
  dispose: () => void;
}

export function useDisposables(items: readonly (Disposable | null | undefined)[]): void {
  useEffect(() => () => {
    items.forEach((item) => item?.dispose());
  }, [items]);
}
