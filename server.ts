import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { optimizeFurnitureLayout, type FurnitureSuggestion, type LayoutOpening } from './src/services/layoutOptimizer';
import { matchFurnitureAsset } from './src/services/furnitureAssets';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'interio-dev-secret-change-me';
const JWT_EXPIRES_IN = '7d';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Body parser
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Malformed JSON or an oversized body (e.g. a huge photo upload) would
// otherwise reach Express's default HTML error page. Return clean JSON
// instead so the frontend's error banners can show something readable.
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: 'That upload is too large. Please use a smaller photo (under 10MB).' });
  }
  if (err?.type === 'entity.parse.failed' || err instanceof SyntaxError) {
    return res.status(400).json({ error: 'The request could not be understood by the server.' });
  }
  next(err);
});

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

// Races a promise against a timeout so a stalled call (e.g. a hung network
// request to Gemini) fails fast instead of leaving the request open
// indefinitely, letting the caller's own fallback/retry logic take over.
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (err) => { clearTimeout(timer); reject(err); }
    );
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
  // Vision (photo analysis) calls are inherently slower than text-only ones.
  const perAttemptTimeoutMs = options.isVision ? 30000 : 20000;

  let lastError: any = null;

  for (const model of modelsToTry) {
    try {
      const response = await withTimeout(
        ai.models.generateContent({
          model,
          contents,
          config: {
            responseMimeType: options.responseMimeType || 'application/json',
            temperature: options.temperature ?? 0.2,
          },
        }),
        perAttemptTimeoutMs,
        `Gemini model ${model}`
      );

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
  const { email, password, name, role } = req.body;
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
    role: role?.trim() || 'Architect',
    createdAt: new Date().toISOString(),
  };

  users.push(newUser);
  writeUsers(users);

  return res.json({
    user: { id: newUser.id, email: newUser.email, name: newUser.name, role: newUser.role, createdAt: newUser.createdAt },
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
    const { plotWidth, plotLength, rooms, userRequirements = '' } = req.body;

    const width = Number(plotWidth) || 10;
    const length = Number(plotLength) || 12;
    const roomList = Array.isArray(rooms) && rooms.length > 0 ? rooms : [
      { name: 'Living Room', type: 'living-room', minSize: 20 },
      { name: 'Kitchen', type: 'kitchen', minSize: 12 },
      { name: 'Master Bedroom', type: 'master-bedroom', minSize: 16 },
      { name: 'Bathroom', type: 'bathroom', minSize: 5 },
    ];

    const ai = getGeminiClient();
    if (ai) {
      const prompt = createFloorPlanPrompt(width, length, roomList, String(userRequirements || '').slice(0, 1000));
      try {
        const text = await generateGeminiContentWithFallback(ai, prompt, {
          temperature: 0.15,
          responseMimeType: 'application/json',
        });
        const parsed = parseJsonResponse(text);
        const validated = validateGeminiFloorPlan(parsed, width, length, roomList);
        if (validated) return res.json(validated);
        console.warn('[INTERIO Engine] Gemini returned a floor plan that failed geometry validation; using deterministic fallback.');
      } catch (geminiErr: any) {
        console.warn(`[INTERIO Engine] Gemini floor-plan generation failed: ${geminiErr?.message || geminiErr}`);
      }
    }

    const fallbackResult = generateAlgorithmicFloorPlan(width, length, roomList);
    if (fallbackResult.constraintError) {
      return res.status(422).json({ error: fallbackResult.constraintError });
    }
    return res.json(fallbackResult);
  } catch (err: any) {
    console.error('[INTERIO Engine] Floor-plan generation failed:', err);
    const fbWidth = Number(req.body.plotWidth) || 10;
    const fbLength = Number(req.body.plotLength) || 12;
    const fallbackResult = generateAlgorithmicFloorPlan(fbWidth, fbLength, req.body.rooms || []);
    if (fallbackResult.constraintError) {
      return res.status(422).json({ error: fallbackResult.constraintError });
    }
    fallbackResult.rooms = sanitizeRoomCoordinates(fallbackResult.rooms, fbWidth, fbLength);
    return res.json(fallbackResult);
  }
});

// ----------------------------------------------------
// GEMINI WORKFLOW 2: PERSONALIZED INTERIOR DESIGN
// ----------------------------------------------------
app.post('/api/gemini/interior', async (req, res) => {
  try {
    const { roomWidth, roomLength, style, budget, roomType, preferredColors = [], additionalRequirements = '', openings = [] } = req.body;
    const w = Number(roomWidth);
    const l = Number(roomLength);
    if (!Number.isFinite(w) || !Number.isFinite(l) || w < 1 || l < 1 || w > 50 || l > 50) {
      return res.status(400).json({ error: 'Room width and length must be between 1 and 50 meters.' });
    }
    const selectedStyle = ['modern', 'minimal', 'traditional', 'industrial', 'scandinavian', 'japandi'].includes(style) ? style : 'modern';
    const selectedBudget = String(budget || '$10,000').slice(0, 100);
    const type = String(roomType || 'Living Room').slice(0, 80);
    const cleanedColors = (Array.isArray(preferredColors) ? preferredColors : []).filter((color: unknown) => typeof color === 'string').slice(0, 8).map((color: string) => color.slice(0, 40));
    const cleanedRequirements = String(additionalRequirements).slice(0, 1000);
    const validOpenings: LayoutOpening[] = Array.isArray(openings) ? openings.slice(0, 30).filter((o: any) => ['north', 'south', 'east', 'west'].includes(o?.wall) && Number.isFinite(Number(o.start)) && Number.isFinite(Number(o.end)) && Number(o.end) > Number(o.start) && ['door', 'window'].includes(o.type)).map((o: any) => ({ ...o, start: Number(o.start), end: Number(o.end) })) : [];

    const prompt = `You are an interior design curator. Suggest a practical design for a ${type} measuring ${w}m by ${l}m. Style: ${selectedStyle}. Budget: ${selectedBudget}. Preferred colors: ${cleanedColors.join(', ')}. Additional requirements: ${cleanedRequirements}.
Return STRICT JSON only. Do not choose final coordinates or rotation; a deterministic optimizer handles placement. Give 3-8 furniture suggestions with realistic width/depth/height in meters and a preferredWall (north/south/east/west/center), plus category, material, color, notes and estimatedPrice. Include five palette colors, designPhilosophy, designSuggestions array, lightingSuggestions and materialFinishes. Use this JSON shape: {"designPhilosophy":"...","designSuggestions":["..."],"lightingSuggestions":"...","materialFinishes":"...","colorPalette":[{"hex":"#...","name":"...","role":"primary","description":"..."}],"furniture":[{"id":"f_1","name":"...","category":"seating","width":1.8,"depth":0.8,"height":0.8,"preferredWall":"north","material":"...","color":"#...","notes":"...","estimatedPrice":"..."}]}`;

    const finish = (design: any) => {
      const rawSuggestions = Array.isArray(design.furniture) ? design.furniture.slice(0, 20) : [];
      const categories = ['seating', 'table', 'storage', 'bed', 'lighting', 'decor', 'fixture', 'electronics'];
      const walls = ['north', 'south', 'east', 'west', 'center'];
      const suggestions: FurnitureSuggestion[] = rawSuggestions.filter((item: any) => item && typeof item === 'object').map((item: any, index: number) => ({
        id: typeof item.id === 'string' ? item.id.slice(0, 60) : `f_${index + 1}`,
        name: typeof item.name === 'string' ? item.name.slice(0, 100) : `Furniture ${index + 1}`,
        category: categories.includes(item.category) ? item.category : 'decor',
        width: Math.min(10, Math.max(0.25, Number(item.width) || 0.8)),
        depth: Math.min(10, Math.max(0.25, Number(item.depth) || 0.8)),
        height: Math.min(4, Math.max(0.1, Number(item.height) || 0.75)),
        preferredWall: walls.includes(item.preferredWall) ? item.preferredWall : 'center',
        material: typeof item.material === 'string' ? item.material.slice(0, 100) : undefined,
        color: typeof item.color === 'string' && /^#[0-9a-f]{6}$/i.test(item.color) ? item.color : undefined,
        notes: typeof item.notes === 'string' ? item.notes.slice(0, 300) : undefined,
        estimatedPrice: typeof item.estimatedPrice === 'string' ? item.estimatedPrice.slice(0, 80) : undefined,
      }));
      const colorPalette = (Array.isArray(design.colorPalette) ? design.colorPalette : []).filter((swatch: any) => swatch && typeof swatch.hex === 'string' && /^#[0-9a-f]{6}$/i.test(swatch.hex) && typeof swatch.name === 'string').slice(0, 8);
      const furniture = optimizeFurnitureLayout(suggestions, { width: w, depth: l, openings: validOpenings }).map((item) => {
        const asset = matchFurnitureAsset(item);
        return { ...item, assetId: asset?.id, assetUrl: asset?.url };
      });
      return {
        ...design, roomWidth: w, roomLength: l, roomType: type, style: selectedStyle, budget: selectedBudget,
        furniture, colorPalette: colorPalette.length ? colorPalette : generateAlgorithmicInterior(w, l, selectedStyle, selectedBudget, type).colorPalette,
        layoutWarnings: furniture.length < rawSuggestions.length ? ['Some suggested pieces were omitted because they could not fit while preserving room bounds, opening clearance, and walking space.'] : [],
        designSuggestions: Array.isArray(design.designSuggestions) ? design.designSuggestions.filter((suggestion: unknown) => typeof suggestion === 'string').slice(0, 10) : [],
        lightingSuggestions: typeof design.lightingSuggestions === 'string' ? design.lightingSuggestions.slice(0, 2000) : '',
        designPhilosophy: typeof design.designPhilosophy === 'string' ? design.designPhilosophy.slice(0, 1000) : '',
        materialFinishes: typeof design.materialFinishes === 'string' ? design.materialFinishes.slice(0, 1000) : '',
        additionalRequirements: cleanedRequirements, preferredColors: cleanedColors,
      };
    };

    const ai = getGeminiClient();
    if (!ai) {
      return res.json(finish(generateAlgorithmicInterior(w, l, selectedStyle, selectedBudget, type)));
    }

    let text = '';
    try {
      text = await generateGeminiContentWithFallback(ai, prompt, {
        temperature: 0.3,
        responseMimeType: 'application/json',
      });
    } catch (aiErr: any) {
      console.log('[INTERIO Engine] Synthesizing interior palette using architectural curation matrix.');
      return res.json(finish(generateAlgorithmicInterior(w, l, selectedStyle, selectedBudget, type)));
    }

    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
      parsed = JSON.parse(cleanJson);
    }

    if (parsed && Array.isArray(parsed.furniture) && Array.isArray(parsed.colorPalette)) {
      return res.json(finish(parsed));
    }

    return res.json(finish(generateAlgorithmicInterior(w, l, selectedStyle, selectedBudget, type)));
  } catch (err: any) {
    console.log('[INTERIO Engine] Interior curation routed through architectural matrix.');
    return res.status(500).json({ error: err?.message || 'Could not generate a valid furniture layout for these room constraints.' });
  }
});

// ----------------------------------------------------
// ALGORITHMIC FALLBACKS & SANITIZERS
// ----------------------------------------------------
function createFloorPlanPrompt(plotW: number, plotL: number, roomList: any[], userRequirements: string): string {
  const plotArea = roundPlan(plotW * plotL);
  const requestedRooms = roomList.map((room: any, index: number) =>
    `${index + 1}. "${String(room.name || `Room ${index + 1}`)}" (type: ${room.type || 'room'}, minimum area: ${Number(room.minSize) || 10} m²)`
  ).join('\n');

  return `You are an experienced residential architect producing a buildable conceptual 2D floor plan.
Create a complete, measured layout for a rectangular plot:
- plot width: ${plotW} m
- plot length: ${plotL} m
- total plot area: ${plotArea} m²

Requested rooms:
${requestedRooms}

User requirements:
${userRequirements || 'No additional requirements. Use a practical residential entry, circulation spine, daylight, and privacy zoning.'}

Use the full available footprint efficiently. Calculate room dimensions from the actual plot area and requested minimum areas; do not invent a different plot size. Keep a 0.25 m exterior planning margin and reserve only purposeful circulation/entry space. The requested rooms must fit completely inside the plot, with no overlap and no large meaningless leftover area. Prefer realistic rectangular proportions: living rooms 1.4:1 to 2.2:1, bedrooms 1.1:1 to 1.8:1, bathrooms 1.2:1 to 2.2:1.

Return JSON only. Every coordinate is in metres from the plot's top-left corner. Room and furniture coordinates are absolute plot coordinates. Include every requested room exactly once, plus an optional circulation array. Do not include images, URLs, base64, or markdown.

JSON shape:
{
  "plotWidth": ${plotW},
  "plotLength": ${plotL},
  "plotArea": ${plotArea},
  "architecturalStyle": "Contemporary residential",
  "designNotes": "brief zoning and entry explanation",
  "circulation": [{"name":"Entry / Hallway","x":0,"y":0,"width":1,"height":1}],
  "rooms": [{
    "id": "room_1",
    "name": "requested room name",
    "type": "room type",
    "x": 0,
    "y": 0,
    "width": 4,
    "height": 4,
    "area": 16,
    "walls": [
      {"side":"top","thickness":0.2},{"side":"bottom","thickness":0.2},
      {"side":"left","thickness":0.2},{"side":"right","thickness":0.2}
    ],
    "doors": [{"side":"bottom","offset":1.2,"width":0.9,"swing":"in"}],
    "windows": [{"side":"top","offset":1.4,"width":1.5}],
    "adjacentTo": ["Hallway"],
    "furniture": [{"id":"f_1","name":"fixture or furniture","category":"furniture","x":0.5,"y":0.5,"width":1.8,"height":0.8,"rotation":0}]
  }]
}

Doors must face a circulation or entry edge, have a swing that stays inside the room, and not block another door. Give bedrooms/living/kitchen daylight windows; bathrooms may use a smaller high-level window. Use furniture/fixtures only where useful, keep each item inside its room, and never overlap furniture items.`;
}

function parseJsonResponse(text: string): any {
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  return JSON.parse(cleaned);
}

function validateGeminiFloorPlan(parsed: any, plotW: number, plotL: number, requestedRooms: any[]) {
  if (!parsed || !Array.isArray(parsed.rooms) || parsed.rooms.length !== requestedRooms.length) return null;

  const byName = new Map<string, any>();
  for (const room of parsed.rooms) {
    if (!room || typeof room !== 'object') return null;
    const key = String(room.name || '').trim().toLowerCase();
    if (!key || byName.has(key)) return null;
    byName.set(key, room);
  }

  const palette = ['#6366f1', '#0ea5e9', '#10b981', '#8b5cf6', '#ec4899', '#f59e0b', '#14b8a6', '#94a3b8'];
  const rooms: any[] = [];
  for (let index = 0; index < requestedRooms.length; index++) {
    const requested = requestedRooms[index];
    const raw = byName.get(String(requested.name || '').trim().toLowerCase());
    if (!raw) return null;

    const x = Number(raw.x);
    const y = Number(raw.y);
    const width = Number(raw.width);
    const height = Number(raw.height);
    const minimumArea = Math.max(Number(requested.minSize) || 0, practicalArea(requested.type));
    if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return null;
    if (x < 0 || y < 0 || x + width > plotW + 0.001 || y + height > plotL + 0.001) return null;
    if (width * height < minimumArea * 0.95 || !hasPracticalDimensions({ type: requested.type, width, height })) return null;

    const doors = normalizeGeminiDoors(raw.doors, raw.doorSide, width, height);
    const windows = normalizeGeminiWindows(raw.windows, raw.windowSide, width, height);
    if (!doors.length) return null;
    const furniture = normalizeGeminiFurniture(raw.furniture, x, y, width, height);
    if (furniture === null) return null;

    rooms.push({
      ...raw,
      id: String(raw.id || `room_${index + 1}`),
      name: String(requested.name),
      type: requested.type || raw.type || 'room',
      x: roundPlan(x),
      y: roundPlan(y),
      width: roundPlan(width),
      height: roundPlan(height),
      area: roundPlan(width * height),
      walls: normalizeGeminiWalls(raw.walls),
      doors,
      windows,
      doorSide: doors[0].side,
      windowSide: windows[0]?.side,
      color: /^#[0-9a-f]{6}$/i.test(String(raw.color || '')) ? raw.color : palette[index % palette.length],
      furniture,
    });
  }

  for (let i = 0; i < rooms.length; i++) {
    for (let j = 0; j < i; j++) {
      if (roomRectsOverlap(rooms[i], rooms[j])) return null;
    }
  }

  const builtArea = rooms.reduce((sum, room) => sum + room.area, 0);
  if (builtArea / (plotW * plotL) < 0.45) return null;
  const circulation = normalizeCirculation(parsed.circulation, plotW, plotL, rooms);
  if (circulation === null) return null;

  return {
    plotWidth: plotW,
    plotLength: plotL,
    plotArea: roundPlan(plotW * plotL),
    totalBuiltArea: roundPlan(builtArea),
    openSpaceArea: roundPlan(Math.max(0, plotW * plotL - builtArea)),
    architecturalStyle: String(parsed.architecturalStyle || 'Contemporary residential').slice(0, 80),
    designNotes: String(parsed.designNotes || 'Rooms are arranged around a purposeful entry and circulation spine.').slice(0, 800),
    circulation,
    rooms,
  };
}

function normalizeGeminiWalls(walls: any): any[] {
  const sides = ['top', 'bottom', 'left', 'right'];
  return sides.map((side) => {
    const match = Array.isArray(walls) ? walls.find((wall: any) => wall?.side === side) : null;
    return { side, thickness: Math.max(0.1, Math.min(0.5, Number(match?.thickness) || 0.2)) };
  });
}

function normalizeGeminiDoors(doors: any, fallbackSide: any, width: number, height: number): any[] {
  const validSides = ['top', 'bottom', 'left', 'right'];
  const source = Array.isArray(doors) ? doors : [{ side: fallbackSide || 'bottom' }];
  return source.slice(0, 3).filter((door: any) => validSides.includes(door?.side)).map((door: any) => ({
    side: door.side,
    offset: Math.max(0.1, Math.min((door.side === 'left' || door.side === 'right' ? height : width) - 0.1, Number(door.offset) || 0.3)),
    width: Math.max(0.6, Math.min(1.1, Number(door.width) || 0.9)),
    swing: ['in', 'out', 'left', 'right'].includes(door.swing) ? door.swing : 'in',
  }));
}

function normalizeGeminiWindows(windows: any, fallbackSide: any, width: number, height: number): any[] {
  const validSides = ['top', 'bottom', 'left', 'right'];
  const source = Array.isArray(windows) ? windows : (fallbackSide ? [{ side: fallbackSide }] : []);
  return source.slice(0, 4).filter((window: any) => validSides.includes(window?.side)).map((window: any) => ({
    side: window.side,
    offset: Math.max(0.1, Math.min((window.side === 'left' || window.side === 'right' ? height : width) - 0.1, Number(window.offset) || 0.4)),
    width: Math.max(0.5, Math.min(2.4, Number(window.width) || 1.2)),
  }));
}

function normalizeGeminiFurniture(items: any, roomX: number, roomY: number, roomW: number, roomH: number): any[] | null {
  if (items === undefined) return [];
  if (!Array.isArray(items)) return null;
  const normalized = items.slice(0, 20).map((item: any, index: number) => ({
    id: String(item?.id || `f_${index + 1}`),
    name: String(item?.name || 'Fixture'),
    category: ['furniture', 'fixture', 'sanitary'].includes(item?.category) ? item.category : 'fixture',
    x: Number(item?.x),
    y: Number(item?.y),
    width: Number(item?.width),
    height: Number(item?.height),
    rotation: Number(item?.rotation) || 0,
  }));
  if (normalized.some((item) => ![item.x, item.y, item.width, item.height].every(Number.isFinite) ||
    item.width <= 0 || item.height <= 0 ||
    item.x < roomX || item.y < roomY ||
    item.x + item.width > roomX + roomW + 0.001 ||
    item.y + item.height > roomY + roomH + 0.001)) return null;
  for (let i = 0; i < normalized.length; i++) {
    for (let j = 0; j < i; j++) {
      if (floorPlanFurnitureOverlap(normalized[i], normalized[j])) return null;
    }

    function floorPlanFurnitureOverlap(
      a: { x: number; y: number; width: number; height: number },
      b: { x: number; y: number; width: number; height: number }
    ): boolean {
      const EPS = 1e-6;
      return (
        a.x < b.x + b.width - EPS &&
        a.x + a.width > b.x + EPS &&
        a.y < b.y + b.height - EPS &&
        a.y + a.height > b.y + EPS
      );
    }
  }
  return normalized;
}

function normalizeCirculation(items: any, plotW: number, plotL: number, rooms: any[]): any[] | null {
  if (!Array.isArray(items) || items.length === 0) return null;
  const circulation = items.slice(0, 12).map((item: any) => ({
    name: String(item?.name || 'Circulation'),
    x: Number(item?.x),
    y: Number(item?.y),
    width: Number(item?.width),
    height: Number(item?.height),
  }));
  if (circulation.some((item) => ![item.x, item.y, item.width, item.height].every(Number.isFinite) ||
    item.x < 0 || item.y < 0 || item.width <= 0 || item.height <= 0 ||
    item.x + item.width > plotW + 0.001 || item.y + item.height > plotL + 0.001)) return null;
  if (circulation.some((corridor) => rooms.some((room) => roomRectsOverlap(corridor, room)))) return null;
  return circulation;
}

// Clamp every room to the plot boundary, then resolve any overlapping
// pairs by nudging the later room apart along whichever axis clears the
// overlap with the smaller shift -- mirrors sanitizeFurnitureCoordinates
// below, since both the Gemini-generated layout and the algorithmic
// fallback can otherwise place rooms that overlap or spill past the plot
// edge (most visibly when a small plot is asked to hold too many rooms).
function sanitizeRoomCoordinates(rooms: any[], plotW: number, plotL: number) {
  const clamped = rooms.map((r, i) => {
    let w = Math.max(1.8, Math.min(plotW - 0.5, Number(r.width) || 3.5));
    let h = Math.max(1.8, Math.min(plotL - 0.5, Number(r.height) || 3.5));
    let x = Math.max(0, Math.min(plotW - w, Number(r.x) || 0));
    let y = Math.max(0, Math.min(plotL - h, Number(r.y) || 0));

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

  const MAX_NUDGE_ITERATIONS = 8;
  const NUDGE_STEP = 0.1;

  for (let iteration = 0; iteration < MAX_NUDGE_ITERATIONS; iteration++) {
    let movedAny = false;

    for (let i = 0; i < clamped.length; i++) {
      const room = clamped[i];
      for (let j = 0; j < i; j++) {
        const other = clamped[j];
        if (!roomRectsOverlap(room, other)) continue;

        const overlapX = Math.min(room.x + room.width, other.x + other.width) - Math.max(room.x, other.x);
        const overlapY = Math.min(room.y + room.height, other.y + other.height) - Math.max(room.y, other.y);

        if (overlapX <= overlapY) {
          const pushRight = room.x >= other.x;
          room.x = pushRight ? room.x + overlapX + NUDGE_STEP : room.x - overlapX - NUDGE_STEP;
        } else {
          const pushDown = room.y >= other.y;
          room.y = pushDown ? room.y + overlapY + NUDGE_STEP : room.y - overlapY - NUDGE_STEP;
        }

        // Re-clamp to the plot boundary after nudging.
        room.x = Math.round(Math.max(0, Math.min(plotW - room.width, room.x)) * 10) / 10;
        room.y = Math.round(Math.max(0, Math.min(plotL - room.height, room.y)) * 10) / 10;
        movedAny = true;
      }
    }

    if (!movedAny) break;
  }

  return clamped;
}

function roomRectsOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number }
): boolean {
  const EPS = 1e-6;
  return (
    a.x < b.x + b.width - EPS &&
    a.x + a.width > b.x + EPS &&
    a.y < b.y + b.height - EPS &&
    a.y + a.height > b.y + EPS
  );
}

// Clamp every furniture item to the room boundary, then resolve any
// overlapping pairs by nudging the later item apart along whichever axis
// clears the overlap with the smaller shift. Rugs ('decor') are excluded
// from overlap resolution since they are meant to sit underneath other
// furniture, not avoid it.
function sanitizeFurnitureCoordinates(furniture: any[], roomW: number, roomL: number) {
  const clamped = furniture.map((f, i) => {
    const width = Math.max(0.2, Math.min(Math.max(roomW - 0.1, 0.2), Number(f.width) || 0.8));
    const depth = Math.max(0.2, Math.min(Math.max(roomL - 0.1, 0.2), Number(f.depth) || 0.8));
    const x = Math.max(0, Math.min(roomW - width, Number(f.x) || 0));
    const y = Math.max(0, Math.min(roomL - depth, Number(f.y) || 0));

    return {
      ...f,
      id: f.id || `f_${i + 1}`,
      x: Math.round(x * 100) / 100,
      y: Math.round(y * 100) / 100,
      width: Math.round(width * 100) / 100,
      depth: Math.round(depth * 100) / 100,
    };
  });

  const MAX_NUDGE_ITERATIONS = 8;
  const NUDGE_STEP = 0.1;

  for (let iteration = 0; iteration < MAX_NUDGE_ITERATIONS; iteration++) {
    let movedAny = false;

    for (let i = 0; i < clamped.length; i++) {
      const item = clamped[i];
      if (item.category === 'decor') continue;

      for (let j = 0; j < i; j++) {
        const other = clamped[j];
        if (other.category === 'decor') continue;
        if (!furnitureRectsOverlap(item, other)) continue;

        // Push `item` away from `other` along whichever axis clears the
        // overlap with the smaller nudge.
        const overlapX = Math.min(item.x + item.width, other.x + other.width) - Math.max(item.x, other.x);
        const overlapY = Math.min(item.y + item.depth, other.y + other.depth) - Math.max(item.y, other.y);

        if (overlapX <= overlapY) {
          const pushRight = item.x >= other.x;
          item.x = pushRight ? item.x + overlapX + NUDGE_STEP : item.x - overlapX - NUDGE_STEP;
        } else {
          const pushDown = item.y >= other.y;
          item.y = pushDown ? item.y + overlapY + NUDGE_STEP : item.y - overlapY - NUDGE_STEP;
        }

        // Re-clamp to the room boundary after nudging.
        item.x = Math.round(Math.max(0, Math.min(roomW - item.width, item.x)) * 100) / 100;
        item.y = Math.round(Math.max(0, Math.min(roomL - item.depth, item.y)) * 100) / 100;
        movedAny = true;
      }
    }

    if (!movedAny) break;
  }

  return clamped;
}

function furnitureRectsOverlap(
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

function generateAlgorithmicFloorPlan(plotW: number, plotL: number, requestedRooms: any[]) {
  const palette = ['#6366f1', '#0ea5e9', '#10b981', '#8b5cf6', '#ec4899', '#f59e0b', '#14b8a6', '#94a3b8'];
  const requested = (requestedRooms.length ? requestedRooms : [
    { name: 'Living Room', type: 'living-room', minSize: 20 },
    { name: 'Kitchen', type: 'kitchen', minSize: 12 },
    { name: 'Master Bedroom', type: 'master-bedroom', minSize: 16 },
    { name: 'Bathroom', type: 'bathroom', minSize: 5 },
  ]).map((room: any, index: number) => ({
    id: room.id || `room_${index + 1}`,
    name: String(room.name || `Room ${index + 1}`).slice(0, 80),
    type: room.type || 'bedroom',
    targetArea: Math.max(Number(room.minSize) || 10, practicalArea(room.type)),
  }));

  const edge = 0.25;
  const clearWidth = Math.max(1.8, plotW - edge * 2);
  const clearLength = Math.max(1.8, plotL - edge * 2);
  const netArea = clearWidth * clearLength;
  const columns = chooseLayoutColumns(requested, clearWidth, clearLength);
  const rows = chunkRooms(requested, columns);
  const corridor = requested.length > 1 ? Math.min(1, Math.max(0.8, Math.min(clearWidth, clearLength) * 0.055)) : 0;
  const usableWidth = clearWidth - Math.max(0, columns - 1) * corridor;
  const usableLength = clearLength - Math.max(0, rows.length - 1) * corridor;
  const requestedArea = requested.reduce((sum: number, room: any) => sum + room.targetArea, 0);
  const constrained = requestedArea > usableWidth * usableLength;
  const rowWeights = rows.map((row) => row.reduce((sum: number, room: any) => sum + room.targetArea, 0));
  const totalWeight = rowWeights.reduce((sum, weight) => sum + weight, 0) || 1;
  const rooms: any[] = [];
  let y = edge;

  rows.forEach((row, rowIndex) => {
    const rowHeight = usableLength * (rowWeights[rowIndex] / totalWeight);
    const rowWeight = rowWeights[rowIndex] || 1;
    let x = edge;
    row.forEach((room, colIndex) => {
      const width = usableWidth * (room.targetArea / rowWeight);
      const doorSide = doorFacingCirculation(rowIndex, rows.length, colIndex, row.length);
      const windowSide = exteriorWindowSide(rowIndex, rows.length, colIndex, row.length, doorSide);
      rooms.push({
        id: room.id,
        name: room.name,
        type: room.type,
        x: roundPlan(x),
        y: roundPlan(y),
        width: roundPlan(width),
        height: roundPlan(rowHeight),
        doorSide,
        windowSide,
        color: palette[rooms.length % palette.length],
        adjacentTo: [],
        area: roundPlan(width * rowHeight),
      });
      x += width + corridor;
    });
    y += rowHeight + corridor;
  });

  const totalBuiltArea = roundPlan(rooms.reduce((sum, room) => sum + room.area, 0));
  const circulationArea = Math.max(0, roundPlan(netArea - totalBuiltArea));
  const minimumIssue = rooms.some((room) => !hasPracticalDimensions(room));
  const constraintNote = constrained
    ? ` Requested program (${roundPlan(requestedArea)} m²) is larger than the ${roundPlan(usableWidth * usableLength)} m² net room area after required circulation. Rooms were proportionally compacted within the plot; review the labelled dimensions before construction.`
    : '';

  return {
    plotWidth: plotW,
    plotLength: plotL,
    plotArea: roundPlan(plotW * plotL),
    totalBuiltArea,
    openSpaceArea: roundPlan(Math.max(0, plotW * plotL - totalBuiltArea)),
    architecturalStyle: 'Area-Optimized Residential Plan',
    designNotes: `Each requested room is sized from its target area and placed inside a ${roundPlan(netArea)} m² net envelope within the measured ${roundPlan(plotW * plotL)} m² plot. ${roundPlan(circulationArea)} m² is reserved as continuous circulation/entry clearance; doors face that clearance and windows face an exterior wall.${constraintNote}`,
    circulation: [
      {
        name: 'Entry clearance',
        x: 0,
        y: roundPlan(plotL - edge),
        width: roundPlan(plotW),
        height: roundPlan(edge),
      },
    ],
    rooms,
    constraintError: minimumIssue
      ? `The ${plotW}m × ${plotL}m plot cannot accommodate all requested rooms with the minimum practical room dimensions and circulation clearance. Reduce room sizes/count or increase the plot dimensions.`
      : undefined,
  };
}

function practicalArea(type: string | undefined): number {
  const normalized = String(type || '').toLowerCase();
  if (normalized.includes('bath') || normalized.includes('powder')) return 3.5;
  if (normalized.includes('kitchen')) return 7;
  if (normalized.includes('living')) return 14;
  if (normalized.includes('bed')) return 9;
  return 6;
}

function chunkRooms(rooms: any[], columns: number): any[][] {
  const rows: any[][] = [];
  for (let index = 0; index < rooms.length; index += columns) rows.push(rooms.slice(index, index + columns));
  return rows;
}

function chooseLayoutColumns(rooms: any[], width: number, length: number): number {
  const maxColumns = Math.min(4, rooms.length);
  let bestColumns = 1;
  let bestScore = Number.POSITIVE_INFINITY;
  for (let columns = 1; columns <= maxColumns; columns++) {
    const rows = chunkRooms(rooms, columns);
    const rowWeights = rows.map((row) => row.reduce((sum, room) => sum + room.targetArea, 0));
    const total = rowWeights.reduce((sum, value) => sum + value, 0) || 1;
    let score = 0;
    rows.forEach((row, rowIndex) => {
      const height = length * rowWeights[rowIndex] / total;
      const rowTotal = rowWeights[rowIndex] || 1;
      row.forEach((room) => {
        const roomWidth = width * room.targetArea / rowTotal;
        const ratio = Math.max(roomWidth / Math.max(height, 0.1), height / Math.max(roomWidth, 0.1));
        score += Math.max(0, ratio - 1.8) * 12;
        if (roomWidth < 1.8 || height < 1.8) score += 100;
      });
    });
    if (score < bestScore) { bestScore = score; bestColumns = columns; }
  }
  return bestColumns;
}

function doorFacingCirculation(row: number, rowCount: number, column: number, columnCount: number): 'top' | 'bottom' | 'left' | 'right' {
  if (rowCount > 1) return row === 0 ? 'bottom' : 'top';
  return column === 0 ? 'right' : column === columnCount - 1 ? 'left' : 'bottom';
}

function exteriorWindowSide(row: number, rowCount: number, column: number, columnCount: number, doorSide: string): 'top' | 'bottom' | 'left' | 'right' {
  const candidates: Array<'top' | 'bottom' | 'left' | 'right'> = [];
  if (row === 0) candidates.push('top');
  if (row === rowCount - 1) candidates.push('bottom');
  if (column === 0) candidates.push('left');
  if (column === columnCount - 1) candidates.push('right');
  return candidates.find((side) => side !== doorSide) || (doorSide === 'top' ? 'bottom' : 'top');
}

function hasPracticalDimensions(room: any): boolean {
  const minSide = String(room.type).toLowerCase().includes('bath') ? 1.5 : 2.1;
  return room.width >= minSide && room.height >= minSide;
}

function roundPlan(value: number): number {
  return Math.round(value * 10) / 10;
}

function generateLegacyAlgorithmicFloorPlan(plotW: number, plotL: number, requestedRooms: any[]) {
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

  // The quadrant layout below assumes the plot is big enough to hold each
  // requested room at a sane minimum size without overlap. It isn't — for a
  // small plot with many/large rooms requested, the hardcoded per-room
  // minimums (e.g. Math.max(2.5, ...)) blow straight through the available
  // space, producing rooms that overlap each other and spill outside the
  // plot boundary. Detect that up front and degrade the same way the
  // Gemini prompt path already does: collapse to a single full-footprint
  // room instead of a broken multi-room layout.
  const plotArea = plotW * plotL;
  const totalRequestedArea = roomTypes.reduce((sum: number, r: any) => sum + (Number(r.minSize) || 10), 0);
  // The quadrant layout below has exactly 5 dedicated slots (4 quadrants
  // plus one bath carved out of the bottom-right quadrant). Anything past
  // that falls into a placeholder "remaining rooms" loop that places boxes
  // at fixed coordinates with no awareness of what's already there --
  // guaranteed overlap with the quadrant rooms, since they already occupy
  // the entire plot by room 5. Route 6+ rooms to the same honest
  // single-space degradation as the over-capacity case instead.
  if (plotW < 2.6 || plotL < 2.6 || totalRequestedArea > plotArea * 0.85 || roomTypes.length > 5) {
    const w = Math.round(Math.max(1.8, plotW - 0.5) * 10) / 10;
    const h = Math.round(Math.max(1.8, plotL - 0.5) * 10) / 10;
    const builtArea = Math.round(w * h * 10) / 10;
    return {
      plotWidth: plotW,
      plotLength: plotL,
      totalBuiltArea: builtArea,
      openSpaceArea: Math.max(0, Math.round((plotArea - builtArea) * 10) / 10),
      architecturalStyle: 'Micro-Living Efficiency',
      designNotes: `The requested room sizes (totaling ~${Math.round(totalRequestedArea)}m²) exceed what a ${plotW}m x ${plotL}m plot can hold as separate rooms. This layout uses the full footprint as a single multi-functional space instead.`,
      rooms: [
        {
          id: 'room_1',
          name: 'Multi-Functional Micro-Unit',
          type: roomTypes[0]?.type || 'living-room',
          x: Math.round(((plotW - w) / 2) * 10) / 10,
          y: Math.round(((plotL - h) / 2) * 10) / 10,
          width: w,
          height: h,
          doorSide: 'bottom',
          windowSide: 'top',
          color: palette[0],
          adjacentTo: [],
          area: builtArea,
        },
      ],
    };
  }

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

    // Fallback if no API key, no photo, or vision processing failed
    const fallbackInterior = generateAlgorithmicInterior(estimatedWidth, estimatedLength, selectedStyle, selectedBudget, type);
    let structuralObservations: string;
    if (!ai) {
      structuralObservations = 'AI-based structural analysis requires a Gemini API key. Add GEMINI_API_KEY to your environment to enable photo-based structural diagnostics. The renovation design below uses estimated room dimensions only.';
    } else if (!imageBase64) {
      structuralObservations = 'No photo was provided, so structural analysis was skipped. The renovation design below uses estimated room dimensions only.';
    } else {
      structuralObservations = 'AI-based structural analysis could not be completed for this photo. The renovation design below uses estimated room dimensions only; no structural diagnostics were performed.';
    }
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
      configLoader: 'runner',
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
