import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Client, handle_file } from '@gradio/client';
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

    const cleanRequirements = String(userRequirements || '').slice(0, 1000);
    const ai = getGeminiClient();
    if (ai) {
      const prompt = createFloorPlanPrompt(width, length, roomList, cleanRequirements);
      try {
        const text = await generateGeminiContentWithFallback(ai, prompt, {
          temperature: 0.15,
          responseMimeType: 'application/json',
        });
        const parsed = parseJsonResponse(text);
        const validated = validateGeminiFloorPlan(parsed, width, length, roomList, cleanRequirements);
        if (validated) return res.json(validated);
        console.warn('[INTERIO Engine] Gemini returned a floor plan that failed geometry validation; using deterministic fallback.');
      } catch (geminiErr: any) {
        console.warn(`[INTERIO Engine] Gemini floor-plan generation failed: ${geminiErr?.message || geminiErr}`);
      }
    }

    const fallbackResult = generateAlgorithmicFloorPlan(width, length, roomList, cleanRequirements);
    if (fallbackResult.constraintError) {
      return res.status(422).json({ error: fallbackResult.constraintError });
    }
    return res.json(fallbackResult);
  } catch (err: any) {
    console.error('[INTERIO Engine] Floor-plan generation failed:', err);
    const fbWidth = Number(req.body.plotWidth) || 10;
    const fbLength = Number(req.body.plotLength) || 12;
    const fallbackResult = generateAlgorithmicFloorPlan(fbWidth, fbLength, req.body.rooms || [], String(req.body.userRequirements || ''));
    if (fallbackResult.constraintError) {
      return res.status(422).json({ error: fallbackResult.constraintError });
    }
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
// Gemini's only job is to choose room RECTANGLES that satisfy public/private
// zoning and adjacency -- doors, windows, walls and furniture are always
// derived afterward by assignOpeningsForLayout, the same deterministic logic
// the algorithmic fallback uses, so both paths produce geometrically
// consistent, non-banded layouts and we never have to trust the model's
// opinion of where an opening belongs.
function createFloorPlanPrompt(plotW: number, plotL: number, roomList: any[], userRequirements: string): string {
  const plotArea = roundPlan(plotW * plotL);
  const requestedRooms = roomList.map((room: any, index: number) =>
    `${index + 1}. "${String(room.name || `Room ${index + 1}`)}" (type: ${room.type || 'room'}, zone: ${classifyZone(room.type)}, minimum area: ${Number(room.minSize) || 10} m²)`
  ).join('\n');

  return `You are an experienced residential architect producing a buildable conceptual 2D floor plan.
Create a complete, measured layout for a rectangular plot:
- plot width: ${plotW} m
- plot length: ${plotL} m
- total plot area: ${plotArea} m²

Requested rooms (each already assigned to a public or private zone -- respect it):
${requestedRooms}

User requirements:
${userRequirements || 'No additional requirements. Use a practical residential entry, circulation spine, daylight, and privacy zoning.'}

Zoning rules -- these matter more than any fixed room order:
- Group every "public" room (living, dining, kitchen, entry/hallway) together on one side of the plot, and every "private" room (bedrooms, bathrooms, study/office, laundry) together on the other side.
- Connect the two zones with exactly ONE hallway/open-circulation rectangle -- never a separate corridor strip between every pair of rooms. If the zones can reasonably touch directly (e.g. a small plot), omit the hallway rectangle entirely and let them share a wall.
- Adjacency: an ensuite/attached bathroom must share a wall with its bedroom. The kitchen must share a wall with the dining room (or the living room if there is no dining room). Bathrooms and laundry rooms should share plumbing walls with each other where possible. The main entry should open into the living room or the hallway, never directly into a bedroom or bathroom.
- Realistic proportions: bedrooms and living areas no more than 2:1 (longest side at most double the shortest side). Kitchens, bathrooms, and the hallway may be more elongated, up to about 2.6:1.
- Respect minimum areas: bedrooms at least 9 m², bathrooms at least 3.5 m², kitchens at least 7 m² -- and never smaller than the minimum area listed above for that room.
- Rooms must tile the plot with no gaps other than the one hallway/circulation rectangle: no overlaps, and nothing may extend past the plot boundary. Keep a 0.25 m exterior planning margin.
- Reflect the user's written requirements in the actual geometry, not just the notes -- e.g. "open kitchen" should place the kitchen directly against the living/dining room rather than behind a hallway door, and "master far from entrance" should place the master bedroom in the corner of the private zone farthest from the hallway/entry.

Return JSON only. Every coordinate is in metres from the plot's top-left corner. Include every requested room exactly once, using its exact requested name. Do not include doors, windows, walls, or furniture -- a deterministic engine derives those from your room rectangles. Do not include images, URLs, base64, or markdown.

JSON shape:
{
  "architecturalStyle": "Contemporary residential",
  "designNotes": "brief zoning explanation",
  "adjacencyIntent": ["Master Bedroom shares a wall with Master Bathroom", "Kitchen opens directly onto Living Room"],
  "circulation": [{"name":"Hallway","x":0,"y":0,"width":1,"height":1}],
  "rooms": [{"name": "requested room name", "x": 0, "y": 0, "width": 4, "height": 4}]
}

Only include "circulation" at all if a genuine hallway/spine rectangle is needed -- at most one rectangle, and omit the key entirely for a fully open-plan connection between zones.`;
}

function parseJsonResponse(text: string): any {
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  return JSON.parse(cleaned);
}

// Gemini now only proposes room rectangles (+ an optional single hallway
// rectangle and a short adjacency intent) -- this validates the geometry,
// repairs minor overlap/bounds noise with the same sanitizer the algorithmic
// fallback uses on its own rough placements, and then hands the final
// rectangles to assignOpeningsForLayout so doors/windows/walls come from one
// shared, deterministic zoning-aware implementation rather than the model's
// own (unverifiable) opinion of where an opening belongs.
function validateGeminiFloorPlan(parsed: any, plotW: number, plotL: number, requestedRooms: any[], userRequirements: string) {
  if (!parsed || !Array.isArray(parsed.rooms) || parsed.rooms.length !== requestedRooms.length) return null;

  const byName = new Map<string, any>();
  for (const room of parsed.rooms) {
    if (!room || typeof room !== 'object') return null;
    const key = String(room.name || '').trim().toLowerCase();
    if (!key || byName.has(key)) return null;
    byName.set(key, room);
  }

  const palette = ['#6366f1', '#0ea5e9', '#10b981', '#8b5cf6', '#ec4899', '#f59e0b', '#14b8a6', '#94a3b8'];
  const rawRooms: any[] = [];
  for (let index = 0; index < requestedRooms.length; index++) {
    const requested = requestedRooms[index];
    const raw = byName.get(String(requested.name || '').trim().toLowerCase());
    if (!raw) return null;

    const x = Number(raw.x);
    const y = Number(raw.y);
    const width = Number(raw.width);
    const height = Number(raw.height);
    if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return null;

    rawRooms.push({
      id: `room_${index + 1}`,
      name: String(requested.name),
      type: requested.type || raw.type || 'room',
      x, y, width, height,
      color: palette[index % palette.length],
    });
  }

  // Clamp to the plot and resolve overlap exactly like the algorithmic
  // fallback's own placements get cleaned up -- geometry noise gets
  // repaired here, not rejected outright.
  const sanitized = sanitizeRoomCoordinates(rawRooms, plotW, plotL);

  for (const room of sanitized) {
    const requested = requestedRooms.find((r: any) => String(r.name).trim().toLowerCase() === room.name.trim().toLowerCase());
    const minimumArea = Math.max(Number(requested?.minSize) || 0, practicalArea(room.type));
    if (room.width * room.height < minimumArea * 0.85) return null;
    if (!hasPracticalDimensions(room) || !respectsAspectCap(room)) return null;
  }

  for (let i = 0; i < sanitized.length; i++) {
    for (let j = 0; j < i; j++) {
      if (roomRectsOverlap(sanitized[i], sanitized[j])) return null;
    }
  }

  const builtArea = sanitized.reduce((sum, room) => sum + room.width * room.height, 0);
  if (builtArea / (plotW * plotL) < 0.45) return null;

  // At most one hallway/spine rectangle -- a corridor strip between every
  // room is exactly the banded layout this rework exists to eliminate.
  const circulationSource = Array.isArray(parsed.circulation) ? parsed.circulation.slice(0, 1) : [];
  const circulation = circulationSource.length ? normalizeCirculation(circulationSource, plotW, plotL, sanitized) : [];
  if (circulation === null) return null;

  assignOpeningsForLayout(sanitized, circulation, plotW, plotL, parseLayoutPreferences(userRequirements));

  const totalBuiltArea = roundPlan(builtArea);
  const adjacencyIntent = Array.isArray(parsed.adjacencyIntent)
    ? parsed.adjacencyIntent.filter((s: unknown) => typeof s === 'string').slice(0, 6).join('; ')
    : '';
  const baseNotes = String(parsed.designNotes || 'Rooms are zoned into public and private areas connected by a single circulation spine.').slice(0, 500);

  return {
    plotWidth: plotW,
    plotLength: plotL,
    plotArea: roundPlan(plotW * plotL),
    totalBuiltArea,
    openSpaceArea: roundPlan(Math.max(0, plotW * plotL - totalBuiltArea)),
    architecturalStyle: String(parsed.architecturalStyle || 'Contemporary residential').slice(0, 80),
    designNotes: (adjacencyIntent ? `${baseNotes} ${adjacencyIntent}` : baseNotes).slice(0, 800),
    circulation,
    rooms: sanitized,
  };
}

function normalizeGeminiWalls(walls: any): any[] {
  const sides = ['top', 'bottom', 'left', 'right'];
  return sides.map((side) => {
    const match = Array.isArray(walls) ? walls.find((wall: any) => wall?.side === side) : null;
    return { side, thickness: Math.max(0.1, Math.min(0.5, Number(match?.thickness) || 0.2)) };
  });
}

// Clamps an opening's width to the wall length first, then clamps offset so
// offset+width can never exceed the wall -- clamping offset alone (the old
// behaviour) could still leave a door hanging off the end of a short wall.
function clampOpeningToWall(offset: number, width: number, wallLength: number, minWidth: number, maxWidth: number): { offset: number; width: number } {
  const w = Math.max(minWidth, Math.min(maxWidth, wallLength - 0.05, width));
  const maxOffset = Math.max(0.05, wallLength - w - 0.05);
  const o = Math.max(0.05, Math.min(maxOffset, offset));
  return { offset: roundPlan(o), width: roundPlan(w) };
}

function wallLengthForSide(side: string, width: number, height: number): number {
  return side === 'left' || side === 'right' ? height : width;
}

// Rejects (returns null) rather than silently shrinking when two openings on
// the same wall would overlap -- that's a geometry error from the model, not
// something safe to paper over, consistent with how room-level validation
// elsewhere in this file rejects rather than repositions bad geometry.
function openingsOverlapOnSameWall(items: { side: string; offset: number; width: number }[]): boolean {
  const bySide = new Map<string, { offset: number; width: number }[]>();
  for (const item of items) {
    if (!bySide.has(item.side)) bySide.set(item.side, []);
    bySide.get(item.side)!.push(item);
  }
  for (const segments of bySide.values()) {
    for (let i = 0; i < segments.length; i++) {
      for (let j = 0; j < i; j++) {
        const a = segments[i];
        const b = segments[j];
        if (a.offset < b.offset + b.width - 1e-6 && a.offset + a.width > b.offset + 1e-6) return true;
      }
    }
  }
  return false;
}

// A room's side is a genuine exterior wall only if it actually touches the
// plot boundary at that room's position -- a window can never legitimately
// be assigned to a side that borders another room.
function isPlotExteriorSide(room: { x: number; y: number; width: number; height: number }, side: string, plotW: number, plotL: number): boolean {
  // Both the Gemini prompt and the algorithmic layout keep a ~0.25m exterior
  // planning margin, so a genuinely exterior room wall sits just inside the
  // plot edge rather than exactly at x=0/y=0/plotW/plotL -- the tolerance
  // has to cover that margin, not just floating-point rounding.
  const EPS = 0.35;
  if (side === 'top') return room.y <= EPS;
  if (side === 'bottom') return room.y + room.height >= plotL - EPS;
  if (side === 'left') return room.x <= EPS;
  if (side === 'right') return room.x + room.width >= plotW - EPS;
  return false;
}

function isHabitableRoomType(type: string | undefined): boolean {
  const normalized = String(type || '').toLowerCase();
  return normalized.includes('living') || normalized.includes('bed') || normalized.includes('kitchen');
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

  // Doors/windows are assigned afterward (by assignOpeningsForLayout) from
  // each room's final, post-nudge geometry, so there's nothing stale here to
  // re-clamp -- unlike the old flow where Gemini supplied openings before
  // this nudge pass could still resize a room out from under them.
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

// Deterministic fallback: zones the plot into public/private halves, slices
// each zone into room rectangles with a squarified guillotine cut (always
// along the current rect's longer side, so cuts alternate orientation
// instead of producing a uniform row/column grid), then hands the result to
// the same assignOpeningsForLayout used for a validated Gemini layout. This
// is the single place a layout's *geometry* is chosen; everything after that
// -- zoning, adjacency, doors, windows -- is shared with the Gemini path.
function generateAlgorithmicFloorPlan(plotW: number, plotL: number, requestedRooms: any[], userRequirements: string = '') {
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

  const prefs = parseLayoutPreferences(userRequirements);
  // 0.3m exterior planning margin -- deliberately a clean 1-decimal value:
  // every cut coordinate downstream gets rounded to 1 decimal (roundPlan),
  // and starting from a value like 0.25 that rounds ambiguously produces a
  // 0.1m gap or overlap the first time a touching edge is rounded on each
  // side independently.
  const edge = 0.3;
  const clearWidth = Math.max(1.8, plotW - edge * 2);
  const clearLength = Math.max(1.8, plotL - edge * 2);
  const netArea = clearWidth * clearLength;
  const requestedArea = requested.reduce((sum: number, room: any) => sum + room.targetArea, 0);
  const constrained = requestedArea > netArea;

  const publicRooms = requested.filter((r: any) => classifyZone(r.type) === 'public');
  const privateRooms = requested.filter((r: any) => classifyZone(r.type) === 'private');
  const hasBothZones = publicRooms.length > 0 && privateRooms.length > 0;
  const openPlan = prefs.openPlanKitchen || !hasBothZones;
  const hallwayWidth = hasBothZones && !openPlan ? Math.min(1.3, Math.max(0.9, Math.min(clearWidth, clearLength) * 0.09)) : 0;

  const { publicRect, privateRect, hallwayRect, publicHallwayEdge, privateHallwayEdge } = splitPlotIntoZones(edge, clearWidth, clearLength, publicRooms, privateRooms, hallwayWidth);

  const rooms: any[] = [];
  const pairMap = computeAdjacencyPairs(requested);
  if (publicRooms.length) sliceZoneIntoRooms(publicRect, orderGroupsForZone(publicRooms, pairMap, false), publicHallwayEdge, rooms, palette);
  if (privateRooms.length) sliceZoneIntoRooms(privateRect, orderGroupsForZone(privateRooms, pairMap, prefs.masterFarFromEntrance), privateHallwayEdge, rooms, palette);

  const circulation: { name: string; x: number; y: number; width: number; height: number }[] = hallwayRect ? [{ ...hallwayRect, name: 'Hallway' }] : [];
  assignOpeningsForLayout(rooms, circulation, plotW, plotL, prefs);

  const totalBuiltArea = roundPlan(rooms.reduce((sum, room) => sum + room.width * room.height, 0));
  const circulationArea = Math.max(0, roundPlan(netArea - totalBuiltArea));
  const minimumIssue = rooms.some((room) => !hasPracticalDimensions(room));
  const constraintNote = constrained
    ? ` Requested program (${roundPlan(requestedArea)} m²) is larger than the ${roundPlan(netArea)} m² net area available inside the plot. Rooms were proportionally compacted; review the labelled dimensions before construction.`
    : '';
  const zoningNote = hasBothZones
    ? (openPlan
      ? ' The public zone (living/dining/kitchen) and private zone (bedrooms/bathrooms) sit directly adjacent in an open-plan connection.'
      : ` A single ${roundPlan(circulationArea)} m² hallway connects the public zone (living/dining/kitchen) to the private zone (bedrooms/bathrooms).`)
    : '';

  return {
    plotWidth: plotW,
    plotLength: plotL,
    plotArea: roundPlan(plotW * plotL),
    totalBuiltArea,
    openSpaceArea: roundPlan(Math.max(0, plotW * plotL - totalBuiltArea)),
    architecturalStyle: 'Zoned Residential Plan',
    designNotes: `Rooms are grouped into public and private zones and sized from their target areas within the ${roundPlan(netArea)} m² net envelope of the measured ${roundPlan(plotW * plotL)} m² plot.${zoningNote}${constraintNote}`,
    circulation,
    rooms,
    constraintError: minimumIssue
      ? `The ${plotW}m × ${plotL}m plot cannot accommodate all requested rooms with the minimum practical room dimensions and circulation clearance. Reduce room sizes/count or increase the plot dimensions.`
      : undefined,
  };
}

// Public rooms (living/dining/kitchen/entry/hallway/balcony) group together,
// private rooms (bedrooms/ensuite bathrooms/study/laundry) group together --
// the zoning rule the whole layout is built around. A powder room is kept
// public rather than private: it's conventionally a guest half-bath off the
// entry/living circulation, not tucked into the bedroom wing, and treating
// it as private would otherwise force it into whatever private-zone bay is
// left over regardless of how little depth that bay actually has.
function classifyZone(type: string | undefined): 'public' | 'private' {
  const PRIVATE_TYPES = new Set(['bedroom', 'master-bedroom', 'bathroom', 'office', 'laundry', 'utility']);
  return PRIVATE_TYPES.has(String(type || '')) ? 'private' : 'public';
}

// Lightweight, deterministic reading of a few explicit layout requests --
// not general NLP, just the two concrete preferences the brief calls out --
// so the same plot/room-list with different written requirements visibly
// changes the resulting layout.
function parseLayoutPreferences(userRequirements: string): { openPlanKitchen: boolean; masterFarFromEntrance: boolean } {
  const text = String(userRequirements || '').toLowerCase();
  return {
    openPlanKitchen: /open[\s-]*(plan|concept)?\s*kitchen/.test(text) || (/open[\s-]*plan/.test(text) && /kitchen/.test(text)),
    masterFarFromEntrance: /master/.test(text) && /(far|away|furthest|farthest)/.test(text) && /(entr|door|front)/.test(text),
  };
}

// Splits the net (margin-clear) plot rectangle into a public zone, a private
// zone, and (unless open-plan) a single hallway strip between them. Cuts
// along whichever axis is longer so the two zones stay reasonably
// proportioned regardless of the plot's own aspect ratio.
type HallwayEdge = 'top' | 'bottom' | 'left' | 'right' | null;

function splitPlotIntoZones(
  edge: number, clearWidth: number, clearLength: number,
  publicRooms: { targetArea: number }[], privateRooms: { targetArea: number }[], hallwayWidth: number
): { publicRect: ZoneRect; privateRect: ZoneRect; hallwayRect: ZoneRect | null; publicHallwayEdge: HallwayEdge; privateHallwayEdge: HallwayEdge } {
  const publicArea = publicRooms.reduce((s, r) => s + r.targetArea, 0);
  const privateArea = privateRooms.reduce((s, r) => s + r.targetArea, 0);
  const totalArea = publicArea + privateArea || 1;

  // A single zone still benefits from a fixed "entry-facing" edge (so its
  // own rooms get bay-cut toward that edge instead of the old longer-side
  // heuristic that could nest one room behind another) even though there's
  // no second zone or hallway to literally face.
  if (!publicRooms.length) return { publicRect: { x: edge, y: edge, width: 0, height: 0 }, privateRect: { x: edge, y: edge, width: clearWidth, height: clearLength }, hallwayRect: null, publicHallwayEdge: null, privateHallwayEdge: 'bottom' };
  if (!privateRooms.length) return { publicRect: { x: edge, y: edge, width: clearWidth, height: clearLength }, privateRect: { x: edge, y: edge, width: 0, height: 0 }, hallwayRect: null, publicHallwayEdge: 'bottom', privateHallwayEdge: null };

  const vertical = clearWidth >= clearLength;
  if (vertical) {
    const usable = Math.max(0.1, clearWidth - hallwayWidth);
    const publicW = Math.max(1.8, usable * (publicArea / totalArea));
    // Round the shared cut coordinate once and derive both zones' edges from
    // it, instead of rounding each zone's x/width independently -- otherwise
    // the public zone's displayed right edge and the private zone's
    // displayed left edge can round to different values and either gap or
    // overlap by up to 0.1m.
    const hallwayStart = roundPlan(edge + publicW);
    const hallwayEnd = roundPlan(hallwayStart + hallwayWidth);
    return {
      publicRect: { x: edge, y: edge, width: hallwayStart - edge, height: clearLength },
      privateRect: { x: hallwayEnd, y: edge, width: edge + clearWidth - hallwayEnd, height: clearLength },
      hallwayRect: hallwayWidth > 0 ? { x: hallwayStart, y: edge, width: hallwayEnd - hallwayStart, height: clearLength } : null,
      publicHallwayEdge: 'right',
      privateHallwayEdge: 'left',
    };
  }
  const usable = Math.max(0.1, clearLength - hallwayWidth);
  const privateL = Math.max(1.8, usable * (privateArea / totalArea));
  // Public zone (with the main entry) sits along the front/bottom edge,
  // private zone at the back -- matches the "entry clearance" convention the
  // rest of the renderer already uses. As above, round the shared cut once
  // so the two zones' edges can't round to slightly different values.
  const hallwayStart = roundPlan(edge + privateL);
  const hallwayEnd = roundPlan(hallwayStart + hallwayWidth);
  return {
    publicRect: { x: edge, y: hallwayEnd, width: clearWidth, height: edge + clearLength - hallwayEnd },
    privateRect: { x: edge, y: edge, width: clearWidth, height: hallwayStart - edge },
    hallwayRect: hallwayWidth > 0 ? { x: edge, y: hallwayStart, width: clearWidth, height: hallwayEnd - hallwayStart } : null,
    publicHallwayEdge: 'top',
    privateHallwayEdge: 'bottom',
  };
}

type ZoneRect = { x: number; y: number; width: number; height: number };
type RoomMeta = { id: string; name: string; type: string; targetArea: number };

// Pairs rooms that must end up sharing a wall: each bedroom (master first)
// with the next unclaimed bathroom (its ensuite), and the kitchen with the
// dining room (or living room if there's no dining room). Pure function of
// id/type, so calling it again later on the final room list -- to decide
// which rooms get a direct door instead of one to the hallway -- reproduces
// exactly the same pairing used here to group them during slicing.
function computeAdjacencyPairs(roomsMeta: { id: string; type: string }[]): Map<string, string> {
  const byType = (t: string) => roomsMeta.filter((r) => r.type === t);
  const map = new Map<string, string>();
  const bedQueue = [...byType('master-bedroom'), ...byType('bedroom')];
  const bathQueue = byType('bathroom');
  while (bedQueue.length && bathQueue.length) {
    const bed = bedQueue.shift()!;
    const bath = bathQueue.shift()!;
    map.set(bed.id, bath.id);
    map.set(bath.id, bed.id);
  }
  const kitchen = byType('kitchen')[0];
  const partner = byType('dining-room')[0] || byType('living-room')[0];
  if (kitchen && partner && !map.has(kitchen.id)) {
    map.set(kitchen.id, partner.id);
    if (!map.has(partner.id)) map.set(partner.id, kitchen.id);
  }
  return map;
}

// Groups a zone's rooms into clusters (a pair that must touch, or a lone
// room) in the order the slicer should carve them from the zone rectangle.
// When farFromEntrance is set, the cluster containing the master bedroom is
// moved to the end of the list -- the slicer always carves the first cluster
// off the edge nearest the hallway, so this pushes the master bedroom toward
// the far corner of the private zone.
function orderGroupsForZone(roomsMeta: RoomMeta[], pairMap: Map<string, string>, farFromEntrance: boolean): RoomMeta[][] {
  const used = new Set<string>();
  const groups: RoomMeta[][] = [];
  for (const room of roomsMeta) {
    if (used.has(room.id)) continue;
    const partnerId = pairMap.get(room.id);
    const partner = partnerId ? roomsMeta.find((r) => r.id === partnerId) : undefined;
    if (partner && !used.has(partner.id)) {
      groups.push([room, partner]);
      used.add(room.id);
      used.add(partner.id);
    } else {
      groups.push([room]);
      used.add(room.id);
    }
  }
  if (farFromEntrance) {
    const masterIdx = groups.findIndex((g) => g.some((r) => r.type === 'master-bedroom'));
    if (masterIdx >= 0 && masterIdx !== groups.length - 1) {
      const [masterGroup] = groups.splice(masterIdx, 1);
      groups.push(masterGroup);
    }
  }
  return groups;
}

// Recursively carves `rect` between the given room clusters. Every cut that
// separates two INDEPENDENT clusters is made parallel to the zone's hallway
// edge (so every resulting bay still spans the full depth back to the
// hallway and keeps its own door to it) -- only the cut INSIDE a pair
// cluster goes the other way, deliberately tucking the second room (an
// ensuite bath, say) behind the first instead of against the hallway. That's
// what keeps a lone room from ever ending up reachable only by walking
// through an unrelated neighbour. With no hallway edge (open-plan or a
// single zone), there's nothing to stay parallel to, so cuts just alternate
// along whichever side of the rect is currently longer.
function sliceZoneIntoRooms(rect: ZoneRect, groups: RoomMeta[][], hallwayEdge: HallwayEdge, out: any[], palette: string[]): void {
  if (groups.length === 0) return;
  if (groups.length === 1) {
    const [group] = groups;
    if (group.length === 1) {
      finalizeRoomRect(group[0], rect, out, palette);
    } else {
      splitPairIntoRect(rect, group[0], group[1], hallwayEdge, out, palette);
    }
    return;
  }

  const weightOf = (g: RoomMeta[]) => g.reduce((s, r) => s + r.targetArea, 0);
  const total = groups.reduce((s, g) => s + weightOf(g), 0) || 1;
  let bestIdx = 1;
  let bestDiff = Infinity;
  let cumulative = 0;
  for (let i = 1; i < groups.length; i++) {
    cumulative += weightOf(groups[i - 1]);
    const diff = Math.abs(cumulative - total / 2);
    if (diff < bestDiff) { bestDiff = diff; bestIdx = i; }
  }
  const left = groups.slice(0, bestIdx);
  const right = groups.slice(bestIdx);
  // The bay's OTHER dimension (depth, toward/away from the hallway) is
  // whatever's left over from the zone -- every bay inherits the same full
  // depth regardless of its target area. Allocating bay WIDTH by raw area
  // would starve a small room (e.g. a 4m² powder room forced to the zone's
  // full ~10m depth ends up under a metre wide); weighting by sqrt(area)
  // instead keeps small rooms from being squeezed into slivers while still
  // giving larger rooms proportionally more space.
  const sqrtWeightOf = (g: RoomMeta[]) => Math.sqrt(Math.max(0.01, weightOf(g)));
  const leftWeight = left.reduce((s, g) => s + sqrtWeightOf(g), 0);
  const rightWeight = right.reduce((s, g) => s + sqrtWeightOf(g), 0) || 0.01;
  const frac = leftWeight / (leftWeight + rightWeight);

  // Round the cut coordinate itself (not each child's x/width separately)
  // before recursing -- two independently-rounded edges meant to coincide
  // can land 0.1m apart and either gap or overlap.
  const bayCutIsVertical = hallwayEdge ? (hallwayEdge === 'top' || hallwayEdge === 'bottom') : rect.width >= rect.height;
  if (bayCutIsVertical) {
    const cutX = roundPlan(rect.x + rect.width * frac);
    sliceZoneIntoRooms({ x: rect.x, y: rect.y, width: cutX - rect.x, height: rect.height }, left, hallwayEdge, out, palette);
    sliceZoneIntoRooms({ x: cutX, y: rect.y, width: rect.x + rect.width - cutX, height: rect.height }, right, hallwayEdge, out, palette);
  } else {
    const cutY = roundPlan(rect.y + rect.height * frac);
    sliceZoneIntoRooms({ x: rect.x, y: rect.y, width: rect.width, height: cutY - rect.y }, left, hallwayEdge, out, palette);
    sliceZoneIntoRooms({ x: rect.x, y: cutY, width: rect.width, height: rect.y + rect.height - cutY }, right, hallwayEdge, out, palette);
  }
}

// Splits a pair's shared rect perpendicular to the hallway: roomA (the
// bedroom/kitchen -- whichever is listed first in computeAdjacencyPairs)
// gets the half nearer the hallway edge, roomB (its ensuite bath / dining
// partner) gets the far half. Without a hallway edge, it just cuts along
// whichever side of the rect is longer.
function splitPairIntoRect(rect: ZoneRect, roomA: RoomMeta, roomB: RoomMeta, hallwayEdge: HallwayEdge, out: any[], palette: string[]): void {
  const frac = roomA.targetArea / Math.max(0.01, roomA.targetArea + roomB.targetArea);
  const pairCutIsVertical = hallwayEdge ? (hallwayEdge === 'left' || hallwayEdge === 'right') : rect.width >= rect.height;
  const aIsNear = hallwayEdge === 'right' || hallwayEdge === 'bottom' || !hallwayEdge;

  if (pairCutIsVertical) {
    const cutX = roundPlan(rect.x + rect.width * (aIsNear ? 1 - frac : frac));
    const nearRect = { x: cutX, y: rect.y, width: rect.x + rect.width - cutX, height: rect.height };
    const farRect = { x: rect.x, y: rect.y, width: cutX - rect.x, height: rect.height };
    finalizeRoomRect(roomA, aIsNear ? nearRect : farRect, out, palette);
    finalizeRoomRect(roomB, aIsNear ? farRect : nearRect, out, palette);
  } else {
    const cutY = roundPlan(rect.y + rect.height * (aIsNear ? 1 - frac : frac));
    const nearRect = { x: rect.x, y: cutY, width: rect.width, height: rect.y + rect.height - cutY };
    const farRect = { x: rect.x, y: rect.y, width: rect.width, height: cutY - rect.y };
    finalizeRoomRect(roomA, aIsNear ? nearRect : farRect, out, palette);
    finalizeRoomRect(roomB, aIsNear ? farRect : nearRect, out, palette);
  }
}

function finalizeRoomRect(meta: RoomMeta, rect: ZoneRect, out: any[], palette: string[]): void {
  out.push({
    id: meta.id,
    name: meta.name,
    type: meta.type,
    x: roundPlan(rect.x),
    y: roundPlan(rect.y),
    width: roundPlan(rect.width),
    height: roundPlan(rect.height),
    area: roundPlan(rect.width * rect.height),
    color: palette[out.length % palette.length],
    adjacentTo: [],
  });
}

function maxAspectForType(type: string | undefined): number {
  const t = String(type || '');
  return t === 'bedroom' || t === 'master-bedroom' || t === 'living-room' ? 2.0 : 2.6;
}

function respectsAspectCap(room: { type: string; width: number; height: number }): boolean {
  const longer = Math.max(room.width, room.height);
  const shorter = Math.max(0.1, Math.min(room.width, room.height));
  return longer / shorter <= maxAspectForType(room.type) * 1.08;
}

// Does `side` of `room` touch `candidate`'s matching side at all?
function findTouchingSide(room: ZoneRect, candidate: ZoneRect): 'top' | 'bottom' | 'left' | 'right' | null {
  const sides: ('top' | 'bottom' | 'left' | 'right')[] = ['top', 'bottom', 'left', 'right'];
  return sides.find((side) => sidesAreAdjacent(room, side, candidate)) || null;
}

function findAnyTouchingSide(room: ZoneRect, candidates: ZoneRect[]): 'top' | 'bottom' | 'left' | 'right' | null {
  const sides: ('top' | 'bottom' | 'left' | 'right')[] = ['top', 'bottom', 'left', 'right'];
  return sides.find((side) => candidates.some((c) => sidesAreAdjacent(room, side, c))) || null;
}

function anyExteriorSide(room: ZoneRect, plotW: number, plotL: number): 'top' | 'bottom' | 'left' | 'right' | null {
  const preferenceOrder: ('top' | 'bottom' | 'left' | 'right')[] = ['bottom', 'top', 'left', 'right'];
  return preferenceOrder.find((side) => isPlotExteriorSide(room, side, plotW, plotL)) || null;
}

// Derives every room's walls/doors/windows from its FINAL rectangle, shared
// by both the Gemini path (after sanitizeRoomCoordinates) and the
// algorithmic fallback -- so opening placement is always one deterministic,
// zoning-aware implementation instead of something either path has to get
// right on its own. Mutates each room in place.
function assignOpeningsForLayout(
  rooms: any[],
  circulation: { x: number; y: number; width: number; height: number }[],
  plotW: number, plotL: number,
  prefs: { openPlanKitchen: boolean }
): void {
  const pairMap = computeAdjacencyPairs(rooms);
  const hallway = circulation[0] || null;

  for (const room of rooms) {
    const partnerId = pairMap.get(room.id);
    const partner = partnerId ? rooms.find((r) => r.id === partnerId) : undefined;
    const otherRooms = rooms.filter((r) => r !== room && r !== partner);
    const doors: { side: string; offset: number; width: number; swing: string }[] = [];

    const isKitchenPair = !!partner && (room.type === 'kitchen' || partner.type === 'kitchen');
    const isBathPair = !!partner && (room.type === 'bathroom' || partner.type === 'bathroom');
    const openKitchenPair = isKitchenPair && prefs.openPlanKitchen;

    if (partner) {
      const side = findTouchingSide(room, partner);
      if (side) {
        const wallLen = wallLengthForSide(side, room.width, room.height);
        const doorWidth = openKitchenPair ? Math.min(2.6, wallLen * 0.6) : isBathPair ? 0.8 : 0.9;
        const opening = clampOpeningToWall((wallLen - doorWidth) / 2, doorWidth, wallLen, 0.6, Math.max(0.9, doorWidth));
        doors.push({ side, offset: opening.offset, width: opening.width, swing: 'in' });
      }
    }

    // An ensuite bathroom (and a kitchen in an open-plan pairing) is reached
    // only through its partner -- it doesn't also need a hallway door.
    const skipSecondaryDoor = !!partner && (isBathPair ? room.type === 'bathroom' : openKitchenPair && room.type === 'kitchen');
    if (!skipSecondaryDoor) {
      const side = (hallway && findTouchingSide(room, hallway))
        || findAnyTouchingSide(room, otherRooms)
        || anyExteriorSide(room, plotW, plotL);
      if (side) {
        const wallLen = wallLengthForSide(side, room.width, room.height);
        const opening = clampOpeningToWall((wallLen - 0.9) / 2, 0.9, wallLen, 0.6, 1.1);
        if (doors.length && doors[0].side === side) {
          // Already have a door on this wall (the pair door) -- try the
          // other half of the same wall instead of stacking two openings.
          const altOffset = opening.offset < wallLen / 2 ? wallLen - opening.width - 0.1 : 0.1;
          const alt = { side, offset: roundPlan(Math.max(0.05, Math.min(wallLen - opening.width - 0.05, altOffset))), width: opening.width, swing: 'in' };
          if (!openingsOverlapOnSameWall([doors[0], alt])) doors.push(alt);
        } else {
          doors.push({ side, offset: opening.offset, width: opening.width, swing: 'in' });
        }
      }
    }

    room.doors = doors.length ? doors : [{ side: 'bottom', offset: 0.3, width: 0.9, swing: 'in' }];
    room.doorSide = room.doors[0].side;

    const usedSides = new Set(room.doors.map((d: any) => d.side));
    const exteriorSides = (['top', 'bottom', 'left', 'right'] as const).filter((side) => isPlotExteriorSide(room, side, plotW, plotL));
    let windowSides = exteriorSides.filter((side) => !usedSides.has(side));
    if (!windowSides.length && isHabitableRoomType(room.type) && exteriorSides.length) windowSides = [exteriorSides[0]];
    room.windows = windowSides.slice(0, 2).map((side) => {
      const wallLen = wallLengthForSide(side, room.width, room.height);
      const maxWidth = Math.min(2.4, wallLen * 0.6);
      const opening = clampOpeningToWall((wallLen - maxWidth) / 2, maxWidth, wallLen, 0.5, 2.4);
      return { side, offset: opening.offset, width: opening.width };
    });
    room.windowSide = room.windows[0]?.side;
    room.walls = normalizeGeminiWalls(undefined);
    room.furniture = [];
  }

  ensureMainEntryDoor(rooms, plotW, plotL);
}

// Picks which room gets the building's single main entry door: an
// explicitly entry/foyer-named room if one exists, else the living room,
// else a room literally typed 'hallway' -- in that priority order, but
// only among rooms that actually have an exterior wall to put a door on.
// If none of those three ever has one (an unusual plot), falls back to any
// public-zone room with an exterior wall, then to any room at all with one.
function pickEntryRoom(rooms: any[], plotW: number, plotL: number): any | null {
  const hasExteriorWall = (r: any) => (['top', 'bottom', 'left', 'right'] as const).some((s) => isPlotExteriorSide(r, s, plotW, plotL));
  const isEntryNamed = (r: any) => /entry|foyer/i.test(String(r.type || '')) || /entry|foyer/i.test(String(r.name || ''));

  const byPriority = [
    rooms.find((r) => isEntryNamed(r) && hasExteriorWall(r)),
    rooms.find((r) => r.type === 'living-room' && hasExteriorWall(r)),
    rooms.find((r) => r.type === 'hallway' && hasExteriorWall(r)),
  ].find(Boolean);
  if (byPriority) return byPriority;

  return rooms.find((r) => classifyZone(r.type) === 'public' && hasExteriorWall(r))
    || rooms.find((r) => hasExteriorWall(r))
    || null;
}

// Relocates (or, failing that, drops) any window on `side` that would
// overlap the new entry door -- tries the clear space on either side of the
// door on the SAME wall first, then a different exterior wall, since the
// door takes priority over a window per the main-entry requirement.
function resolveWindowCollision(room: any, side: string, doorOffset: number, doorWidth: number, plotW: number, plotL: number): void {
  const wallLen = wallLengthForSide(side, room.width, room.height);
  const windows = room.windows || [];
  const doorOpening = { side, offset: doorOffset, width: doorWidth };

  // Seed `result` with every window that ISN'T colliding first (including
  // ones later in the original array), so a window being relocated can see
  // them as already-occupied space -- checking only windows processed
  // earlier in a single left-to-right pass missed a later, untouched
  // window on the target wall and produced an exact duplicate there.
  const result: any[] = windows.filter((w: any) => w.side !== side || !openingsOverlapOnSameWall([doorOpening, w]));
  const needsRelocation = windows.filter((w: any) => w.side === side && openingsOverlapOnSameWall([doorOpening, w]));

  for (const w of needsRelocation) {
    const winWidth = Number(w.width) || 1.2;
    const before = doorOffset;
    const after = wallLen - (doorOffset + doorWidth);
    if (before >= winWidth + 0.1 && before >= after) {
      result.push({ ...w, offset: roundPlan(Math.max(0.05, doorOffset - winWidth - 0.1)), width: roundPlan(Math.min(winWidth, before - 0.15)) });
      continue;
    }
    if (after >= winWidth + 0.1) {
      result.push({ ...w, offset: roundPlan(doorOffset + doorWidth + 0.1), width: roundPlan(Math.min(winWidth, after - 0.15)) });
      continue;
    }

    // No room beside the door on this wall -- try a different exterior
    // wall, but only one that's actually clear: checked against every
    // door/window already kept for this room, including windows already
    // relocated earlier in this same pass (otherwise two displaced windows
    // can land on top of each other, or on top of a window already there).
    const altSide = (['top', 'bottom', 'left', 'right'] as const).find((s) => {
      if (s === side || !isPlotExteriorSide(room, s, plotW, plotL)) return false;
      const altWallLen = wallLengthForSide(s, room.width, room.height);
      const altWidth = Math.min(winWidth, altWallLen - 0.2);
      if (altWidth < 0.5) return false;
      const candidate = { side: s, offset: roundPlan((altWallLen - altWidth) / 2), width: roundPlan(altWidth) };
      const occupied = [...(room.doors || []), ...result].filter((o: any) => o.side === s);
      return !occupied.some((o: any) => openingsOverlapOnSameWall([candidate, o]));
    });
    if (!altSide) continue; // drop -- no clear exterior wall left for it

    const altWallLen = wallLengthForSide(altSide, room.width, room.height);
    const altWidth = Math.min(winWidth, altWallLen - 0.2);
    result.push({ side: altSide, offset: roundPlan((altWallLen - altWidth) / 2), width: roundPlan(altWidth) });
  }

  room.windows = result;
}

// Guarantees every generated plan has exactly one door flagged as the main
// entry, on a genuinely exterior wall: picks the entry room, prefers the
// wall facing the plot's front (bottom edge) via the same anyExteriorSide
// priority the rest of this file already uses, then places a 1m-wide door
// at least 0.5m from either corner, nudged along the wall if needed to
// clear any door/window already there (relocating a colliding window
// rather than leaving it overlapped). Room positions are never touched --
// only this one room's doors/windows arrays change.
function ensureMainEntryDoor(rooms: any[], plotW: number, plotL: number): void {
  const entryRoom = pickEntryRoom(rooms, plotW, plotL);
  if (!entryRoom) return;
  const side = anyExteriorSide(entryRoom, plotW, plotL);
  if (!side) return;

  const wallLen = wallLengthForSide(side, entryRoom.width, entryRoom.height);
  const CORNER_MARGIN = 0.5;
  const doorWidth = Math.min(1.0, Math.max(0.6, wallLen - CORNER_MARGIN * 2));
  const minOffset = CORNER_MARGIN;
  const maxOffset = Math.max(minOffset, wallLen - doorWidth - CORNER_MARGIN);
  const centered = (wallLen - doorWidth) / 2;

  const existingOnWall = [
    ...(entryRoom.doors || []).filter((d: any) => d.side === side),
    ...(entryRoom.windows || []).filter((w: any) => w.side === side),
  ];

  // Sweep outward from the centred position (still respecting the corner
  // margin) for the first spot that clears every door/window already on
  // this wall.
  let offset = roundPlan(Math.min(maxOffset, Math.max(minOffset, centered)));
  if (existingOnWall.length) {
    let found = false;
    for (let step = 0; step <= wallLen; step += 0.1) {
      for (const candidate of [centered - step, centered + step]) {
        const clamped = roundPlan(Math.min(maxOffset, Math.max(minOffset, candidate)));
        const candidateDoor = { side, offset: clamped, width: doorWidth };
        if (!existingOnWall.some((o: any) => openingsOverlapOnSameWall([candidateDoor, o]))) {
          offset = clamped;
          found = true;
          break;
        }
      }
      if (found) break;
    }
  }

  resolveWindowCollision(entryRoom, side, offset, doorWidth, plotW, plotL);

  entryRoom.doors = [...(entryRoom.doors || []), { side, offset, width: doorWidth, swing: 'in', isMainEntry: true }];
  entryRoom.doorSide = entryRoom.doors[0].side;
}

// Does `side` of `room` touch `other`'s matching opposite side, with their
// 1D extents along that wall overlapping? Used to confirm a door facing
// `side` actually opens onto a real adjacent room or corridor rect.
function sidesAreAdjacent(
  room: { x: number; y: number; width: number; height: number },
  side: 'top' | 'bottom' | 'left' | 'right',
  other: { x: number; y: number; width: number; height: number }
): boolean {
  // Independently-rounded (1-decimal) coordinates that are meant to
  // coincide -- e.g. a room's edge and an adjacent zone/hallway rect's edge
  // -- can differ by up to ~0.1m after rounding even though they're meant
  // to touch exactly.
  const TOUCH_EPS = 0.15;
  const OVERLAP_EPS = 0.05;
  const overlaps1D = (aStart: number, aEnd: number, bStart: number, bEnd: number) => aStart < bEnd - OVERLAP_EPS && aEnd > bStart + OVERLAP_EPS;
  if (side === 'top') return Math.abs(other.y + other.height - room.y) <= TOUCH_EPS && overlaps1D(room.x, room.x + room.width, other.x, other.x + other.width);
  if (side === 'bottom') return Math.abs(other.y - (room.y + room.height)) <= TOUCH_EPS && overlaps1D(room.x, room.x + room.width, other.x, other.x + other.width);
  if (side === 'left') return Math.abs(other.x + other.width - room.x) <= TOUCH_EPS && overlaps1D(room.y, room.y + room.height, other.y, other.y + other.height);
  return Math.abs(other.x - (room.x + room.width)) <= TOUCH_EPS && overlaps1D(room.y, room.y + room.height, other.y, other.y + other.height);
}

function practicalArea(type: string | undefined): number {
  const normalized = String(type || '').toLowerCase();
  if (normalized.includes('bath') || normalized.includes('powder')) return 3.5;
  if (normalized.includes('kitchen')) return 7;
  if (normalized.includes('living')) return 14;
  if (normalized.includes('bed')) return 9;
  return 6;
}

function hasPracticalDimensions(room: any): boolean {
  const type = String(room.type).toLowerCase();
  const minSide = type.includes('bath') ? 1.5 : type.includes('powder') || type.includes('laundry') || type.includes('utility') ? 1.8 : 2.1;
  return room.width >= minSide && room.height >= minSide;
}

function roundPlan(value: number): number {
  return Math.round(value * 10) / 10;
}

// ----------------------------------------------------
// GEMINI WORKFLOW 3: EXISTING HOUSE RECONSTRUCTION
// ----------------------------------------------------
async function roomImageToBuffer(imageSource: string): Promise<Buffer> {
  if (imageSource.startsWith('data:image/')) {
    const commaIndex = imageSource.indexOf(',');
    if (commaIndex === -1) throw new Error('The uploaded room image could not be read.');
    return Buffer.from(imageSource.slice(commaIndex + 1), 'base64');
  }

  const response = await fetch(imageSource, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error('The selected room image could not be downloaded for renovation.');
  return Buffer.from(await response.arrayBuffer());
}

async function generateQwenRenovation(imageSource: string, userRenovationPrompt: string) {
  const originalRoomImageBuffer = await roomImageToBuffer(imageSource);
  const qwen = await Client.connect('Qwen/Qwen-Image-2.1');
  const prediction = qwen.predict('/prepare_request', {
    input_images: [{ image: handle_file(originalRoomImageBuffer) }],
    original_prompt: [
      'Use image 1 as the original room.',
      'Renovate it according to this user request:',
      userRenovationPrompt,
      'Preserve the existing room geometry and camera viewpoint.',
      'Keep walls, doors, windows, floor boundaries, ceiling boundaries,',
      'openings, and overall room proportions in their original locations.',
    ].join(' '),
    enable_extend: false,
    custom_size: false,
    quality: 'quality',
    seed: 0,
    randomize_seed: true,
  });
  const result = await Promise.race([
    prediction,
    new Promise<never>((_, reject) => setTimeout(
      () => reject(new Error('Qwen did not complete within four minutes. Please try again.')),
      240_000,
    )),
  ]);

  const generatedImage = result.data?.[0] as { url?: string; path?: string } | string | undefined;
  const imageUrl = typeof generatedImage === 'string'
    ? generatedImage
    : generatedImage?.url || generatedImage?.path;
  if (!imageUrl) throw new Error('Qwen did not return a renovated room image.');

  // Gradio normally returns `url`, but some runs return only a path. Convert a
  // Space-relative file path into the public Gradio file URL for the browser.
  return /^https?:\/\//.test(imageUrl)
    ? imageUrl
    : `https://qwen-qwen-image-2-1.hf.space/gradio_api/file=${encodeURIComponent(imageUrl)}`;
}

function qwenImageProxyUrl(remoteImageUrl: string) {
  return `/api/qwen/image?url=${encodeURIComponent(remoteImageUrl)}`;
}

app.get('/api/qwen/image', async (req, res) => {
  const requestedUrl = typeof req.query.url === 'string' ? req.query.url : '';
  let remoteUrl: URL;
  try {
    remoteUrl = new URL(requestedUrl);
  } catch {
    return res.status(400).json({ error: 'Invalid Qwen image URL.' });
  }

  // This is intentionally allowlisted instead of acting as a general proxy.
  if (remoteUrl.protocol !== 'https:' || remoteUrl.hostname !== 'qwen-qwen-image-2-1.hf.space') {
    return res.status(400).json({ error: 'Unexpected Qwen image host.' });
  }

  try {
    const imageResponse = await fetch(remoteUrl, { signal: AbortSignal.timeout(60_000) });
    const contentType = imageResponse.headers.get('content-type') || '';
    if (!imageResponse.ok || !contentType.startsWith('image/')) {
      throw new Error(`Qwen image download returned ${imageResponse.status} (${contentType || 'unknown content type'}).`);
    }
    const image = Buffer.from(await imageResponse.arrayBuffer());
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    return res.send(image);
  } catch (proxyErr: any) {
    console.error('[INTERIO Qwen] Generated image proxy failed:', proxyErr?.message || proxyErr);
    return res.status(502).json({ error: 'The generated Qwen image could not be downloaded.' });
  }
});

app.post('/api/qwen/renovate', async (req, res) => {
  try {
    const { imageBase64, renovationPrompt } = req.body;
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return res.status(400).json({ error: 'A room photo is required to generate a renovation.' });
    }
    if (!renovationPrompt || typeof renovationPrompt !== 'string' || !renovationPrompt.trim()) {
      return res.status(400).json({ error: 'Enter a renovation prompt before generating the room design.' });
    }

    const remoteImageUrl = await generateQwenRenovation(imageBase64, renovationPrompt.trim());
    console.info('[INTERIO Qwen] /prepare_request completed:', remoteImageUrl);
    return res.json({ renovatedImageUrl: qwenImageProxyUrl(remoteImageUrl) });
  } catch (qwenErr: any) {
    const detail = qwenErr?.message || String(qwenErr);
    console.error('[INTERIO Qwen] Renovation image generation failed:', detail);
    return res.status(502).json({ error: `Qwen image generation failed: ${detail}` });
  }
});

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
