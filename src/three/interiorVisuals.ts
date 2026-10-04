import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { FurnitureItem } from '../types';

type Palette = { role?: string; hex?: string; name?: string }[];

const geometryCache = new Map<string, THREE.BufferGeometry>();
const materialCache = new Map<string, THREE.MeshStandardMaterial>();
const woodTextureCache = new Map<string, THREE.CanvasTexture>();

function material(color: THREE.ColorRepresentation, roughness = 0.72, metalness = 0, extra = '') {
  const key = `${String(color)}:${roughness}:${metalness}:${extra}`;
  let value = materialCache.get(key);
  if (!value) {
    value = new THREE.MeshStandardMaterial({ color, roughness, metalness });
    materialCache.set(key, value);
  }
  return value;
}

function boxGeometry(w: number, h: number, d: number, radius = 0) {
  const r = Math.min(radius, w / 3, h / 3, d / 3);
  const key = `${w.toFixed(3)}:${h.toFixed(3)}:${d.toFixed(3)}:${r.toFixed(3)}`;
  let geometry = geometryCache.get(key);
  if (!geometry) {
    geometry = r > 0.005 ? new RoundedBoxGeometry(w, h, d, 3, r) : new THREE.BoxGeometry(w, h, d);
    geometryCache.set(key, geometry);
  }
  return geometry;
}

function mesh(geometry: THREE.BufferGeometry, mat: THREE.Material, cast = true) {
  const result = new THREE.Mesh(geometry, mat);
  result.castShadow = cast;
  result.receiveShadow = true;
  return result;
}

function addBox(group: THREE.Group, size: [number, number, number], pos: [number, number, number], mat: THREE.Material, radius = 0.025) {
  const part = mesh(boxGeometry(...size, radius), mat);
  part.position.set(...pos);
  group.add(part);
  return part;
}

function addCylinder(group: THREE.Group, top: number, bottom: number, h: number, pos: [number, number, number], mat: THREE.Material, radial = 12) {
  const key = `cylinder:${top}:${bottom}:${h}:${radial}`;
  let geometry = geometryCache.get(key);
  if (!geometry) {
    geometry = new THREE.CylinderGeometry(top, bottom, h, radial);
    geometryCache.set(key, geometry);
  }
  const part = mesh(geometry, mat);
  part.position.set(...pos);
  group.add(part);
  return part;
}

export function createWoodTexture(base = '#b99569') {
  const key = base;
  const cached = woodTextureCache.get(key);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;
  const baseColor = new THREE.Color(base);
  const color = `#${baseColor.getHexString()}`;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1024, 1024);
  // Deterministic plank variation and fine grain keep generated floor maps reproducible.
  let seed = 713;
  const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const plankH = 128;
  for (let row = 0; row < 8; row++) {
    const offset = row % 2 ? -170 : 0;
    for (let x = offset; x < 1024; x += 340) {
      const light = 0.92 + rand() * 0.15;
      const plank = baseColor.clone().multiplyScalar(light);
      ctx.fillStyle = `#${plank.getHexString()}`;
      ctx.fillRect(x + 2, row * plankH + 2, 336, plankH - 4);
      ctx.strokeStyle = 'rgba(73,48,30,0.13)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 2, row * plankH + 2, 336, plankH - 4);
      for (let i = 0; i < 18; i++) {
        const gx = x + 12 + rand() * 310;
        const gy = row * plankH + 8 + rand() * (plankH - 16);
        ctx.beginPath();
        ctx.ellipse(gx, gy, 15 + rand() * 42, 0.7 + rand() * 1.4, rand() * 0.08, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(77,50,30,${0.035 + rand() * 0.055})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  woodTextureCache.set(key, texture);
  return texture;
}

export function createFloorMaterial(color: string, tile = false) {
  const mat = material(color, tile ? 0.58 : 0.78);
  mat.map = createWoodTexture(color);
  mat.needsUpdate = true;
  return mat;
}

function getWood(palette: Palette, style: string) {
  const role = palette.find((entry) => entry.role === 'secondary' || entry.role === 'flooring')?.hex;
  return role || (style.toLowerCase().includes('japandi') ? '#b99569' : '#a98158');
}

export function createFurnitureModel(
  item: FurnitureItem,
  palette: Palette,
  style: string,
  wireframe: boolean
): THREE.Group {
  const group = new THREE.Group();
  const name = item.name.toLowerCase();
  const w = Math.max(0.12, item.width);
  const d = Math.max(0.12, item.depth);
  const h = Math.max(0.12, item.height || (item.category === 'storage' ? 0.7 : 0.8));
  const defaultFabric = style.toLowerCase().includes('japandi') ? '#ded6c9'
    : style.toLowerCase().includes('traditional') ? '#8c6555'
    : style.toLowerCase().includes('modern') ? '#b8b9b4' : '#d6d2c9';
  const accent = item.color || defaultFabric;
  const fabric = material(accent, 0.91);
  const lightFabric = material('#eee7dc', 0.94);
  const woodColor = getWood(palette, style);
  const wood = material(woodColor, 0.52);
  const darkWood = material('#483a2c', 0.48);
  const metal = material('#403d39', 0.32, 0.68);
  const black = material('#262522', 0.42);
  const round = (size: [number, number, number], pos: [number, number, number], mat: THREE.Material, r = 0.035) => addBox(group, size, pos, mat, r);
  const legs = (legW: number, legD: number, legH: number, y: number, mat: THREE.Material) => {
    for (const x of [-w / 2 + legW, w / 2 - legW]) for (const z of [-d / 2 + legD, d / 2 - legD]) {
      addCylinder(group, legW * 0.78, legW, legH, [x, y, z], mat, 10);
    }
  };

  if (item.category === 'seating') {
    const chair = /armchair|accent chair|lounge chair/.test(name);
    const seatH = Math.min(0.47, Math.max(0.34, h * 0.36));
    const legH = seatH * 0.42;
    legs(Math.min(0.04, w * 0.035), Math.min(0.04, d * 0.035), legH, legH / 2, darkWood);
    round([w * 0.9, seatH * 0.36, d * 0.86], [0, legH + seatH * 0.42, 0], fabric, Math.min(0.1, seatH * 0.22));
    const backW = chair ? w * 0.82 : w * 0.91;
    round([backW, Math.max(0.22, h * 0.36), Math.max(0.12, d * 0.2)], [0, legH + seatH + Math.min(0.34, h * 0.25), -d * 0.34], fabric, 0.07);
    if (!chair || /armchair/.test(name)) {
      const armW = Math.min(0.16, w * 0.18);
      for (const side of [-1, 1]) round([armW, seatH * 0.72, d * 0.78], [side * (w / 2 - armW / 2), legH + seatH * 0.72, 0.02], fabric, 0.055);
    }
    const cushionCount = chair ? 1 : Math.max(2, Math.min(4, Math.round(w / 0.75)));
    for (let i = 0; i < cushionCount; i++) {
      const cushionW = (w * 0.72) / cushionCount;
      round([cushionW * 0.94, seatH * 0.17, d * 0.53], [-w * 0.36 + cushionW * (i + 0.5), legH + seatH * 0.64, d * 0.08], lightFabric, 0.045);
    }
  } else if (item.category === 'table') {
    const low = /coffee|side table/.test(name);
    const tall = /dining|desk|work/.test(name);
    const topY = Math.min(h, tall ? 0.76 : low ? 0.43 : 0.68);
    const topT = Math.max(0.055, Math.min(0.09, topY * 0.14));
    round([w * 0.98, topT, d * 0.98], [0, topY, 0], wood, 0.04);
    if (/coffee/.test(name) && w > d * 1.3) {
      addCylinder(group, 0.06, Math.min(0.14, w * 0.12), topY - topT / 2, [0, (topY - topT) / 2, 0], darkWood, 16);
    } else {
      const legH = Math.max(0.18, topY - topT);
      legs(Math.min(0.045, w * 0.04), Math.min(0.045, d * 0.06), legH, legH / 2, darkWood);
    }
    if (/desk/.test(name)) {
      round([w * 0.42, topY * 0.46, d * 0.12], [w * 0.24, topY * 0.48, -d * 0.34], wood, 0.025);
      addCylinder(group, 0.012, 0.012, 0.11, [w * 0.15, topY * 0.42, -d * 0.402], metal, 10).rotation.x = Math.PI / 2;
    }
  } else if (item.category === 'storage') {
    const tall = /wardrobe|bookcase|bookshelf|shelf/.test(name);
    const cabinetH = Math.min(h, tall ? Math.max(1.45, h) : 0.76);
    const baseY = cabinetH * 0.5;
    round([w * 0.96, cabinetH, d * 0.88], [0, baseY, 0], wood, 0.025);
    if (/media|console|credenza/.test(name)) {
      for (let i = 0; i < 3; i++) {
        const panelW = w * 0.28;
        round([panelW, cabinetH * 0.72, 0.025], [-w * 0.31 + i * w * 0.31, baseY, d * 0.45], darkWood, 0.012);
        addCylinder(group, 0.012, 0.012, 0.05, [-w * 0.31 + i * w * 0.31, baseY, d * 0.47], metal, 8).rotation.x = Math.PI / 2;
      }
    } else if (tall) {
      for (let y = 1; y <= 4; y++) round([w * 0.9, 0.025, d * 0.84], [0, cabinetH * y / 5, 0], darkWood, 0.008);
      if (/wardrobe/.test(name)) round([0.018, cabinetH * 0.9, 0.025], [0, baseY, d * 0.46], darkWood, 0.01);
    } else {
      for (const x of [-w * 0.24, w * 0.24]) addCylinder(group, 0.015, 0.015, 0.06, [x, baseY, d * 0.47], metal, 8).rotation.x = Math.PI / 2;
    }
    legs(Math.min(0.045, w * 0.04), Math.min(0.045, d * 0.05), 0.11, 0.055, darkWood);
  } else if (item.category === 'lighting' || /lamp/.test(name)) {
    const floorLamp = h > 1.05 || /floor/.test(name);
    const totalH = floorLamp ? Math.min(1.8, h) : Math.min(0.65, h);
    const baseR = Math.min(w, d) * 0.28;
    addCylinder(group, baseR, baseR * 1.1, 0.045, [0, 0.022, 0], metal, 20);
    addCylinder(group, 0.018, 0.022, totalH * 0.68, [0, totalH * 0.37, 0], metal, 12);
    const shade = mesh(new THREE.CylinderGeometry(baseR * 1.4, baseR * 0.65, totalH * 0.23, 20, 1, true), material('#f5e9d2', 0.82));
    shade.position.y = totalH * 0.83;
    group.add(shade);
    group.userData.lamp = true;
  } else if (item.category === 'decor' || /rug/.test(name)) {
    const colors = ['#d9cbb7', '#b9aa94', '#e8ded0'];
    const rugMat = material(item.color || colors[style.toLowerCase().includes('minimal') ? 0 : 1], 0.98);
    const rug = mesh(new THREE.PlaneGeometry(w, d), rugMat, false);
    rug.rotation.x = -Math.PI / 2;
    rug.position.y = 0.012;
    group.add(rug);
    const border = material('#8d7862', 0.94);
    for (const z of [-d / 2 + 0.04, d / 2 - 0.04]) round([w * 0.92, 0.008, 0.012], [0, 0.018, z], border, 0.003);
  } else if (/bed/.test(name)) {
    const frameH = 0.24;
    round([w, frameH, d], [0, frameH / 2, 0], darkWood, 0.035);
    round([w * 0.96, 0.2, d * 0.91], [0, frameH + 0.1, 0], lightFabric, 0.075);
    round([w, Math.min(1.15, h * 0.48), 0.12], [0, Math.min(0.78, h * 0.3), -d / 2 + 0.055], wood, 0.045);
    for (const x of [-w * 0.22, w * 0.22]) round([w * 0.28, 0.11, d * 0.2], [x, frameH + 0.255, -d * 0.32], fabric, 0.05);
    legs(0.045, 0.045, 0.12, 0.06, darkWood);
  } else if (/tv|television|monitor/.test(name)) {
    round([w, Math.max(0.055, h * 0.7), 0.07], [0, h * 0.5, 0], black, 0.02);
    const screen = new THREE.MeshStandardMaterial({ color: '#3d5158', roughness: 0.16, metalness: 0.25, emissive: '#1b2d33', emissiveIntensity: 0.12, wireframe });
    round([w * 0.94, Math.max(0.02, h * 0.59), 0.012], [0, h * 0.5, 0.042], screen, 0.01);
    addCylinder(group, 0.012, 0.012, 0.18, [0, h * 0.14, 0], metal, 8);
  } else {
    round([w * 0.95, Math.min(h, 0.72), d * 0.9], [0, Math.min(h, 0.72) / 2, 0], wood, 0.025);
    if (/plant|tree/.test(name)) addPlant(group, w, h, d);
  }

  group.traverse((part) => {
    if (part instanceof THREE.Mesh) {
      part.castShadow = true;
      part.receiveShadow = true;
      if (Array.isArray(part.material)) part.material.forEach((m) => { if ('wireframe' in m) (m as THREE.Material & { wireframe: boolean }).wireframe = wireframe; });
      else if ('wireframe' in part.material) (part.material as THREE.Material & { wireframe: boolean }).wireframe = wireframe;
    }
  });
  return group;
}

function addPlant(group: THREE.Group, w = 0.45, h = 1.2, d = 0.45) {
  const pot = material('#c6ad8e', 0.83);
  const leafMats = ['#536e4d', '#748c61', '#3f5c45'].map((c) => material(c, 0.86));
  addCylinder(group, Math.min(w, d) * 0.27, Math.min(w, d) * 0.34, 0.26, [0, 0.13, 0], pot, 16);
  const stemH = Math.max(0.3, h - 0.32);
  addCylinder(group, 0.012, 0.018, stemH, [0, 0.26 + stemH / 2, 0], leafMats[0], 8);
  for (let i = 0; i < 9; i++) {
    const angle = (Math.PI * 2 * i) / 9;
    const leaf = mesh(new THREE.SphereGeometry(0.13, 8, 6), leafMats[i % leafMats.length]);
    leaf.scale.set(0.55, 1.65, 0.52);
    leaf.position.set(Math.cos(angle) * 0.16, 0.42 + (i % 3) * stemH * 0.19, Math.sin(angle) * 0.16);
    leaf.rotation.z = -Math.cos(angle) * 0.45;
    group.add(leaf);
  }
}

export function addStyledDecor(scene: THREE.Scene, w: number, l: number, palette: Palette, style: string, includeRug = true) {
  // Decorative grouping uses a separate scene layer: these meshes never enter the furniture raycast list.
  const decor = new THREE.Group();
  decor.name = 'non-selectable-room-decor';
  const green = material('#536d4e', 0.87);
  const pot = material('#b99d7c', 0.82);
  const artFrame = material('#6f5944', 0.55);
  const artCanvas = material(palette.find((entry) => entry.role === 'accent')?.hex || '#c9b49a', 0.82);
  const wood = material(getWood(palette, style), 0.52);
  const add = (geometry: THREE.BufferGeometry, mat: THREE.Material, position: [number, number, number]) => {
    const part = mesh(geometry, mat);
    part.position.set(...position);
    decor.add(part);
    return part;
  };
  const plant = (x: number, z: number, scale: number) => {
    const p = new THREE.Group();
    p.position.set(x, 0, z);
    p.scale.setScalar(scale);
    addPlant(p, 0.5, 1.35, 0.5);
    decor.add(p);
  };
  // Select placement zones that stay against the open corners and preserve the useful walking area.
  plant(-w * 0.39, -l * 0.38, 0.82);
  plant(w * 0.39, -l * 0.39, 0.68);
  // A warm, low-pile area rug in the room centre.
  if (includeRug) {
    const rugColor = palette.find((entry) => entry.role === 'accent')?.hex || '#c8b79f';
    const rugMat = material(rugColor, 0.96);
    const rugW = Math.min(3.1, w * 0.58);
    const rugD = Math.min(2.55, l * 0.42);
    const rug = add(new THREE.PlaneGeometry(rugW, rugD), rugMat, [0, 0.02, l * 0.06]);
    rug.rotation.x = -Math.PI / 2;
    const border = material('#8a765f', 0.95);
    for (const z of [-rugD / 2 + 0.04, rugD / 2 - 0.04]) add(boxGeometry(rugW * 0.92, 0.008, 0.012, 0.003), border, [0, 0.027, l * 0.06 + z]);
  }
  // Window-side curtains, wall art, and a compact floor lamp.
  const curtainMat = material('#e6ded2', 0.92);
  const windowHalf = Math.min(1.7, w * 0.42) / 2;
  for (const side of [-1, 1]) add(boxGeometry(0.24, 1.55, 0.09, 0.025), curtainMat, [side * (windowHalf + 0.12), 1.35, -l / 2 + 0.23]);
  const artX = w * 0.32;
  const artW = Math.min(1.02, w * 0.24);
  add(boxGeometry(artW, 0.72, 0.055, 0.012), artFrame, [artX, 1.88, -l / 2 + 0.115]);
  add(boxGeometry(artW - 0.12, 0.6, 0.025, 0.008), artCanvas, [artX, 1.88, -l / 2 + 0.08]);
  // Simple abstract artwork with two matte shapes.
  const artAccent = material(style.toLowerCase().includes('modern') ? '#58656a' : '#987b5d', 0.84);
  add(new THREE.CircleGeometry(0.17, 20), artAccent, [artX - 0.16, 1.9, -l / 2 + 0.06]);
  const lamp = new THREE.Group();
  addCylinder(lamp, 0.13, 0.15, 0.04, [w * 0.34, 0.02, l * 0.2], wood);
  const pole = mesh(new THREE.CylinderGeometry(0.018, 0.022, 1.28, 10), material('#51463a', 0.42));
  pole.position.set(w * 0.34, 0.68, l * 0.2);
  lamp.add(pole);
  const shade = mesh(new THREE.CylinderGeometry(0.12, 0.22, 0.26, 16, 1, true), material('#f0dfbd', 0.78));
  shade.position.set(w * 0.34, 1.38, l * 0.2);
  lamp.add(shade);
  const warmLight = new THREE.PointLight('#ffd59b', 0.6, 3.4, 2);
  warmLight.position.set(w * 0.34, 1.3, l * 0.2);
  lamp.add(warmLight);
  decor.add(lamp);
  scene.add(decor);
}
