import { useEffect } from 'react';

export interface WalkInput {
  forward: number;
  strafe: number;
  run: boolean;
}

const keys = new Set(['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift']);

export function useWalkInput(inputRef: React.MutableRefObject<WalkInput>, active: boolean): void {
  useEffect(() => {
    if (!active) {
      inputRef.current.forward = 0;
      inputRef.current.strafe = 0;
      inputRef.current.run = false;
      return;
    }
    const update = (event: KeyboardEvent, pressed: boolean) => {
      const key = event.key.toLowerCase();
      if (!keys.has(key) || (event.target instanceof HTMLElement && ['INPUT', 'TEXTAREA'].includes(event.target.tagName))) return;
      if (pressed) event.preventDefault();
      const held = new Set<string>();
      if (pressed) held.add(key);
      if (key === 'w' || key === 'arrowup') inputRef.current.forward = pressed ? 1 : 0;
      if (key === 's' || key === 'arrowdown') inputRef.current.forward = pressed ? -1 : 0;
      if (key === 'a' || key === 'arrowleft') inputRef.current.strafe = pressed ? -1 : 0;
      if (key === 'd' || key === 'arrowright') inputRef.current.strafe = pressed ? 1 : 0;
      if (key === 'shift') inputRef.current.run = pressed;
      void held;
    };
    const clear = () => {
      inputRef.current.forward = 0;
      inputRef.current.strafe = 0;
      inputRef.current.run = false;
    };
    const down = (event: KeyboardEvent) => update(event, true);
    const up = (event: KeyboardEvent) => update(event, false);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', clear);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', clear);
      clear();
    };
  }, [active, inputRef]);
}
