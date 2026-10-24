import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

export function exportHouseGlb(root: THREE.Object3D, filename = 'interio-floorplan.glb'): Promise<void> {
  return new Promise((resolve, reject) => {
    new GLTFExporter().parse(root, (result) => {
      const data = result as ArrayBuffer;
      const blob = new Blob([data], { type: 'model/gltf-binary' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
      resolve();
    }, (error) => reject(error), { binary: true, onlyVisible: true });
  });
}
