import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

/**
 * 1.2 — Hide all selection overlay meshes before export and restore afterward,
 * so no highlight tinting appears in the exported GLB.
 * Overlays are identified by `userData.selectionOverlay = true`.
 */
function hideOverlays(root: THREE.Object3D): THREE.Object3D[] {
  const hidden: THREE.Object3D[] = [];
  root.traverse((obj) => {
    if (obj.userData?.selectionOverlay && obj.visible) {
      obj.visible = false;
      hidden.push(obj);
    }
  });
  return hidden;
}

function restoreOverlays(hidden: THREE.Object3D[]): void {
  hidden.forEach((obj) => { obj.visible = true; });
}

/** Serializes the visible house scene as a binary GLB, including material maps. */
export function serializeHouseGlb(root: THREE.Object3D): Promise<ArrayBuffer> {
  // 1.2 — Hide overlays before starting the export. Restore in both resolve
  // and reject paths so visibility is always cleaned up.
  const hidden = hideOverlays(root);
  return new Promise((resolve, reject) => {
    new GLTFExporter().parse(
      root,
      (result) => {
        restoreOverlays(hidden);
        if (result instanceof ArrayBuffer) resolve(result);
        else reject(new Error('GLB exporter returned a non-binary result.'));
      },
      (error) => {
        restoreOverlays(hidden);
        reject(error);
      },
      { binary: true, onlyVisible: true },
    );
  });
}

export async function exportHouseGlb(root: THREE.Object3D, filename = 'interio-floorplan.glb'): Promise<void> {
  const data = await serializeHouseGlb(root);
  const blob = new Blob([data], { type: 'model/gltf-binary' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  // Defer cleanup until the browser has consumed the object URL for download.
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
