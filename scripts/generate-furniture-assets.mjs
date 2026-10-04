import fs from 'node:fs';
import path from 'node:path';

const output = path.resolve('public/assets/furniture');
fs.mkdirSync(output, { recursive: true });

const cubeFaces = [
  { n: [0, 0, 1], v: [[-0.5,-0.5,0.5],[0.5,-0.5,0.5],[0.5,0.5,0.5],[-0.5,0.5,0.5]] },
  { n: [0, 0, -1], v: [[0.5,-0.5,-0.5],[-0.5,-0.5,-0.5],[-0.5,0.5,-0.5],[0.5,0.5,-0.5]] },
  { n: [1, 0, 0], v: [[0.5,-0.5,0.5],[0.5,-0.5,-0.5],[0.5,0.5,-0.5],[0.5,0.5,0.5]] },
  { n: [-1, 0, 0], v: [[-0.5,-0.5,-0.5],[-0.5,-0.5,0.5],[-0.5,0.5,0.5],[-0.5,0.5,-0.5]] },
  { n: [0, 1, 0], v: [[-0.5,0.5,0.5],[0.5,0.5,0.5],[0.5,0.5,-0.5],[-0.5,0.5,-0.5]] },
  { n: [0, -1, 0], v: [[-0.5,-0.5,-0.5],[0.5,-0.5,-0.5],[0.5,-0.5,0.5],[-0.5,-0.5,0.5]] },
];
const positions = [], normals = [], indices = [];
for (const face of cubeFaces) {
  const base = positions.length / 3;
  face.v.forEach((vertex) => { positions.push(...vertex); normals.push(...face.n); });
  indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
}
const vertexBytes = Buffer.alloc(positions.length * 4);
positions.forEach((value, i) => vertexBytes.writeFloatLE(value, i * 4));
const normalBytes = Buffer.alloc(normals.length * 4);
normals.forEach((value, i) => normalBytes.writeFloatLE(value, i * 4));
const indexBytes = Buffer.alloc(indices.length * 2);
indices.forEach((value, i) => indexBytes.writeUInt16LE(value, i * 2));
const geometry = Buffer.concat([vertexBytes, normalBytes, indexBytes]);

const models = {
  sofa: [
    ['sofa base', [0, 0.22, 0], [1, 0.38, 0.72]], ['seat cushion', [0, 0.46, 0.02], [0.9, 0.13, 0.59]],
    ['back', [0, 0.68, -0.27], [0.94, 0.48, 0.16]], ['left arm', [-0.44, 0.47, 0], [0.12, 0.35, 0.72]], ['right arm', [0.44, 0.47, 0], [0.12, 0.35, 0.72]],
  ],
  chair: [['seat', [0, 0.48, 0], [0.72, 0.12, 0.66]], ['back', [0, 0.78, -0.26], [0.72, 0.52, 0.12]], ['left leg', [-0.27, 0.23, 0.24], [0.07, 0.46, 0.07]], ['right leg', [0.27, 0.23, 0.24], [0.07, 0.46, 0.07]], ['rear legs', [0, 0.23, -0.27], [0.55, 0.46, 0.07]]],
  bed: [['bed frame', [0, 0.19, 0], [1, 0.36, 0.72]], ['mattress', [0, 0.43, 0], [0.98, 0.18, 0.70]], ['headboard', [0, 0.72, -0.34], [1, 0.56, 0.08]]],
  table: [['table top', [0, 0.72, 0], [1, 0.09, 0.72]], ['leg one', [-0.43, 0.36, -0.29], [0.08, 0.72, 0.08]], ['leg two', [0.43, 0.36, -0.29], [0.08, 0.72, 0.08]], ['leg three', [-0.43, 0.36, 0.29], [0.08, 0.72, 0.08]], ['leg four', [0.43, 0.36, 0.29], [0.08, 0.72, 0.08]]],
  storage: [['cabinet carcass', [0, 0.46, 0], [1, 0.88, 0.42]], ['left door', [-0.25, 0.47, 0.22], [0.48, 0.78, 0.025]], ['right door', [0.25, 0.47, 0.22], [0.48, 0.78, 0.025]], ['base plinth', [0, 0.05, 0], [0.92, 0.1, 0.38]]],
  lamp: [['lamp base', [0, 0.035, 0], [0.38, 0.07, 0.38]], ['lamp stem', [0, 0.48, 0], [0.045, 0.86, 0.045]], ['lamp shade', [0, 0.92, 0], [0.42, 0.24, 0.42]]],
};

for (const [name, parts] of Object.entries(models)) {
  const nodes = parts.map(([label, translation, scale]) => ({ name: label, mesh: 0, translation, scale }));
  const json = {
    asset: { version: '2.0', generator: 'INTERIO local furniture library' },
    scene: 0, scenes: [{ nodes: nodes.map((_, i) => i) }], nodes,
    meshes: [{ name: `${name} furniture`, primitives: [{ attributes: { POSITION: 0, NORMAL: 1 }, indices: 2, material: 0 }] }],
    materials: [{ name: 'Neutral furniture finish', pbrMetallicRoughness: { baseColorFactor: [0.72, 0.66, 0.56, 1], metallicFactor: 0.05, roughnessFactor: 0.72 } }],
    buffers: [{ byteLength: geometry.length }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: vertexBytes.length, target: 34962 },
      { buffer: 0, byteOffset: vertexBytes.length, byteLength: normalBytes.length, target: 34962 },
      { buffer: 0, byteOffset: vertexBytes.length + normalBytes.length, byteLength: indexBytes.length, target: 34963 },
    ],
    accessors: [
      { bufferView: 0, componentType: 5126, count: positions.length / 3, type: 'VEC3', min: [-0.5,-0.5,-0.5], max: [0.5,0.5,0.5] },
      { bufferView: 1, componentType: 5126, count: normals.length / 3, type: 'VEC3' },
      { bufferView: 2, componentType: 5123, count: indices.length, type: 'SCALAR', min: [0], max: [23] },
    ],
  };
  let jsonBytes = Buffer.from(JSON.stringify(json));
  const jsonPadding = (4 - jsonBytes.length % 4) % 4;
  jsonBytes = Buffer.concat([jsonBytes, Buffer.alloc(jsonPadding, 0x20)]);
  const binaryPadding = (4 - geometry.length % 4) % 4;
  const binary = Buffer.concat([geometry, Buffer.alloc(binaryPadding)]);
  const totalLength = 12 + 8 + jsonBytes.length + 8 + binary.length;
  const header = Buffer.alloc(12); header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4); header.writeUInt32LE(totalLength, 8);
  const jsonHeader = Buffer.alloc(8); jsonHeader.writeUInt32LE(jsonBytes.length, 0); jsonHeader.writeUInt32LE(0x4e4f534a, 4);
  const binHeader = Buffer.alloc(8); binHeader.writeUInt32LE(binary.length, 0); binHeader.writeUInt32LE(0x004e4942, 4);
  fs.writeFileSync(path.join(output, `${name}.glb`), Buffer.concat([header, jsonHeader, jsonBytes, binHeader, binary]));
}
