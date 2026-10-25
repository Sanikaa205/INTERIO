export function isWebGLAvailable(): boolean {
  if (typeof document === 'undefined') return false;
  const canvas = document.createElement('canvas');
  try {
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}
