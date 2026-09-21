export type WorkflowType = 'floorplan' | 'interior' | 'renovation';

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
}

// Workflow 1: Floor Plan Types
export type RoomType =
  | 'living-room'
  | 'master-bedroom'
  | 'bedroom'
  | 'kitchen'
  | 'dining-room'
  | 'bathroom'
  | 'powder-room'
  | 'hallway'
  | 'balcony'
  | 'office'
  | 'laundry'
  | 'utility';

export interface RoomInput {
  id: string;
  name: string;
  type: RoomType;
  minSize: number; // in square meters
}

export interface FloorPlanRoom {
  id: string;
  name: string;
  type: RoomType;
  x: number; // meters from plot left
  y: number; // meters from plot top
  width: number; // meters
  height: number; // meters
  doorSide?: 'top' | 'bottom' | 'left' | 'right';
  windowSide?: 'top' | 'bottom' | 'left' | 'right';
  color?: string;
  adjacentTo?: string[];
  area?: number;
}

export interface FloorPlanResult {
  plotWidth: number; // meters
  plotLength: number; // meters
  rooms: FloorPlanRoom[];
  totalBuiltArea: number;
  openSpaceArea?: number;
  architecturalStyle?: string;
  designNotes?: string;
}

// Workflow 2: Interior Design Types
export type DesignStyle = 'modern' | 'minimal' | 'traditional' | 'industrial' | 'scandinavian' | 'japandi';

export type FurnitureCategory =
  | 'seating'
  | 'table'
  | 'storage'
  | 'bed'
  | 'lighting'
  | 'decor'
  | 'fixture'
  | 'electronics';

export interface FurnitureItem {
  id: string;
  name: string;
  category: FurnitureCategory;
  x: number; // meters
  y: number; // meters
  width: number; // meters
  depth: number; // meters
  height?: number; // meters
  rotation?: number; // degrees (0, 90, 180, 270)
  material?: string;
  color?: string;
  notes?: string;
  estimatedPrice?: string;
}

export interface ColorSwatch {
  hex: string;
  name: string;
  role: 'primary' | 'secondary' | 'accent' | 'wall' | 'trim' | 'flooring';
  description?: string;
}

export interface InteriorDesignResult {
  roomWidth: number;
  roomLength: number;
  roomType: string;
  style: DesignStyle;
  budget: string;
  furniture: FurnitureItem[];
  colorPalette: ColorSwatch[];
  lightingSuggestions: string;
  materialFinishes?: string;
  designPhilosophy?: string;
}

// Workflow 3: Existing House Reconstruction Types
export interface Point2D {
  x: number; // 0 to 1 (normalized or canvas coords)
  y: number;
}

export interface ReconstructionData {
  imageUrl: string;
  imageFileName?: string;
  cornerPoints: Point2D[];
  estimatedDimensions: {
    width: number;
    length: number;
    height: number;
    area: number;
  };
  detectedFeatures?: string[];
  structuralObservations?: string;
  renovationDesign?: InteriorDesignResult;
}

// Saved Project Type
export interface SavedProject {
  id: string;
  userId: string;
  title: string;
  description: string;
  type: WorkflowType;
  createdAt: string;
  updatedAt: string;
  thumbnail?: string;
  data: FloorPlanResult | InteriorDesignResult | ReconstructionData;
}
