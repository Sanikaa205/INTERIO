import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { serializeHouseGlb } from './exportGlb';

class TestFileReader {
  result: ArrayBuffer | string | null = null;
  onloadend: (() => void) | null = null;

  readAsArrayBuffer(blob: Blob): void {
    void blob.arrayBuffer().then((data) => {
      this.result = data;
      this.onloadend?.();
    });
  }
}

function installExporterCanvas(): void {
  const canvas = {
    width: 1,
    height: 1,
    getContext: () => ({ translate: () => {}, scale: () => {}, putImageData: () => {} }),
    toBlob: (callback: (blob: Blob | null) => void, mimeType?: string) => {
      callback(new Blob([new Uint8Array([137, 80, 78, 71])], { type: mimeType ?? 'image/png' }));
    },
  };
  Object.assign(globalThis, {
    document: { createElement: () => canvas },
    ImageData: class { constructor(_data: Uint8ClampedArray, _width: number, _height: number) {} },
    FileReader: TestFileReader,
  });
}

function readGlbJson(glb: ArrayBuffer): Record<string, unknown> {
  const view = new DataView(glb);
  assert.equal(view.getUint32(0, true), 0x46546c67, 'GLB magic');
  assert.equal(view.getUint32(16, true), 0x4e4f534a, 'first chunk is JSON');
  const jsonLength = view.getUint32(12, true);
  const json = new TextDecoder().decode(new Uint8Array(glb, 20, jsonLength)).trim();
  return JSON.parse(json) as Record<string, unknown>;
}

test('serializes a textured material into an embedded GLB image', async () => {
  installExporterCanvas();
  const texture = new THREE.DataTexture(new Uint8Array([184, 140, 93, 255]), 1, 1, THREE.RGBAFormat);
  texture.needsUpdate = true;
  const material = new THREE.MeshStandardMaterial({ color: '#ffffff', map: texture });
  const root = new THREE.Group();
  root.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material));

  const json = readGlbJson(await serializeHouseGlb(root));
  const images = json.images as Array<Record<string, unknown>>;
  const textures = json.textures as Array<Record<string, unknown>>;
  const materials = json.materials as Array<{ pbrMetallicRoughness?: { baseColorTexture?: { index: number } } }>;
  assert.equal(images.length, 1);
  assert.equal(typeof images[0].bufferView, 'number');
  assert.equal(textures.length, 1);
  assert.equal(materials[0].pbrMetallicRoughness?.baseColorTexture?.index, 0);

  texture.dispose();
  material.dispose();
});

// 1.2 — Selection overlay meshes must not appear in the exported GLB.
test('excludes selection overlay meshes from GLB export', async () => {
  installExporterCanvas();

  const root = new THREE.Group();

  // A regular wall mesh
  const wallMat = new THREE.MeshStandardMaterial({ color: '#e7e1d8' });
  root.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), wallMat));

  // A selection overlay (must be excluded)
  const overlayMat = new THREE.MeshBasicMaterial({ color: '#9ee8ff', transparent: true, opacity: 0.28 });
  const overlay = new THREE.Mesh(new THREE.BoxGeometry(1.004, 1.004, 1.004), overlayMat);
  overlay.userData.selectionOverlay = true;
  root.add(overlay);

  const json = readGlbJson(await serializeHouseGlb(root));
  const meshes = json.meshes as Array<unknown>;

  // Only 1 mesh should be exported (the wall), not the overlay.
  assert.equal(meshes.length, 1, 'overlay mesh must not be in exported GLB');

  // After export, the overlay must be visible again (restored).
  assert.equal(overlay.visible, true, 'overlay visibility must be restored after export');

  wallMat.dispose();
  overlayMat.dispose();
});
