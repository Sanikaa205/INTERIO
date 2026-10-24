import * as THREE from 'three';

export interface Materials {
  wall: THREE.MeshStandardMaterial;
  exteriorWall: THREE.MeshStandardMaterial;
  ceiling: THREE.MeshStandardMaterial;
  door: THREE.MeshStandardMaterial;
  mainDoor: THREE.MeshStandardMaterial;
  frame: THREE.MeshStandardMaterial;
  glass: THREE.MeshStandardMaterial;
}

export function makeMaterials(): Materials {
  return {
    wall: new THREE.MeshStandardMaterial({ color: '#e7e1d8', roughness: 0.8 }),
    exteriorWall: new THREE.MeshStandardMaterial({ color: '#d6d0c7', roughness: 0.85 }),
    ceiling: new THREE.MeshStandardMaterial({ color: '#f4f1ec', side: THREE.BackSide }),
    door: new THREE.MeshStandardMaterial({ color: '#8a6244', roughness: 0.65 }),
    mainDoor: new THREE.MeshStandardMaterial({ color: '#4e3424', roughness: 0.7 }),
    frame: new THREE.MeshStandardMaterial({ color: '#b18a63', roughness: 0.6 }),
    glass: new THREE.MeshStandardMaterial({ color: '#8fc7dc', transparent: true, opacity: 0.25, roughness: 0.05, depthWrite: false }),
  };
}

export function floorMaterial(color: string): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
}

export function disposeMaterials(materials: Materials): void {
  Object.values(materials).forEach((material) => material.dispose());
}
