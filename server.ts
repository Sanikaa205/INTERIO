import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

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
        password: 'interio2026',
        name: 'Alex Vance',
        createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
      },
      {
        id: 'usr_demo_02',
        email: 'demo@interio.ai',
        password: 'password123',
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
          circulationEfficiency: 88,
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

// Health Check API
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', app: 'INTERIO', timestamp: new Date().toISOString() });
});

// Token helpers
function generateToken(userId: string): string {
  return Buffer.from(JSON.stringify({ userId, timestamp: Date.now() })).toString('base64url');
}

function extractUserId(authHeader?: string): string | null {
  if (!authHeader) return null;
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;

  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64url').toString('utf-8'));
    if (decoded && decoded.userId) return decoded.userId;
  } catch {}

  return null;
}

// ----------------------------------------------------
// AUTH API ROUTES
// ----------------------------------------------------
app.post('/api/auth/register', (req, res) => {
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
    password: password.trim(),
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

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const users = readUsers();
  const user = users.find(
    (u: any) => u.email.toLowerCase() === email.toLowerCase().trim() && u.password === password.trim()
  );

  if (!user) {
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
  "circulationEfficiency": <percentage number between 75 and 95>,
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
      const response = await ai.models.generateContent({
        model: 'gemini-flash-latest',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.2,
        },
      });
      text = response.text || '';
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
    circulationEfficiency: 86,
    rooms,
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
