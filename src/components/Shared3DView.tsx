import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createFloorMaterial, createFurnitureModel, addStyledDecor, furnitureAppearanceKey } from '../three/interiorVisuals';
import { buildInteriorShell, createInteriorFloor, createSurfaceHighlight, createSurfaceMaterial, createFloorFinishMaterial, isSurfaceId, type SurfaceId, type WallSide } from '../three/interiorShell';
import { getMaterialVariant } from './FloorPlan3D/materialCatalog';
import { resolveWallFinish, type WallScope } from '../services/interiorFinishes';
import { InteriorDesignPanel, PANEL_MAX_WIDTH, PANEL_MIN_WIDTH, type PanelTab } from './InteriorEditor/InteriorDesignPanel';
import { interiorSceneKey, resolveInteriorOpenings } from '../three/interiorSceneKey';
import { furnitureFootprint, hitsOpening } from '../services/layoutOptimizer';
import { getCatalogPiece } from '../services/furnitureCatalog';
import { furnitureTransform3D, rotationFromRadians } from '../three/furnitureTransform3D';
import { createCachedGlbLoader, loadFurnitureModel } from '../three/glbFurniture';
import { findRealModel } from '../services/furnitureModels';
import {
  createContactShadow,
  defaultQuality,
  disposeContactShadow,
  qualitySettings,
  shadowFrustum,
  sunPosition,
  type RenderQuality,
} from '../three/interiorRealism';
import { createCatalogItem, createDuplicate } from '../services/furniturePlacement';
import {
  FloorPlanResult,
  FurnitureItem,
  InteriorDesignResult,
  Point2D,
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
  Paintbrush,
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
  /** Whole-result edits (finishes, palette) from the interior editor. */
  onInteriorChange?: (next: InteriorDesignResult) => void;
}

const WALL_SIDE_LIST: WallSide[] = ['north', 'south', 'east', 'west'];
// One shared loader, so each bundled model is downloaded and parsed once per session.
const glbLoader = createCachedGlbLoader(new GLTFLoader());

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
  onInteriorChange,
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
  const [showGrid, setShowGrid] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [wallHeight, setWallHeight] = useState(2.8); // meters
  const [shellView, setShellView] = useState<'interior' | 'full'>('interior');
  const [exportedToast, setExportedToast] = useState(false);
  // 'open' (default): rotating the camera reveals the interior by hiding
  // whichever wall(s) are nearest it. 'enclosed': all 4 walls always stay
  // solid, like a fully closed room shell seen from outside.
  const [wallShellMode, setWallShellMode] = useState<'open' | 'enclosed'>('open');
  const wallShellModeRef = useRef(wallShellMode);
  wallShellModeRef.current = wallShellMode;

  // Manual Orbit controls tracking
  const isDragging = useRef(false);
  const previousMousePosition = useRef({ x: 0, y: 0 });
  const pointerDownPosition = useRef({ x: 0, y: 0 });
  const cameraAngles = useRef({ theta: Math.PI / 4, phi: Math.PI / 3, radius: 18 });
  const targetLookAt = useRef(new THREE.Vector3(0, 0, 0));
  const shellWallMaterialsRef = useRef<Array<{ normal: THREE.Vector3; material: THREE.MeshStandardMaterial }>>([]);

  // Interior editing: the live floor mesh and wall materials are kept so an
  // edit updates them in place instead of rebuilding the whole scene.
  const floorMeshRef = useRef<THREE.Mesh | null>(null);
  // Which look the floor/each wall currently has ('palette:<hex>' or 'finish:<json>'), so a sync only touches what changed.
  const floorColorRef = useRef<string | null>(null);
  const wallKeysRef = useRef<Partial<Record<WallSide, string>>>({});
  // Materials created for finishes; they are ours to dispose when replaced.
  const ownedMaterialsRef = useRef<Set<THREE.Material>>(new Set());
  const wallMaterialsRef = useRef<Partial<Record<WallSide, THREE.MeshStandardMaterial>>>({});
  const roomShapeRef = useRef({ width: 0, depth: 0, height: 0, thickness: 0.2 });
  const highlightRef = useRef<THREE.Object3D | null>(null);
  const [selectedSurface, setSelectedSurface] = useState<SurfaceId | null>(null);

  // Design sidebar (interior projects only).
  const PANEL_WIDTH_KEY = 'interio:interior-panel-width';
  const [isSmall, setIsSmall] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  const [panelOpen, setPanelOpen] = useState(() => typeof window === 'undefined' || window.innerWidth >= 768);
  const [panelWidth, setPanelWidth] = useState(() => {
    try {
      const saved = Number(window.localStorage.getItem(PANEL_WIDTH_KEY));
      if (Number.isFinite(saved) && saved >= PANEL_MIN_WIDTH && saved <= PANEL_MAX_WIDTH) return saved;
    } catch { /* storage unavailable: use the default */ }
    return 360;
  });
  const QUALITY_KEY = 'interio:render-quality';
  const [quality, setQuality] = useState<RenderQuality>(() => {
    try {
      const saved = window.localStorage.getItem(QUALITY_KEY);
      if (saved === 'high' || saved === 'balanced') return saved;
    } catch { /* storage unavailable: pick by device */ }
    return defaultQuality(window.innerWidth, navigator.hardwareConcurrency);
  });
  const [panelTab, setPanelTab] = useState<PanelTab>('floor');
  const [wallScope, setWallScope] = useState<WallScope>('all');
  const selectedSurfaceRef = useRef(selectedSurface);
  selectedSurfaceRef.current = selectedSurface;
  // Camera is only re-fitted when the room itself changes, not on every rebuild.
  const cameraFitKeyRef = useRef('');
  // Dev aid: how many times the scene was built from scratch (see data-scene-builds).
  const sceneBuildCount = useRef(0);

  // The 4 room walls, each a solid Group (wall body + its window/door/trim
  // detailing) so they can be shown/hidden together. All 4 are always
  // built as real solid geometry; whichever one currently sits between the
  // camera and the room interior is hidden so the camera can still see
  // inside, rather than ever leaving a wall out of the scene entirely.
  const wallGroupsRef = useRef<Partial<Record<'north' | 'south' | 'east' | 'west', THREE.Group>>>({});

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
  const selectedFurnitureIdRef = useRef(selectedFurnitureId);
  onFurnitureChangeRef.current = onFurnitureChange;
  onSelectFurnitureRef.current = onSelectFurniture;
  const onInteriorChangeRef = useRef(onInteriorChange);
  onInteriorChangeRef.current = onInteriorChange;
  selectedFurnitureIdRef.current = selectedFurnitureId;

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

  // Workflow 3 (Reconstruction): the 4 corners the user clicked on the room
  // photo, still in normalized [0,1] image space. When present, the room
  // shell is extruded to actually follow this quadrilateral instead of a
  // plain rectangle. Older saved reconstructions without cornerPoints (or
  // any other project type) fall back to the rectangular room below.
  const reconstructionCorners: Point2D[] | null =
    projectType === 'renovation' &&
    Array.isArray((data as ReconstructionData)?.cornerPoints) &&
    (data as ReconstructionData).cornerPoints.length >= 4
      ? (data as ReconstructionData).cornerPoints
      : null;

  // Interior projects rebuild the scene only when the geometry changes (room,
  // openings, furniture list). Colour and position edits are applied in place
  // by the sync effect below. Other project types keep rebuilding on any data change.
  const sceneDependency: unknown = projectType === 'interior' ? interiorSceneKey(interiorData) : data;

  // Initialize Three.js scene
  useEffect(() => {
    if (!mountRef.current) return;
    sceneBuildCount.current += 1;
    mountRef.current.dataset.sceneBuilds = String(sceneBuildCount.current);
    highlightRef.current = null;

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
    const isInterior = projectType === 'interior';
    const settings = qualitySettings(quality, window.devicePixelRatio, renderer.capabilities.getMaxAnisotropy());
    renderer.setPixelRatio(isInterior ? settings.pixelRatio : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = isInterior ? (lightingMode === 'day' ? 1.05 : 0.9) : 0.98;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const pmrem = new THREE.PMREMGenerator(renderer);
    const roomEnvironment = new RoomEnvironment();
    const environmentTarget = pmrem.fromScene(roomEnvironment, 0.04);
    scene.environment = environmentTarget.texture;
    // The bundled room environment is bright; dial it down so the real lights and shadows carry the look.
    if (isInterior) scene.environmentIntensity = lightingMode === 'day' ? 0.55 : 0.22;
    pmrem.dispose();
    roomEnvironment.dispose();

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
      list[idx].rotation = rotationFromRadians(object.rotation.y);
    };
    transformControls.addEventListener('dragging-changed', handleDraggingChanged);
    transformControls.addEventListener('objectChange', handleObjectChange);

    // Build 3D models based on current data
    build3DScene(scene);

    // Re-attach the gizmo to whichever furniture is currently selected
    // (the scene/objects were just rebuilt, so prior object references are gone).
    syncTransformSelection();
    syncSurfaceHighlight();
    if (projectType === 'interior') syncInteriorAppearance(scene);

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
      environmentTarget.dispose();
      ownedMaterialsRef.current.forEach((material) => material.dispose());
      ownedMaterialsRef.current.clear();
      transformControlsRef.current = null;
      if (rendererRef.current?.domElement && mountRef.current) {
        mountRef.current.innerHTML = '';
      }
      renderer.dispose();
    };
  }, [sceneDependency, projectType, wallHeight, lightingMode, showWireframe, showGrid, shellView, quality]);

  // Apply interior colour and position edits to the existing scene. Runs after
  // the build effect, so right after a rebuild it finds everything in sync.
  useEffect(() => {
    if (projectType !== 'interior' || !interiorData || !sceneRef.current) return;
    syncInteriorAppearance(sceneRef.current);
  }, [data]);

  // Re-sync the gizmo when selection changes without a full scene rebuild
  // (e.g. the user picked a different item in the 2D preview before
  // switching to 3D, or clicked a furniture mesh here).
  useEffect(() => {
    syncTransformSelection();
  }, [selectedFurnitureId]);

  // Selected floor/wall outline (never tints the real material).
  useEffect(() => {
    syncSurfaceHighlight();
  }, [selectedSurface]);

  // Switch translate/rotate mode on the live TransformControls instance.
  useEffect(() => {
    const controls = transformControlsRef.current;
    if (!controls) return;
    controls.setMode(transformMode);
    applyTransformAxisVisibility(controls, transformMode);
  }, [transformMode]);

  // Re-apply wall visibility immediately when the shell mode toggles,
  // instead of waiting for the next camera move.
  useEffect(() => {
    updateWallCutaway();
  }, [wallShellMode]);

  // Escape deselects the current furniture piece.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onSelectFurnitureRef.current?.(null);
        setSelectedSurface(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const onResize = () => setIsSmall(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    try { window.localStorage.setItem(QUALITY_KEY, quality); } catch { /* not persisted */ }
  }, [quality]);

  useEffect(() => {
    try { window.localStorage.setItem(PANEL_WIDTH_KEY, String(panelWidth)); } catch { /* not persisted */ }
  }, [panelWidth]);

  // Picking something in 3D jumps the sidebar to the matching tab (and wall).
  useEffect(() => {
    if (!selectedSurface) return;
    if (selectedSurface === 'floor') setPanelTab('floor');
    else {
      setPanelTab('walls');
      setWallScope(selectedSurface.slice(5) as WallScope);
    }
    setPanelOpen(true);
  }, [selectedSurface]);

  useEffect(() => {
    if (selectedFurnitureId && projectType === 'interior') {
      setPanelTab('furniture');
      setSelectedSurface(null);
    }
  }, [selectedFurnitureId]);

  // Short messages (warnings, "Undo delete"). Kept in a ref-backed timer so
  // scene listeners created once per build can still raise them.
  const [toast, setToast] = useState<{ message: string; tone: 'info' | 'warn'; action?: { label: string; run: () => void } } | null>(null);
  const toastTimer = useRef<number | null>(null);
  const showToast = (message: string, tone: 'info' | 'warn' = 'info', action?: { label: string; run: () => void }) => {
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    setToast({ message, tone, action });
    toastTimer.current = window.setTimeout(() => setToast(null), action ? 8000 : 4000);
  };
  useEffect(() => () => { if (toastTimer.current !== null) window.clearTimeout(toastTimer.current); }, []);

  // Add / duplicate / delete pieces. These always read the latest design through a ref.
  const latestInterior = useRef<InteriorDesignResult | null>(null);
  latestInterior.current = projectType === 'interior' ? (interiorData as InteriorDesignResult | null) : null;

  const addFurniture = (catalogId: string) => {
    const design = latestInterior.current;
    const piece = getCatalogPiece(catalogId);
    if (!design || !piece) return;
    const added = createCatalogItem(design, piece);
    if (!added) {
      showToast(`No free space for a ${piece.name.toLowerCase()}. Move or remove something first.`, 'warn');
      return;
    }
    onFurnitureChangeRef.current?.([...design.furniture, added.item]);
    onSelectFurnitureRef.current?.(added.item.id);
    showToast(added.tight ? `Added ${piece.name} in a tight spot.` : `Added ${piece.name}.`);
  };

  const duplicateFurniture = (id: string) => {
    const design = latestInterior.current;
    const source = design?.furniture.find((f) => f.id === id);
    if (!design || !source) return;
    const copy = createDuplicate(design, source);
    if (!copy) {
      showToast(`No free space for another ${source.name.toLowerCase()}.`, 'warn');
      return;
    }
    onFurnitureChangeRef.current?.([...design.furniture, copy.item]);
    onSelectFurnitureRef.current?.(copy.item.id);
    showToast(copy.tight ? `Duplicated ${source.name} in a tight spot.` : `Duplicated ${source.name}.`);
  };

  const deleteFurniture = (id: string) => {
    const design = latestInterior.current;
    const index = design?.furniture.findIndex((f) => f.id === id) ?? -1;
    if (!design || index < 0) return;
    const removed = design.furniture[index];
    onFurnitureChangeRef.current?.(design.furniture.filter((f) => f.id !== id));
    onSelectFurnitureRef.current?.(null);
    showToast(`Deleted ${removed.name}.`, 'info', {
      label: 'Undo',
      run: () => {
        const latest = latestInterior.current;
        if (!latest || latest.furniture.some((f) => f.id === removed.id)) return;
        const list = [...latest.furniture];
        list.splice(Math.min(index, list.length), 0, removed);
        onFurnitureChangeRef.current?.(list);
        onSelectFurnitureRef.current?.(removed.id);
        setToast(null);
      },
    });
  };
  const deleteFurnitureRef = useRef(deleteFurniture);
  deleteFurnitureRef.current = deleteFurniture;

  // Delete removes the selected piece (unless the user is typing in a field).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Delete') return;
      const target = e.target as HTMLElement | null;
      if (target && (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable)) return;
      if (selectedFurnitureIdRef.current && latestInterior.current) deleteFurnitureRef.current(selectedFurnitureIdRef.current);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Dev-only handle for checking the editor in a browser (no UI selects a
  // floor/wall yet): window.__interio3d.selectSurface('wall:north'), .builds().
  useEffect(() => {
    if (!(import.meta as { env?: { DEV?: boolean } }).env?.DEV) return;
    const handle = { selectSurface: setSelectedSurface, builds: () => sceneBuildCount.current };
    (window as unknown as { __interio3d?: typeof handle }).__interio3d = handle;
    return () => { delete (window as unknown as { __interio3d?: typeof handle }).__interio3d; };
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
    updateWallCutaway();
    updateCameraFacingWallOpacity();
  };

  // All 4 walls are always built as solid geometry (see build3DScene).
  // When wallShellMode is 'open', this hides whichever wall(s) currently
  // sit between the camera and the room's center, so the view into the
  // room is never blocked -- a standard "doll's house" cutaway,
  // recomputed on every camera move. When wallShellMode is 'enclosed',
  // every wall simply stays solid and visible, matching a fully closed
  // room shell. In 'top' camera mode the camera looks straight down (no
  // horizontal wall can block that view), so every wall stays visible
  // regardless of wallShellMode.
  const WALL_OUTWARD_NORMALS: Record<'north' | 'south' | 'east' | 'west', [number, number]> = {
    north: [0, -1],
    south: [0, 1],
    east: [1, 0],
    west: [-1, 0],
  };
  const updateWallCutaway = () => {
    const camera = cameraRef.current;
    const groups = wallGroupsRef.current;
    if (!camera) return;

    const target = targetLookAt.current;
    const dx = camera.position.x - target.x;
    const dz = camera.position.z - target.z;
    const horizontalDist = Math.hypot(dx, dz);

    (Object.keys(groups) as (keyof typeof groups)[]).forEach((key) => {
      const group = groups[key];
      if (!group) return;
      if (wallShellModeRef.current === 'enclosed' || cameraMode === 'top' || horizontalDist < 0.001) {
        group.visible = true;
        return;
      }
      const [nx, nz] = WALL_OUTWARD_NORMALS[key];
      const dot = (dx / horizontalDist) * nx + (dz / horizontalDist) * nz;
      // A small positive threshold (rather than exactly 0) avoids a wall
      // flickering in/out right at an edge-on viewing angle.
      group.visible = dot <= 0.15;
    });
  };

  // In interior mode, only the wall facing the current camera fades. This
  // keeps free Orbit inspectable from every side without compromising the
  // complete shell shown in Full Shell mode. Independent of updateWallCutaway
  // above: that one hides a whole wall outright when wallShellMode is 'open',
  // this one softly fades whichever wall still faces the camera (e.g. in
  // 'enclosed' mode) when shellView is 'interior'.
  const updateCameraFacingWallOpacity = () => {
    const camera = cameraRef.current;
    if (!camera) return;
    const direction = camera.position.clone().sub(targetLookAt.current).setY(0).normalize();
    shellWallMaterialsRef.current.forEach(({ normal, material }) => {
      const facingCamera = normal.dot(direction) > 0.62;
      material.transparent = shellView === 'interior' && facingCamera;
      material.opacity = shellView === 'interior' && facingCamera ? 0.12 : 1;
      material.depthWrite = !(shellView === 'interior' && facingCamera);
      material.needsUpdate = true;
    });
  };

  // Setup Lights
  const setupLighting = (scene: THREE.Scene) => {
    const isInterior = projectType === 'interior';
    const settings = qualitySettings(quality, window.devicePixelRatio);
    // Ambient Light
    const ambient = new THREE.HemisphereLight(
      lightingMode === 'day' ? 0xfff7e9 : 0xb5c7e1,
      lightingMode === 'day' ? 0x7a6957 : 0x252b3a,
      lightingMode === 'day' ? (isInterior ? 0.55 : 0.72) : 0.48
    );
    scene.add(ambient);

    // Directional Sunlight
    const sunLight = new THREE.DirectionalLight(
      lightingMode === 'day' ? 0xfffaed : 0x93c5fd,
      lightingMode === 'day' ? (isInterior ? 1.25 : 1.05) : 0.55
    );
    sunLight.castShadow = true;
    if (isInterior) {
      // Fit the sun's shadow map to the room: crisp, soft-edged shadows without acne.
      const frustum = shadowFrustum(roomW, roomL, wallHeight);
      sunLight.position.copy(sunPosition(roomW, roomL, wallHeight));
      sunLight.shadow.mapSize.set(settings.shadowMapSize, settings.shadowMapSize);
      sunLight.shadow.camera.near = frustum.near;
      sunLight.shadow.camera.far = frustum.far;
      sunLight.shadow.camera.left = -frustum.half;
      sunLight.shadow.camera.right = frustum.half;
      sunLight.shadow.camera.top = frustum.half;
      sunLight.shadow.camera.bottom = -frustum.half;
      sunLight.shadow.bias = -0.0003;
      sunLight.shadow.normalBias = 0.035;
      sunLight.shadow.radius = 4;
    } else {
      sunLight.position.set(15, 25, 12);
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
      sunLight.shadow.normalBias = 0.025;
      sunLight.shadow.radius = 5;
    }
    scene.add(sunLight);

    // Soft Fill Light
    const fillLight = new THREE.DirectionalLight(0xe0e7ff, isInterior ? 0.3 : 0.24);
    fillLight.position.set(-15, 12, -10);
    scene.add(fillLight);

    // Warm Interior Accent point lights
    if (lightingMode === 'night' || interiorData) {
      const interiorLight = new THREE.PointLight(0xffbe76, isInterior ? 1.1 : 1.4, 15);
      interiorLight.position.set(0, wallHeight - 0.4, 0);
      // A shadow-casting point light renders the scene six extra times per frame, so interiors skip it.
      interiorLight.castShadow = !isInterior;
      scene.add(interiorLight);
    }

    // Daylight spilling in through each window (no shadows, so it is cheap and cannot leak through walls).
    if (isInterior && interiorData) {
      const windows = resolveInteriorOpenings(interiorData, roomW, roomL).filter((o) => o.type === 'window').slice(0, 2);
      for (const opening of windows) {
        const mid = (opening.start + opening.end) / 2;
        const inset = 0.45;
        const position = opening.wall === 'north' ? [mid - roomW / 2, 0, -roomL / 2 + inset]
          : opening.wall === 'south' ? [mid - roomW / 2, 0, roomL / 2 - inset]
          : opening.wall === 'west' ? [-roomW / 2 + inset, 0, mid - roomL / 2]
          : [roomW / 2 - inset, 0, mid - roomL / 2];
        const spill = new THREE.PointLight(lightingMode === 'day' ? 0xfff1d6 : 0x8fa8d8, lightingMode === 'day' ? 1.4 : 0.35, Math.max(roomW, roomL) * 1.4, 1.6);
        spill.position.set(position[0], Math.min(wallHeight - 0.5, 1.7), position[2]);
        scene.add(spill);
      }
    }
  };

  // Build 3D geometry
  const build3DScene = (scene: THREE.Scene) => {
    // Reset from any previous scene build -- repopulated below only for
    // the rectangular interior/renovation room shell (floor plan rooms and
    // the reconstructed-polygon shell don't use the wall cutaway/fade).
    shellWallMaterialsRef.current = [];
    wallGroupsRef.current = {};
    wallMaterialsRef.current = {};
    floorMeshRef.current = null;
    floorColorRef.current = null;
    wallKeysRef.current = {};
    ownedMaterialsRef.current.clear();

    // Center point of room
    const centerX = roomW / 2;
    const centerZ = roomL / 2;
    // Fit the camera when the room changes; a rebuild for any other reason
    // (lighting toggle, furniture list change) keeps the user's view.
    const fitKey = `${projectType}:${roomW}x${roomL}:${wallHeight}`;
    if (cameraFitKeyRef.current !== fitKey) {
      cameraFitKeyRef.current = fitKey;
      targetLookAt.current.set(0, wallHeight * 0.35, 0);
      cameraAngles.current.radius = Math.max(roomW, roomL) * 1.6;
    }
    updateCameraPosition();

    // 1. Foundation Ground / Grid Floor
    const groundGeo = new THREE.PlaneGeometry(roomW + 5, roomL + 5);
    const groundMat = new THREE.MeshStandardMaterial({
      color: lightingMode === 'day' ? 0xe9e5de : 0x191b20,
      roughness: 0.9,
      metalness: 0,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    ground.receiveShadow = true;
    scene.add(ground);
    if (showGrid) {
      const grid = new THREE.GridHelper(Math.max(roomW, roomL) + 4, Math.max(8, Math.ceil(Math.max(roomW, roomL) * 2)), 0xb8aa98, 0xd8d0c5);
      grid.position.y = 0.002;
      scene.add(grid);
    }

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
      // Reconstruction (Workflow 3) with clicked corners: scale the
      // normalized [0,1] image-space quadrilateral into the same
      // centered meter space furniture/walls already use.
      const polygonCorners = reconstructionCorners
        ? reconstructionCorners.slice(0, 4).map((p) => ({
            x: (p.x - 0.5) * roomW,
            z: (p.y - 0.5) * roomL,
          }))
        : null;

      // Main Room Hardwood/Stone Floor
      const floorGeo = polygonCorners ? buildPolygonFloorGeometry(polygonCorners) : new THREE.PlaneGeometry(roomW, roomL);
      const floorColor = interiorData.colorPalette?.find((swatch) => swatch.role === 'flooring')?.hex || '#b99569';
      const floorMat = createFloorMaterial(floorColor, /tile|marble/i.test(interiorData.style || ''));
      floorMat.wireframe = showWireframe;
      const floorMesh = createInteriorFloor(floorMat, { width: roomW, depth: roomL }, floorGeo);
      scene.add(floorMesh);
      floorMeshRef.current = floorMesh;
      floorColorRef.current = `palette:${floorColor}`;
      roomShapeRef.current = { width: roomW, depth: roomL, height: wallHeight, thickness: 0.2 };

      // Room perimeter shell.  Wall sections are laid out from the measured
      // room edges, rather than decorative caps or detached approximations.
      const wallColor = interiorData.colorPalette?.find((swatch) => swatch.role === 'wall')?.hex || '#eee9df';
      const wallMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(wallColor),
        roughness: 0.9,
        wireframe: showWireframe,
      });
      const wallThick = 0.2;

      if (polygonCorners) {
        // Walls follow the actual clicked quadrilateral (corners in order
        // 0=bottom-left, 1=bottom-right, 2=top-right, 3=top-left in the
        // source photo). Unlike the former open-shell preview, all four
        // edges are present so the reconstruction remains a real enclosure.
        createWallSegmentBetween(scene, polygonCorners[0], polygonCorners[1], wallThick, wallHeight, wallMat);
        createWallSegmentBetween(scene, polygonCorners[1], polygonCorners[2], wallThick, wallHeight, wallMat);
        createWallSegmentBetween(scene, polygonCorners[2], polygonCorners[3], wallThick, wallHeight, wallMat);
        createWallSegmentBetween(scene, polygonCorners[3], polygonCorners[0], wallThick, wallHeight, wallMat);
      } else {
        // All 4 walls are solid, real geometry -- nothing is ever left out
        // of the scene. Each side's wall body plus its own window/door/trim
        // detailing is grouped together so the camera-relative cutaway in
        // updateWallCutaway() can show/hide an entire wall as one unit, and
        // each wall gets its own material instance so updateCameraFacingWallOpacity()
        // can independently fade whichever one still faces the camera in
        // "Interior" shell view (e.g. while wallShellMode is 'enclosed').
        const shell = buildInteriorShell(scene, {
          width: roomW,
          depth: roomL,
          height: wallHeight,
          thickness: wallThick,
          wallMaterial: wallMat,
          openings: resolveInteriorOpenings(interiorData, roomW, roomL),
        });
        wallGroupsRef.current = shell.groups;
        wallMaterialsRef.current = shell.wallMaterials;
        WALL_SIDE_LIST.forEach((side) => { wallKeysRef.current[side] = `palette:${wallColor}`; });
        shellWallMaterialsRef.current = shell.faces;
        updateWallCutaway();
        updateCameraFacingWallOpacity();
      }
      if (!polygonCorners && projectType === 'renovation') addStyledDecor(
        scene,
        roomW,
        roomL,
        interiorData.colorPalette || [],
        interiorData.style || 'Japandi',
        !interiorData.furniture?.some((item) => item.category === 'decor' || /rug/i.test(item.name))
      );

      // Place Furniture Pieces
      furnitureObjectsRef.current = [];
      furnitureDataRef.current = [];

      if (interiorData.furniture && Array.isArray(interiorData.furniture)) {
        furnitureDataRef.current = interiorData.furniture.map((f) => ({ ...f }));
        interiorData.furniture.forEach((item) => {
          furnitureObjectsRef.current.push(createFurnitureObject(scene, item));
        });
      }
    }
  };

  // Reconstruction (Workflow 3) corners in centred metre space, or null for a rectangular room.
  const getPolygonCorners = () =>
    reconstructionCorners
      ? reconstructionCorners.slice(0, 4).map((p) => ({ x: (p.x - 0.5) * roomW, z: (p.y - 0.5) * roomL }))
      : null;

  // Where a piece sits in the scene, matching the 2D plan's footprint.
  const furnitureScenePosition = (item: FurnitureItem) => {
    const transform = furnitureTransform3D(item, { width: roomW, depth: roomL });
    let { x, z } = transform;
    const polygon = getPolygonCorners();
    if (polygon) {
      const clamped = clampPointToPolygon(x, z, polygon);
      x = clamped.x;
      z = clamped.z;
    }
    return { x, z, rotation: transform.rotationY };
  };

  // Build one piece (procedural model, then a matched GLB over it if the item
  // has one), add it to the scene and return its root. Used for the first
  // build and whenever a single piece must be re-created in place.
  const createFurnitureObject = (scene: THREE.Scene, item: FurnitureItem): THREE.Object3D => {
    const palette = interiorData?.colorPalette || [];
    const style = interiorData?.style || 'Modern';
    const { x: itemPosX, z: itemPosZ, rotation: rotRad } = furnitureScenePosition(item);
    const model = createFurnitureModel(item, palette, style, showWireframe);
    // Rugs are wrapped in a group so they rotate like everything else.
    let rootObject: THREE.Object3D = model;
    if (item.category === 'decor') {
      rootObject = new THREE.Group();
      rootObject.add(model);
    }
    rootObject.position.set(itemPosX, 0, itemPosZ);
    rootObject.rotation.y = rotRad;
    scene.add(rootObject);
    rootObject.userData.furnitureId = item.id;
    rootObject.userData.category = item.category;
    rootObject.userData.appearanceKey = furnitureAppearanceKey(item, palette, style);
    if (projectType === 'interior' && !showWireframe) {
      const blob = createContactShadow(item);
      if (blob) rootObject.add(blob);
    }

    // Load the matched local GLB over the existing procedural fallback.
    // Missing or invalid assets leave the fallback visible.
    // The bundled starter GLBs are intentionally minimal primitives; keep
    // the more detailed, style-aware procedural models visible for them.
    // Replacing these with a curated model in /models automatically opts
    // into GLTFLoader while retaining the same fallback on load failure.
    // A model the item names itself, else a bundled CC0 model that suits it.
    const explicitUrl = item.assetUrl && !item.assetUrl.startsWith('/assets/furniture/') ? item.assetUrl : null;
    const real = explicitUrl || projectType !== 'interior' ? null : findRealModel(item);
    const modelUrl = explicitUrl ?? real?.url ?? null;
    if (modelUrl) {
      const fallback = rootObject;
      void loadFurnitureModel(modelUrl, item, glbLoader, real ? { maxStretch: real.maxStretch, flip: real.flip } : {}).then((holder) => {
        // A failed or empty model keeps the procedural fallback. So does a piece
        // that was replaced or removed while the file was loading.
        if (!holder || !furnitureObjectsRef.current.includes(fallback)) return;
        holder.position.set(itemPosX, 0, itemPosZ);
        holder.rotation.y = rotRad;
        holder.userData.furnitureId = item.id;
        holder.userData.category = item.category;
        holder.userData.appearanceKey = fallback.userData.appearanceKey;
        scene.remove(fallback);
        holder.add(...fallback.children.filter((child) => child.userData.contactShadow));
        scene.add(holder);
        const index = furnitureObjectsRef.current.indexOf(fallback);
        if (index >= 0) furnitureObjectsRef.current[index] = holder;
        if (selectedFurnitureIdRef.current === item.id) transformControlsRef.current?.attach(holder);
      });
    }
    return rootObject;
  };

  // Bring the existing interior scene in line with the latest data without
  // rebuilding it: floor/wall colours, per-piece colours and positions.
  // Camera, orbit target, selection and the gizmo are not touched.
  // Apply the floor and wall looks (a finish if the user set one, else the
  // palette colour) to the existing meshes. Only surfaces whose look changed
  // are touched; replaced finish materials are disposed.
  const applyInteriorFinishes = () => {
    if (!interiorData) return;
    const palette = interiorData.colorPalette || [];
    const style = interiorData.style || 'Modern';
    const finishes = interiorData.finishes;
    const own = (material: THREE.MeshStandardMaterial) => {
      material.wireframe = showWireframe;
      ownedMaterialsRef.current.add(material);
      return material;
    };
    const release = (material: THREE.Material | THREE.Material[]) => {
      [material].flat().forEach((m) => {
        if (ownedMaterialsRef.current.delete(m)) m.dispose();
      });
    };

    const floorMesh = floorMeshRef.current;
    if (floorMesh) {
      const floorColor = palette.find((swatch) => swatch.role === 'flooring')?.hex || '#b99569';
      const finish = finishes?.floor;
      const key = finish ? `finish:${JSON.stringify(finish)}` : `palette:${floorColor}`;
      if (floorColorRef.current !== key) {
        const previous = floorMesh.material;
        if (finish) {
          const variant = getMaterialVariant(finish.variantId, finish.materialId);
          floorMesh.material = own(createFloorFinishMaterial(variant, {
            width: roomW, depth: roomL, scale: finish.scale, color: finish.color, roughness: finish.roughness,
          }));
        } else {
          const plain = createFloorMaterial(floorColor, /tile|marble/i.test(style));
          plain.wireframe = showWireframe;
          floorMesh.material = plain;
        }
        release(previous);
        floorColorRef.current = key;
      }
    }

    const wallColor = palette.find((swatch) => swatch.role === 'wall')?.hex || '#eee9df';
    WALL_SIDE_LIST.forEach((side) => {
      const current = wallMaterialsRef.current[side];
      const group = wallGroupsRef.current[side];
      if (!current || !group) return;
      const finish = resolveWallFinish(finishes, side);
      const key = finish ? `finish:${JSON.stringify(finish)}` : `palette:${wallColor}`;
      if (wallKeysRef.current[side] === key) return;
      const previousKey = wallKeysRef.current[side];
      wallKeysRef.current[side] = key;
      if (!finish && previousKey?.startsWith('palette:')) {
        current.color.set(wallColor);
        return;
      }
      const next = own(
        finish
          ? createSurfaceMaterial(getMaterialVariant(finish.variantId, finish.materialId), { color: finish.color, roughness: finish.roughness, scale: finish.scale })
          : new THREE.MeshStandardMaterial({ color: wallColor, roughness: 0.9 }),
      );
      group.traverse((child) => {
        if (child instanceof THREE.Mesh && child.userData.surface === `wall:${side}`) child.material = next;
      });
      wallMaterialsRef.current[side] = next;
      shellWallMaterialsRef.current.forEach((entry) => {
        if (entry.material === current) entry.material = next;
      });
      release(current);
    });
    updateCameraFacingWallOpacity();
  };

  const syncInteriorAppearance = (scene: THREE.Scene) => {
    if (!interiorData) return;
    const palette = interiorData.colorPalette || [];
    const style = interiorData.style || 'Modern';

    applyInteriorFinishes();

    // While a gizmo drag is in progress the live objects are the source of truth.
    if (isTransformDragging.current) return;
    const items = interiorData.furniture || [];
    furnitureDataRef.current = items.map((f) => ({ ...f }));
    items.forEach((item) => {
      const index = furnitureObjectsRef.current.findIndex((obj) => obj.userData.furnitureId === item.id);
      if (index === -1) return;
      let object = furnitureObjectsRef.current[index];
      if (object.userData.appearanceKey !== furnitureAppearanceKey(item, palette, style)) {
        // Models share cached materials, so a recolour swaps this one piece's model.
        scene.remove(object);
        disposeContactShadow(object);
        object = createFurnitureObject(scene, item);
        furnitureObjectsRef.current[index] = object;
        if (selectedFurnitureIdRef.current === item.id) transformControlsRef.current?.attach(object);
        return;
      }
      const { x, z, rotation } = furnitureScenePosition(item);
      if (Math.abs(object.position.x - x) > 1e-4) object.position.x = x;
      if (Math.abs(object.position.z - z) > 1e-4) object.position.z = z;
      if (Math.abs(object.rotation.y - rotation) > 1e-4) object.rotation.y = rotation;
    });
  };

  // Show an outline on the selected floor/wall (or remove it).
  const syncSurfaceHighlight = () => {
    const scene = sceneRef.current;
    if (!scene) return;
    if (highlightRef.current) {
      scene.remove(highlightRef.current);
      highlightRef.current.traverse((child) => {
        if (child instanceof THREE.Mesh || child instanceof THREE.LineSegments) {
          child.geometry.dispose();
          (child.material as THREE.Material).dispose();
        }
      });
      highlightRef.current = null;
    }
    const surface = selectedSurfaceRef.current;
    if (!surface || projectType !== 'interior' || roomShapeRef.current.width === 0) return;
    const outline = createSurfaceHighlight(surface, roomShapeRef.current);
    scene.add(outline);
    highlightRef.current = outline;
  };

  // Procedural Furniture Helpers
  const createWallSegment = (
    parent: THREE.Object3D,
    w: number,
    d: number,
    h: number,
    x: number,
    y: number,
    z: number,
    mat: THREE.Material,
    addOutline = false
  ) => {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    if (addOutline) {
      // A pale wall can blend into a similarly pale floor/background from
      // some angles (most noticeable on the exterior faces only visible in
      // the "Enclosed" shell view), making it look like it's missing even
      // though it's solid, correctly-lit geometry. A crisp edge outline
      // keeps every structural wall legible regardless of color/lighting.
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(geo),
        new THREE.LineBasicMaterial({ color: 0x3a342a })
      );
      mesh.add(edges);
    }
    parent.add(mesh);
    return mesh;
  };

  // Wall segment spanning two arbitrary points in the X/Z ground plane,
  // used for the Workflow 3 reconstructed room shell (a non-rectangular
  // quadrilateral), unlike createWallSegment above which is always
  // axis-aligned.
  const createWallSegmentBetween = (
    parent: THREE.Object3D,
    a: { x: number; z: number },
    b: { x: number; z: number },
    thickness: number,
    h: number,
    mat: THREE.Material
  ) => {
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const length = Math.hypot(dx, dz);
    if (length < 1e-4) return;
    const geo = new THREE.BoxGeometry(length, h, thickness);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set((a.x + b.x) / 2, h / 2, (a.z + b.z) / 2);
    mesh.rotation.y = -Math.atan2(dz, dx);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
  };

  // Filled floor shape for the reconstructed quadrilateral. THREE.Shape is
  // authored in local (x, y); after the floor mesh's rotation.x = -PI/2 that
  // local y maps to world -z, so points are negated here to land it exactly
  // under the (world x, world z) wall corners.
  const buildPolygonFloorGeometry = (corners: { x: number; z: number }[]) => {
    const shape = new THREE.Shape();
    shape.moveTo(corners[0].x, -corners[0].z);
    for (let i = 1; i < corners.length; i++) {
      shape.lineTo(corners[i].x, -corners[i].z);
    }
    shape.closePath();
    return new THREE.ShapeGeometry(shape);
  };

  // Even-odd ray-casting point-in-polygon test in the X/Z ground plane.
  const isInsidePolygon = (x: number, z: number, poly: { x: number; z: number }[]) => {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i].x, zi = poly[i].z;
      const xj = poly[j].x, zj = poly[j].z;
      const intersects = zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi;
      if (intersects) inside = !inside;
    }
    return inside;
  };

  // Pull a point that falls outside the reconstructed room's quadrilateral
  // back toward the polygon's centroid until it lands inside, so furniture
  // placed by the (rectangle-based) layout engine never renders through a
  // slanted wall.
  const clampPointToPolygon = (x: number, z: number, poly: { x: number; z: number }[]) => {
    if (isInsidePolygon(x, z, poly)) return { x, z };
    const cx = poly.reduce((sum, p) => sum + p.x, 0) / poly.length;
    const cz = poly.reduce((sum, p) => sum + p.z, 0) / poly.length;
    for (let t = 0.95; t > 0; t -= 0.05) {
      const px = cx + (x - cx) * t;
      const pz = cz + (z - cz) * t;
      if (isInsidePolygon(px, pz, poly)) return { x: px, z: pz };
    }
    return { x: cx, z: cz };
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

    current.rotation = rotationFromRadians(object.rotation.y);

    if (transformControlsRef.current?.getMode() !== 'translate') return;

    const rotatedFootprint = Math.round(current.rotation / 90) % 2 !== 0;
    const footprintWidth = rotatedFootprint ? current.depth : current.width;
    const footprintDepth = rotatedFootprint ? current.width : current.depth;
    const rawX = object.position.x + roomW / 2 - footprintWidth / 2;
    const rawY = object.position.z + roomL / 2 - footprintDepth / 2;

    const maxX = Math.max(0, roomW - footprintWidth);
    const maxY = Math.max(0, roomL - footprintDepth);
    const clampedX = Math.min(Math.max(rawX, 0), maxX);
    const clampedY = Math.min(Math.max(rawY, 0), maxY);

    // The piece is always kept inside the walls. Overlaps and blocked doors or
    // windows are allowed (the user may want them) but flagged with a warning.
    current.x = clampedX;
    current.y = clampedY;
    object.position.x = clampedX + footprintWidth / 2 - roomW / 2;
    object.position.z = clampedY + footprintDepth / 2 - roomL / 2;

    const landed = furnitureFootprint(current);
    const isFlat = (f: FurnitureItem) => f.category === 'decor' && /rug|carpet/i.test(f.name);
    const touching = isFlat(current)
      ? undefined
      : list.find((other, i) => i !== idx && !isFlat(other) && furnitureAabbOverlap(landed, furnitureFootprint(other)));
    const blocksOpening = !isFlat(current) && interiorData
      ? hitsOpening(landed, { width: roomW, depth: roomL, openings: resolveInteriorOpenings(interiorData, roomW, roomL), doorClearance: 0.3 })
      : false;
    if (touching) showToast(`${current.name} overlaps ${touching.name}.`, 'warn');
    else if (blocksOpening) showToast(`${current.name} is blocking a door or window.`, 'warn');
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
    const furnitureId = raycastFurnitureIdAt(clientX, clientY);
    if (furnitureId || projectType !== 'interior') {
      onSelectFurnitureRef.current?.(furnitureId);
      return;
    }
    // Furniture wins; otherwise the nearest visible wall or the floor.
    onSelectFurnitureRef.current?.(null);
    setSelectedSurface(raycastSurfaceAt(clientX, clientY));
  };

  // Which editable surface (floor or a wall) is under a screen point. Walls
  // hidden by the cut-away are skipped, as are walls faded out in front of the camera.
  const raycastSurfaceAt = (clientX: number, clientY: number): SurfaceId | null => {
    const renderer = rendererRef.current;
    const camera = cameraRef.current;
    if (!renderer || !camera) return null;
    const rect = renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    const targets: THREE.Object3D[] = [];
    if (floorMeshRef.current) targets.push(floorMeshRef.current);
    WALL_SIDE_LIST.forEach((side) => {
      const group = wallGroupsRef.current[side];
      const material = wallMaterialsRef.current[side];
      if (!group || !group.visible || (material && material.transparent && material.opacity < 0.5)) return;
      group.traverse((child) => { if (child instanceof THREE.Mesh && child.userData.surface) targets.push(child); });
    });
    raycasterRef.current.setFromCamera(ndc, camera);
    const hit = raycasterRef.current.intersectObjects(targets, false)[0];
    const surface = hit?.object.userData.surface;
    return isSurfaceId(surface) ? surface : null;
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
      setSelectedSurface(null);
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
    if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return;
    // Editing overlays (selection outline) must not appear in the exported image.
    const hidden: THREE.Object3D[] = [];
    sceneRef.current.traverse((object) => {
      if (object.userData.exportHidden && object.visible) {
        object.visible = false;
        hidden.push(object);
      }
    });
    rendererRef.current.render(sceneRef.current, cameraRef.current);
    const dataUrl = rendererRef.current.domElement.toDataURL('image/png');
    hidden.forEach((object) => { object.visible = true; });
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
    <div className={`view3d-root w-full h-[calc(100vh-5rem)] flex ${isSmall ? 'flex-col' : 'flex-row'} bg-slate-950 overflow-hidden select-none`}>
    {/* Touch screens get finger-sized buttons everywhere in the viewer. */}
    <style>{'@media (pointer: coarse) { .view3d-root button { min-height: 44px; min-width: 44px; } }'}</style>
    <div className="relative flex-1 min-w-0 min-h-0 flex flex-col">
      {/* 3D Canvas Mount */}
      <div
        ref={mountRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        className="w-full flex-1 min-h-0 cursor-grab active:cursor-grabbing"
      />

      {/* Top Floating Control Bar */}
      <div className="absolute top-4 left-4 right-4 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
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

          <div className="px-3 py-1.5 rounded-lg bg-stone-900/90 text-white border border-stone-800 backdrop-blur-md flex items-center gap-2 whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <div>
              <p className="text-xs font-medium text-stone-200 leading-none">
                {projectTitle}
              </p>
              <p className="text-[10px] text-stone-400 mt-0.5">
                {projectType === 'floorplan'
                  ? `Floor Plan (${roomW}m × ${roomL}m · ${floorPlanData?.rooms.length || 0} Rooms)`
                  : projectType === 'interior'
                  ? `${interiorData?.roomType || 'Interior'} (${roomW}m × ${roomL}m · ${interiorData?.furniture?.length || 0} Pieces)`
                  : `House Reconstruction (${roomW}m × ${roomL}m)`}
              </p>
            </div>
          </div>
        </div>

        {/* Right: Camera Angles & Mode Toggles */}
        <div className="flex flex-wrap items-center gap-1.5 pointer-events-auto">
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

          {projectType === 'interior' && interiorData && (
            <button
              id="btn-3d-quality"
              onClick={() => setQuality(quality === 'high' ? 'balanced' : 'high')}
              title={quality === 'high' ? 'High quality: sharper shadows and edges. Click for Balanced (smoother on slower devices).' : 'Balanced: smoother on slower devices. Click for High quality.'}
              aria-label={`Render quality: ${quality}. Click to change.`}
              className="px-2.5 py-1.5 rounded-lg bg-stone-900/90 hover:bg-stone-800 text-stone-300 border border-stone-800 backdrop-blur-md text-xs font-medium transition-colors cursor-pointer"
            >
              {quality === 'high' ? 'High' : 'Balanced'}
            </button>
          )}

          {projectType === 'interior' && interiorData && (
            <button
              id="btn-3d-design-panel"
              onClick={() => setPanelOpen(!panelOpen)}
              aria-pressed={panelOpen}
              title={panelOpen ? 'Hide design panel' : 'Edit floor, walls and furniture'}
              className={`px-2.5 py-1.5 rounded-lg border backdrop-blur-md text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                panelOpen ? 'bg-cyan-600 border-cyan-400 text-white' : 'bg-stone-900/90 hover:bg-stone-800 text-stone-300 border-stone-800'
              }`}
            >
              <Paintbrush className="w-3.5 h-3.5" />
              <span>Design</span>
            </button>
          )}

          {interiorData && (
            <button
              id="btn-3d-shell-view"
              onClick={() => setShellView(shellView === 'interior' ? 'full' : 'interior')}
              title={shellView === 'interior' ? 'Show complete room shell' : 'Fade camera-side wall for interior inspection'}
              className="px-2.5 py-1.5 rounded-lg bg-stone-900/90 hover:bg-stone-800 text-stone-300 border border-stone-800 backdrop-blur-md text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{shellView === 'interior' ? 'Full Shell' : 'Interior'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Furniture Selection & Transform Panel (interior / renovation only) */}
      {interiorData && selectedFurnitureId && (
        <div className="absolute top-28 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-stone-900/90 border border-stone-800 backdrop-blur-md px-3 py-2 rounded-xl">
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
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex max-w-[calc(100%-1rem)] items-center gap-2 overflow-x-auto [&>*]:flex-shrink-0 [&>*]:whitespace-nowrap bg-stone-900/90 border border-stone-800 backdrop-blur-md px-3.5 py-2 rounded-xl">
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
          onClick={() => setShowGrid(!showGrid)}
          title={showGrid ? 'Hide floor grid' : 'Show floor grid'}
          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors border cursor-pointer ${
            showGrid
              ? 'bg-stone-800 text-white border-stone-700'
              : 'text-stone-400 border-transparent hover:text-white'
          }`}
        >
          Grid {showGrid ? 'On' : 'Off'}
        </button>
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

        {/* Wall shell mode: fully enclosed vs. open/cutaway view */}
        <button
          id="btn-3d-wall-shell-mode"
          onClick={() => setWallShellMode(wallShellMode === 'open' ? 'enclosed' : 'open')}
          title={
            wallShellMode === 'open'
              ? 'Currently: Open view (walls near the camera hide so you can see inside). Click for a fully enclosed room.'
              : 'Currently: Enclosed room (all 4 walls always solid). Click for an open view into the interior.'
          }
          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors border cursor-pointer ${
            wallShellMode === 'enclosed'
              ? 'bg-stone-800 text-white border-stone-700'
              : 'text-stone-400 border-transparent hover:text-white'
          }`}
        >
          {wallShellMode === 'enclosed' ? 'Enclosed' : 'Open View'}
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
      <div className={`absolute bottom-6 left-6 hidden pointer-events-none ${projectType === 'interior' && panelOpen ? '2xl:block' : 'lg:block'}`}>
        <div className="bg-stone-900/80 border border-stone-800 backdrop-blur-md px-3 py-1.5 rounded-lg text-[11px] text-stone-400">
          {interiorData
            ? (projectType === 'interior' ? 'Click furniture, a wall or the floor to select' : 'Click furniture to select') + ' · Drag gizmo to move/rotate · Drag empty space to orbit · Scroll to zoom'
            : 'Left-click & drag to rotate · Scroll to zoom'}
        </div>
      </div>

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`absolute bottom-24 left-1/2 z-20 flex max-w-[90%] -translate-x-1/2 items-center gap-3 rounded-lg border px-3.5 py-2 text-xs font-medium shadow-lg ${
            toast.tone === 'warn' ? 'border-amber-500/60 bg-amber-950/95 text-amber-100' : 'border-stone-700 bg-stone-900/95 text-stone-100'
          }`}
        >
          <span>{toast.message}</span>
          {toast.action && (
            <button
              type="button"
              id="btn-toast-action"
              onClick={toast.action.run}
              className="rounded-md bg-white/15 px-2 py-1 text-white hover:bg-white/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300"
            >
              {toast.action.label}
            </button>
          )}
        </div>
      )}

      {/* Export Confirmation Toast */}
      {exportedToast && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-stone-900 border border-stone-800 text-white px-3.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 shadow-lg animate-fade-in">
          <Check className="w-3.5 h-3.5 text-emerald-400" />
          <span>File downloaded successfully</span>
        </div>
      )}
    </div>
    {projectType === 'interior' && interiorData && (
      <InteriorDesignPanel
        data={interiorData as InteriorDesignResult}
        open={panelOpen}
        onToggle={() => setPanelOpen(false)}
        isSmall={isSmall}
        width={panelWidth}
        onWidthChange={setPanelWidth}
        tab={panelTab}
        onTab={(tab) => {
          setPanelTab(tab);
          if (tab === 'floor') { onSelectFurnitureRef.current?.(null); setSelectedSurface('floor'); }
          else if (tab === 'walls') { onSelectFurnitureRef.current?.(null); setSelectedSurface(wallScope === 'all' ? null : `wall:${wallScope}`); }
          else setSelectedSurface(null);
        }}
        wallScope={wallScope}
        onWallScope={(scope) => {
          setWallScope(scope);
          setSelectedSurface(scope === 'all' ? null : `wall:${scope}`);
        }}
        selectedFurnitureId={selectedFurnitureId}
        onAddFurniture={addFurniture}
        onDuplicateFurniture={duplicateFurniture}
        onDeleteFurniture={deleteFurniture}
        onChange={(next) => onInteriorChangeRef.current?.(next)}
        onFurnitureChange={(list) => onFurnitureChangeRef.current?.(list)}
      />
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
