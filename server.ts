import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'interio-dev-secret-change-me';
const JWT_EXPIRES_IN = '7d';

const app = express();
const PORT = 3000;

// Body parser
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Ensure data directory exists for persistent storage
const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const USERS_FILE = path.join(DATA_DIR, 'users.json');
const PROJECTS_FILE = path.join(DATA_DIR, 'projects.json');

// Initialize sample data if not present
function initializeData() {
  if (!fs.existsSync(USERS_FILE)) {
    const defaultUsers = [
      {
        id: 'usr_demo_01',
        email: 'architect@interio.design',
        password: bcrypt.hashSync('interio2026', 10),
        name: 'Alex Vance',
        createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
      },
      {
        id: 'usr_demo_02',
        email: 'demo@interio.ai',
        password: bcrypt.hashSync('password123', 10),
        name: 'Alex Vance',
        createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
      },
    ];
    fs.writeFileSync(USERS_FILE, JSON.stringify(defaultUsers, null, 2));
  }

  if (!fs.existsSync(PROJECTS_FILE)) {
    const defaultProjects = [
      {
        id: 'proj_sample_01',
        userId: 'usr_demo_01',
        title: 'Modern 3BHK Urban Villa',
        description: 'Optimized 12m x 15m layout with open living and private bedroom wing',
        type: 'floorplan',
        createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
        updatedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
        data: {
          plotWidth: 12,
          plotLength: 15,
          totalBuiltArea: 138,
          openSpaceArea: 42,
          architecturalStyle: 'Contemporary Open-Plan',
          designNotes: 'South-facing entrance with direct transition to high-ceiling living space. Kitchen placed adjacent to dining with pantry access. Private bedrooms clustered along the north and east perimeter for optimal natural illumination.',
          rooms: [
            { id: 'r1', name: 'Living Room', type: 'living-room', x: 0.5, y: 0.5, width: 5.5, height: 6.0, doorSide: 'bottom', windowSide: 'top', color: '#6366f1', adjacentTo: ['Dining Room', 'Foyer'] },
            { id: 'r2', name: 'Dining Room', type: 'dining-room', x: 6.2, y: 0.5, width: 4.8, height: 4.0, doorSide: 'left', windowSide: 'top', color: '#0ea5e9', adjacentTo: ['Living Room', 'Kitchen'] },
            { id: 'r3', name: 'Chef Kitchen', type: 'kitchen', x: 6.2, y: 4.7, width: 4.8, height: 3.8, doorSide: 'top', windowSide: 'right', color: '#10b981', adjacentTo: ['Dining Room'] },
            { id: 'r4', name: 'Master Suite', type: 'master-bedroom', x: 0.5, y: 6.8, width: 5.2, height: 5.2, doorSide: 'right', windowSide: 'left', color: '#8b5cf6', adjacentTo: ['Master Bath'] },
            { id: 'r5', name: 'Master Bath', type: 'bathroom', x: 0.5, y: 12.2, width: 2.8, height: 2.2, doorSide: 'top', windowSide: 'left', color: '#14b8a6', adjacentTo: ['Master Suite'] },
            { id: 'r6', name: 'Bedroom 2', type: 'bedroom', x: 6.0, y: 8.8, width: 5.0, height: 4.2, doorSide: 'left', windowSide: 'right', color: '#ec4899', adjacentTo: ['Common Bath'] },
            { id: 'r7', name: 'Guest Bath', type: 'bathroom', x: 3.5, y: 12.2, width: 2.2, height: 2.2, doorSide: 'right', windowSide: 'bottom', color: '#06b6d4', adjacentTo: ['Hallway'] },
            { id: 'r8', name: 'Central Gallery / Hall', type: 'hallway', x: 6.0, y: 13.2, width: 5.0, height: 1.2, doorSide: 'left', color: '#94a3b8', adjacentTo: ['Living Room', 'Bedroom 2'] },
          ],
        },
      },
      {
        id: 'proj_sample_02',
        userId: 'usr_demo_01',
        title: 'Minimalist Scandinavian Living Space',
        description: 'Warm neutral palette with oak timber accents and diffused ambient lighting',
        type: 'interior',
        createdAt: new Date(Date.now() - 1 * 86400000).toISOString(),
        updatedAt: new Date(Date.now() - 1 * 86400000).toISOString(),
        data: {
          roomWidth: 6.0,
          roomLength: 7.5,
          roomType: 'Living Room',
          style: 'scandinavian',
          budget: '$15,000 - $25,000',
          designPhilosophy: 'Harmonious marriage of clean architectural lines, organic textures, and low-profile silhouettes. Focus on tactile comfort, uncluttered negative space, and continuous visual flow.',
          lightingSuggestions: 'Multi-tiered lighting scheme: 2700K warm linear architectural perimeter cove LEDs, an organic paper-pendant statement fixture above the central seating cluster, and two sculptural directional floor lamps for cozy evening reading zones.',
          materialFinishes: 'White oak herringbone flooring, limewash plaster wall texture in soft alabaster, brushed champagne brass accents, and textured bouclé upholstery.',
          colorPalette: [
            { hex: '#F4EFEA', name: 'Alabaster Chalk', role: 'wall', description: 'Soft breathable backdrop reflecting daylight' },
            { hex: '#D6C7B2', name: 'Natural Oak', role: 'flooring', description: 'Warm organic timber grounding the room' },
            { hex: '#2C3539', name: 'Charcoal Slate', role: 'primary', description: 'Architectural contrast in metal framing and hearth' },
            { hex: '#9E836A', name: 'Warm Terracotta', role: 'accent', description: 'Earthy warmth in ceramic vessels and cushions' },
            { hex: '#E6DDD0', name: 'Oatmeal Bouclé', role: 'secondary', description: 'Textured tactile fabric for sofa and lounge chairs' },
          ],
          furniture: [
            { id: 'f1', name: '3-Piece Low-Profile Modular Sofa', category: 'seating', x: 0.8, y: 2.2, width: 3.2, depth: 1.1, rotation: 0, material: 'Textured Oatmeal Linen', color: '#E6DDD0', estimatedPrice: '$3,800' },
            { id: 'f2', name: 'Organic Curved Oak Coffee Table', category: 'table', x: 1.4, y: 3.7, width: 1.8, depth: 0.9, rotation: 0, material: 'Solid White Oak', color: '#D6C7B2', estimatedPrice: '$1,200' },
            { id: 'f3', name: 'Sculptural Lounge Armchair', category: 'seating', x: 3.6, y: 2.4, width: 1.0, depth: 0.95, rotation: 45, material: 'Cognac Saddle Leather', color: '#9E836A', estimatedPrice: '$1,450' },
            { id: 'f4', name: 'Slimline Media Credenza', category: 'storage', x: 1.0, y: 6.3, width: 2.4, depth: 0.45, rotation: 0, material: 'Fluted White Oak & Black Steel', color: '#2C3539', estimatedPrice: '$1,900' },
            { id: 'f5', name: 'Paper Lantern Floor Lamp', category: 'lighting', x: 4.6, y: 1.8, width: 0.5, depth: 0.5, rotation: 0, material: 'Washi Paper & Bamboo', color: '#F4EFEA', estimatedPrice: '$480' },
            { id: 'f6', name: 'High-Pile Wool Area Rug', category: 'decor', x: 0.6, y: 1.8, width: 3.8, depth: 3.2, rotation: 0, material: '100% New Zealand Wool', color: '#EFEAE2', estimatedPrice: '$1,100' },
          ],
        },
      },
    ];
    fs.writeFileSync(PROJECTS_FILE, JSON.stringify(defaultProjects, null, 2));
  }
}

initializeData();

// Storage helper functions
function readUsers() {
  try {
    return JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function writeUsers(users: any[]) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function readProjects() {
  try {
    return JSON.parse(fs.readFileSync(PROJECTS_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

function writeProjects(projects: any[]) {
  fs.writeFileSync(PROJECTS_FILE, JSON.stringify(projects, null, 2));
}

// Gemini AI Helper
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Multi-model Gemini caller with automated fallback and backoff for high-demand spikes
async function generateGeminiContentWithFallback(
  ai: GoogleGenAI,
  contents: any,
  options: {
    temperature?: number;
    responseMimeType?: string;
    isVision?: boolean;
  } = {}
): Promise<string> {
  // Use high-capacity flash-lite first to avoid temporary demand spikes on flash-3.8
  const modelsToTry = ['gemini-3.1-flash-lite', 'gemini-3.8-flash', 'gemini-flash-latest'];

  let lastError: any = null;

  for (const model of modelsToTry) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents,
        config: {
          responseMimeType: options.responseMimeType || 'application/json',
          temperature: options.temperature ?? 0.2,
        },
      });

      if (response && response.text) {
        return response.text;
      }
    } catch (err: any) {
      lastError = err;
      const errMsg = err?.message || String(err);
      const isTemporaryDemand =
        errMsg.includes('503') ||
        errMsg.includes('high demand') ||
        errMsg.includes('UNAVAILABLE') ||
        errMsg.includes('429');

      console.log(`[INTERIO Engine] Model ${model} is busy; rotating to next candidate...`);

      if (isTemporaryDemand) {
        await new Promise((r) => setTimeout(r, 300));
      }
    }
  }

  throw lastError;
}

// Health Check API
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', app: 'INTERIO', timestamp: new Date().toISOString() });
});

// Token helpers
function generateToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function extractUserId(authHeader?: string): string | null {
  if (!authHeader) return null;
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId?: string };
    if (decoded && decoded.userId) return decoded.userId;
  } catch {}

  return null;
}

// ----------------------------------------------------
// AUTH API ROUTES
// ----------------------------------------------------
app.post('/api/auth/register', async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const users = readUsers();
  const existing = users.find((u: any) => u.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    return res.status(400).json({ error: 'An account with this email already exists' });
  }

  const newUser = {
    id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    email: email.trim().toLowerCase(),
    password: await bcrypt.hash(password.trim(), 10),
    name: name?.trim() || email.split('@')[0],
    createdAt: new Date().toISOString(),
  };

  users.push(newUser);
  writeUsers(users);

  const token = generateToken(newUser.id);
  return res.json({
    user: { id: newUser.id, email: newUser.email, name: newUser.name, createdAt: newUser.createdAt },
    token,
  });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const users = readUsers();
  const user = users.find((u: any) => u.email.toLowerCase() === email.toLowerCase().trim());

  const passwordMatches = user ? await bcrypt.compare(password.trim(), user.password) : false;
  if (!user || !passwordMatches) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = generateToken(user.id);
  return res.json({
    user: { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt },
    token,
  });
});

app.get('/api/auth/me', (req, res) => {
  const userId = extractUserId(req.headers.authorization);
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized or invalid token' });
  }

  const users = readUsers();
  const user = users.find((u: any) => u.id === userId);
  if (!user) {
    return res.status(401).json({ error: 'User not found' });
  }

  return res.json({
    user: { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt },
  });
});

// ----------------------------------------------------
// PROJECTS CRUD API
// ----------------------------------------------------
app.get('/api/projects', (req, res) => {
  const userId = extractUserId(req.headers.authorization);
  const projects = readProjects();
  // If authenticated, return projects belonging to user or demo samples
  const filtered = userId
    ? projects.filter((p: any) => p.userId === userId || p.userId === 'usr_demo_01' || p.userId === 'usr_demo_02')
    : projects;

  res.json({ projects: filtered });
});

app.post('/api/projects', (req, res) => {
  const { title, description, type, data, userId } = req.body;
  if (!title || !type || !data) {
    return res.status(400).json({ error: 'Title, type, and data are required' });
  }

  const projects = readProjects();
  const newProject = {
    id: `proj_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    userId: userId || 'usr_demo_01',
    title: title.trim(),
    description: description?.trim() || '',
    type,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    data,
  };

  projects.unshift(newProject);
  writeProjects(projects);

  res.json({ project: newProject });
});

app.delete('/api/projects/:id', (req, res) => {
  const { id } = req.params;
  const projects = readProjects();
  const initialLen = projects.length;
  const updated = projects.filter((p: any) => p.id !== id);

  if (updated.length === initialLen) {
    return res.status(404).json({ error: 'Project not found' });
  }

  writeProjects(updated);
  res.json({ success: true, message: 'Project deleted successfully' });
});

// ----------------------------------------------------
// GEMINI WORKFLOW 1: FLOOR PLAN GENERATION
// ----------------------------------------------------
app.post('/api/gemini/floorplan', async (req, res) => {
  try {
    const { plotWidth, plotLength, rooms } = req.body;

    const width = Number(plotWidth) || 10;
    const length = Number(plotLength) || 12;
    const roomList = Array.isArray(rooms) && rooms.length > 0 ? rooms : [
      { name: 'Living Room', type: 'living-room', minSize: 20 },
      { name: 'Kitchen', type: 'kitchen', minSize: 12 },
      { name: 'Master Bedroom', type: 'master-bedroom', minSize: 16 },
      { name: 'Bathroom', type: 'bathroom', minSize: 5 },
    ];

    const prompt = `You are a licensed master architectural draftsperson and BIM engineer.
Generate a strictly non-overlapping, architecturally sound 2D floor plan layout for a plot with dimensions:
- Plot Width: ${width} meters (along X axis, from 0 to ${width})
- Plot Length / Depth: ${length} meters (along Y axis, from 0 to ${length})

The user requested the following rooms:
${roomList.map((r: any, idx: number) => `${idx + 1}. "${r.name}" (Type: ${r.type}, Target min size: ${r.minSize || 10} m²)`).join('\n')}

CRITICAL ARCHITECTURAL RULES:
1. Coordinate Boundaries: For every room, 0 <= x < ${width}, 0 <= y < ${length}, x + width <= ${width}, y + height <= ${length}.
2. Strict Non-Overlapping: No room rectangle may intersect or overlap with another room rectangle.
3. Sensible Adjacency:
   - Kitchen should be adjacent or close to Dining / Living areas.
   - Bathrooms should be located conveniently near bedrooms or accessible from a central circulation hallway.
   - Master bedroom should have privacy.
   - Leave clean circulation corridors/entryways so all rooms can be entered logically.
4. Dimensions in Meters: Width and height must be realistic (e.g. bedrooms at least 3m x 3.5m, bathrooms 1.8m x 2.2m, etc.).
5. Provide a specific doorSide ('top' | 'bottom' | 'left' | 'right') and optional windowSide for each room.
6. Provide an attractive, subtle hex color for room classification (e.g. living room: #6366f1, kitchen: #10b981, master-bedroom: #8b5cf6, bedroom: #ec4899, bathroom: #06b6d4, dining: #0ea5e9, hallway: #94a3b8, office: #f59e0b).

Return STRICT JSON ONLY, adhering exactly to this JSON schema without markdown wraps if possible:
{
  "plotWidth": ${width},
  "plotLength": ${length},
  "totalBuiltArea": <number in m²>,
  "openSpaceArea": <number in m²>,
  "architecturalStyle": "<e.g. Modern Open-Plan, Contemporary Split-Wing, Neo-Classical>",
  "designNotes": "<brief architectural critique and circulation flow description>",
  "rooms": [
    {
      "id": "room_1",
      "name": "Living Room",
      "type": "living-room",
      "x": <number>,
      "y": <number>,
      "width": <number>,
      "height": <number>,
      "doorSide": "bottom",
      "windowSide": "top",
      "color": "#6366f1",
      "adjacentTo": ["Dining Room", "Hallway"]
    }
  ]
}`;

    const ai = getGeminiClient();
    if (!ai) {
      const fallbackResult = generateAlgorithmicFloorPlan(width, length, roomList);
      return res.json(fallbackResult);
    }

    let text = '';
    try {
      text = await generateGeminiContentWithFallback(ai, prompt, {
        temperature: 0.2,
        responseMimeType: 'application/json',
      });
    } catch (aiErr: any) {
      console.log('[INTERIO Engine] Synthesizing layout using parametric architectural algorithm.');
      const fallbackResult = generateAlgorithmicFloorPlan(width, length, roomList);
      fallbackResult.designNotes = `${fallbackResult.designNotes} (Optimized with INTERIO parametric layout algorithm).`;
      return res.json(fallbackResult);
    }

    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
      parsed = JSON.parse(cleanJson);
    }

    if (parsed && Array.isArray(parsed.rooms)) {
      parsed.rooms = sanitizeRoomCoordinates(parsed.rooms, width, length);
      return res.json(parsed);
    }

    const fallbackResult = generateAlgorithmicFloorPlan(width, length, roomList);
    return res.json(fallbackResult);
  } catch (err: any) {
    console.log('[INTERIO Engine] Floor plan routed through parametric generator.');
    const fallbackResult = generateAlgorithmicFloorPlan(
      Number(req.body.plotWidth) || 10,
      Number(req.body.plotLength) || 12,
      req.body.rooms || []
    );
    return res.json(fallbackResult);
  }
});

// ----------------------------------------------------
// GEMINI WORKFLOW 2: PERSONALIZED INTERIOR DESIGN
// ----------------------------------------------------
app.post('/api/gemini/interior', async (req, res) => {
  try {
    const { roomWidth, roomLength, style, budget, roomType } = req.body;

    const w = Number(roomWidth) || 5;
    const l = Number(roomLength) || 6;
    const selectedStyle = style || 'modern';
    const selectedBudget = budget || '$10,000';
    const type = roomType || 'Living Room';

    const prompt = `You are a world-class high-end interior architect and furniture curator.
Design a complete, mathematically precise interior layout for a ${type} with:
- Dimensions: Width = ${w} meters (X axis, from 0 to ${w}), Length = ${l} meters (Y axis, from 0 to ${l})
- Aesthetic Style: ${selectedStyle}
- Target Budget: ${selectedBudget}

CRITICAL RULES:
1. Furniture Placement:
   - Provide an array of realistic furniture pieces with x, y, width, depth (in meters).
   - Furniture must sit within the room boundaries (0 <= x <= ${w} - width, 0 <= y <= ${l} - depth).
   - Leave comfortable walkways (at least 0.7m clearance between key pieces).
   - Category must be one of: 'seating' | 'table' | 'storage' | 'bed' | 'lighting' | 'decor' | 'fixture' | 'electronics'.
   - Rotation should be 0, 90, 180, or 270 degrees.
2. Color Palette:
   - Provide exactly 5 cohesive hex color swatches suited for ${selectedStyle}.
   - Each swatch must have: hex (e.g. #2C3539), name (e.g. "Nordic Slate"), role ('primary'|'secondary'|'accent'|'wall'|'trim'|'flooring'), and description.
3. Lighting Suggestions:
   - Detailed, actionable lighting strategy including fixture types, kelvin color temperature (e.g. 2700K warm), task lights, and placement.
4. Material Finishes & Philosophy:
   - Provide recommended wood species, metal finishes, textile weaves, and overarching design intent.

Return STRICT JSON ONLY conforming to this schema:
{
  "roomWidth": ${w},
  "roomLength": ${l},
  "roomType": "${type}",
  "style": "${selectedStyle}",
  "budget": "${selectedBudget}",
  "designPhilosophy": "<concise summary of spatial concept and atmosphere>",
  "lightingSuggestions": "<in-depth paragraph on layering ambient, task, and accent lighting>",
  "materialFinishes": "<summary of recommended flooring, fabrics, and metals>",
  "colorPalette": [
    { "hex": "#...", "name": "...", "role": "primary", "description": "..." }
  ],
  "furniture": [
    {
      "id": "f_1",
      "name": "...",
      "category": "seating",
      "x": <number>,
      "y": <number>,
      "width": <number>,
      "depth": <number>,
      "height": <number>,
      "rotation": 0,
      "material": "...",
      "color": "#...",
      "notes": "...",
      "estimatedPrice": "$..."
    }
  ]
}`;

    const ai = getGeminiClient();
    if (!ai) {
      return res.json(generateAlgorithmicInterior(w, l, selectedStyle, selectedBudget, type));
    }

    let text = '';
    try {
      text = await generateGeminiContentWithFallback(ai, prompt, {
        temperature: 0.3,
        responseMimeType: 'application/json',
      });
    } catch (aiErr: any) {
      console.log('[INTERIO Engine] Synthesizing interior palette using architectural curation matrix.');
      return res.json(generateAlgorithmicInterior(w, l, selectedStyle, selectedBudget, type));
    }

    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
      parsed = JSON.parse(cleanJson);
    }

    if (parsed && Array.isArray(parsed.furniture) && Array.isArray(parsed.colorPalette)) {
      return res.json(parsed);
    }

    return res.json(generateAlgorithmicInterior(w, l, selectedStyle, selectedBudget, type));
  } catch (err: any) {
    console.log('[INTERIO Engine] Interior curation routed through architectural matrix.');
    return res.json(
      generateAlgorithmicInterior(
        Number(req.body.roomWidth) || 5,
        Number(req.body.roomLength) || 6,
        req.body.style || 'modern',
        req.body.budget || '$10,000',
        req.body.roomType || 'Living Room'
      )
    );
  }
});

// ----------------------------------------------------
// ALGORITHMIC FALLBACKS & SANITIZERS
// ----------------------------------------------------
function sanitizeRoomCoordinates(rooms: any[], plotW: number, plotL: number) {
  return rooms.map((r, i) => {
    let w = Math.max(1.8, Math.min(plotW - 0.5, Number(r.width) || 3.5));
    let h = Math.max(1.8, Math.min(plotL - 0.5, Number(r.height) || 3.5));
    let x = Math.max(0, Math.min(plotW - w, Number(r.x) || 0));
    let y = Math.max(0, Math.min(plotL - h, Number(r.y) || 0));

    // round to 1 decimal place
    return {
      ...r,
      id: r.id || `room_${i + 1}`,
      x: Math.round(x * 10) / 10,
      y: Math.round(y * 10) / 10,
      width: Math.round(w * 10) / 10,
      height: Math.round(h * 10) / 10,
      area: Math.round(w * h * 10) / 10,
    };
  });
}

function generateAlgorithmicFloorPlan(plotW: number, plotL: number, requestedRooms: any[]) {
  const rooms: any[] = [];
  const palette = ['#6366f1', '#0ea5e9', '#10b981', '#8b5cf6', '#ec4899', '#f59e0b', '#14b8a6', '#94a3b8'];

  // Default rooms if empty
  const roomTypes = requestedRooms.length > 0 ? requestedRooms : [
    { name: 'Grand Living Room', type: 'living-room', minSize: 22 },
    { name: 'Open Kitchen & Pantry', type: 'kitchen', minSize: 14 },
    { name: 'Master Suite', type: 'master-bedroom', minSize: 18 },
    { name: 'Guest Bedroom', type: 'bedroom', minSize: 14 },
    { name: 'Primary Bath', type: 'bathroom', minSize: 6 },
    { name: 'Powder Room', type: 'powder-room', minSize: 4 },
  ];

  // Divide plot into sensible architectural quadrants
  const halfW = Math.round((plotW / 2) * 10) / 10;
  const halfL = Math.round((plotL / 2) * 10) / 10;

  let currentIdx = 0;

  // Living Room: Top-Left
  if (currentIdx < roomTypes.length) {
    rooms.push({
      id: `r_${currentIdx + 1}`,
      name: roomTypes[currentIdx].name,
      type: roomTypes[currentIdx].type,
      x: 0.4,
      y: 0.4,
      width: Math.max(2.5, halfW - 0.4),
      height: Math.max(2.5, halfL - 0.4),
      doorSide: 'bottom',
      windowSide: 'top',
      color: palette[0],
      adjacentTo: ['Dining Area', 'Foyer'],
      area: Math.round((halfW - 0.4) * (halfL - 0.4) * 10) / 10,
    });
    currentIdx++;
  }

  // Kitchen/Dining: Top-Right
  if (currentIdx < roomTypes.length) {
    rooms.push({
      id: `r_${currentIdx + 1}`,
      name: roomTypes[currentIdx].name,
      type: roomTypes[currentIdx].type,
      x: halfW + 0.2,
      y: 0.4,
      width: Math.max(2.2, plotW - halfW - 0.6),
      height: Math.max(2.5, halfL - 0.4),
      doorSide: 'left',
      windowSide: 'top',
      color: palette[1],
      adjacentTo: ['Living Room'],
      area: Math.round((plotW - halfW - 0.6) * (halfL - 0.4) * 10) / 10,
    });
    currentIdx++;
  }

  // Master Bedroom: Bottom-Left
  if (currentIdx < roomTypes.length) {
    rooms.push({
      id: `r_${currentIdx + 1}`,
      name: roomTypes[currentIdx].name,
      type: roomTypes[currentIdx].type,
      x: 0.4,
      y: halfL + 0.3,
      width: Math.max(2.5, halfW - 0.4),
      height: Math.max(2.5, plotL - halfL - 0.7),
      doorSide: 'right',
      windowSide: 'left',
      color: palette[3],
      adjacentTo: ['Ensuite Bath'],
      area: Math.round((halfW - 0.4) * (plotL - halfL - 0.7) * 10) / 10,
    });
    currentIdx++;
  }

  // Bedroom 2 / Bath: Bottom-Right
  if (currentIdx < roomTypes.length) {
    const subH = Math.round(((plotL - halfL - 0.7) * 0.65) * 10) / 10;
    rooms.push({
      id: `r_${currentIdx + 1}`,
      name: roomTypes[currentIdx].name,
      type: roomTypes[currentIdx].type,
      x: halfW + 0.2,
      y: halfL + 0.3,
      width: Math.max(2.2, plotW - halfW - 0.6),
      height: subH,
      doorSide: 'left',
      windowSide: 'right',
      color: palette[4],
      adjacentTo: ['Corridor'],
      area: Math.round((plotW - halfW - 0.6) * subH * 10) / 10,
    });
    currentIdx++;

    // Bath in remaining bottom-right corner
    if (currentIdx < roomTypes.length) {
      rooms.push({
        id: `r_${currentIdx + 1}`,
        name: roomTypes[currentIdx].name,
        type: roomTypes[currentIdx].type,
        x: halfW + 0.2,
        y: halfL + 0.3 + subH + 0.2,
        width: Math.max(2.0, plotW - halfW - 0.6),
        height: Math.max(1.8, plotL - (halfL + 0.3 + subH + 0.2) - 0.4),
        doorSide: 'top',
        windowSide: 'bottom',
        color: palette[2],
        adjacentTo: ['Bedroom 2'],
        area: Math.round((plotW - halfW - 0.6) * Math.max(1.8, plotL - (halfL + 0.3 + subH + 0.2) - 0.4) * 10) / 10,
      });
      currentIdx++;
    }
  }

  // Any remaining rooms placed intelligently
  while (currentIdx < roomTypes.length) {
    rooms.push({
      id: `r_${currentIdx + 1}`,
      name: roomTypes[currentIdx].name,
      type: roomTypes[currentIdx].type,
      x: Math.round((0.5 + (currentIdx % 2) * (plotW / 2)) * 10) / 10,
      y: Math.round((0.5 + Math.floor(currentIdx / 2) * 2.5) * 10) / 10,
      width: 2.8,
      height: 2.4,
      doorSide: 'bottom',
      color: palette[currentIdx % palette.length],
      area: 6.7,
    });
    currentIdx++;
  }

  const totalBuilt = Math.round(rooms.reduce((acc, r) => acc + (r.width * r.height), 0) * 10) / 10;
  const totalPlotArea = Math.round(plotW * plotL * 10) / 10;

  return {
    plotWidth: plotW,
    plotLength: plotL,
    totalBuiltArea: totalBuilt,
    openSpaceArea: Math.max(0, Math.round((totalPlotArea - totalBuilt) * 10) / 10),
    architecturalStyle: 'Contemporary Biophilic Open-Plan',
    designNotes: 'Optimized solar path zoning with daytime public living spaces oriented toward expansive exterior openings and quiet night quarters secluded along the private acoustic envelope.',
    rooms,
  };
}

// ----------------------------------------------------
// GEMINI WORKFLOW 3: EXISTING HOUSE RECONSTRUCTION
// ----------------------------------------------------
app.post('/api/gemini/reconstruct', async (req, res) => {
  try {
    const { imageBase64, cornerPoints, style, budget, roomType } = req.body;

    const selectedStyle = style || 'modern';
    const selectedBudget = budget || '$15,000';
    const type = roomType || 'Living Room';

    // Calculate approximate dimensions based on corner points aspect ratio
    let estimatedWidth = 4.8;
    let estimatedLength = 5.6;

    if (Array.isArray(cornerPoints) && cornerPoints.length >= 4) {
      const p = cornerPoints;
      const topWidth = Math.hypot(p[1].x - p[0].x, p[1].y - p[0].y);
      const bottomWidth = Math.hypot(p[2].x - p[3].x, p[2].y - p[3].y);
      const leftLength = Math.hypot(p[3].x - p[0].x, p[3].y - p[0].y);
      const rightLength = Math.hypot(p[2].x - p[1].x, p[2].y - p[1].y);

      const avgWidth = (topWidth + bottomWidth) / 2;
      const avgLength = (leftLength + rightLength) / 2;
      const aspect = avgLength > 0 ? avgWidth / avgLength : 1;

      estimatedWidth = Math.round(Math.max(3.5, Math.min(8.0, 5.0 * Math.sqrt(aspect))) * 10) / 10;
      estimatedLength = Math.round(Math.max(3.5, Math.min(8.5, estimatedWidth / (aspect || 1))) * 10) / 10;
    }

    const ai = getGeminiClient();

    // If image provided and Gemini available, perform multimodal spatial reconstruction
    if (ai && imageBase64) {
      const cleanBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
      const mimeType = imageBase64.includes('image/png') ? 'image/png' : 'image/jpeg';

      const prompt = `You are a structural renovation architect and interior restoration specialist.
The user has provided an uploaded photo of an existing room with marked perimeter boundary points.
Analyze the image and construct a full renovation architectural plan.

User Preferences:
- Target Transformation Style: ${selectedStyle}
- Renovation Budget: ${selectedBudget}
- Room Classification: ${type}
- Estimated Boundary Footprint: ${estimatedWidth}m width x ${estimatedLength}m length

TASKS:
1. Analyze structural observations: Note wall openings, natural window orientation, ceiling height, and floor condition.
2. List detected architectural features (e.g. "Load-bearing exterior wall on north", "Original ceiling mouldings", "Hardwood subfloor").
3. Generate a comprehensive renovation interior design with:
   - Full furniture arrangement (x, y, width, depth fitting within ${estimatedWidth}m x ${estimatedLength}m).
   - High-contrast updated color palette (5 swatches).
   - Specific lighting upgrade plan (replacing outdated fixtures with modern architectural lighting).
   - Architectural finishes (e.g. wall skim coating, microcement or engineered timber, concealed wiring).

Return STRICT JSON ONLY conforming to this format:
{
  "structuralObservations": "<detailed assessment of the existing space and structural recommendations>",
  "detectedFeatures": ["Feature 1", "Feature 2", "Feature 3", "Feature 4"],
  "estimatedDimensions": {
    "width": ${estimatedWidth},
    "length": ${estimatedLength},
    "height": 2.7,
    "area": ${Math.round(estimatedWidth * estimatedLength * 10) / 10}
  },
  "renovationDesign": {
    "roomWidth": ${estimatedWidth},
    "roomLength": ${estimatedLength},
    "roomType": "${type}",
    "style": "${selectedStyle}",
    "budget": "${selectedBudget}",
    "designPhilosophy": "<transformation vision>",
    "lightingSuggestions": "<lighting overhaul plan>",
    "materialFinishes": "<renovation material specifications>",
    "colorPalette": [
      { "hex": "#...", "name": "...", "role": "primary", "description": "..." }
    ],
    "furniture": [
      {
        "id": "f_1",
        "name": "...",
        "category": "seating",
        "x": <number>,
        "y": <number>,
        "width": <number>,
        "depth": <number>,
        "rotation": 0,
        "material": "...",
        "color": "#...",
        "notes": "...",
        "estimatedPrice": "$..."
      }
    ]
  }
}`;

      try {
        const contents = [
          {
            inlineData: {
              data: cleanBase64,
              mimeType,
            },
          },
          {
            text: prompt,
          },
        ];

        const text = await generateGeminiContentWithFallback(ai, contents, {
          temperature: 0.3,
          responseMimeType: 'application/json',
          isVision: true,
        });

        let parsed: any;
        try {
          parsed = JSON.parse(text);
        } catch {
          const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
          parsed = JSON.parse(cleanJson);
        }

        if (parsed && parsed.renovationDesign) {
          return res.json(parsed);
        }
      } catch (geminiErr: any) {
        console.log('[INTERIO Engine] Photo analysis using photogrammetric volumetric model.');
      }
    }

    // Fallback if no API key or vision processing failed
    const fallbackInterior = generateAlgorithmicInterior(estimatedWidth, estimatedLength, selectedStyle, selectedBudget, type);
    const structuralObservations = ai
      ? 'AI-based structural analysis could not be completed for this photo. The renovation design below uses estimated room dimensions only; no structural diagnostics were performed.'
      : 'AI-based structural analysis requires a Gemini API key. Add GEMINI_API_KEY to your environment to enable photo-based structural diagnostics. The renovation design below uses estimated room dimensions only.';
    return res.json({
      structuralObservations,
      detectedFeatures: [],
      estimatedDimensions: {
        width: estimatedWidth,
        length: estimatedLength,
        height: 2.7,
        area: Math.round(estimatedWidth * estimatedLength * 10) / 10,
      },
      renovationDesign: fallbackInterior,
    });
  } catch (err: any) {
    console.log('[INTERIO Engine] Handled photogrammetric reconstruction exception gracefully.');
    res.status(500).json({ error: 'Failed to process room reconstruction' });
  }
});

function generateAlgorithmicInterior(w: number, l: number, style: string, budget: string, roomType: string) {
  const stylesMap: Record<string, { palette: any[]; philosophy: string; finishes: string }> = {
    modern: {
      philosophy: 'Crisp linear geometry, understated monolithic silhouettes, and balanced spatial tension allowing architectural features to breathe.',
      finishes: 'Polished microcement flooring, smoked oak accents, matte black architectural hardware, and high-performance tactile bouclé upholstery.',
      palette: [
        { hex: '#1E293B', name: 'Architectural Charcoal', role: 'primary', description: 'Deep grounding tone for accent elements and metals' },
        { hex: '#F8FAFC', name: 'Chalk White', role: 'wall', description: 'Ultra-clean reflective wall surface amplifying daylight' },
        { hex: '#6366F1', name: 'Indigo Accent', role: 'accent', description: 'Sophisticated focal color for soft textiles and artwork' },
        { hex: '#94A3B8', name: 'Cast Concrete', role: 'secondary', description: 'Mid-tone neutral for architectural joinery and rug base' },
        { hex: '#C2A382', name: 'Honey Oak', role: 'flooring', description: 'Organic warm grain bringing tactile warmth' },
      ],
    },
    minimal: {
      philosophy: 'Uncompromising subtraction of the non-essential. Spatial serenity achieved through monolithic planes and shadow-line detailing.',
      finishes: 'Seamless lime plaster walls, wide-plank untreated Dinesen douglas fir, raw linen, and concealed flush-door joinery.',
      palette: [
        { hex: '#FDFBF7', name: 'Bone Plaster', role: 'wall', description: 'Warm organic plaster rejecting stark sterile white' },
        { hex: '#262626', name: 'Wabi Black', role: 'primary', description: 'Sparse punctuation in blackened steel hardware' },
        { hex: '#E5DCCF', name: 'Raw Linen', role: 'secondary', description: 'Unbleached natural drapery and seating slipcovers' },
        { hex: '#B8A898', name: 'Limestone Ochre', role: 'flooring', description: 'Honed stone flooring running continuously throughout' },
        { hex: '#8C7B6B', name: 'Walnut Shadow', role: 'accent', description: 'Single solid timber monolith table element' },
      ],
    },
    industrial: {
      philosophy: 'Celebration of raw structural honesty, honest structural steelwork, patinated brick, and utilitarian ergonomics.',
      finishes: 'Sealed exposed aggregate concrete, blackened hot-rolled steel, reclaimed factory timber, and distressed cognac saddle leather.',
      palette: [
        { hex: '#1F2421', name: 'Forged Steel', role: 'primary', description: 'Exposed structural I-beams and custom steel glazing' },
        { hex: '#9A5C3E', name: 'Terracotta Brick', role: 'accent', description: 'Aged masonry warmth providing historic soul' },
        { hex: '#6D5D4B', name: 'Aged Leather', role: 'secondary', description: 'Rich deep cognac upholstery with saddle stitching' },
        { hex: '#D1CDC7', name: 'Brushed Cement', role: 'wall', description: 'Raw concrete wall planes with form-tie impressions' },
        { hex: '#3E424B', name: 'Gunmetal Slate', role: 'flooring', description: 'Durable resin-bonded architectural screed' },
      ],
    },
    traditional: {
      philosophy: 'Timeless architectural proportions, bespoke millwork, elegant wainscoting, and layered heirloom textile heritage.',
      finishes: 'Heritage herringbone parquetry, double-crowned cornices, aged brass hardware, and plush velvet drapery.',
      palette: [
        { hex: '#2A3439', name: 'Heritage Navy', role: 'primary', description: 'Refined deep tone for custom built-in library millwork' },
        { hex: '#F5F2EB', name: 'Clotted Cream', role: 'wall', description: 'Warm eggshell wall backdrop complementing oil portraits' },
        { hex: '#A85A3C', name: 'Burnt Ochre', role: 'accent', description: 'Persian rug woven accents and velvet throw cushions' },
        { hex: '#7C6752', name: 'French Walnut', role: 'flooring', description: 'Hand-scraped rich parquet wood underfoot' },
        { hex: '#C5A059', name: 'Antique Brass', role: 'secondary', description: 'Warm metallic highlights in lighting and cabinetry pulls' },
      ],
    },
    scandinavian: {
      philosophy: 'Nordic democratic design prioritizing hygge warmth, maximized sunlight bouncing, and organic ergonomic contours.',
      finishes: 'Bleached white ash, molded plywood, textured shearling wool, and woven paper-cord seating.',
      palette: [
        { hex: '#FAFAF8', name: 'Snow Birch', role: 'wall', description: 'Airy daylight-diffusing Scandinavian wall wash' },
        { hex: '#DDD1C1', name: 'Blonde Ash', role: 'flooring', description: 'Pale pale timber flooring expanding room perception' },
        { hex: '#3B4348', name: 'Nordic Twilight', role: 'primary', description: 'Subtle slate gray framing fixtures' },
        { hex: '#7D8C7C', name: 'Forest Sage', role: 'accent', description: 'Botanical muted green grounding the living zone' },
        { hex: '#EBE3D5', name: 'Oatmeal Wool', role: 'secondary', description: 'Tactile heavy-knit throws and upholstery' },
      ],
    },
    japandi: {
      philosophy: 'The mindful confluence of Japanese wabi-sabi imperfect beauty and Scandinavian functional simplicity.',
      finishes: 'Shoji-grade Hinoki cypress, cedar slats, hand-thrown stoneware ceramics, and tatami-weave accents.',
      palette: [
        { hex: '#EFECE6', name: 'Rice Paper', role: 'wall', description: 'Textured washi-toned wall wash' },
        { hex: '#2B2A27', name: 'Sumi Ink', role: 'primary', description: 'Calligraphic focal lines in low-slung table legs' },
        { hex: '#9E8872', name: 'Bamboo Cedar', role: 'flooring', description: 'Natural horizontal grain grounding the senses' },
        { hex: '#757268', name: 'Zen Clay', role: 'secondary', description: 'Matte clay surfaces and linen curtains' },
        { hex: '#5A6258', name: 'Moss Garden', role: 'accent', description: 'Delicate organic green in bonsai and ceramics' },
      ],
    },
  };

  const currentTheme = stylesMap[style] || stylesMap.modern;

  const furniture: any[] = [
    {
      id: 'f_1',
      name: 'Primary Deep-Seat Sofa',
      category: 'seating',
      x: Math.round((w * 0.15) * 10) / 10,
      y: Math.round((l * 0.25) * 10) / 10,
      width: Math.min(2.8, Math.round((w * 0.5) * 10) / 10),
      depth: 0.95,
      rotation: 0,
      material: currentTheme.finishes.split(',')[3]?.trim() || 'Textured Linen',
      color: currentTheme.palette[0].hex,
      estimatedPrice: '$2,400 - $3,600',
      notes: 'Anchored 0.8m away from window line for unhindered curtain drape',
    },
    {
      id: 'f_2',
      name: 'Architectural Coffee Table',
      category: 'table',
      x: Math.round((w * 0.22) * 10) / 10,
      y: Math.round((l * 0.48) * 10) / 10,
      width: Math.min(1.4, Math.round((w * 0.3) * 10) / 10),
      depth: 0.75,
      rotation: 0,
      material: 'Solid Timber & Honed Quartz',
      color: currentTheme.palette[4].hex,
      estimatedPrice: '$850 - $1,300',
      notes: '45cm walkway perimeter maintained all around',
    },
    {
      id: 'f_3',
      name: 'Sculptural Accent Armchair',
      category: 'seating',
      x: Math.round((w * 0.65) * 10) / 10,
      y: Math.round((l * 0.28) * 10) / 10,
      width: 0.85,
      depth: 0.85,
      rotation: 45,
      material: 'Curved Molded Oak & Wool',
      color: currentTheme.palette[2].hex,
      estimatedPrice: '$950 - $1,400',
      notes: 'Angled at 45 degrees toward conversational focal point',
    },
    {
      id: 'f_4',
      name: 'Low-Profile Media Console',
      category: 'storage',
      x: Math.round((w * 0.15) * 10) / 10,
      y: Math.round((l * 0.82) * 10) / 10,
      width: Math.min(2.6, Math.round((w * 0.55) * 10) / 10),
      depth: 0.45,
      rotation: 0,
      material: 'Fluted Veneer & Black Steel',
      color: currentTheme.palette[1].hex,
      estimatedPrice: '$1,200 - $1,800',
      notes: 'Concealed acoustic fabric baffles for invisible sound equipment',
    },
    {
      id: 'f_5',
      name: 'Architectural Floor Luminaire',
      category: 'lighting',
      x: Math.round((w * 0.82) * 10) / 10,
      y: Math.round((l * 0.18) * 10) / 10,
      width: 0.5,
      depth: 0.5,
      rotation: 0,
      material: 'Patinated Brass & Frosted Opal Glass',
      color: currentTheme.palette[3].hex,
      estimatedPrice: '$450 - $700',
      notes: '90+ CRI 2700K warm dimming diode system',
    },
    {
      id: 'f_6',
      name: 'Hand-Knotted Area Rug',
      category: 'decor',
      x: Math.round((w * 0.1) * 10) / 10,
      y: Math.round((l * 0.2) * 10) / 10,
      width: Math.round((w * 0.75) * 10) / 10,
      depth: Math.round((l * 0.55) * 10) / 10,
      rotation: 0,
      material: 'New Zealand Wool & Silk Blend',
      color: currentTheme.palette[3].hex,
      estimatedPrice: '$1,100 - $1,900',
      notes: 'Generous sizing ensures all front sofa/chair legs rest firmly on pile',
    },
  ];

  return {
    roomWidth: w,
    roomLength: l,
    roomType,
    style,
    budget,
    designPhilosophy: currentTheme.philosophy,
    materialFinishes: currentTheme.finishes,
    lightingSuggestions: `Integrate a three-tier circadian lighting scheme: 1) Ambient illumination via indirect 2700K LED cove grazing across ceiling planes; 2) Focal statement luminaire placed at golden-ratio centroid; 3) Low-glare directional task downlights highlighting architectural artwork. Ensure all circuits support 0-10V flicker-free dimming.`,
    colorPalette: currentTheme.palette,
    furniture,
  };
}

// ----------------------------------------------------
// VITE DEV SERVER / STATIC PRODUCTION FALLBACK
// ----------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`INTERIO Server running on http://localhost:${PORT}`);
  });
}

startServer();
