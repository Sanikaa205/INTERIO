import type { FurnitureCategory } from '../types';
import type { FurnitureRole, StyleRecipe } from './interiorStyles';

export interface ArrangementSlot {
  role: FurnitureRole;
  category: FurnitureCategory;
  essential: boolean;
  preferredWall: 'north' | 'south' | 'east' | 'west' | 'center';
  facing?: 'wall' | 'room' | { focal: string };
  xRatio: number;
  yRatio: number;
  widthRatio: number;
  depthRatio: number;
  minWidth?: number;
  maxWidth?: number;
  minDepth?: number;
  maxDepth?: number;
  defaultHeight: number;
  clearance: number;
  relativeTo?: string;
  relativeSide?: 'north' | 'south' | 'east' | 'west';
  rotation?: number;
}

export interface ArrangementTemplate {
  id: string;
  roomType: string;
  name: string;
  minWidth?: number;
  minDepth?: number;
  preferredAspect?: 'wide' | 'deep' | 'square' | 'any';
  focalRole?: FurnitureRole;
  slots: ArrangementSlot[];
}

export const ARRANGEMENT_TEMPLATES: Record<string, ArrangementTemplate[]> = {
  living: [
    // Template 1: Classic North Sofa facing South Media Wall
    {
      id: 'living-classic-north-sofa',
      roomType: 'living',
      name: 'North Sofa Facing Media Console',
      focalRole: 'media-console',
      slots: [
        { role: 'sofa', category: 'seating', essential: true, preferredWall: 'north', facing: 'room', xRatio: 0.5, yRatio: 0.22, widthRatio: 0.55, depthRatio: 0.2, minWidth: 1.6, maxWidth: 2.8, defaultHeight: 0.82, clearance: 0.35 },
        { role: 'rug', category: 'decor', essential: true, preferredWall: 'center', xRatio: 0.5, yRatio: 0.5, widthRatio: 0.76, depthRatio: 0.52, minWidth: 1.8, maxWidth: 3.6, defaultHeight: 0.02, clearance: 0 },
        { role: 'coffee-table', category: 'table', essential: true, preferredWall: 'center', facing: 'room', xRatio: 0.5, yRatio: 0.52, widthRatio: 0.28, depthRatio: 0.16, minWidth: 0.7, maxWidth: 1.3, defaultHeight: 0.44, clearance: 0.25 },
        { role: 'media-console', category: 'storage', essential: true, preferredWall: 'south', facing: 'wall', xRatio: 0.5, yRatio: 0.88, widthRatio: 0.5, depthRatio: 0.12, minWidth: 1.1, maxWidth: 2.2, defaultHeight: 0.58, clearance: 0.2 },
        { role: 'accent-chair', category: 'seating', essential: false, preferredWall: 'east', facing: { focal: 'coffee-table' }, xRatio: 0.82, yRatio: 0.42, widthRatio: 0.18, depthRatio: 0.18, minWidth: 0.75, maxWidth: 0.9, defaultHeight: 0.78, clearance: 0.25 },
        { role: 'floor-lamp', category: 'lighting', essential: false, preferredWall: 'north', xRatio: 0.88, yRatio: 0.15, widthRatio: 0.1, depthRatio: 0.1, minWidth: 0.4, maxWidth: 0.45, defaultHeight: 1.55, clearance: 0.15 },
        { role: 'plant', category: 'decor', essential: false, preferredWall: 'north', xRatio: 0.12, yRatio: 0.15, widthRatio: 0.1, depthRatio: 0.1, minWidth: 0.4, maxWidth: 0.45, defaultHeight: 1.2, clearance: 0 },
      ],
    },
    // Template 2: Floating Centered Lounge with West Armchairs
    {
      id: 'living-floating-social',
      roomType: 'living',
      name: 'Floating Lounge with Dual Facing Chairs',
      minWidth: 4.5,
      minDepth: 4.5,
      focalRole: 'coffee-table',
      slots: [
        { role: 'sofa', category: 'seating', essential: true, preferredWall: 'south', facing: 'room', xRatio: 0.5, yRatio: 0.72, widthRatio: 0.52, depthRatio: 0.2, minWidth: 1.6, maxWidth: 2.6, defaultHeight: 0.82, clearance: 0.35 },
        { role: 'rug', category: 'decor', essential: true, preferredWall: 'center', xRatio: 0.5, yRatio: 0.48, widthRatio: 0.74, depthRatio: 0.54, minWidth: 2.0, maxWidth: 3.5, defaultHeight: 0.02, clearance: 0 },
        { role: 'coffee-table', category: 'table', essential: true, preferredWall: 'center', facing: 'room', xRatio: 0.5, yRatio: 0.48, widthRatio: 0.26, depthRatio: 0.18, minWidth: 0.75, maxWidth: 1.25, defaultHeight: 0.42, clearance: 0.25 },
        { role: 'media-console', category: 'storage', essential: true, preferredWall: 'north', facing: 'wall', xRatio: 0.5, yRatio: 0.12, widthRatio: 0.48, depthRatio: 0.12, minWidth: 1.1, maxWidth: 2.2, defaultHeight: 0.58, clearance: 0.2 },
        { role: 'accent-chair', category: 'seating', essential: false, preferredWall: 'west', facing: { focal: 'coffee-table' }, xRatio: 0.18, yRatio: 0.48, widthRatio: 0.18, depthRatio: 0.18, minWidth: 0.75, maxWidth: 0.88, defaultHeight: 0.78, clearance: 0.25 },
        { role: 'floor-lamp', category: 'lighting', essential: false, preferredWall: 'south', xRatio: 0.84, yRatio: 0.82, widthRatio: 0.1, depthRatio: 0.1, minWidth: 0.4, maxWidth: 0.45, defaultHeight: 1.55, clearance: 0.15 },
        { role: 'plant', category: 'decor', essential: false, preferredWall: 'east', xRatio: 0.85, yRatio: 0.25, widthRatio: 0.1, depthRatio: 0.1, minWidth: 0.4, maxWidth: 0.45, defaultHeight: 1.2, clearance: 0 },
      ],
    },
    // Template 3: West Wall Seating with East Entertainment Zone
    {
      id: 'living-lateral-lounge',
      roomType: 'living',
      name: 'Lateral Seating facing Entertainment Wall',
      focalRole: 'media-console',
      slots: [
        { role: 'sofa', category: 'seating', essential: true, preferredWall: 'west', facing: 'room', xRatio: 0.22, yRatio: 0.5, widthRatio: 0.22, depthRatio: 0.54, minWidth: 1.6, maxWidth: 2.7, defaultHeight: 0.82, clearance: 0.35 },
        { role: 'rug', category: 'decor', essential: true, preferredWall: 'center', xRatio: 0.5, yRatio: 0.5, widthRatio: 0.65, depthRatio: 0.65, minWidth: 1.8, maxWidth: 3.4, defaultHeight: 0.02, clearance: 0 },
        { role: 'coffee-table', category: 'table', essential: true, preferredWall: 'center', facing: 'room', xRatio: 0.5, yRatio: 0.5, widthRatio: 0.2, depthRatio: 0.26, minWidth: 0.7, maxWidth: 1.2, defaultHeight: 0.44, clearance: 0.25 },
        { role: 'media-console', category: 'storage', essential: true, preferredWall: 'east', facing: 'wall', xRatio: 0.88, yRatio: 0.5, widthRatio: 0.12, depthRatio: 0.48, minWidth: 1.1, maxWidth: 2.2, defaultHeight: 0.58, clearance: 0.2 },
        { role: 'accent-chair', category: 'seating', essential: false, preferredWall: 'north', facing: { focal: 'coffee-table' }, xRatio: 0.5, yRatio: 0.2, widthRatio: 0.18, depthRatio: 0.18, minWidth: 0.75, maxWidth: 0.9, defaultHeight: 0.78, clearance: 0.25 },
        { role: 'floor-lamp', category: 'lighting', essential: false, preferredWall: 'west', xRatio: 0.15, yRatio: 0.16, widthRatio: 0.1, depthRatio: 0.1, minWidth: 0.4, maxWidth: 0.45, defaultHeight: 1.55, clearance: 0.15 },
        { role: 'plant', category: 'decor', essential: false, preferredWall: 'east', xRatio: 0.85, yRatio: 0.82, widthRatio: 0.1, depthRatio: 0.1, minWidth: 0.4, maxWidth: 0.45, defaultHeight: 1.2, clearance: 0 },
      ],
    },
  ],

  bedroom: [
    // Template 1: Classic North Wall Bed with South Wardrobe
    {
      id: 'bedroom-headboard-north',
      roomType: 'bedroom',
      name: 'North Headboard with South Wardrobe',
      slots: [
        { role: 'bed', category: 'bed', essential: true, preferredWall: 'north', facing: 'wall', xRatio: 0.5, yRatio: 0.25, widthRatio: 0.5, depthRatio: 0.45, minWidth: 1.4, maxWidth: 1.9, minDepth: 1.8, maxDepth: 2.1, defaultHeight: 1.1, clearance: 0.2 },
        { role: 'nightstand', category: 'table', essential: true, preferredWall: 'north', facing: 'wall', xRatio: 0.2, yRatio: 0.22, widthRatio: 0.12, depthRatio: 0.1, minWidth: 0.4, maxWidth: 0.55, defaultHeight: 0.55, clearance: 0.1 },
        { role: 'nightstand', category: 'table', essential: true, preferredWall: 'north', facing: 'wall', xRatio: 0.8, yRatio: 0.22, widthRatio: 0.12, depthRatio: 0.1, minWidth: 0.4, maxWidth: 0.55, defaultHeight: 0.55, clearance: 0.1 },
        { role: 'wardrobe', category: 'storage', essential: true, preferredWall: 'south', facing: 'wall', xRatio: 0.5, yRatio: 0.88, widthRatio: 0.45, depthRatio: 0.15, minWidth: 1.0, maxWidth: 2.0, minDepth: 0.55, maxDepth: 0.65, defaultHeight: 2.0, clearance: 0.2 },
        { role: 'rug', category: 'decor', essential: false, preferredWall: 'center', xRatio: 0.5, yRatio: 0.55, widthRatio: 0.68, depthRatio: 0.5, minWidth: 1.6, maxWidth: 2.8, defaultHeight: 0.02, clearance: 0 },
      ],
    },
    // Template 2: West Wall Bed with East Storage
    {
      id: 'bedroom-headboard-west',
      roomType: 'bedroom',
      name: 'West Headboard with Lateral Wardrobe',
      slots: [
        { role: 'bed', category: 'bed', essential: true, preferredWall: 'west', facing: 'wall', xRatio: 0.28, yRatio: 0.5, widthRatio: 0.45, depthRatio: 0.5, minWidth: 1.4, maxWidth: 1.9, minDepth: 1.8, maxDepth: 2.1, defaultHeight: 1.1, clearance: 0.2 },
        { role: 'nightstand', category: 'table', essential: true, preferredWall: 'west', facing: 'wall', xRatio: 0.25, yRatio: 0.2, widthRatio: 0.1, depthRatio: 0.12, minWidth: 0.4, maxWidth: 0.55, defaultHeight: 0.55, clearance: 0.1 },
        { role: 'nightstand', category: 'table', essential: true, preferredWall: 'west', facing: 'wall', xRatio: 0.25, yRatio: 0.8, widthRatio: 0.1, depthRatio: 0.12, minWidth: 0.4, maxWidth: 0.55, defaultHeight: 0.55, clearance: 0.1 },
        { role: 'wardrobe', category: 'storage', essential: true, preferredWall: 'east', facing: 'wall', xRatio: 0.88, yRatio: 0.5, widthRatio: 0.14, depthRatio: 0.45, minWidth: 1.0, maxWidth: 2.0, minDepth: 0.55, maxDepth: 0.65, defaultHeight: 2.0, clearance: 0.2 },
        { role: 'rug', category: 'decor', essential: false, preferredWall: 'center', xRatio: 0.5, yRatio: 0.5, widthRatio: 0.55, depthRatio: 0.65, minWidth: 1.6, maxWidth: 2.8, defaultHeight: 0.02, clearance: 0 },
      ],
    },
  ],

  masterBedroom: [
    // Template 1: Suite with Bed, Dual Nightstands, Wardrobe, Bench, Accent Chair
    {
      id: 'master-suite-grand',
      roomType: 'masterBedroom',
      name: 'Executive Master Suite with End Bench & Lounge',
      slots: [
        { role: 'bed', category: 'bed', essential: true, preferredWall: 'north', facing: 'wall', xRatio: 0.5, yRatio: 0.26, widthRatio: 0.52, depthRatio: 0.42, minWidth: 1.6, maxWidth: 2.1, minDepth: 1.9, maxDepth: 2.2, defaultHeight: 1.2, clearance: 0.2 },
        { role: 'nightstand', category: 'table', essential: true, preferredWall: 'north', facing: 'wall', xRatio: 0.18, yRatio: 0.22, widthRatio: 0.12, depthRatio: 0.1, minWidth: 0.45, maxWidth: 0.6, defaultHeight: 0.55, clearance: 0.1 },
        { role: 'nightstand', category: 'table', essential: true, preferredWall: 'north', facing: 'wall', xRatio: 0.82, yRatio: 0.22, widthRatio: 0.12, depthRatio: 0.1, minWidth: 0.45, maxWidth: 0.6, defaultHeight: 0.55, clearance: 0.1 },
        { role: 'bench', category: 'seating', essential: false, preferredWall: 'center', facing: 'room', xRatio: 0.5, yRatio: 0.56, widthRatio: 0.42, depthRatio: 0.1, minWidth: 1.1, maxWidth: 1.6, defaultHeight: 0.45, clearance: 0.2 },
        { role: 'wardrobe', category: 'storage', essential: true, preferredWall: 'south', facing: 'wall', xRatio: 0.4, yRatio: 0.88, widthRatio: 0.42, depthRatio: 0.14, minWidth: 1.4, maxWidth: 2.4, defaultHeight: 2.1, clearance: 0.2 },
        { role: 'accent-chair', category: 'seating', essential: false, preferredWall: 'south', facing: 'room', xRatio: 0.82, yRatio: 0.82, widthRatio: 0.16, depthRatio: 0.16, minWidth: 0.75, maxWidth: 0.9, defaultHeight: 0.8, clearance: 0.2 },
        { role: 'rug', category: 'decor', essential: true, preferredWall: 'center', xRatio: 0.5, yRatio: 0.52, widthRatio: 0.74, depthRatio: 0.54, minWidth: 2.0, maxWidth: 3.4, defaultHeight: 0.02, clearance: 0 },
      ],
    },
    // Template 2: Suite with Wardrobe Wall and Vanity Dresser
    {
      id: 'master-suite-dresser',
      roomType: 'masterBedroom',
      name: 'Master Suite with Dedicated Dresser & Wardrobe Run',
      slots: [
        { role: 'bed', category: 'bed', essential: true, preferredWall: 'north', facing: 'wall', xRatio: 0.45, yRatio: 0.26, widthRatio: 0.48, depthRatio: 0.42, minWidth: 1.6, maxWidth: 2.0, minDepth: 1.9, maxDepth: 2.2, defaultHeight: 1.2, clearance: 0.2 },
        { role: 'nightstand', category: 'table', essential: true, preferredWall: 'north', facing: 'wall', xRatio: 0.15, yRatio: 0.22, widthRatio: 0.12, depthRatio: 0.1, minWidth: 0.45, maxWidth: 0.6, defaultHeight: 0.55, clearance: 0.1 },
        { role: 'nightstand', category: 'table', essential: true, preferredWall: 'north', facing: 'wall', xRatio: 0.75, yRatio: 0.22, widthRatio: 0.12, depthRatio: 0.1, minWidth: 0.45, maxWidth: 0.6, defaultHeight: 0.55, clearance: 0.1 },
        { role: 'dresser', category: 'storage', essential: false, preferredWall: 'east', facing: 'wall', xRatio: 0.88, yRatio: 0.6, widthRatio: 0.12, depthRatio: 0.32, minWidth: 0.9, maxWidth: 1.4, defaultHeight: 0.85, clearance: 0.2 },
        { role: 'wardrobe', category: 'storage', essential: true, preferredWall: 'south', facing: 'wall', xRatio: 0.5, yRatio: 0.88, widthRatio: 0.5, depthRatio: 0.14, minWidth: 1.4, maxWidth: 2.4, defaultHeight: 2.1, clearance: 0.2 },
        { role: 'rug', category: 'decor', essential: true, preferredWall: 'center', xRatio: 0.5, yRatio: 0.5, widthRatio: 0.72, depthRatio: 0.52, minWidth: 2.0, maxWidth: 3.2, defaultHeight: 0.02, clearance: 0 },
      ],
    },
  ],

  dining: [
    // Template 1: Centered Rectangular Table with 4 Chairs and Sideboard
    {
      id: 'dining-central-table',
      roomType: 'dining',
      name: 'Central Dining Table with Sideboard',
      focalRole: 'dining-table',
      slots: [
        { role: 'dining-table', category: 'table', essential: true, preferredWall: 'center', facing: 'room', xRatio: 0.5, yRatio: 0.48, widthRatio: 0.45, depthRatio: 0.28, minWidth: 1.0, maxWidth: 2.0, minDepth: 0.75, maxDepth: 1.0, defaultHeight: 0.76, clearance: 0.4 },
        { role: 'dining-chair', category: 'seating', essential: true, preferredWall: 'north', facing: 'room', xRatio: 0.5, yRatio: 0.3, widthRatio: 0.14, depthRatio: 0.14, minWidth: 0.46, maxWidth: 0.52, defaultHeight: 0.84, clearance: 0.2, relativeTo: 'dining-table', relativeSide: 'north', rotation: 0 },
        { role: 'dining-chair', category: 'seating', essential: true, preferredWall: 'south', facing: 'room', xRatio: 0.5, yRatio: 0.66, widthRatio: 0.14, depthRatio: 0.14, minWidth: 0.46, maxWidth: 0.52, defaultHeight: 0.84, clearance: 0.2, relativeTo: 'dining-table', relativeSide: 'south', rotation: 180 },
        { role: 'dining-chair', category: 'seating', essential: true, preferredWall: 'west', facing: 'room', xRatio: 0.3, yRatio: 0.48, widthRatio: 0.14, depthRatio: 0.14, minWidth: 0.46, maxWidth: 0.52, defaultHeight: 0.84, clearance: 0.2, relativeTo: 'dining-table', relativeSide: 'west', rotation: 90 },
        { role: 'dining-chair', category: 'seating', essential: true, preferredWall: 'east', facing: 'room', xRatio: 0.7, yRatio: 0.48, widthRatio: 0.14, depthRatio: 0.14, minWidth: 0.46, maxWidth: 0.52, defaultHeight: 0.84, clearance: 0.2, relativeTo: 'dining-table', relativeSide: 'east', rotation: 270 },
        { role: 'sideboard', category: 'storage', essential: false, preferredWall: 'south', facing: 'wall', xRatio: 0.5, yRatio: 0.88, widthRatio: 0.45, depthRatio: 0.12, minWidth: 1.0, maxWidth: 1.8, defaultHeight: 0.82, clearance: 0.2 },
      ],
    },
    // Template 2: Banquette / Wall-Side Dining Setting
    {
      id: 'dining-lateral-table',
      roomType: 'dining',
      name: 'Offset Dining with Buffet Console',
      focalRole: 'dining-table',
      slots: [
        { role: 'dining-table', category: 'table', essential: true, preferredWall: 'center', facing: 'room', xRatio: 0.46, yRatio: 0.5, widthRatio: 0.44, depthRatio: 0.28, minWidth: 1.0, maxWidth: 1.9, minDepth: 0.75, maxDepth: 0.95, defaultHeight: 0.76, clearance: 0.4 },
        { role: 'dining-chair', category: 'seating', essential: true, preferredWall: 'north', facing: 'room', xRatio: 0.46, yRatio: 0.32, widthRatio: 0.14, depthRatio: 0.14, minWidth: 0.46, maxWidth: 0.52, defaultHeight: 0.84, clearance: 0.2, relativeTo: 'dining-table', relativeSide: 'north', rotation: 0 },
        { role: 'dining-chair', category: 'seating', essential: true, preferredWall: 'south', facing: 'room', xRatio: 0.46, yRatio: 0.68, widthRatio: 0.14, depthRatio: 0.14, minWidth: 0.46, maxWidth: 0.52, defaultHeight: 0.84, clearance: 0.2, relativeTo: 'dining-table', relativeSide: 'south', rotation: 180 },
        { role: 'dining-chair', category: 'seating', essential: true, preferredWall: 'west', facing: 'room', xRatio: 0.26, yRatio: 0.5, widthRatio: 0.14, depthRatio: 0.14, minWidth: 0.46, maxWidth: 0.52, defaultHeight: 0.84, clearance: 0.2, relativeTo: 'dining-table', relativeSide: 'west', rotation: 90 },
        { role: 'sideboard', category: 'storage', essential: false, preferredWall: 'east', facing: 'wall', xRatio: 0.88, yRatio: 0.5, widthRatio: 0.12, depthRatio: 0.42, minWidth: 0.9, maxWidth: 1.6, defaultHeight: 0.82, clearance: 0.2 },
      ],
    },
  ],

  kitchen: [
    // Template 1: Kitchen Run North + Island Center + Fridge
    {
      id: 'kitchen-island-layout',
      roomType: 'kitchen',
      name: 'North Counter Run with Central Prep Island',
      minWidth: 3.8,
      minDepth: 3.8,
      slots: [
        { role: 'kitchen-run', category: 'storage', essential: true, preferredWall: 'north', facing: 'wall', xRatio: 0.42, yRatio: 0.14, widthRatio: 0.65, depthRatio: 0.16, minWidth: 1.6, maxWidth: 3.4, minDepth: 0.6, maxDepth: 0.7, defaultHeight: 0.9, clearance: 0.2, rotation: 0 },
        { role: 'refrigerator', category: 'electronics', essential: true, preferredWall: 'north', facing: 'wall', xRatio: 0.85, yRatio: 0.15, widthRatio: 0.16, depthRatio: 0.16, minWidth: 0.65, maxWidth: 0.8, minDepth: 0.65, maxDepth: 0.8, defaultHeight: 1.85, clearance: 0.15, rotation: 0, relativeTo: 'kitchen-run', relativeSide: 'east' },
        { role: 'kitchen-island', category: 'table', essential: false, preferredWall: 'center', facing: 'room', xRatio: 0.45, yRatio: 0.56, widthRatio: 0.38, depthRatio: 0.2, minWidth: 1.0, maxWidth: 1.8, minDepth: 0.65, maxDepth: 0.9, defaultHeight: 0.9, clearance: 0.35 },
      ],
    },
    // Template 2: Linear Compact Kitchen Run with Side Fridge
    {
      id: 'kitchen-linear-layout',
      roomType: 'kitchen',
      name: 'Full-Span Wall Kitchen Run with End Storage',
      slots: [
        { role: 'kitchen-run', category: 'storage', essential: true, preferredWall: 'north', facing: 'wall', xRatio: 0.42, yRatio: 0.14, widthRatio: 0.68, depthRatio: 0.18, minWidth: 1.6, maxWidth: 3.5, minDepth: 0.6, maxDepth: 0.7, defaultHeight: 0.9, clearance: 0.2, rotation: 0 },
        { role: 'refrigerator', category: 'electronics', essential: true, preferredWall: 'north', facing: 'wall', xRatio: 0.84, yRatio: 0.15, widthRatio: 0.16, depthRatio: 0.16, minWidth: 0.65, maxWidth: 0.8, minDepth: 0.65, maxDepth: 0.8, defaultHeight: 1.85, clearance: 0.15, rotation: 0, relativeTo: 'kitchen-run', relativeSide: 'east' },
      ],
    },
  ],

  kitchenDining: [
    // Template 1: Kitchen Run North + Dining Table South
    {
      id: 'kitchen-dining-combined',
      roomType: 'kitchenDining',
      name: 'North Kitchen Run with South Dining Zone',
      focalRole: 'dining-table',
      slots: [
        { role: 'kitchen-run', category: 'storage', essential: true, preferredWall: 'north', facing: 'wall', xRatio: 0.4, yRatio: 0.14, widthRatio: 0.62, depthRatio: 0.16, minWidth: 1.6, maxWidth: 3.2, minDepth: 0.6, maxDepth: 0.7, defaultHeight: 0.9, clearance: 0.2, rotation: 0 },
        { role: 'refrigerator', category: 'electronics', essential: true, preferredWall: 'north', facing: 'wall', xRatio: 0.82, yRatio: 0.15, widthRatio: 0.16, depthRatio: 0.16, minWidth: 0.65, maxWidth: 0.8, minDepth: 0.65, maxDepth: 0.8, defaultHeight: 1.85, clearance: 0.15, rotation: 0, relativeTo: 'kitchen-run', relativeSide: 'east' },
        { role: 'dining-table', category: 'table', essential: true, preferredWall: 'center', facing: 'room', xRatio: 0.5, yRatio: 0.62, widthRatio: 0.42, depthRatio: 0.24, minWidth: 1.0, maxWidth: 1.8, minDepth: 0.75, maxDepth: 0.9, defaultHeight: 0.76, clearance: 0.35 },
        { role: 'dining-chair', category: 'seating', essential: true, preferredWall: 'north', facing: 'room', xRatio: 0.5, yRatio: 0.46, widthRatio: 0.14, depthRatio: 0.14, minWidth: 0.46, maxWidth: 0.52, defaultHeight: 0.84, clearance: 0.2, relativeTo: 'dining-table', relativeSide: 'north', rotation: 0 },
        { role: 'dining-chair', category: 'seating', essential: true, preferredWall: 'south', facing: 'room', xRatio: 0.5, yRatio: 0.78, widthRatio: 0.14, depthRatio: 0.14, minWidth: 0.46, maxWidth: 0.52, defaultHeight: 0.84, clearance: 0.2, relativeTo: 'dining-table', relativeSide: 'south', rotation: 180 },
      ],
    },
  ],

  study: [
    // Template 1: Window Desk North + Lateral Bookcase East
    {
      id: 'study-window-desk',
      roomType: 'study',
      name: 'North Window Desk with Lateral Library Shelving',
      slots: [
        { role: 'desk', category: 'table', essential: true, preferredWall: 'north', facing: 'wall', xRatio: 0.5, yRatio: 0.18, widthRatio: 0.48, depthRatio: 0.22, minWidth: 1.0, maxWidth: 1.7, minDepth: 0.6, maxDepth: 0.75, defaultHeight: 0.76, clearance: 0.25 },
        { role: 'desk-chair', category: 'seating', essential: true, preferredWall: 'center', facing: { focal: 'desk' }, xRatio: 0.5, yRatio: 0.4, widthRatio: 0.18, depthRatio: 0.18, minWidth: 0.55, maxWidth: 0.65, defaultHeight: 0.92, clearance: 0.2 },
        { role: 'bookcase', category: 'storage', essential: true, preferredWall: 'east', facing: 'wall', xRatio: 0.88, yRatio: 0.5, widthRatio: 0.12, depthRatio: 0.4, minWidth: 0.8, maxWidth: 1.6, defaultHeight: 1.85, clearance: 0.2 },
        { role: 'rug', category: 'decor', essential: false, preferredWall: 'center', xRatio: 0.5, yRatio: 0.45, widthRatio: 0.6, depthRatio: 0.5, minWidth: 1.4, maxWidth: 2.2, defaultHeight: 0.02, clearance: 0 },
      ],
    },
    // Template 2: Executive Wall-Facing Desk
    {
      id: 'study-room-facing',
      roomType: 'study',
      name: 'Room-Facing Desk with Rear Bookcase Credenza',
      slots: [
        { role: 'bookcase', category: 'storage', essential: true, preferredWall: 'north', facing: 'wall', xRatio: 0.5, yRatio: 0.12, widthRatio: 0.55, depthRatio: 0.12, minWidth: 1.0, maxWidth: 1.8, defaultHeight: 1.85, clearance: 0.2 },
        { role: 'desk', category: 'table', essential: true, preferredWall: 'center', facing: 'room', xRatio: 0.5, yRatio: 0.46, widthRatio: 0.48, depthRatio: 0.22, minWidth: 1.1, maxWidth: 1.7, minDepth: 0.6, maxDepth: 0.75, defaultHeight: 0.76, clearance: 0.25 },
        { role: 'desk-chair', category: 'seating', essential: true, preferredWall: 'center', facing: { focal: 'desk' }, xRatio: 0.5, yRatio: 0.3, widthRatio: 0.18, depthRatio: 0.18, minWidth: 0.55, maxWidth: 0.65, defaultHeight: 0.92, clearance: 0.2 },
        { role: 'rug', category: 'decor', essential: false, preferredWall: 'center', xRatio: 0.5, yRatio: 0.5, widthRatio: 0.6, depthRatio: 0.5, minWidth: 1.4, maxWidth: 2.2, defaultHeight: 0.02, clearance: 0 },
      ],
    },
  ],

  homeOffice: [
    // Template 1: Executive Suite with Large Desk, Credenza, Guest Chairs, Library Bookcase
    {
      id: 'executive-office-command',
      roomType: 'homeOffice',
      name: 'Executive Command Suite with Guest Seating',
      slots: [
        { role: 'desk', category: 'table', essential: true, preferredWall: 'center', facing: 'room', xRatio: 0.5, yRatio: 0.48, widthRatio: 0.52, depthRatio: 0.24, minWidth: 1.4, maxWidth: 2.0, minDepth: 0.7, maxDepth: 0.9, defaultHeight: 0.76, clearance: 0.3 },
        { role: 'desk-chair', category: 'seating', essential: true, preferredWall: 'center', facing: { focal: 'desk' }, xRatio: 0.5, yRatio: 0.3, widthRatio: 0.18, depthRatio: 0.18, minWidth: 0.6, maxWidth: 0.7, defaultHeight: 1.0, clearance: 0.2 },
        { role: 'sideboard', category: 'storage', essential: true, preferredWall: 'north', facing: 'wall', xRatio: 0.5, yRatio: 0.12, widthRatio: 0.55, depthRatio: 0.12, minWidth: 1.2, maxWidth: 2.2, defaultHeight: 0.75, clearance: 0.2 },
        { role: 'bookcase', category: 'storage', essential: true, preferredWall: 'east', facing: 'wall', xRatio: 0.88, yRatio: 0.5, widthRatio: 0.12, depthRatio: 0.42, minWidth: 1.0, maxWidth: 1.8, defaultHeight: 2.0, clearance: 0.2 },
        { role: 'accent-chair', category: 'seating', essential: false, preferredWall: 'south', facing: { focal: 'desk' }, xRatio: 0.35, yRatio: 0.74, widthRatio: 0.16, depthRatio: 0.16, minWidth: 0.65, maxWidth: 0.8, defaultHeight: 0.8, clearance: 0.2 },
        { role: 'accent-chair', category: 'seating', essential: false, preferredWall: 'south', facing: { focal: 'desk' }, xRatio: 0.65, yRatio: 0.74, widthRatio: 0.16, depthRatio: 0.16, minWidth: 0.65, maxWidth: 0.8, defaultHeight: 0.8, clearance: 0.2 },
        { role: 'rug', category: 'decor', essential: true, preferredWall: 'center', xRatio: 0.5, yRatio: 0.52, widthRatio: 0.72, depthRatio: 0.55, minWidth: 2.0, maxWidth: 3.2, defaultHeight: 0.02, clearance: 0 },
      ],
    },
  ],

  bathroom: [
    // Template 1: Classic Bath (Vanity North, Shower East, Toilet South)
    {
      id: 'bath-three-fixture',
      roomType: 'bathroom',
      name: 'Tri-Fixture Full Bathroom',
      slots: [
        { role: 'vanity', category: 'fixture', essential: true, preferredWall: 'north', facing: 'wall', xRatio: 0.25, yRatio: 0.15, widthRatio: 0.42, depthRatio: 0.24, minWidth: 0.7, maxWidth: 1.3, minDepth: 0.5, maxDepth: 0.6, defaultHeight: 0.85, clearance: 0.2 },
        { role: 'shower', category: 'fixture', essential: true, preferredWall: 'east', facing: 'wall', xRatio: 0.82, yRatio: 0.22, widthRatio: 0.32, depthRatio: 0.32, minWidth: 0.85, maxWidth: 1.15, minDepth: 0.85, maxDepth: 1.15, defaultHeight: 2.1, clearance: 0.2 },
        { role: 'toilet', category: 'fixture', essential: true, preferredWall: 'south', facing: 'wall', xRatio: 0.78, yRatio: 0.84, widthRatio: 0.18, depthRatio: 0.24, minWidth: 0.4, maxWidth: 0.48, minDepth: 0.65, maxDepth: 0.75, defaultHeight: 0.78, clearance: 0.2 },
      ],
    },
    // Template 2: Luxury Bath with Tub & Shower
    {
      id: 'bath-luxury-tub',
      roomType: 'bathroom',
      name: 'Luxury Spa Bath with Tub & Shower',
      minWidth: 3.2,
      minDepth: 3.2,
      slots: [
        { role: 'vanity', category: 'fixture', essential: true, preferredWall: 'north', facing: 'wall', xRatio: 0.3, yRatio: 0.15, widthRatio: 0.45, depthRatio: 0.22, minWidth: 0.9, maxWidth: 1.6, minDepth: 0.5, maxDepth: 0.6, defaultHeight: 0.85, clearance: 0.2 },
        { role: 'shower', category: 'fixture', essential: true, preferredWall: 'east', facing: 'wall', xRatio: 0.84, yRatio: 0.2, widthRatio: 0.28, depthRatio: 0.28, minWidth: 0.85, maxWidth: 1.1, minDepth: 0.85, maxDepth: 1.1, defaultHeight: 2.1, clearance: 0.2 },
        { role: 'bathtub', category: 'fixture', essential: false, preferredWall: 'south', facing: 'wall', xRatio: 0.4, yRatio: 0.82, widthRatio: 0.48, depthRatio: 0.24, minWidth: 1.4, maxWidth: 1.8, minDepth: 0.7, maxDepth: 0.85, defaultHeight: 0.6, clearance: 0.2 },
        { role: 'toilet', category: 'fixture', essential: true, preferredWall: 'south', facing: 'wall', xRatio: 0.85, yRatio: 0.82, widthRatio: 0.16, depthRatio: 0.22, minWidth: 0.4, maxWidth: 0.48, minDepth: 0.65, maxDepth: 0.75, defaultHeight: 0.78, clearance: 0.2 },
      ],
    },
  ],

  studio: [
    // Template 1: Studio Apartment with Sleeping Zone, Living Zone, and Compact Kitchen
    {
      id: 'studio-zoned-apartment',
      roomType: 'studio',
      name: 'Multi-Zone Studio Apartment',
      slots: [
        // Sleeping Zone (North)
        { role: 'bed', category: 'bed', essential: true, preferredWall: 'north', facing: 'wall', xRatio: 0.28, yRatio: 0.24, widthRatio: 0.38, depthRatio: 0.36, minWidth: 1.4, maxWidth: 1.8, minDepth: 1.8, maxDepth: 2.05, defaultHeight: 1.0, clearance: 0.2 },
        { role: 'nightstand', category: 'table', essential: false, preferredWall: 'north', facing: 'wall', xRatio: 0.08, yRatio: 0.2, widthRatio: 0.08, depthRatio: 0.08, minWidth: 0.38, maxWidth: 0.5, defaultHeight: 0.52, clearance: 0.1 },
        { role: 'wardrobe', category: 'storage', essential: true, preferredWall: 'west', facing: 'wall', xRatio: 0.12, yRatio: 0.65, widthRatio: 0.12, depthRatio: 0.35, minWidth: 0.9, maxWidth: 1.5, defaultHeight: 2.0, clearance: 0.2 },
        // Living / Seating Zone (Center-South)
        { role: 'sofa', category: 'seating', essential: true, preferredWall: 'center', facing: 'room', xRatio: 0.6, yRatio: 0.65, widthRatio: 0.38, depthRatio: 0.18, minWidth: 1.4, maxWidth: 2.2, defaultHeight: 0.8, clearance: 0.3 },
        { role: 'coffee-table', category: 'table', essential: false, preferredWall: 'center', facing: 'room', xRatio: 0.6, yRatio: 0.48, widthRatio: 0.22, depthRatio: 0.14, minWidth: 0.65, maxWidth: 1.1, defaultHeight: 0.42, clearance: 0.2 },
        { role: 'rug', category: 'decor', essential: false, preferredWall: 'center', xRatio: 0.6, yRatio: 0.58, widthRatio: 0.48, depthRatio: 0.4, minWidth: 1.5, maxWidth: 2.6, defaultHeight: 0.02, clearance: 0 },
        // Kitchenette Run (North-East)
        { role: 'kitchen-run', category: 'storage', essential: true, preferredWall: 'east', facing: 'wall', xRatio: 0.88, yRatio: 0.26, widthRatio: 0.14, depthRatio: 0.38, minWidth: 1.2, maxWidth: 2.2, minDepth: 0.6, maxDepth: 0.68, defaultHeight: 0.9, clearance: 0.2 },
      ],
    },
    // Template 2: Studio with Distinct Living Focal Wall
    {
      id: 'studio-alcove-layout',
      roomType: 'studio',
      name: 'Studio Alcove Bed with Dedicated Living Zone',
      slots: [
        { role: 'bed', category: 'bed', essential: true, preferredWall: 'west', facing: 'wall', xRatio: 0.24, yRatio: 0.28, widthRatio: 0.34, depthRatio: 0.4, minWidth: 1.4, maxWidth: 1.75, minDepth: 1.8, maxDepth: 2.05, defaultHeight: 1.0, clearance: 0.2 },
        { role: 'wardrobe', category: 'storage', essential: true, preferredWall: 'north', facing: 'wall', xRatio: 0.72, yRatio: 0.14, widthRatio: 0.35, depthRatio: 0.14, minWidth: 1.0, maxWidth: 1.8, defaultHeight: 2.0, clearance: 0.2 },
        { role: 'sofa', category: 'seating', essential: true, preferredWall: 'south', facing: 'room', xRatio: 0.45, yRatio: 0.82, widthRatio: 0.4, depthRatio: 0.18, minWidth: 1.5, maxWidth: 2.3, defaultHeight: 0.8, clearance: 0.3 },
        { role: 'coffee-table', category: 'table', essential: false, preferredWall: 'center', facing: 'room', xRatio: 0.45, yRatio: 0.6, widthRatio: 0.22, depthRatio: 0.14, minWidth: 0.65, maxWidth: 1.1, defaultHeight: 0.42, clearance: 0.2 },
        { role: 'media-console', category: 'storage', essential: false, preferredWall: 'east', facing: 'wall', xRatio: 0.88, yRatio: 0.6, widthRatio: 0.12, depthRatio: 0.35, minWidth: 0.9, maxWidth: 1.6, defaultHeight: 0.55, clearance: 0.2 },
      ],
    },
  ],
};

export function selectArrangement(
  roomTypeKey: string,
  width: number,
  depth: number,
  _styleRecipe: StyleRecipe,
  seed = 0
): ArrangementTemplate {
  const templates = ARRANGEMENT_TEMPLATES[roomTypeKey] || ARRANGEMENT_TEMPLATES.living;
  const area = width * depth;
  const aspect = width / depth;
  const eligible = templates.filter((tpl) => {
    if (tpl.minWidth && width < tpl.minWidth) return false;
    if (tpl.minDepth && depth < tpl.minDepth) return false;
    if (tpl.preferredAspect === 'wide' && aspect < 1.1) return false;
    if (tpl.preferredAspect === 'deep' && aspect > 0.9) return false;
    return true;
  });
  const candidates = eligible.length ? eligible : templates;
  // Seeded deterministic selection
  const index = Math.abs(seed) % candidates.length;
  return candidates[index];
}
