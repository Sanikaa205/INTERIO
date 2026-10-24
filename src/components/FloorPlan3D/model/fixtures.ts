import type { FloorPlanResult } from '../../../types';

/**
 * 10x12 m plot: living room, kitchen, 2 bedrooms, bathroom.
 * Rooms tile without gaps. Doors on shared or exterior walls.
 * Windows on exterior sides only.
 */
export const plan10x12: FloorPlanResult = {
  plotWidth: 10,
  plotLength: 12,
  totalBuiltArea: 90,
  rooms: [
    {
      id: 'r1',
      name: 'Living Room',
      type: 'living-room',
      x: 0, y: 0, width: 5, height: 5,
      doors: [{ side: 'bottom', offset: 2.05, width: 0.9, swing: 'in', isMainEntry: true }],
      windows: [{ side: 'top', offset: 1.5, width: 2.0 }],
      color: '#6366f1',
    },
    {
      id: 'r2',
      name: 'Kitchen',
      type: 'kitchen',
      x: 5, y: 0, width: 5, height: 5,
      doors: [{ side: 'left', offset: 2.05, width: 0.9, swing: 'in' }],
      windows: [{ side: 'top', offset: 1.5, width: 1.5 }, { side: 'right', offset: 1.5, width: 1.2 }],
      color: '#10b981',
    },
    {
      id: 'r3',
      name: 'Master Bedroom',
      type: 'master-bedroom',
      x: 0, y: 5, width: 5, height: 4,
      doors: [{ side: 'top', offset: 2.05, width: 0.9, swing: 'in' }],
      windows: [{ side: 'left', offset: 1.05, width: 1.5 }, { side: 'bottom', offset: 1.5, width: 1.5 }],
      color: '#8b5cf6',
    },
    {
      id: 'r4',
      name: 'Bedroom 2',
      type: 'bedroom',
      x: 5, y: 5, width: 3.5, height: 4,
      doors: [{ side: 'top', offset: 1.3, width: 0.9, swing: 'in' }],
      windows: [{ side: 'right', offset: 1.05, width: 1.2 }, { side: 'bottom', offset: 1.3, width: 1.2 }],
      color: '#ec4899',
    },
    {
      id: 'r5',
      name: 'Bathroom',
      type: 'bathroom',
      x: 8.5, y: 5, width: 1.5, height: 4,
      doors: [{ side: 'left', offset: 1.05, width: 0.8, swing: 'in' }],
      windows: [],
      color: '#14b8a6',
    },
    {
      id: 'r6',
      name: 'Hallway',
      type: 'hallway',
      x: 0, y: 9, width: 10, height: 3,
      doors: [{ side: 'top', offset: 2.0, width: 0.9, swing: 'in' }],
      windows: [],
      color: '#94a3b8',
    },
  ],
};

/**
 * 12x12 m plot: living room, dining, kitchen, 2 bedrooms, bathroom.
 */
export const plan12x12: FloorPlanResult = {
  plotWidth: 12,
  plotLength: 12,
  totalBuiltArea: 110,
  rooms: [
    {
      id: 'r1',
      name: 'Living Room',
      type: 'living-room',
      x: 0, y: 0, width: 6, height: 6,
      doors: [{ side: 'bottom', offset: 2.55, width: 0.9, swing: 'in', isMainEntry: true }],
      windows: [{ side: 'top', offset: 2.0, width: 2.0 }, { side: 'left', offset: 2.0, width: 1.5 }],
      color: '#6366f1',
    },
    {
      id: 'r2',
      name: 'Dining Room',
      type: 'dining-room',
      x: 6, y: 0, width: 6, height: 4,
      doors: [{ side: 'left', offset: 2.55, width: 0.9, swing: 'in' }],
      windows: [{ side: 'top', offset: 2.0, width: 1.5 }, { side: 'right', offset: 1.0, width: 1.5 }],
      color: '#0ea5e9',
    },
    {
      id: 'r3',
      name: 'Kitchen',
      type: 'kitchen',
      x: 6, y: 4, width: 6, height: 4,
      doors: [{ side: 'left', offset: 2.55, width: 0.9, swing: 'in' }],
      windows: [{ side: 'right', offset: 1.5, width: 2.0 }],
      color: '#10b981',
    },
    {
      id: 'r4',
      name: 'Master Bedroom',
      type: 'master-bedroom',
      x: 0, y: 6, width: 5.5, height: 6,
      doors: [{ side: 'top', offset: 2.3, width: 0.9, swing: 'in' }],
      windows: [{ side: 'left', offset: 2.0, width: 2.0 }, { side: 'bottom', offset: 2.0, width: 2.0 }],
      color: '#8b5cf6',
    },
    {
      id: 'r5',
      name: 'Bedroom 2',
      type: 'bedroom',
      x: 5.5, y: 8, width: 4, height: 4,
      doors: [{ side: 'top', offset: 1.55, width: 0.9, swing: 'in' }],
      windows: [{ side: 'right', offset: 1.55, width: 1.5 }, { side: 'bottom', offset: 1.55, width: 1.5 }],
      color: '#ec4899',
    },
    {
      id: 'r6',
      name: 'Bathroom',
      type: 'bathroom',
      x: 9.5, y: 8, width: 2.5, height: 4,
      doors: [{ side: 'left', offset: 1.6, width: 0.8, swing: 'in' }],
      windows: [{ side: 'bottom', offset: 0.85, width: 0.8 }],
      color: '#14b8a6',
    },
    {
      id: 'r7',
      name: 'Hallway',
      type: 'hallway',
      x: 5.5, y: 6, width: 6.5, height: 2,
      doors: [{ side: 'left', offset: 0.55, width: 0.9, swing: 'in' }],
      windows: [],
      color: '#94a3b8',
    },
  ],
};

/**
 * 15x20 m plot: living, dining, kitchen, 3 bedrooms, 2 bathrooms, hallway.
 */
export const plan15x20: FloorPlanResult = {
  plotWidth: 15,
  plotLength: 20,
  totalBuiltArea: 200,
  rooms: [
    {
      id: 'r1',
      name: 'Living Room',
      type: 'living-room',
      x: 0, y: 0, width: 7, height: 6,
      doors: [{ side: 'bottom', offset: 3.05, width: 0.9, swing: 'in', isMainEntry: true }],
      windows: [{ side: 'top', offset: 2.0, width: 2.4 }, { side: 'left', offset: 2.0, width: 2.0 }],
      color: '#6366f1',
    },
    {
      id: 'r2',
      name: 'Dining Room',
      type: 'dining-room',
      x: 7, y: 0, width: 8, height: 5,
      doors: [{ side: 'left', offset: 2.05, width: 0.9, swing: 'in' }],
      windows: [{ side: 'top', offset: 2.55, width: 2.4 }, { side: 'right', offset: 1.55, width: 2.0 }],
      color: '#0ea5e9',
    },
    {
      id: 'r3',
      name: 'Kitchen',
      type: 'kitchen',
      x: 7, y: 5, width: 8, height: 5,
      doors: [{ side: 'left', offset: 2.05, width: 0.9, swing: 'in' }],
      windows: [{ side: 'right', offset: 1.55, width: 2.4 }],
      color: '#10b981',
    },
    {
      id: 'r4',
      name: 'Master Suite',
      type: 'master-bedroom',
      x: 0, y: 6, width: 6.5, height: 6,
      doors: [{ side: 'right', offset: 2.55, width: 0.9, swing: 'in' }],
      windows: [{ side: 'left', offset: 2.05, width: 2.4 }, { side: 'bottom', offset: 2.05, width: 2.0 }],
      color: '#8b5cf6',
    },
    {
      id: 'r5',
      name: 'Master Bath',
      type: 'bathroom',
      x: 6.5, y: 6, width: 3, height: 3,
      doors: [{ side: 'left', offset: 1.1, width: 0.8, swing: 'in' }],
      windows: [],
      color: '#14b8a6',
    },
    {
      id: 'r6',
      name: 'Bedroom 2',
      type: 'bedroom',
      x: 9.5, y: 10, width: 5.5, height: 5,
      doors: [{ side: 'left', offset: 2.05, width: 0.9, swing: 'in' }],
      windows: [{ side: 'right', offset: 2.05, width: 1.5 }, { side: 'bottom', offset: 2.05, width: 1.5 }],
      color: '#ec4899',
    },
    {
      id: 'r7',
      name: 'Bedroom 3',
      type: 'bedroom',
      x: 0, y: 12, width: 6.5, height: 5,
      doors: [{ side: 'right', offset: 2.05, width: 0.9, swing: 'in' }],
      windows: [{ side: 'left', offset: 2.05, width: 1.5 }, { side: 'bottom', offset: 2.05, width: 1.5 }],
      color: '#f59e0b',
    },
    {
      id: 'r8',
      name: 'Bathroom 2',
      type: 'bathroom',
      x: 6.5, y: 9, width: 3, height: 3,
      doors: [{ side: 'left', offset: 1.1, width: 0.8, swing: 'in' }],
      windows: [{ side: 'bottom', offset: 1.1, width: 0.8 }],
      color: '#06b6d4',
    },
    {
      id: 'r9',
      name: 'Hallway',
      type: 'hallway',
      x: 6.5, y: 12, width: 3, height: 5,
      doors: [{ side: 'top', offset: 1.05, width: 0.9, swing: 'in' }],
      windows: [],
      color: '#94a3b8',
    },
    {
      id: 'r10',
      name: 'Utility',
      type: 'utility',
      x: 0, y: 17, width: 6.5, height: 3,
      doors: [{ side: 'top', offset: 2.8, width: 0.9, swing: 'in' }],
      windows: [{ side: 'left', offset: 1.05, width: 1.0 }, { side: 'bottom', offset: 2.8, width: 1.0 }],
      color: '#78716c',
    },
    {
      id: 'r11',
      name: 'Laundry',
      type: 'laundry',
      x: 6.5, y: 17, width: 8.5, height: 3,
      doors: [{ side: 'top', offset: 3.8, width: 0.9, swing: 'in' }],
      windows: [{ side: 'right', offset: 1.05, width: 1.0 }, { side: 'bottom', offset: 3.8, width: 1.0 }],
      color: '#a8a29e',
    },
  ],
};

/** Single-room plan for edge-case testing */
export const planSingleRoom: FloorPlanResult = {
  plotWidth: 6,
  plotLength: 5,
  totalBuiltArea: 30,
  rooms: [
    {
      id: 'r1',
      name: 'Studio',
      type: 'living-room',
      x: 0, y: 0, width: 6, height: 5,
      doors: [{ side: 'bottom', offset: 2.55, width: 0.9, swing: 'in', isMainEntry: true }],
      windows: [{ side: 'top', offset: 2.55, width: 2.0 }, { side: 'left', offset: 2.05, width: 1.2 }],
      color: '#6366f1',
    },
  ],
};

/** Plan with circulation hallway */
export const planWithHallway: FloorPlanResult = {
  plotWidth: 10,
  plotLength: 10,
  totalBuiltArea: 80,
  rooms: [
    {
      id: 'r1',
      name: 'Living Room',
      type: 'living-room',
      x: 0, y: 0, width: 6, height: 5,
      doors: [{ side: 'bottom', offset: 2.55, width: 0.9, swing: 'in', isMainEntry: true }],
      windows: [{ side: 'top', offset: 2.0, width: 2.0 }],
      color: '#6366f1',
    },
    {
      id: 'r2',
      name: 'Bedroom',
      type: 'bedroom',
      x: 6, y: 0, width: 4, height: 5,
      doors: [{ side: 'bottom', offset: 1.55, width: 0.9, swing: 'in' }],
      windows: [{ side: 'top', offset: 1.55, width: 1.5 }, { side: 'right', offset: 2.05, width: 1.2 }],
      color: '#8b5cf6',
    },
  ],
  circulation: [
    { x: 0, y: 5, width: 10, height: 2, name: 'Main Corridor' },
  ],
};

/**
 * planReal1: copied verbatim from data/projects.json proj_sample_01 (data only).
 * 12×15 m "Modern 3BHK Urban Villa".
 */
export const planReal1: FloorPlanResult = {
  plotWidth: 12,
  plotLength: 15,
  totalBuiltArea: 138,
  openSpaceArea: 42,
  architecturalStyle: 'Contemporary Open-Plan',
  designNotes: 'South-facing entrance with direct transition to high-ceiling living space.',
  rooms: [
    { id: 'r1', name: 'Living Room',          type: 'living-room',     x: 0.5, y: 0.5,  width: 5.5, height: 6.0, doorSide: 'bottom', windowSide: 'top',   color: '#6366f1', adjacentTo: ['Dining Room', 'Foyer'] },
    { id: 'r2', name: 'Dining Room',           type: 'dining-room',     x: 6.2, y: 0.5,  width: 4.8, height: 4.0, doorSide: 'left',   windowSide: 'top',   color: '#0ea5e9', adjacentTo: ['Living Room', 'Kitchen'] },
    { id: 'r3', name: 'Chef Kitchen',          type: 'kitchen',         x: 6.2, y: 4.7,  width: 4.8, height: 3.8, doorSide: 'top',    windowSide: 'right', color: '#10b981', adjacentTo: ['Dining Room'] },
    { id: 'r4', name: 'Master Suite',          type: 'master-bedroom',  x: 0.5, y: 6.8,  width: 5.2, height: 5.2, doorSide: 'right',  windowSide: 'left',  color: '#8b5cf6', adjacentTo: ['Master Bath'] },
    { id: 'r5', name: 'Master Bath',           type: 'bathroom',        x: 0.5, y: 12.2, width: 2.8, height: 2.2, doorSide: 'top',    windowSide: 'left',  color: '#14b8a6', adjacentTo: ['Master Suite'] },
    { id: 'r6', name: 'Bedroom 2',             type: 'bedroom',         x: 6.0, y: 8.8,  width: 5.0, height: 4.2, doorSide: 'left',   windowSide: 'right', color: '#ec4899', adjacentTo: ['Common Bath'] },
    { id: 'r7', name: 'Guest Bath',            type: 'bathroom',        x: 3.5, y: 12.2, width: 2.2, height: 2.2, doorSide: 'right',  windowSide: 'bottom',color: '#06b6d4', adjacentTo: ['Hallway'] },
    { id: 'r8', name: 'Central Gallery / Hall',type: 'hallway',         x: 6.0, y: 13.2, width: 5.0, height: 1.2, doorSide: 'left',   color: '#94a3b8',    adjacentTo: ['Living Room', 'Bedroom 2'] },
  ],
};
