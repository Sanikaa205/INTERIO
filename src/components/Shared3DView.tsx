import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import {
  FloorPlanResult,
  FurnitureItem,
  InteriorDesignResult,
  ReconstructionData,
  SavedProject,
} from '../types';
import {
  RotateCcw,
  Sun,
  Moon,
  Eye,
  Camera,
  Download,
  BookmarkPlus,
  ArrowLeft,
  Layers,
  Box,
  Check,
  Home,
  Move,
  RotateCw,
  X,
} from 'lucide-react';

interface Shared3DViewProps {
  data: FloorPlanResult | InteriorDesignResult | ReconstructionData | null;
  projectType: 'floorplan' | 'interior' | 'renovation';
  projectTitle?: string;
  onBack: () => void;
  onBackToHome?: () => void;
  onSaveProject: () => void;
  selectedFurnitureId?: string | null;
  onSelectFurniture?: (id: string | null) => void;
  onFurnitureChange?: (furniture: FurnitureItem[]) => void;
}

export const Shared3DView: React.FC<Shared3DViewProps> = ({
  data,
  projectType,
  projectTitle = 'Untitled Design',
  onBack,
  onBackToHome,
  onSaveProject,
  selectedFurnitureId = null,
  onSelectFurniture,
  onFurnitureChange,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const animationFrameId = useRef<number | null>(null);

  // View settings
  const [cameraMode, setCameraMode] = useState<'orbit' | 'top' | 'iso'>('orbit');
  const [lightingMode, setLightingMode] = useState<'day' | 'night'>('day');
  const [showWireframe, setShowWireframe] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [wallHeight, setWallHeight] = useState(2.8); // meters
  const [exportedToast, setExportedToast] = useState(false);

  // Manual Orbit controls tracking
  const isDragging = useRef(false);
  const previousMousePosition = useRef({ x: 0, y: 0 });
  const pointerDownPosition = useRef({ x: 0, y: 0 });
  const cameraAngles = useRef({ theta: Math.PI / 4, phi: Math.PI / 3, radius: 18 });
  const targetLookAt = useRef(new THREE.Vector3(0, 0, 0));

  // Furniture selection & transform editing (click-to-select + drag/rotate)
  const [transformMode, setTransformMode] = useState<'translate' | 'rotate'>('translate');
  const transformControlsRef = useRef<TransformControls | null>(null);
  const furnitureObjectsRef = useRef<THREE.Object3D[]>([]);
  const furnitureDataRef = useRef<FurnitureItem[]>([]);
  const raycasterRef = useRef(new THREE.Raycaster());
  const isTransformDragging = useRef(false);

  // Keep the latest callbacks in refs so scene event listeners (registered
  // once per scene rebuild) never call a stale closure.
  const onFurnitureChangeRef = useRef(onFurnitureChange);
  const onSelectFurnitureRef = useRef(onSelectFurniture);
  onFurnitureChangeRef.current = onFurnitureChange;
  onSelectFurnitureRef.current = onSelectFurniture;

  // Determine active data payload
  const floorPlanData = projectType === 'floorplan' ? (data as FloorPlanResult) : null;
  const interiorData =
    projectType === 'interior'
      ? (data as InteriorDesignResult)
      : projectType === 'renovation'
      ? (data as ReconstructionData)?.renovationDesign || null
      : null;

  // Calculate overall bounds
  const roomW = floorPlanData?.plotWidth || interiorData?.roomWidth || 8;
  const roomL = floorPlanData?.plotLength || interiorData?.roomLength || 10;

  // Initialize Three.js scene
  useEffect(() => {
    if (!mountRef.current) return;

    const width = mountRef.current.clientWidth || 800;
    const height = mountRef.current.clientHeight || 600;

    // Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(lightingMode === 'day' ? 0xf5f3ef : 0x0f172a);
    scene.fog = new THREE.FogExp2(
      lightingMode === 'day' ? 0xf5f3ef : 0x0f172a,
      0.015
    );

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    cameraRef.current = camera;
    updateCameraPosition();

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    rendererRef.current = renderer;
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    mountRef.current.innerHTML = '';
    mountRef.current.appendChild(renderer.domElement);

    // Transform Controls: drag/rotate whichever furniture piece is selected
    const transformControls = new TransformControls(camera, renderer.domElement);
    transformControlsRef.current = transformControls;
    applyTransformAxisVisibility(transformControls, transformMode);
    transformControls.setMode(transformMode);
    const tcHelper = transformControls.getHelper();
    scene.add(tcHelper);

    const handleDraggingChanged = (event: { value: unknown }) => {
      isTransformDragging.current = Boolean(event.value);
      if (!event.value) {
        // Drag ended: only now do we enforce bounds/overlap, against the
        // final released position. During the drag itself the piece moves
        // freely (see handleObjectChange) so the gizmo never fights the
        // user's mouse.
        const object = transformControls.object;
        const furnitureId = object?.userData.furnitureId;
        if (object && furnitureId) {
          applyTransformConstraints(object, furnitureId);
        }
        onFurnitureChangeRef.current?.(furnitureDataRef.current.map((f) => ({ ...f })));
      }
    };
    const handleObjectChange = () => {
      // Live updates while dragging: sync rotation only (no bounds/overlap
      // rejection here, or the piece would appear to snap back mid-drag on
      // every frame it overlaps something). Translation constraints are
      // enforced once, on release, in handleDraggingChanged above.
      const object = transformControls.object;
      const furnitureId = object?.userData.furnitureId;
      if (!object || !furnitureId) return;
      const list = furnitureDataRef.current;
      const idx = list.findIndex((f) => f.id === furnitureId);
      if (idx === -1) return;
      const rotationDeg = THREE.MathUtils.radToDeg(object.rotation.y);
      list[idx].rotation = ((rotationDeg % 360) + 360) % 360;
    };
    transformControls.addEventListener('dragging-changed', handleDraggingChanged);
    transformControls.addEventListener('objectChange', handleObjectChange);

    // Build 3D models based on current data
    build3DScene(scene);

    // Re-attach the gizmo to whichever furniture is currently selected
    // (the scene/objects were just rebuilt, so prior object references are gone).
    syncTransformSelection();

    // Setup Lighting
    setupLighting(scene);

    // Render loop
    const animate = () => {
      animationFrameId.current = requestAnimationFrame(animate);
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };
    animate();

    // Resize Observer
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: newW, height: newH } = entry.contentRect;
        if (cameraRef.current && rendererRef.current && newW > 0 && newH > 0) {
          cameraRef.current.aspect = newW / newH;
          cameraRef.current.updateProjectionMatrix();
          rendererRef.current.setSize(newW, newH);
        }
      }
    });
    resizeObserver.observe(mountRef.current);

    return () => {
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
      resizeObserver.disconnect();
      transformControls.removeEventListener('dragging-changed', handleDraggingChanged);
      transformControls.removeEventListener('objectChange', handleObjectChange);
      transformControls.dispose();
      transformControlsRef.current = null;
      if (rendererRef.current?.domElement && mountRef.current) {
        mountRef.current.innerHTML = '';
      }
      renderer.dispose();
    };
  }, [data, projectType, wallHeight, lightingMode, showWireframe]);

  // Re-sync the gizmo when selection changes without a full scene rebuild
  // (e.g. the user picked a different item in the 2D preview before
  // switching to 3D, or clicked a furniture mesh here).
  useEffect(() => {
    syncTransformSelection();
  }, [selectedFurnitureId]);

  // Switch translate/rotate mode on the live TransformControls instance.
  useEffect(() => {
    const controls = transformControlsRef.current;
    if (!controls) return;
    controls.setMode(transformMode);
    applyTransformAxisVisibility(controls, transformMode);
  }, [transformMode]);

  // Escape deselects the current furniture piece.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onSelectFurnitureRef.current?.(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Handle camera position updates based on mode and spherical coords
  const updateCameraPosition = () => {
    if (!cameraRef.current) return;

    const camera = cameraRef.current;
    const { theta, phi, radius } = cameraAngles.current;
    const target = targetLookAt.current;

    if (cameraMode === 'top') {
      camera.position.set(target.x, radius * 1.2, target.z + 0.001);
      camera.lookAt(target);
    } else if (cameraMode === 'iso') {
      const isoDist = radius * 0.9;
      camera.position.set(target.x + isoDist, target.y + isoDist * 0.9, target.z + isoDist);
      camera.lookAt(target);
    } else {
      // Free Orbit
      const x = target.x + radius * Math.sin(phi) * Math.cos(theta);
      const y = target.y + radius * Math.cos(phi);
      const z = target.z + radius * Math.sin(phi) * Math.sin(theta);
      camera.position.set(x, Math.max(y, 1.0), z);
      camera.lookAt(target);
    }
  };

  // Setup Lights
  const setupLighting = (scene: THREE.Scene) => {
    // Ambient Light
    const ambientColor = lightingMode === 'day' ? 0xffffff : 0x1e293b;
    const ambientIntensity = lightingMode === 'day' ? 0.75 : 0.4;
    const ambient = new THREE.AmbientLight(ambientColor, ambientIntensity);
    scene.add(ambient);

    // Directional Sunlight
    const sunLight = new THREE.DirectionalLight(
      lightingMode === 'day' ? 0xfffaed : 0x93c5fd,
      lightingMode === 'day' ? 1.2 : 0.5
    );
    sunLight.position.set(15, 25, 12);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 100;
    const d = 20;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.bias = -0.0005;
    scene.add(sunLight);

    // Soft Fill Light
    const fillLight = new THREE.DirectionalLight(0xe0e7ff, 0.4);
    fillLight.position.set(-15, 12, -10);
    scene.add(fillLight);

    // Warm Interior Accent point lights
    if (lightingMode === 'night' || interiorData) {
      const interiorLight = new THREE.PointLight(0xffbe76, 1.4, 15);
      interiorLight.position.set(0, wallHeight - 0.4, 0);
      interiorLight.castShadow = true;
      scene.add(interiorLight);
    }
  };

  // Build 3D geometry
  const build3DScene = (scene: THREE.Scene) => {
    // Center point of room
    const centerX = roomW / 2;
    const centerZ = roomL / 2;
    targetLookAt.current.set(0, wallHeight * 0.35, 0);
    cameraAngles.current.radius = Math.max(roomW, roomL) * 1.6;
    updateCameraPosition();

    // 1. Foundation Ground / Grid Floor
    const groundGeo = new THREE.PlaneGeometry(roomW * 3, roomL * 3);
    const groundMat = new THREE.MeshStandardMaterial({
      color: lightingMode === 'day' ? 0xedebe8 : 0x090d16,
      roughness: 0.9,
      metalness: 0.1,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    ground.receiveShadow = true;
    scene.add(ground);

    // Architectural Grid Lines
    const grid = new THREE.GridHelper(
      Math.max(roomW, roomL) * 2.5,
      Math.max(roomW, roomL) * 2,
      lightingMode === 'day' ? 0xcbd5e1 : 0x334155,
      lightingMode === 'day' ? 0xe2e8f0 : 0x1e293b
    );
    grid.position.y = 0.001;
    scene.add(grid);

    // 2. SCENARIO A: MULTI-ROOM FLOOR PLAN
    if (floorPlanData && floorPlanData.rooms) {
      floorPlanData.rooms.forEach((room) => {
        // Room position centered around scene origin (0,0)
        const posX = room.x + room.width / 2 - centerX;
        const posZ = room.y + room.height / 2 - centerZ;

        // Room Floor
        const floorGeo = new THREE.PlaneGeometry(room.width - 0.08, room.height - 0.08);
        const floorMat = new THREE.MeshStandardMaterial({
          color: new THREE.Color(room.color || '#6366f1').lerp(new THREE.Color('#ffffff'), 0.45),
          roughness: 0.6,
          metalness: 0.1,
          wireframe: showWireframe,
        });
        const floorMesh = new THREE.Mesh(floorGeo, floorMat);
        floorMesh.rotation.x = -Math.PI / 2;
        floorMesh.position.set(posX, 0.01, posZ);
        floorMesh.receiveShadow = true;
        scene.add(floorMesh);

        // Room Perimeter Walls (extruded boxes)
        const wallThickness = 0.18; // 18cm standard wall
        const wallMat = new THREE.MeshStandardMaterial({
          color: lightingMode === 'day' ? 0xf1f5f9 : 0x334155,
          roughness: 0.8,
          metalness: 0.1,
          wireframe: showWireframe,
        });

        // North wall
        createWallSegment(scene, room.width, wallThickness, wallHeight, posX, wallHeight / 2, posZ - room.height / 2 + wallThickness / 2, wallMat);
        // South wall
        createWallSegment(scene, room.width, wallThickness, wallHeight, posX, wallHeight / 2, posZ + room.height / 2 - wallThickness / 2, wallMat);
        // West wall
        createWallSegment(scene, wallThickness, room.height, wallHeight, posX - room.width / 2 + wallThickness / 2, wallHeight / 2, posZ, wallMat);
        // East wall
        createWallSegment(scene, wallThickness, room.height, wallHeight, posX + room.width / 2 - wallThickness / 2, wallHeight / 2, posZ, wallMat);
      });
    }

    // 3. SCENARIO B: INTERIOR DESIGN / RENOVATION WITH FURNITURE
    if (interiorData) {
      // Main Room Hardwood/Stone Floor
      const floorGeo = new THREE.PlaneGeometry(roomW, roomL);
      const floorMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(interiorData.colorPalette?.[4]?.hex || '#d6c7b2'),
        roughness: 0.45,
        metalness: 0.05,
        wireframe: showWireframe,
      });
      const floorMesh = new THREE.Mesh(floorGeo, floorMat);
      floorMesh.rotation.x = -Math.PI / 2;
      floorMesh.position.set(0, 0.01, 0);
      floorMesh.receiveShadow = true;
      scene.add(floorMesh);

      // Room Perimeter Walls with decorative baseboard
      const wallMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(interiorData.colorPalette?.[1]?.hex || '#f8fafc'),
        roughness: 0.9,
        wireframe: showWireframe,
      });
      const wallThick = 0.2;

      // Back Wall (North)
      createWallSegment(scene, roomW, wallThick, wallHeight, 0, wallHeight / 2, -roomL / 2, wallMat);
      // Left Wall (West)
      createWallSegment(scene, wallThick, roomL, wallHeight, -roomW / 2, wallHeight / 2, 0, wallMat);
      // Right Wall (East) with window cutout simulation
      createWallSegment(scene, wallThick, roomL, wallHeight, roomW / 2, wallHeight / 2, 0, wallMat);

      // Place Furniture Pieces
      furnitureObjectsRef.current = [];
      furnitureDataRef.current = [];

      if (interiorData.furniture && Array.isArray(interiorData.furniture)) {
        furnitureDataRef.current = interiorData.furniture.map((f) => ({ ...f }));

        interiorData.furniture.forEach((item) => {
          const itemPosX = item.x + item.width / 2 - roomW / 2;
          const itemPosZ = item.y + item.depth / 2 - roomL / 2;
          const rotRad = ((item.rotation || 0) * Math.PI) / 180;

          const itemColor = new THREE.Color(item.color || interiorData.colorPalette?.[0]?.hex || '#4f46e5');

          let rootObject: THREE.Object3D;

          if (item.category === 'seating') {
            // Detailed Sofa / Armchair
            rootObject = create3DSofa(scene, item.width, item.depth, itemPosX, itemPosZ, rotRad, itemColor, showWireframe);
          } else if (item.category === 'table') {
            // Detailed Table
            rootObject = create3DTable(scene, item.width, item.depth, itemPosX, itemPosZ, rotRad, itemColor, showWireframe);
          } else if (item.category === 'storage') {
            // Credenza / Shelf
            rootObject = create3DStorage(scene, item.width, item.depth, itemPosX, itemPosZ, rotRad, itemColor, showWireframe);
          } else if (item.category === 'lighting') {
            // Floor Lamp
            rootObject = create3DLamp(scene, itemPosX, itemPosZ, rotRad, itemColor);
          } else if (item.category === 'decor') {
            // Flat Area Rug (wrapped in a group so it rotates like everything else)
            const rugGroup = new THREE.Group();
            const rugGeo = new THREE.PlaneGeometry(item.width, item.depth);
            const rugMat = new THREE.MeshStandardMaterial({
              color: itemColor,
              roughness: 0.95,
              metalness: 0.0,
            });
            const rugMesh = new THREE.Mesh(rugGeo, rugMat);
            rugMesh.rotation.x = -Math.PI / 2;
            rugMesh.position.y = 0.02;
            rugMesh.receiveShadow = true;
            rugGroup.add(rugMesh);
            rugGroup.position.set(itemPosX, 0, itemPosZ);
            rugGroup.rotation.y = rotRad;
            scene.add(rugGroup);
            rootObject = rugGroup;
          } else {
            // Standard bounding furniture volume
            const defaultHeight = item.height || 0.75;
            const geo = new THREE.BoxGeometry(item.width, defaultHeight, item.depth);
            const mat = new THREE.MeshStandardMaterial({
              color: itemColor,
              roughness: 0.6,
              wireframe: showWireframe,
            });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(itemPosX, defaultHeight / 2, itemPosZ);
            mesh.rotation.y = rotRad;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            scene.add(mesh);
            rootObject = mesh;
          }

          rootObject.userData.furnitureId = item.id;
          rootObject.userData.category = item.category;
          furnitureObjectsRef.current.push(rootObject);
        });
      }
    }
  };

  // Procedural Furniture Helpers
  const createWallSegment = (
    scene: THREE.Scene,
    w: number,
    d: number,
    h: number,
    x: number,
    y: number,
    z: number,
    mat: THREE.Material
  ) => {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
  };

  const create3DSofa = (
    scene: THREE.Scene,
    w: number,
    d: number,
    x: number,
    z: number,
    rot: number,
    color: THREE.Color,
    wireframe: boolean
  ): THREE.Group => {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.75, wireframe });

    // Seat cushion
    const seatH = 0.42;
    const seatGeo = new THREE.BoxGeometry(w, seatH, d);
    const seat = new THREE.Mesh(seatGeo, mat);
    seat.position.y = seatH / 2;
    seat.castShadow = true;
    seat.receiveShadow = true;
    group.add(seat);

    // Backrest
    const backH = 0.45;
    const backD = d * 0.28;
    const backGeo = new THREE.BoxGeometry(w, backH, backD);
    const back = new THREE.Mesh(backGeo, mat);
    back.position.set(0, seatH + backH / 2, -d / 2 + backD / 2);
    back.castShadow = true;
    group.add(back);

    // Armrests
    const armW = w * 0.12;
    const armH = 0.25;
    const armGeo = new THREE.BoxGeometry(armW, armH, d);
    const armL = new THREE.Mesh(armGeo, mat);
    armL.position.set(-w / 2 + armW / 2, seatH + armH / 2, 0);
    armL.castShadow = true;
    group.add(armL);

    const armR = new THREE.Mesh(armGeo, mat);
    armR.position.set(w / 2 - armW / 2, seatH + armH / 2, 0);
    armR.castShadow = true;
    group.add(armR);

    group.position.set(x, 0, z);
    group.rotation.y = rot;
    scene.add(group);
    return group;
  };

  const create3DTable = (
    scene: THREE.Scene,
    w: number,
    d: number,
    x: number,
    z: number,
    rot: number,
    color: THREE.Color,
    wireframe: boolean
  ): THREE.Group => {
    const group = new THREE.Group();
    const tableTopH = 0.45;
    const topThickness = 0.05;
    const topMat = new THREE.MeshStandardMaterial({ color, roughness: 0.4, wireframe });

    // Table Top
    const topGeo = new THREE.BoxGeometry(w, topThickness, d);
    const top = new THREE.Mesh(topGeo, topMat);
    top.position.y = tableTopH;
    top.castShadow = true;
    top.receiveShadow = true;
    group.add(top);

    // Table Legs (4 corners)
    const legGeo = new THREE.CylinderGeometry(0.025, 0.025, tableTopH - topThickness);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.3 });
    const legOffsets = [
      { lx: -w / 2 + 0.08, lz: -d / 2 + 0.08 },
      { lx: w / 2 - 0.08, lz: -d / 2 + 0.08 },
      { lx: -w / 2 + 0.08, lz: d / 2 - 0.08 },
      { lx: w / 2 - 0.08, lz: d / 2 - 0.08 },
    ];

    legOffsets.forEach(({ lx, lz }) => {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(lx, (tableTopH - topThickness) / 2, lz);
      leg.castShadow = true;
      group.add(leg);
    });

    group.position.set(x, 0, z);
    group.rotation.y = rot;
    scene.add(group);
    return group;
  };

  const create3DStorage = (
    scene: THREE.Scene,
    w: number,
    d: number,
    x: number,
    z: number,
    rot: number,
    color: THREE.Color,
    wireframe: boolean
  ): THREE.Group => {
    const group = new THREE.Group();
    const h = 0.65;
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.5, wireframe });
    const geo = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = h / 2;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);

    group.position.set(x, 0, z);
    group.rotation.y = rot;
    scene.add(group);
    return group;
  };

  const create3DLamp = (
    scene: THREE.Scene,
    x: number,
    z: number,
    rot: number,
    color: THREE.Color
  ): THREE.Group => {
    const group = new THREE.Group();
    const poleH = 1.6;

    // Base
    const baseGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.04);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.2 });
    const base = new THREE.Mesh(baseGeo, baseMat);
    group.add(base);

    // Stem
    const stemGeo = new THREE.CylinderGeometry(0.015, 0.015, poleH);
    const stem = new THREE.Mesh(stemGeo, baseMat);
    stem.position.y = poleH / 2;
    group.add(stem);

    // Shade
    const shadeGeo = new THREE.ConeGeometry(0.2, 0.28, 16, 1, true);
    const shadeMat = new THREE.MeshStandardMaterial({
      color: 0xfffcf5,
      roughness: 0.9,
      side: THREE.DoubleSide,
      emissive: new THREE.Color(0xffeaa7),
      emissiveIntensity: 0.6,
    });
    const shade = new THREE.Mesh(shadeGeo, shadeMat);
    shade.position.y = poleH;
    group.add(shade);

    group.position.set(x, 0, z);
    group.rotation.y = rot;
    scene.add(group);
    return group;
  };

  // Enforce the same room-boundary clamp and non-overlap rule the server's
  // sanitizeFurnitureCoordinates() applies, so dragging never produces a
  // layout the backend wouldn't have allowed. Rotation is recorded freely
  // (the server never validates it either). Rugs ('decor') are exempt from
  // overlap checks on both sides since they are meant to sit under other
  // furniture.
  const applyTransformConstraints = (object: THREE.Object3D, furnitureId: string) => {
    const list = furnitureDataRef.current;
    const idx = list.findIndex((f) => f.id === furnitureId);
    if (idx === -1) return;
    const current = list[idx];

    const rotationDeg = THREE.MathUtils.radToDeg(object.rotation.y);
    current.rotation = ((rotationDeg % 360) + 360) % 360;

    if (transformControlsRef.current?.getMode() !== 'translate') return;

    const rawX = object.position.x + roomW / 2 - current.width / 2;
    const rawY = object.position.z + roomL / 2 - current.depth / 2;

    const maxX = Math.max(0, roomW - current.width);
    const maxY = Math.max(0, roomL - current.depth);
    const clampedX = Math.min(Math.max(rawX, 0), maxX);
    const clampedY = Math.min(Math.max(rawY, 0), maxY);

    const candidate = { ...current, x: clampedX, y: clampedY };
    const overlapsOther =
      current.category !== 'decor' &&
      list.some((other, i) => i !== idx && other.category !== 'decor' && furnitureAabbOverlap(candidate, other));

    if (overlapsOther) {
      // Reject the move: snap the mesh back to its last valid position.
      object.position.x = current.x + current.width / 2 - roomW / 2;
      object.position.z = current.y + current.depth / 2 - roomL / 2;
      return;
    }

    current.x = clampedX;
    current.y = clampedY;
    object.position.x = clampedX + current.width / 2 - roomW / 2;
    object.position.z = clampedY + current.depth / 2 - roomL / 2;
  };

  // Attach/detach TransformControls to whichever furniture object matches
  // the current selection, so the 2D preview and 3D view stay in sync.
  const syncTransformSelection = () => {
    const controls = transformControlsRef.current;
    if (!controls) return;

    if (!selectedFurnitureId) {
      controls.detach();
      return;
    }

    const target = furnitureObjectsRef.current.find(
      (obj) => obj.userData.furnitureId === selectedFurnitureId
    );
    if (target) {
      controls.attach(target);
    } else {
      controls.detach();
    }
  };

  const applyTransformAxisVisibility = (controls: TransformControls, mode: 'translate' | 'rotate') => {
    if (mode === 'translate') {
      controls.showX = true;
      controls.showZ = true;
      controls.showY = false;
    } else {
      controls.showX = false;
      controls.showZ = false;
      controls.showY = true;
    }
  };

  // Pure hit-test: which furniture id (if any) sits under a screen point.
  // No side effects, so it's safe to call from mousedown to decide whether
  // to suppress camera orbit, as well as from the click-to-deselect path.
  const raycastFurnitureIdAt = (clientX: number, clientY: number): string | null => {
    const renderer = rendererRef.current;
    const camera = cameraRef.current;
    if (!renderer || !camera || furnitureObjectsRef.current.length === 0) return null;

    const rect = renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );

    raycasterRef.current.setFromCamera(ndc, camera);
    const intersects = raycasterRef.current.intersectObjects(furnitureObjectsRef.current, true);
    if (intersects.length === 0) return null;

    let hit: THREE.Object3D | null = intersects[0].object;
    while (hit && !hit.userData.furnitureId) hit = hit.parent;
    return hit?.userData.furnitureId ?? null;
  };

  // Raycast from a screen point and select whichever furniture object (if
  // any) it hits; clicking empty space deselects.
  const handleFurnitureRaycastSelect = (clientX: number, clientY: number) => {
    onSelectFurnitureRef.current?.(raycastFurnitureIdAt(clientX, clientY));
  };

  // Mouse drag handlers for Orbit (suppressed while TransformControls is
  // actively dragging a furniture piece, so the camera doesn't spin at the
  // same time as the gizmo drag). Also suppressed if the press itself lands
  // directly on a furniture mesh: without this check, a plain click-and-drag
  // on a furniture piece's body (rather than its gizmo handles) would orbit
  // the camera and never select or move anything.
  const handleMouseDown = (e: React.MouseEvent) => {
    pointerDownPosition.current = { x: e.clientX, y: e.clientY };

    const hitFurnitureId = raycastFurnitureIdAt(e.clientX, e.clientY);
    if (hitFurnitureId) {
      if (hitFurnitureId !== selectedFurnitureId) {
        onSelectFurnitureRef.current?.(hitFurnitureId);
      }
      isDragging.current = false;
      return;
    }

    isDragging.current = true;
    previousMousePosition.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current || cameraMode !== 'orbit' || isTransformDragging.current) return;

    const deltaX = e.clientX - previousMousePosition.current.x;
    const deltaY = e.clientY - previousMousePosition.current.y;

    cameraAngles.current.theta -= deltaX * 0.008;
    cameraAngles.current.phi = Math.max(
      0.1,
      Math.min(Math.PI / 2 - 0.05, cameraAngles.current.phi - deltaY * 0.008)
    );

    previousMousePosition.current = { x: e.clientX, y: e.clientY };
    updateCameraPosition();
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    isDragging.current = false;

    // A near-zero-movement mouseup (not mouseleave, and not the tail end of
    // a gizmo drag) is treated as a click: raycast for furniture selection.
    if (e.type === 'mouseup' && !isTransformDragging.current) {
      const dx = e.clientX - pointerDownPosition.current.x;
      const dy = e.clientY - pointerDownPosition.current.y;
      if (Math.hypot(dx, dy) < 4) {
        handleFurnitureRaycastSelect(e.clientX, e.clientY);
      }
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    cameraAngles.current.radius = Math.max(
      4,
      Math.min(45, cameraAngles.current.radius + e.deltaY * 0.02)
    );
    updateCameraPosition();
  };

  // Reset Camera View
  const handleResetCamera = () => {
    cameraAngles.current = { theta: Math.PI / 4, phi: Math.PI / 3, radius: Math.max(roomW, roomL) * 1.6 };
    setCameraMode('orbit');
    updateCameraPosition();
  };

  // Export Snapshot
  const handleExportPNG = () => {
    if (!rendererRef.current) return;
    const dataUrl = rendererRef.current.domElement.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `INTERIO_${projectTitle.replace(/\s+/g, '_')}_3D.png`;
    link.href = dataUrl;
    link.click();
    setExportedToast(true);
    setTimeout(() => setExportedToast(false), 3000);
  };

  // Export JSON specification
  const handleExportJSON = () => {
    const spec = {
      app: 'INTERIO Architectural Platform',
      version: '1.0',
      exportedAt: new Date().toISOString(),
      projectType,
      projectTitle,
      dimensions: { width: roomW, length: roomL, wallHeight },
      data,
    };
    const blob = new Blob([JSON.stringify(spec, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `INTERIO_${projectTitle.replace(/\s+/g, '_')}_Specs.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExportedToast(true);
    setTimeout(() => setExportedToast(false), 3000);
  };

  return (
    <div className="relative w-full h-[calc(100vh-5rem)] flex flex-col bg-slate-950 overflow-hidden select-none">
      {/* 3D Canvas Mount */}
      <div
        ref={mountRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        className="w-full h-full cursor-grab active:cursor-grabbing"
      />

      {/* Top Floating Control Bar */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none">
        {/* Left: Back & Project Title */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {onBackToHome && (
            <button
              id="btn-3d-home"
              onClick={onBackToHome}
              className="px-3 py-1.5 rounded-lg bg-stone-900/90 hover:bg-stone-800 text-stone-200 text-xs font-medium flex items-center gap-1.5 backdrop-blur-md transition-colors border border-stone-800"
              title="Return to Home Dashboard"
            >
              <Home className="w-3.5 h-3.5" />
              <span>Home</span>
            </button>
          )}

          <button
            id="btn-3d-back"
            onClick={onBack}
            className="px-3 py-1.5 rounded-lg bg-stone-900/90 hover:bg-stone-800 text-stone-200 text-xs font-medium flex items-center gap-1.5 backdrop-blur-md transition-colors border border-stone-800"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </button>

          <div className="px-3 py-1.5 rounded-lg bg-stone-900/90 text-white border border-stone-800 backdrop-blur-md flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <div>
              <p className="text-xs font-medium text-stone-200 leading-none">
                {projectTitle}
              </p>
              <p className="text-[10px] text-stone-400 mt-0.5">
                {projectType === 'floorplan'
                  ? `Floor Plan (${roomW}m × ${roomL}m · ${floorPlanData?.rooms.length || 0} Rooms)`
                  : projectType === 'interior'
                  ? `Interior Scheme (${roomW}m × ${roomL}m · ${interiorData?.furniture?.length || 0} Pieces)`
                  : `House Reconstruction (${roomW}m × ${roomL}m)`}
              </p>
            </div>
          </div>
        </div>

        {/* Right: Camera Angles & Mode Toggles */}
        <div className="flex items-center gap-1.5 pointer-events-auto">
          {/* Camera Presets */}
          <div className="p-1 rounded-lg bg-stone-900/90 border border-stone-800 backdrop-blur-md flex items-center gap-1">
            <button
              onClick={() => {
                setCameraMode('orbit');
                handleResetCamera();
              }}
              title="Perspective Orbit"
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1 ${
                cameraMode === 'orbit' ? 'bg-stone-800 text-white' : 'text-stone-400 hover:text-white'
              }`}
            >
              <Eye className="w-3 h-3" />
              <span>Orbit</span>
            </button>
            <button
              onClick={() => {
                setCameraMode('top');
                updateCameraPosition();
              }}
              title="Top-Down Blueprint"
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1 ${
                cameraMode === 'top' ? 'bg-stone-800 text-white' : 'text-stone-400 hover:text-white'
              }`}
            >
              <Layers className="w-3 h-3" />
              <span>Top-Down</span>
            </button>
            <button
              onClick={() => {
                setCameraMode('iso');
                updateCameraPosition();
              }}
              title="Isometric 45°"
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1 ${
                cameraMode === 'iso' ? 'bg-stone-800 text-white' : 'text-stone-400 hover:text-white'
              }`}
            >
              <Box className="w-3 h-3" />
              <span>Isometric</span>
            </button>
          </div>

          {/* Lighting Mode Toggle */}
          <button
            onClick={() => setLightingMode(lightingMode === 'day' ? 'night' : 'day')}
            title={`Switch to ${lightingMode === 'day' ? 'Evening' : 'Daylight'}`}
            className="p-2 rounded-lg bg-stone-900/90 hover:bg-stone-800 text-stone-300 border border-stone-800 backdrop-blur-md transition-colors cursor-pointer"
          >
            {lightingMode === 'day' ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
          </button>

          {/* Reset Camera */}
          <button
            onClick={handleResetCamera}
            title="Reset Camera View"
            className="p-2 rounded-lg bg-stone-900/90 hover:bg-stone-800 text-stone-300 border border-stone-800 backdrop-blur-md transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Furniture Selection & Transform Panel (interior / renovation only) */}
      {interiorData && selectedFurnitureId && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-stone-900/90 border border-stone-800 backdrop-blur-md px-3 py-2 rounded-xl">
          <span className="text-xs font-medium text-stone-200 max-w-[140px] truncate">
            {interiorData.furniture?.find((f) => f.id === selectedFurnitureId)?.name || 'Selected Item'}
          </span>

          <div className="p-1 rounded-lg bg-stone-800/80 border border-stone-700/60 flex items-center gap-1">
            <button
              id="btn-3d-transform-move"
              onClick={() => setTransformMode('translate')}
              title="Move (drag within the floor plane)"
              className={`px-2 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1 ${
                transformMode === 'translate' ? 'bg-stone-700 text-white' : 'text-stone-400 hover:text-white'
              }`}
            >
              <Move className="w-3 h-3" />
              <span>Move</span>
            </button>
            <button
              id="btn-3d-transform-rotate"
              onClick={() => setTransformMode('rotate')}
              title="Rotate around vertical axis"
              className={`px-2 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1 ${
                transformMode === 'rotate' ? 'bg-stone-700 text-white' : 'text-stone-400 hover:text-white'
              }`}
            >
              <RotateCw className="w-3 h-3" />
              <span>Rotate</span>
            </button>
          </div>

          <button
            id="btn-3d-transform-deselect"
            onClick={() => onSelectFurnitureRef.current?.(null)}
            title="Deselect (Esc)"
            className="p-1.5 rounded-md text-stone-400 hover:text-white hover:bg-stone-800 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Bottom Action / Export Bar */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-stone-900/90 border border-stone-800 backdrop-blur-md px-3.5 py-2 rounded-xl">
        {/* Wall Height Adjuster */}
        <div className="hidden sm:flex items-center gap-2 border-r border-stone-800 pr-3 mr-1">
          <span className="text-[11px] text-stone-400">
            Wall: {wallHeight}m
          </span>
          <input
            type="range"
            min="1.8"
            max="3.8"
            step="0.2"
            value={wallHeight}
            onChange={(e) => setWallHeight(Number(e.target.value))}
            className="w-16 accent-stone-400 cursor-pointer"
          />
        </div>

        {/* Wireframe toggle */}
        <button
          onClick={() => setShowWireframe(!showWireframe)}
          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors border cursor-pointer ${
            showWireframe
              ? 'bg-stone-800 text-white border-stone-700'
              : 'text-stone-400 border-transparent hover:text-white'
          }`}
        >
          {showWireframe ? 'Wireframe ON' : 'Solid'}
        </button>

        {/* Save Project Button */}
        <button
          id="btn-3d-save"
          onClick={onSaveProject}
          className="px-3 py-1 rounded-md bg-stone-100 hover:bg-white text-stone-900 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <BookmarkPlus className="w-3.5 h-3.5" />
          <span>Save</span>
        </button>

        {/* Export Snapshot PNG */}
        <button
          id="btn-3d-export-png"
          onClick={handleExportPNG}
          className="px-2.5 py-1 rounded-md bg-stone-800/80 hover:bg-stone-800 text-stone-300 text-xs font-medium flex items-center gap-1.5 border border-stone-700/60 transition-colors cursor-pointer"
        >
          <Camera className="w-3.5 h-3.5" />
          <span>Capture</span>
        </button>

        {/* Export Specs JSON */}
        <button
          id="btn-3d-export-json"
          onClick={handleExportJSON}
          className="px-2.5 py-1 rounded-md bg-stone-800/80 hover:bg-stone-800 text-stone-300 text-xs font-medium flex items-center gap-1.5 border border-stone-700/60 transition-colors cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export</span>
        </button>
      </div>

      {/* Floating Instructions Toast */}
      <div className="absolute bottom-6 left-6 hidden lg:block pointer-events-none">
        <div className="bg-stone-900/80 border border-stone-800 backdrop-blur-md px-3 py-1.5 rounded-lg text-[11px] text-stone-400">
          {interiorData
            ? 'Click furniture to select · Drag gizmo to move/rotate · Drag empty space to orbit · Scroll to zoom'
            : 'Left-click & drag to rotate · Scroll to zoom'}
        </div>
      </div>

      {/* Export Confirmation Toast */}
      {exportedToast && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-stone-900 border border-stone-800 text-white px-3.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 shadow-lg animate-fade-in">
          <Check className="w-3.5 h-3.5 text-emerald-400" />
          <span>File downloaded successfully</span>
        </div>
      )}
    </div>
  );
};

// Axis-aligned overlap test for two furniture rectangles, ignoring rotation
// (matches the approximation the server's sanitizeFurnitureCoordinates uses).
function furnitureAabbOverlap(
  a: { x: number; y: number; width: number; depth: number },
  b: { x: number; y: number; width: number; depth: number }
): boolean {
  const EPS = 1e-6;
  return (
    a.x < b.x + b.width - EPS &&
    a.x + a.width > b.x + EPS &&
    a.y < b.y + b.depth - EPS &&
    a.y + a.depth > b.y + EPS
  );
}
