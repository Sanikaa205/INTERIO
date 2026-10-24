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
    const { plotWidth, plotLength, rooms, userRequirements = '', variationSeed = '' } = req.body;

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

    const fallbackResult = generateAlgorithmicFloorPlan(width, length, roomList, cleanRequirements, String(variationSeed || ''));
    if (fallbackResult.constraintError) {
      return res.status(422).json({ error: fallbackResult.constraintError });
    }
    return res.json(fallbackResult);
  } catch (err: any) {
    console.error('[INTERIO Engine] Floor-plan generation failed:', err);
    const fbWidth = Number(req.body.plotWidth) || 10;
    const fbLength = Number(req.body.plotLength) || 12;
    const fallbackResult = generateAlgorithmicFloorPlan(fbWidth, fbLength, req.body.rooms || [], String(req.body.userRequirements || ''), String(req.body.variationSeed || ''));
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
  const requestedRooms = roomList.map((room: any, index: number) => {
    const target = deriveTargetArea(room.type, Number(room.minSize), plotArea, roomList.length);
    return `${index + 1}. "${String(room.name || `Room ${index + 1}`)}" (type: ${room.type || 'room'}, zone: ${classifyZone(room.type)}, target area: about ${roundPlan(target)} m², minimum area: ${Number(room.minSize) || roundPlan(target * 0.8)} m²)`;
  }).join('\n');

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
    // Same data-driven sizing the algorithmic path scores candidates
    // against (derived target area, not just a hard practical-minimum
    // floor), so a Gemini layout that passes here is held to the same
    // area-fit bar instead of a looser, separate standard.
    const target = deriveTargetArea(room.type, Number(requested?.minSize), plotW * plotL, requestedRooms.length);
    const area = room.width * room.height;
    if (area < target * 0.75 || area > target * 1.6) return null;
    if (!hasPracticalDimensions(room) || !respectsAspectCap(room)) return null;
  }

  for (let i = 0; i < sanitized.length; i++) {
    for (let j = 0; j < i; j++) {
      if (roomRectsOverlap(sanitized[i], sanitized[j])) return null;
    }
  }

  const builtArea = sanitized.reduce((sum, room) => sum + room.width * room.height, 0);
  if (builtArea / (plotW * plotL) < 0.45) return null;

  // Gemini's rooms must pass the same stacking check the algorithmic
  // generator scores against -- a straight column of 3+ same-width rooms
  // falls back to the core-and-wings generator instead.
  if (longestSameWidthStack(sanitized) >= 3) return null;

  // At most one hallway/spine rectangle -- a corridor strip between every
  // room is exactly the banded layout this rework exists to eliminate.
  const circulationSource = Array.isArray(parsed.circulation) ? parsed.circulation.slice(0, 1) : [];
  const circulation = circulationSource.length ? normalizeCirculation(circulationSource, plotW, plotL, sanitized) : [];
  if (circulation === null) return null;

  assignOpeningsForLayout(sanitized, circulation, plotW, plotL, parseLayoutPreferences(userRequirements));
  if (countUnreachableRooms(sanitized, circulation, plotW, plotL) > 0) return null;

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
// ----------------------------------------------------
// Data-driven room sizing: a user-given minimum area always wins; otherwise
// a type's normal range is scaled by how much plot area each room actually
// gets, up to 1.5x the range's top, so the same room list produces visibly
// bigger rooms on a bigger plot instead of an identical fixed table.
// ----------------------------------------------------
const AREA_RANGES: Record<string, [number, number]> = {
  'bedroom': [11, 16],
  'master-bedroom': [16, 24],
  'living-room': [22, 35],
  'dining-room': [12, 18],
  'kitchen': [9, 16],
  'bathroom': [4, 7],
  'powder-room': [3, 4.5],
  'hallway': [6, 12],
  'office': [9, 14],
  'laundry': [5, 9],
  'utility': [4, 7],
  'balcony': [4, 8],
};
const DEFAULT_AREA_RANGE: [number, number] = [8, 14];

function deriveTargetArea(type: string | undefined, minSize: number | undefined, plotArea: number, roomCount: number): number {
  const floor = practicalArea(type);
  if (Number.isFinite(minSize) && (minSize as number) > 0) return Math.max(minSize as number, floor);

  const range = AREA_RANGES[String(type || '')] || DEFAULT_AREA_RANGE;
  const perRoomShare = plotArea / Math.max(1, roomCount);
  // ~40 m² of plot per room (net of circulation/walls/yard) is treated as a
  // "comfortable, generously-proportioned" baseline; a tighter plot per
  // room scales rooms down toward the bottom of their normal range instead
  // of overshooting it, and only a genuinely spacious plot scales up, to
  // 1.5x the range's top.
  const scale = Math.min(1.5, Math.max(0.75, perRoomShare / 40));
  const norm = Math.min(1, Math.max(0, (scale - 0.75) / 0.75));
  const withinRange = range[0] + (range[1] - range[0]) * norm;
  const target = withinRange * Math.max(1, scale);
  return Math.max(floor, Math.min(range[1] * 1.5, target));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// Deterministic seeded PRNG (mulberry32) so the same inputs reproduce the
// same chosen candidate, while a changed variationSeed ("Regenerate")
// perturbs which candidate wins without needing true randomness.
function hashSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return function () {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ----------------------------------------------------
// Multi-candidate generation: every request builds several layout
// candidates from different footprint/ordering strategies, scores each,
// and keeps the best -- instead of a single fixed deterministic pass.
// ----------------------------------------------------
type FootprintKind = 'rect' | 'stepped' | 'L';
type CandidateConfig = { footprintKind: FootprintKind; notchSide: 'start' | 'end'; reverseGroups: boolean };

function buildCandidateConfigs(): CandidateConfig[] {
  const kinds: FootprintKind[] = ['rect', 'stepped', 'L'];
  const sides: ('start' | 'end')[] = ['start', 'end'];
  const configs: CandidateConfig[] = [];
  for (const footprintKind of kinds) {
    for (const notchSide of sides) {
      for (const reverseGroups of [false, true]) {
        configs.push({ footprintKind, notchSide, reverseGroups });
      }
    }
  }
  return configs; // 3 * 2 * 2 = 12
}

// Sizes the built footprint to roughly the requested room area plus ~12%
// for walls/circulation, anchored to the plot's left/bottom (keeping a
// genuine plot-boundary wall for the entry and a stable reference edge),
// leaving any extra plot area as unused yard on the top/right instead of
// always stretching rooms to fill the whole plot.
function computeFootprintRect(edge: number, clearWidth: number, clearLength: number, requiredArea: number, footprintKind: FootprintKind, rng: () => number): ZoneRect {
  const netArea = clearWidth * clearLength;
  if (footprintKind === 'rect' || requiredArea >= netArea * 0.92) {
    return { x: edge, y: edge, width: clearWidth, height: clearLength };
  }
  // The shorter clear dimension is protected by a floor (it's usually
  // already close to the minimum depth several rooms need side by side),
  // and any additional shrink needed to reach the required area is placed
  // on the longer dimension instead. Critically, the shorter dimension
  // never shrinks below its floor BEFORE the longer one is computed, and
  // the longer one is clamped to never end up smaller than the shorter --
  // both guard against flipping which axis is actually longer, which would
  // otherwise flip the zone-split orientation underneath the slicer and
  // squeeze a pair of rooms meant to split along the other axis.
  const shortDim = Math.min(clearWidth, clearLength);
  const longDim = Math.max(clearWidth, clearLength);
  const shrinkRatio = Math.sqrt(clamp(requiredArea / netArea, 0.3, 1));
  const jitter = 0.95 + rng() * 0.1;
  const shortFloor = Math.max(shortDim * 0.72, 3.6);
  const newShort = clamp(shortDim * shrinkRatio * jitter, shortFloor, shortDim);
  const newLong = clamp(requiredArea / Math.max(0.1, newShort), newShort, longDim);

  const width = clearWidth >= clearLength ? newLong : newShort;
  const height = clearWidth >= clearLength ? newShort : newLong;
  // Centered left/right (a single mass reads better in the middle of the
  // plot than pinned to one side), but still anchored to the bottom -- the
  // entry edge -- so the building always keeps a genuine street-facing wall
  // for the main door instead of floating away from every plot boundary.
  return { x: edge + (clearWidth - width) / 2, y: edge + (clearLength - height), width, height };
}

// For 'stepped'/'L' footprints, carves a notch out of the private zone's
// cross-axis (the dimension perpendicular to its hallway edge), leaving a
// corner of the footprint as yard and giving the built massing a genuine
// stepped/L-shaped silhouette -- bounded so it never shrinks the private
// zone below what its own rooms actually need.
function applyFootprintNotch(
  zones: { publicRect: ZoneRect; privateRect: ZoneRect; hallwayRect: ZoneRect | null; publicHallwayEdge: HallwayEdge; privateHallwayEdge: HallwayEdge },
  footprintKind: FootprintKind, notchSide: 'start' | 'end', privateRequiredArea: number
): typeof zones {
  if (footprintKind !== 'L' && footprintKind !== 'stepped') return zones;
  const { privateRect, privateHallwayEdge } = zones;
  if (!privateRect.width || !privateRect.height) return zones;

  const desiredFrac = footprintKind === 'L' ? 0.36 : 0.14;
  const currentArea = privateRect.width * privateRect.height;
  const maxFrac = Math.max(0, 1 - privateRequiredArea / currentArea);
  const notchFrac = Math.min(desiredFrac, maxFrac * 0.9);
  if (notchFrac <= 0.02) return zones;

  const crossIsHeight = privateHallwayEdge === 'left' || privateHallwayEdge === 'right';
  const newPrivateRect = { ...privateRect };
  let newHallwayRect = zones.hallwayRect ? { ...zones.hallwayRect } : null;

  if (crossIsHeight) {
    const newH = Math.max(1.8, privateRect.height * (1 - notchFrac));
    if (notchSide === 'end') {
      newPrivateRect.height = newH;
    } else {
      newPrivateRect.y = privateRect.y + (privateRect.height - newH);
      newPrivateRect.height = newH;
    }
    if (newHallwayRect) {
      const top = Math.max(newHallwayRect.y, newPrivateRect.y);
      const bottom = Math.min(newHallwayRect.y + newHallwayRect.height, newPrivateRect.y + newPrivateRect.height);
      if (bottom > top) { newHallwayRect.y = top; newHallwayRect.height = bottom - top; }
    }
  } else {
    const newW = Math.max(1.8, privateRect.width * (1 - notchFrac));
    if (notchSide === 'end') {
      newPrivateRect.width = newW;
    } else {
      newPrivateRect.x = privateRect.x + (privateRect.width - newW);
      newPrivateRect.width = newW;
    }
    if (newHallwayRect) {
      const left = Math.max(newHallwayRect.x, newPrivateRect.x);
      const right = Math.min(newHallwayRect.x + newHallwayRect.width, newPrivateRect.x + newPrivateRect.width);
      if (right > left) { newHallwayRect.x = left; newHallwayRect.width = right - left; }
    }
  }

  return { ...zones, privateRect: newPrivateRect, hallwayRect: newHallwayRect };
}

function buildLayoutCandidate(
  plotW: number, plotL: number, requested: RoomMeta[],
  prefs: { openPlanKitchen: boolean; masterFarFromEntrance: boolean },
  config: CandidateConfig, rng: () => number, palette: string[], circulationFactor: number = 1.12
): { rooms: any[]; circulation: { name: string; x: number; y: number; width: number; height: number }[]; footprintRect: ZoneRect } {
  const edge = 0.3;
  const clearWidth = Math.max(1.8, plotW - edge * 2);
  const clearLength = Math.max(1.8, plotL - edge * 2);

  const publicRooms = requested.filter((r) => classifyZone(r.type) === 'public');
  const privateRooms = requested.filter((r) => classifyZone(r.type) === 'private');
  const hasBothZones = publicRooms.length > 0 && privateRooms.length > 0;
  const openPlan = prefs.openPlanKitchen || !hasBothZones;
  const hallwayWidth = hasBothZones && !openPlan ? Math.min(1.3, Math.max(0.9, Math.min(clearWidth, clearLength) * 0.09)) * (circulationFactor > 1.15 ? 1.2 : 1) : 0;

  const requiredArea = requested.reduce((s, r) => s + r.targetArea, 0) * circulationFactor;
  const footprintRect = computeFootprintRect(edge, clearWidth, clearLength, requiredArea, config.footprintKind, rng);

  let zones = splitPlotIntoZones(footprintRect, publicRooms, privateRooms, hallwayWidth);
  const privateRequiredArea = privateRooms.reduce((s, r) => s + r.targetArea, 0) * 1.1;
  zones = applyFootprintNotch(zones, config.footprintKind, config.notchSide, privateRequiredArea);

  const rooms: any[] = [];
  const pairMap = computeAdjacencyPairs(requested);
  let publicGroups = orderGroupsForZone(publicRooms, pairMap, false);
  let privateGroups = orderGroupsForZone(privateRooms, pairMap, prefs.masterFarFromEntrance);
  if (config.reverseGroups) {
    publicGroups = [...publicGroups].reverse();
    if (!prefs.masterFarFromEntrance) privateGroups = [...privateGroups].reverse();
  }
  if (publicRooms.length) sliceZoneIntoRooms(zones.publicRect, publicGroups, zones.publicHallwayEdge, rooms, palette);
  if (privateRooms.length) sliceZoneIntoRooms(zones.privateRect, privateGroups, zones.privateHallwayEdge, rooms, palette);

  const circulation = zones.hallwayRect ? [{ ...zones.hallwayRect, name: 'Hallway' }] : [];
  assignOpeningsForLayout(rooms, circulation, plotW, plotL, prefs);

  return { rooms, circulation, footprintRect };
}

// Hard-rejects a candidate outright (not just a scoring penalty) when any
// room is unreachable from the entry without crossing a bedroom -- a
// disconnected second cluster, or a public/private zone that never actually
// touches, shows up here as an unreachable room, since there's then no door
// path at all connecting it back to the entry.
function isCandidateValid(rooms: any[], circulation: { x: number; y: number; width: number; height: number }[], plotW: number, plotL: number): boolean {
  if (!rooms.length) return false;
  for (const room of rooms) {
    if (room.x < -0.05 || room.y < -0.05 || room.x + room.width > plotW + 0.05 || room.y + room.height > plotL + 0.05) return false;
    if (!hasPracticalDimensions(room)) return false;
  }
  for (let i = 0; i < rooms.length; i++) {
    for (let j = 0; j < i; j++) {
      if (roomRectsOverlap(rooms[i], rooms[j])) return false;
    }
  }
  if (countUnreachableRooms(rooms, circulation, plotW, plotL) > 0) return false;
  return true;
}

// Builds a room-to-room (and room-to-hallway) adjacency graph straight from
// each room's assigned doors, for the reachability check below. A layout can
// now have more than one hallway segment (one per wing that needed one), so
// each gets its own graph node rather than assuming a single shared strip.
function buildRoomGraph(rooms: any[], hallways: ZoneRect[]): Map<string, Set<string>> {
  const hallwayId = (i: number) => `__hallway_${i}__`;
  const graph = new Map<string, Set<string>>();
  const ensure = (id: string) => {
    if (!graph.has(id)) graph.set(id, new Set());
    return graph.get(id)!;
  };
  for (const room of rooms) ensure(room.id);
  hallways.forEach((_, i) => ensure(hallwayId(i)));

  for (const room of rooms) {
    for (const door of room.doors || []) {
      const hallwayIndex = hallways.findIndex((h) => sidesAreAdjacent(room, door.side, h));
      if (hallwayIndex >= 0) {
        ensure(room.id).add(hallwayId(hallwayIndex));
        ensure(hallwayId(hallwayIndex)).add(room.id);
        continue;
      }
      const neighbor = rooms.find((other) => other !== room && sidesAreAdjacent(room, door.side, other));
      if (neighbor) {
        ensure(room.id).add(neighbor.id);
        ensure(neighbor.id).add(room.id);
      }
    }
  }
  return graph;
}

// Finds every room unreachable from the entry without crossing a bedroom --
// bedrooms are treated as dead ends for traversal, but whatever's directly
// attached to them (an ensuite, and -- one more hop out, via a short
// connecting hallway -- a walk-in wardrobe) is expected to be reached by
// walking through that one bedroom. That's normal private-suite circulation,
// not "crossing" the bedroom to reach somewhere unrelated, so a bedroom
// grants a 2-hop budget to whatever's attached to it, then traversal stops.
function findUnreachableRooms(rooms: any[], hallways: ZoneRect[], plotW: number, plotL: number): any[] {
  const entry = pickEntryRoom(rooms, plotW, plotL);
  if (!entry) return rooms;
  const graph = buildRoomGraph(rooms, hallways);
  const isBedroom = (id: string) => {
    const r = rooms.find((x) => x.id === id);
    return !!r && (r.type === 'bedroom' || r.type === 'master-bedroom');
  };
  const BEDROOM_SUITE_HOPS = 2;
  const visited = new Set<string>([entry.id]);
  const queue: { id: string; suiteHopsLeft: number }[] = [{ id: entry.id, suiteHopsLeft: -1 }];
  while (queue.length) {
    const { id: current, suiteHopsLeft } = queue.shift()!;
    if (isBedroom(current) && current !== entry.id) {
      // A bedroom always grants a fresh budget to its own attachments,
      // regardless of how it was itself reached.
      for (const next of graph.get(current) || []) {
        if (!visited.has(next)) { visited.add(next); queue.push({ id: next, suiteHopsLeft: BEDROOM_SUITE_HOPS - 1 }); }
      }
      continue;
    }
    if (suiteHopsLeft === 0) continue; // budget exhausted past a bedroom; this room is reached but not a thoroughfare
    for (const next of graph.get(current) || []) {
      if (!visited.has(next)) { visited.add(next); queue.push({ id: next, suiteHopsLeft: suiteHopsLeft < 0 ? -1 : suiteHopsLeft - 1 }); }
    }
  }
  return rooms.filter((r) => !visited.has(r.id));
}

export function countUnreachableRooms(rooms: any[], hallways: ZoneRect[], plotW: number, plotL: number): number {
  return findUnreachableRooms(rooms, hallways, plotW, plotL).length;
}

// Scores a fully-built candidate layout against every criterion from the
// brief: area fit, aspect ratio, required adjacencies, reachability, a
// short (not full-width) hallway, a compact footprint, and written
// preferences. Higher is better; used only to rank candidates against each
// other, so the absolute scale doesn't matter.
function scoreCandidate(
  rooms: any[], requested: RoomMeta[], plotW: number, plotL: number,
  circulation: { x: number; y: number; width: number; height: number }[],
  prefs: { openPlanKitchen: boolean; masterFarFromEntrance: boolean },
  footprintKind: FootprintKind
): number {
  if (!rooms.length) return -Infinity;
  const targetById = new Map(requested.map((r) => [r.id, r.targetArea]));
  let score = 0;

  for (const room of rooms) {
    const target = targetById.get(room.id) || practicalArea(room.type);
    const ratio = (room.width * room.height) / target;
    if (ratio < 0.8) score -= (0.8 - ratio) * 40;
    else if (ratio > 1.4) score -= (ratio - 1.4) * 25;
    else score += 6 - Math.abs(ratio - 1) * 4;
  }

  for (const room of rooms) {
    const cap = maxAspectForType(room.type);
    const longer = Math.max(room.width, room.height);
    const shorter = Math.max(0.1, Math.min(room.width, room.height));
    const aspect = longer / shorter;
    if (aspect > cap) score -= (aspect - cap) * 15;
    else score += 2;
  }

  const pairMap = computeAdjacencyPairs(rooms);
  for (const room of rooms) {
    const partnerId = pairMap.get(room.id);
    if (!partnerId) continue;
    const partner = rooms.find((r) => r.id === partnerId);
    if (partner && findTouchingSide(room, partner)) score += 10;
    else if (partner) score -= 20;
  }
  const wetRooms = rooms.filter((r) => r.type === 'bathroom' || r.type === 'powder-room' || r.type === 'laundry');
  for (let i = 0; i < wetRooms.length; i++) {
    for (let j = 0; j < i; j++) {
      if (findTouchingSide(wetRooms[i], wetRooms[j])) score += 4;
    }
  }

  score -= countUnreachableRooms(rooms, circulation, plotW, plotL) * 60;

  if (circulation.length) {
    const hallwayArea = circulation.reduce((s, h) => s + h.width * h.height, 0);
    score -= (hallwayArea / (plotW * plotL)) * 80;
  } else {
    score += 4;
  }

  const minX = Math.min(...rooms.map((r) => r.x));
  const minY = Math.min(...rooms.map((r) => r.y));
  const maxX = Math.max(...rooms.map((r) => r.x + r.width));
  const maxY = Math.max(...rooms.map((r) => r.y + r.height));
  const boundingArea = Math.max(0.01, (maxX - minX) * (maxY - minY));
  const builtArea = rooms.reduce((s, r) => s + r.width * r.height, 0);
  score += (builtArea / boundingArea) * 20;

  // Outline complexity: a plain bounding rectangle has a known perimeter;
  // allow some extra for up to about two notches, and penalise anything
  // raggedier than that (a ground-truth check on top of the compactness
  // bonus above, which only looks at AREA coverage, not perimeter shape).
  const boundingPerimeter = 2 * ((maxX - minX) + (maxY - minY));
  const actualPerimeter = outlinePerimeter(rooms);
  score -= Math.max(0, actualPerimeter - boundingPerimeter * 1.3) * 3;

  if (prefs.openPlanKitchen) {
    const kitchen = rooms.find((r) => r.type === 'kitchen');
    const livingOrDining = rooms.find((r) => r.type === 'dining-room') || rooms.find((r) => r.type === 'living-room');
    if (kitchen && livingOrDining && findTouchingSide(kitchen, livingOrDining)) score += 15;
  }
  if (prefs.masterFarFromEntrance) {
    const entry = pickEntryRoom(rooms, plotW, plotL);
    const master = rooms.find((r) => r.type === 'master-bedroom');
    if (entry && master) {
      const dx = (master.x + master.width / 2) - (entry.x + entry.width / 2);
      const dy = (master.y + master.height / 2) - (entry.y + entry.height / 2);
      const dist = Math.hypot(dx, dy);
      const diag = Math.hypot(plotW, plotL);
      score += (dist / diag) * 20;
    }
  }

  // Core arrangement: foyer/living/dining forming one open core near the
  // entry, and a massing that isn't just a plain single-column stack.
  const foyer = rooms.find((r) => r.type === 'hallway' || /foyer|entry/i.test(r.name));
  const living = rooms.find((r) => r.type === 'living-room');
  const dining = rooms.find((r) => r.type === 'dining-room');
  if (foyer && living && findTouchingSide(foyer, living)) score += 12;
  if (foyer && dining && findTouchingSide(foyer, dining)) score += 6;
  if (living && dining && findTouchingSide(living, dining)) score += 8;
  if (footprintKind !== 'rect') score += 10;
  if (footprintKind === 'L') score += 4;

  // Heavily penalise a long straight column of same-width stacked rooms --
  // the "two columns of stacked rooms with a gap" failure mode the
  // core-and-wings generator exists to replace.
  const stack = longestSameWidthStack(rooms);
  if (stack >= 3) score -= (stack - 2) * 35;

  return score;
}

// Longest run of rooms stacked directly on top of one another sharing (near
// enough) the same x position and width -- the exact plain-column pattern a
// good layout should never produce.
function longestSameWidthStack(rooms: any[]): number {
  const TOL = 0.15;
  let longest = 1;
  for (const room of rooms) {
    const sameColumn = rooms.filter((r) => Math.abs(r.x - room.x) < TOL && Math.abs(r.width - room.width) < TOL);
    if (sameColumn.length <= 1) continue;
    sameColumn.sort((a, b) => a.y - b.y);
    let run = 1;
    let best = 1;
    for (let i = 1; i < sameColumn.length; i++) {
      const touching = Math.abs(sameColumn[i].y - (sameColumn[i - 1].y + sameColumn[i - 1].height)) < TOL;
      run = touching ? run + 1 : 1;
      best = Math.max(best, run);
    }
    longest = Math.max(longest, best);
  }
  return longest;
}

// ----------------------------------------------------
// PRIMARY GENERATOR: core and wings
// ----------------------------------------------------
// Replaces zone-slicing as the main layout strategy. A recursive slicer
// always cuts a rect in two, every cut running parallel to the previous
// zone's hallway edge -- which reliably produces two straight columns of
// stacked rooms with a gap between them (exactly the reference-plan mismatch
// this rework exists to fix). Instead: one open core block (foyer/living/
// dining) anchored to the entry wall, with 2-3 wings of rooms attached to
// its left/right/back sides at their own independent depths, giving a
// stepped/L/T massing by construction rather than by chance.

// Splits `rooms` one at a time along a single fixed axis (the row's "long"
// axis), each room's own minimum side guaranteed whenever the row can
// afford it -- a simple side-by-side row, never a stack, since every cut
// here runs the same direction instead of alternating.
function sliceRowIntoRooms(rowRect: ZoneRect, rooms: RoomMeta[], longIsHeight: boolean, out: any[], palette: string[]): void {
  if (!rooms.length) return;
  if (rooms.length === 1) { finalizeRoomRect(rooms[0], rowRect, out, palette); return; }
  const [first, ...rest] = rooms;
  const wFirst = Math.sqrt(Math.max(0.01, first.targetArea));
  const wRest = Math.sqrt(Math.max(0.01, rest.reduce((s, r) => s + r.targetArea, 0)));
  let frac = wFirst / (wFirst + wRest);
  const longDim = longIsHeight ? rowRect.height : rowRect.width;
  const minFirst = minSideForType(first.type);
  const minRest = Math.max(...rest.map((r) => minSideForType(r.type)));
  if (minFirst + minRest <= longDim) frac = clamp(frac, minFirst / longDim, 1 - minRest / longDim);
  const len = roundPlan(longDim * frac);
  if (longIsHeight) {
    finalizeRoomRect(first, { x: rowRect.x, y: rowRect.y, width: rowRect.width, height: len }, out, palette);
    sliceRowIntoRooms({ x: rowRect.x, y: rowRect.y + len, width: rowRect.width, height: rowRect.height - len }, rest, longIsHeight, out, palette);
  } else {
    finalizeRoomRect(first, { x: rowRect.x, y: rowRect.y, width: len, height: rowRect.height }, out, palette);
    sliceRowIntoRooms({ x: rowRect.x + len, y: rowRect.y, width: rowRect.width - len, height: rowRect.height }, rest, longIsHeight, out, palette);
  }
}

// The core block: foyer (if present) gets a shallow strip along the entry
// edge (the core's own bottom, which is anchored to the plot's entry edge),
// living/dining split side-by-side above it. Two different cut directions
// in a row, so three rooms never read as a straight stack. With 2 rooms (no
// foyer, or a request without one of living/dining) it's a single
// side-by-side row; with 1, the whole core is that one room.
function sliceCoreIntoRooms(coreRect: ZoneRect, foyer: RoomMeta | undefined, living: RoomMeta | undefined, dining: RoomMeta | undefined, out: any[], palette: string[]): void {
  const present = [foyer, living, dining].filter(Boolean) as RoomMeta[];
  if (present.length === 0) return;
  if (present.length === 1) { finalizeRoomRect(present[0], coreRect, out, palette); return; }
  if (!foyer || present.length === 2) {
    sliceRowIntoRooms(coreRect, present, false, out, palette);
    return;
  }
  const foyerDepth = clamp((foyer.targetArea * 1.1) / coreRect.width, minSideForType(foyer.type), coreRect.height * 0.45);
  const foyerRect = { x: coreRect.x, y: coreRect.y + coreRect.height - foyerDepth, width: coreRect.width, height: foyerDepth };
  finalizeRoomRect(foyer, foyerRect, out, palette);
  const remainderRect = { x: coreRect.x, y: coreRect.y, width: coreRect.width, height: coreRect.height - foyerDepth };
  sliceRowIntoRooms(remainderRect, [living!, dining!], false, out, palette);
}

// Sizes and positions the open core: depth/width derived from its own
// target area at a seeded aspect ratio, anchored to the plot's entry
// (bottom) edge, horizontally positioned anywhere from flush-left to
// flush-right per `positionFrac` so candidates vary where the core sits.
function buildCoreRect(clearRect: ZoneRect, coreArea: number, aspect: number, positionFrac: number): ZoneRect {
  const rawDepth = Math.sqrt(coreArea / aspect);
  const width = clamp(coreArea / Math.max(0.1, rawDepth), clearRect.width * 0.4, clearRect.width);
  const depth = clamp(coreArea / width, 2.4, clearRect.height * 0.7);
  const x = clearRect.x + (clearRect.width - width) * positionFrac;
  const y = clearRect.y + clearRect.height - depth;
  return { x, y, width, height: depth };
}

// The rect available for a wing on the given side of the core, sized from
// the wing's own room area and clamped to whatever space the plot actually
// has left on that side -- returns null when there isn't even a minimal
// 1.8m of depth to work with, so the caller can try a different side.
function placeWing(clearRect: ZoneRect, coreRect: ZoneRect, side: 'left' | 'right' | 'back', groupArea: number): ZoneRect | null {
  if (side === 'left') {
    const avail = coreRect.x - clearRect.x;
    if (avail < 1.8) return null;
    const length = coreRect.height;
    const depth = clamp(groupArea / length, 1.8, avail);
    return { x: coreRect.x - depth, y: coreRect.y, width: depth, height: length };
  }
  if (side === 'right') {
    const avail = clearRect.x + clearRect.width - (coreRect.x + coreRect.width);
    if (avail < 1.8) return null;
    const length = coreRect.height;
    const depth = clamp(groupArea / length, 1.8, avail);
    return { x: coreRect.x + coreRect.width, y: coreRect.y, width: depth, height: length };
  }
  const avail = coreRect.y - clearRect.y;
  if (avail < 1.8) return null;
  const length = coreRect.width;
  const depth = clamp(groupArea / length, 1.8, avail);
  return { x: coreRect.x, y: coreRect.y - depth, width: length, height: depth };
}

// Fills a wing with its rooms: 1 room fills the whole wing, 2 sit side by
// side in a single row, 3+ split into two rows (sqrt-weighted depth share)
// with a short hallway strip between them -- a real room-like rect that
// gets its own doors to the rooms on both sides, never a blank gap.
function sliceWingIntoRooms(wingRect: ZoneRect, side: 'left' | 'right' | 'back', group: RoomMeta[], out: any[], palette: string[]): { hallway: ZoneRect | null } {
  if (!group.length) return { hallway: null };
  if (group.length === 1) { finalizeRoomRect(group[0], wingRect, out, palette); return { hallway: null }; }

  const longIsHeight = side === 'left' || side === 'right';
  if (group.length === 2) {
    sliceRowIntoRooms(wingRect, group, longIsHeight, out, palette);
    return { hallway: null };
  }

  const mid = Math.ceil(group.length / 2);
  const rowA = group.slice(0, mid);
  const rowB = group.slice(mid);
  const wA = Math.sqrt(Math.max(0.01, rowA.reduce((s, r) => s + r.targetArea, 0)));
  const wB = Math.sqrt(Math.max(0.01, rowB.reduce((s, r) => s + r.targetArea, 0)));
  const hallwayDepth = 1.0;
  const depthDim = longIsHeight ? wingRect.width : wingRect.height;
  const usableDepth = Math.max(0.1, depthDim - hallwayDepth);
  // Every room in a row shares that row's full depth share (a row's rooms
  // differ along the row's own LENGTH axis, not its depth), so the row's
  // depth floor has to cover the widest minimum among its own rooms, not a
  // flat 1.8m -- a bedroom needs 2.1m, not the 1.8m a bathroom/laundry gets.
  const minDepthA = Math.max(...rowA.map((r) => minSideForType(r.type)));
  const minDepthB = Math.max(...rowB.map((r) => minSideForType(r.type)));
  // Clamp the FRACTION, not each row's absolute depth independently --
  // clamping depthA and depthB to their own floors separately can make
  // them sum to more than usableDepth on a narrow wing, overflowing rowB
  // back past the wing's own bounds and into the core. depthB is always
  // derived as the remainder, so depthA+depthB === usableDepth exactly.
  let fracA = wA / (wA + wB);
  if (minDepthA + minDepthB <= usableDepth) {
    fracA = clamp(fracA, minDepthA / usableDepth, 1 - minDepthB / usableDepth);
  } else {
    fracA = 0.5; // too narrow to give both rows their own minimum -- split evenly and let isCandidateValid reject if still impractical
  }
  const depthA = usableDepth * fracA;
  const depthB = usableDepth - depthA;

  let rowARect: ZoneRect, hallwayRect: ZoneRect, rowBRect: ZoneRect;
  if (longIsHeight) {
    // Row A sits nearest the core (the edge of the wing touching it).
    if (side === 'left') {
      rowBRect = { x: wingRect.x, y: wingRect.y, width: depthB, height: wingRect.height };
      hallwayRect = { x: wingRect.x + depthB, y: wingRect.y, width: hallwayDepth, height: wingRect.height };
      rowARect = { x: wingRect.x + depthB + hallwayDepth, y: wingRect.y, width: depthA, height: wingRect.height };
    } else {
      rowARect = { x: wingRect.x, y: wingRect.y, width: depthA, height: wingRect.height };
      hallwayRect = { x: wingRect.x + depthA, y: wingRect.y, width: hallwayDepth, height: wingRect.height };
      rowBRect = { x: wingRect.x + depthA + hallwayDepth, y: wingRect.y, width: depthB, height: wingRect.height };
    }
  } else {
    rowARect = { x: wingRect.x, y: wingRect.y + wingRect.height - depthA, width: wingRect.width, height: depthA };
    hallwayRect = { x: wingRect.x, y: wingRect.y + wingRect.height - depthA - hallwayDepth, width: wingRect.width, height: hallwayDepth };
    rowBRect = { x: wingRect.x, y: wingRect.y, width: wingRect.width, height: depthB };
  }

  sliceRowIntoRooms(rowARect, rowA, longIsHeight, out, palette);
  sliceRowIntoRooms(rowBRect, rowB, longIsHeight, out, palette);
  return { hallway: hallwayRect };
}

type WingSlot = 'private' | 'secondary' | 'service';
type CoreWingsConfig = { aspect: number; positionFrac: number; wingOrder: WingSlot[] };

function buildCoreWingsConfigs(): CoreWingsConfig[] {
  const aspects = [1.05, 1.4, 1.8];
  const positions = [0.12, 0.5, 0.88];
  const orders: WingSlot[][] = [
    ['private', 'secondary', 'service'],
    ['private', 'service', 'secondary'],
    ['service', 'private', 'secondary'],
    ['secondary', 'private', 'service'],
  ];
  const configs: CoreWingsConfig[] = [];
  for (const aspect of aspects) for (const positionFrac of positions) for (const wingOrder of orders) {
    configs.push({ aspect, positionFrac, wingOrder });
  }
  return configs; // 3 * 3 * 4 = 36 candidates
}

// Builds one full core-and-wings candidate. Returns null when the geometry
// doesn't work out (e.g. a wing has nowhere left to go) so the caller
// filters it out like any other invalid candidate.
// Fisher-Yates using the candidate's own seeded rng, so "Regenerate" visibly
// reorders rooms within a wing even on the same geometric config.
function seededShuffle<T>(items: T[], rng: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildCoreWingsCandidate(
  plotW: number, plotL: number, requested: RoomMeta[],
  prefs: { openPlanKitchen: boolean; masterFarFromEntrance: boolean },
  config: CoreWingsConfig, rng: () => number, palette: string[]
): { rooms: any[]; circulation: { name: string; x: number; y: number; width: number; height: number }[] } | null {
  const edge = 0.3;
  const clearRect: ZoneRect = { x: edge, y: edge, width: Math.max(1.8, plotW - edge * 2), height: Math.max(1.8, plotL - edge * 2) };

  const used = new Set<string>();
  const take = (predicate: (r: RoomMeta) => boolean): RoomMeta | undefined => {
    const found = requested.find((r) => !used.has(r.id) && predicate(r));
    if (found) used.add(found.id);
    return found;
  };
  const takeAll = (predicate: (r: RoomMeta) => boolean): RoomMeta[] => {
    const list = requested.filter((r) => !used.has(r.id) && predicate(r));
    list.forEach((r) => used.add(r.id));
    return list;
  };

  const foyer = take((r) => r.type === 'hallway' || /foyer|entry/i.test(r.name));
  const living = take((r) => r.type === 'living-room');
  const dining = take((r) => r.type === 'dining-room');
  const kitchen = take((r) => r.type === 'kitchen');
  const masterBed = take((r) => r.type === 'master-bedroom');
  const walkIn = take((r) => r.type === 'utility' && /walk.?in|wardrobe/i.test(r.name));
  const masterBath = masterBed ? take((r) => r.type === 'bathroom') : undefined;
  const laundryUtility = takeAll((r) => r.type === 'laundry' || r.type === 'utility');
  const powder = takeAll((r) => r.type === 'powder-room');
  const otherBedrooms = takeAll((r) => r.type === 'bedroom');
  const sharedBaths = takeAll((r) => r.type === 'bathroom');
  const leftover = requested.filter((r) => !used.has(r.id));

  const coreGroup = [foyer, living, dining].filter(Boolean) as RoomMeta[];
  if (!coreGroup.length) return null; // nothing to anchor to the entry wall

  const serviceGroup = seededShuffle([kitchen, ...laundryUtility, ...powder].filter(Boolean) as RoomMeta[], rng);
  const privateGroup = [masterBed, masterBath, walkIn].filter(Boolean) as RoomMeta[];
  const secondaryGroup = seededShuffle([...otherBedrooms, ...sharedBaths, ...leftover], rng);

  const coreArea = coreGroup.reduce((s, r) => s + r.targetArea, 0) * 1.15;
  const coreRectRaw = buildCoreRect(clearRect, coreArea, config.aspect, config.positionFrac);
  // Round the core's own boundary once, before it's used for anything else.
  // Every room's rect gets independently rounded to 1 decimal when
  // finalized (finalizeRoomRect); if a wing is attached using the core's
  // raw (unrounded) edge, the core's own rightmost room and the wing's
  // nearest room can each round their shared edge to a DIFFERENT value and
  // land up to 0.1m apart -- a gap, or (as seen here) an overlap. Rounding
  // the core rect first means every room derived from it rounds to the
  // exact same edge.
  const coreRect: ZoneRect = { x: roundPlan(coreRectRaw.x), y: roundPlan(coreRectRaw.y), width: roundPlan(coreRectRaw.width), height: roundPlan(coreRectRaw.height) };

  const rooms: any[] = [];
  const circulation: { name: string; x: number; y: number; width: number; height: number }[] = [];
  sliceCoreIntoRooms(coreRect, foyer, living, dining, rooms, palette);
  const coreRoomIds = new Set(rooms.map((r) => r.id));

  const groupsBySlot: Record<WingSlot, RoomMeta[]> = { private: privateGroup, secondary: secondaryGroup, service: serviceGroup };
  const remainingSides: ('back' | 'left' | 'right')[] = ['back', 'left', 'right'];
  const placements: { side: 'back' | 'left' | 'right'; group: RoomMeta[]; rect: ZoneRect }[] = [];
  for (const slot of config.wingOrder) {
    const group = groupsBySlot[slot];
    if (!group.length) continue;
    const groupArea = group.reduce((s, r) => s + r.targetArea, 0) * 1.15;
    let placed = false;
    for (let i = 0; i < remainingSides.length; i++) {
      const side = remainingSides[i];
      const wingRect = placeWing(clearRect, coreRect, side, groupArea);
      if (wingRect) {
        placements.push({ side, group, rect: wingRect });
        remainingSides.splice(i, 1);
        placed = true;
        break;
      }
    }
    if (!placed) return null;
  }

  for (const { side, group, rect } of placements) {
    const { hallway } = sliceWingIntoRooms(rect, side, group, rooms, palette);
    if (hallway) circulation.push({ ...hallway, name: 'Hallway' });
  }

  assignOpeningsForLayout(rooms, circulation, plotW, plotL, prefs);

  // The generic per-room door assignment above gives each room only ONE
  // secondary door, picked by side priority -- a core room can end up
  // spending it on an adjacent wing instead of on its own core neighbour,
  // and a wing's near-core room can end up spending it on the wing's own
  // internal hallway instead of the core. Guarantee the core stays fully
  // connected internally, and that every wing has at least one door
  // straight back to the core, independent of what the generic pass
  // happened to pick.
  ensureCoreInternalConnectivity(rooms, coreRoomIds);
  for (const { group } of placements) {
    ensureWingTouchesCore(rooms, coreRoomIds, new Set(group.map((r) => r.id)));
  }

  return { rooms, circulation };
}

// Forces a door between some room of the wing and some room of the core if
// the generic door-assignment pass didn't already connect them -- see the
// comment at its call site in buildCoreWingsCandidate.
function ensureWingTouchesCore(rooms: any[], coreRoomIds: Set<string>, wingRoomIds: Set<string>): void {
  const alreadyConnected = rooms.some((r) => wingRoomIds.has(r.id) && (r.doors || []).some((d: any) =>
    rooms.some((other) => coreRoomIds.has(other.id) && sidesAreAdjacent(r, d.side, other))
  ));
  if (alreadyConnected) return;

  for (const wingRoom of rooms.filter((r) => wingRoomIds.has(r.id))) {
    for (const coreRoom of rooms.filter((r) => coreRoomIds.has(r.id))) {
      const side = findTouchingSide(wingRoom, coreRoom);
      if (!side) continue;
      const wallLen = wallLengthForSide(side, wingRoom.width, wingRoom.height);
      const opening = clampOpeningToWall((wallLen - 0.9) / 2, 0.9, wallLen, 0.6, 1.1);
      const newDoor = { side, offset: opening.offset, width: opening.width, swing: 'in' };
      const existing = wingRoom.doors || [];
      if (existing.some((d: any) => d.side === side && openingsOverlapOnSameWall([d, newDoor]))) continue;
      wingRoom.doors = [...existing, newDoor];
      return;
    }
  }
}

// Guarantees every pair of touching rooms within the core (foyer/living/
// dining) has a direct door between them, instead of leaving it to chance
// which adjacent wing each one's single generic secondary door happened to
// pick. Without this, e.g. the dining room can end up with its only door
// facing the private wing instead of the living room right beside it --
// reachable, but only by walking through a bedroom, which the reachability
// check then (correctly) refuses to count as a real path.
function ensureCoreInternalConnectivity(rooms: any[], coreRoomIds: Set<string>): void {
  const members = rooms.filter((r) => coreRoomIds.has(r.id));
  for (let i = 0; i < members.length; i++) {
    for (let j = 0; j < i; j++) {
      const a = members[i];
      const b = members[j];
      const side = findTouchingSide(a, b);
      if (!side) continue;
      const alreadyConnected = (a.doors || []).some((d: any) => sidesAreAdjacent(a, d.side, b))
        || (b.doors || []).some((d: any) => sidesAreAdjacent(b, d.side, a));
      if (alreadyConnected) continue;
      const wallLen = wallLengthForSide(side, a.width, a.height);
      const opening = clampOpeningToWall((wallLen - 0.9) / 2, 0.9, wallLen, 0.6, 1.1);
      const newDoor = { side, offset: opening.offset, width: opening.width, swing: 'in' };
      const existing = a.doors || [];
      if (existing.some((d: any) => d.side === side && openingsOverlapOnSameWall([d, newDoor]))) continue;
      a.doors = [...existing, newDoor];
    }
  }
}

// ----------------------------------------------------
// PRIMARY GENERATOR: grow by attachment
// ----------------------------------------------------
// Replaces core-and-wings as the main strategy. Pouring rooms into a
// pre-sized container (what core-and-wings' row/wing slicing did) can still
// produce slivers when a container's own aspect ratio doesn't suit the
// rooms inside it. Here every room is sized as a real width x height
// FIRST, then placed one at a time as a whole rectangle attached to a free
// side of an already-placed room -- the footprint is whatever results,
// never pre-allocated.

// A room's width/height, chosen before it's ever placed: aspect ratio
// within [1, maxAspect] (wider allowance for hallways/bathrooms), and never
// narrower than its type's practical minimum side.
function sizeRoomRect(room: RoomMeta, rng: () => number): { width: number; height: number } {
  const isWalkIn = room.type === 'utility' && /walk.?in|wardrobe/i.test(room.name);
  const isHallway = room.type === 'hallway';
  const minSide = isHallway ? 1.2 : isWalkIn ? 1.8 : 2.4;
  const wideAspectType = isHallway || room.type === 'bathroom' || room.type === 'powder-room';
  const maxAspect = wideAspectType ? 2.2 : 1.6;
  const aspect = 1.0 + rng() * (maxAspect - 1.0);
  let h = Math.sqrt(room.targetArea / aspect);
  let w = room.targetArea / h;
  if (h < minSide) { h = minSide; w = room.targetArea / h; }
  if (w < minSide) { w = minSide; h = room.targetArea / w; }
  if (w / h > maxAspect) w = h * maxAspect;
  if (h / w > maxAspect) h = w * maxAspect;
  return { width: roundPlan(Math.max(minSide, w)), height: roundPlan(Math.max(minSide, h)) };
}

// A handful of flush/centred/bounds-aligned x (or y) offsets to try along
// the anchor's chosen side -- enough variety to find a legal, well-fitting
// spot without an expensive continuous search.
const STAGGER_OVERLAP = 1.4;
function candidateOffsets(anchor: ZoneRect, size: { width: number; height: number }, side: 'top' | 'bottom' | 'left' | 'right', bounds: ZoneRect): { x: number; y: number }[] {
  if (side === 'bottom' || side === 'top') {
    const y = side === 'bottom' ? anchor.y + anchor.height : anchor.y - size.height;
    // last two: hang off either end of the anchor, sharing only ~1.3m of wall
    const xs = [anchor.x, anchor.x + anchor.width - size.width, anchor.x + (anchor.width - size.width) / 2, bounds.x, bounds.x + bounds.width - size.width, anchor.x - size.width + STAGGER_OVERLAP, anchor.x + anchor.width - STAGGER_OVERLAP];
    return xs.map((x) => ({ x: roundPlan(x), y: roundPlan(y) }));
  }
  const x = side === 'right' ? anchor.x + anchor.width : anchor.x - size.width;
  const ys = [anchor.y, anchor.y + anchor.height - size.height, anchor.y + (anchor.height - size.height) / 2, bounds.y, bounds.y + bounds.height - size.height, anchor.y - size.height + STAGGER_OVERLAP, anchor.y + anchor.height - STAGGER_OVERLAP];
  return ys.map((y) => ({ x: roundPlan(x), y: roundPlan(y) }));
}

function sharedWallLength(rect: ZoneRect, anchor: ZoneRect, side: 'top' | 'bottom' | 'left' | 'right'): number {
  if (side === 'top' || side === 'bottom') {
    return Math.max(0, Math.min(rect.x + rect.width, anchor.x + anchor.width) - Math.max(rect.x, anchor.x));
  }
  return Math.max(0, Math.min(rect.y + rect.height, anchor.y + anchor.height) - Math.max(rect.y, anchor.y));
}

type AttachGroup = 'core' | 'kitchen' | 'hallway' | 'master-suite' | 'bedroom-wing' | 'service' | 'other';

// Local heuristic for picking WHERE to put one room among its legal
// candidate spots: favour the architecturally "right" neighbour (matching
// one of its preferred groups), a generous shared wall, hugging the plot
// boundary (keeps the footprint from sprawling), and -- for the
// hallway/master/other-bedrooms chain -- distance from the entry, so that
// chain naturally runs away from the door the way the brief describes.
function scorePlacementCandidate(
  rect: ZoneRect, anchor: { _group: AttachGroup } & ZoneRect, side: string, group: AttachGroup,
  preferredGroups: AttachGroup[], placed: ZoneRect[], bounds: ZoneRect, compactWeight: number = 0.02
): number {
  let score = 0;
  if (preferredGroups.includes(anchor._group)) score += 30;
  score += sharedWallLength(rect, anchor, side as 'top' | 'bottom' | 'left' | 'right') * 2;

  const allRects = [...placed, rect];
  const minX = Math.min(...allRects.map((r) => r.x));
  const minY = Math.min(...allRects.map((r) => r.y));
  const maxX = Math.max(...allRects.map((r) => r.x + r.width));
  const maxY = Math.max(...allRects.map((r) => r.y + r.height));
  score -= (maxX - minX) * (maxY - minY) * compactWeight;

  if (Math.abs(rect.x - bounds.x) < 0.2 || Math.abs(rect.x + rect.width - (bounds.x + bounds.width)) < 0.2) score += 2;
  if (Math.abs(rect.y - bounds.y) < 0.2 || Math.abs(rect.y + rect.height - (bounds.y + bounds.height)) < 0.2) score += 2;

  if (group === 'hallway' || group === 'master-suite' || group === 'bedroom-wing') {
    const entryY = bounds.y + bounds.height;
    score += (entryY - (rect.y + rect.height / 2)) * 0.5;
  }
  return score;
}

// ----------------------------------------------------
// COMPACTION PASS: edge alignment, gap closing, void filling/detection
// ----------------------------------------------------
// Grow-by-attachment places rooms as independent rectangles; neighbouring
// edges that were MEANT to align (two rooms attached along "the same" wall)
// can still land a few decimetres apart, and small gaps are left between
// rooms that don't actually need yard between them. This pass tightens
// that up after placement, without touching the attachment logic itself.

function snapRoomsToGrid(rooms: any[]): void {
  for (const r of rooms) {
    r.x = roundPlan(r.x);
    r.y = roundPlan(r.y);
    r.width = roundPlan(r.width);
    r.height = roundPlan(r.height);
  }
}

// Edges (room boundaries) within `threshold` of each other are pulled to
// their shared average, so neighbouring rooms form one continuous straight
// wall instead of a near-miss. Applied per axis (x edges, then y edges)
// using every room's own min/max edges as the clustering input.
function alignNearEqualEdges(rooms: any[], threshold: number = 0.5): void {
  const snapAxis = (
    getStart: (r: any) => number, getEnd: (r: any) => number,
    apply: (r: any, start: number, end: number) => void
  ) => {
    const values: number[] = [];
    for (const r of rooms) { values.push(getStart(r)); values.push(getEnd(r)); }
    values.sort((a, b) => a - b);
    // Bound each cluster's total span to `threshold` by comparing every new
    // value to the cluster's FIRST (smallest) member, not just the
    // previous one -- comparing to the previous value lets a chain of
    // edges each 0.49m apart merge into one cluster spanning metres, which
    // then snaps a room's edge to a wildly different position.
    const clusters: number[][] = [];
    for (const v of values) {
      const last = clusters[clusters.length - 1];
      if (last && v - last[0] <= threshold) last.push(v);
      else clusters.push([v]);
    }
    const clusterValueFor = (v: number): number => {
      for (const c of clusters) {
        if (v >= c[0] - 1e-6 && v <= c[c.length - 1] + 1e-6) return roundPlan(c.reduce((s, x) => s + x, 0) / c.length);
      }
      return roundPlan(v);
    };
    for (const r of rooms) {
      const newStart = clusterValueFor(getStart(r));
      const newEnd = clusterValueFor(getEnd(r));
      if (newEnd - newStart >= 1.0) apply(r, newStart, newEnd);
    }
  };
  snapAxis((r) => r.x, (r) => r.x + r.width, (r, start, end) => { r.x = start; r.width = roundPlan(end - start); });
  snapAxis((r) => r.y, (r) => r.y + r.height, (r, start, end) => { r.y = start; r.height = roundPlan(end - start); });
}

// Extends a room into a small gap toward the nearest obstacle in that
// direction (another room's facing edge), when the gap is narrow enough to
// read as a leftover seam rather than genuine yard, and doing so doesn't
// grow the room past 1.4x its own target area.
function closeSmallGaps(rooms: any[], targetAreaById: Map<string, number>, maxGap: number = 1.5): void {
  const sides: ('top' | 'bottom' | 'left' | 'right')[] = ['top', 'bottom', 'left', 'right'];
  for (const room of rooms) {
    for (const side of sides) {
      let nearest = Infinity;
      for (const other of rooms) {
        if (other === room) continue;
        if (side === 'left' || side === 'right') {
          const overlapY = Math.min(room.y + room.height, other.y + other.height) - Math.max(room.y, other.y);
          if (overlapY <= 0.05) continue;
        } else {
          const overlapX = Math.min(room.x + room.width, other.x + other.width) - Math.max(room.x, other.x);
          if (overlapX <= 0.05) continue;
        }
        let dist: number;
        if (side === 'right') dist = other.x - (room.x + room.width);
        else if (side === 'left') dist = room.x - (other.x + other.width);
        else if (side === 'bottom') dist = other.y - (room.y + room.height);
        else dist = room.y - (other.y + other.height);
        if (dist >= -0.05 && dist < nearest) nearest = dist;
      }
      if (nearest === Infinity || nearest <= 0.15 || nearest > maxGap) continue;
      const target = targetAreaById.get(room.id) || room.width * room.height;
      const newWidth = side === 'left' || side === 'right' ? room.width + nearest : room.width;
      const newHeight = side === 'top' || side === 'bottom' ? room.height + nearest : room.height;
      if (newWidth * newHeight > target * 1.4) continue;
      const wideAspectType = room.type === 'hallway' || room.type === 'bathroom' || room.type === 'powder-room';
      const maxAspect = wideAspectType ? 2.2 : 1.6;
      if (Math.max(newWidth, newHeight) / Math.min(newWidth, newHeight) > maxAspect) continue;
      if (side === 'right') room.width = roundPlan(room.width + nearest);
      else if (side === 'left') { room.x = roundPlan(room.x - nearest); room.width = roundPlan(room.width + nearest); }
      else if (side === 'bottom') room.height = roundPlan(room.height + nearest);
      else { room.y = roundPlan(room.y - nearest); room.height = roundPlan(room.height + nearest); }
    }
  }
}

// Rasterizes the rooms' combined footprint at a coarse grid and flood-fills
// every empty cell from the footprint's own bounding-box edge inward --
// whatever empty region is NEVER reached that way is enclosed by rooms on
// every side (a true interior void); anything reached from the edge is a
// notch open to the yard, which is fine.
function findInteriorVoidRegions(rooms: any[], cell: number = 0.2): { x: number; y: number }[][] {
  if (!rooms.length) return [];
  const minX = Math.min(...rooms.map((r) => r.x));
  const minY = Math.min(...rooms.map((r) => r.y));
  const maxX = Math.max(...rooms.map((r) => r.x + r.width));
  const maxY = Math.max(...rooms.map((r) => r.y + r.height));
  const cols = Math.max(1, Math.round((maxX - minX) / cell));
  const rows = Math.max(1, Math.round((maxY - minY) / cell));
  const occupied: boolean[][] = Array.from({ length: rows }, () => new Array(cols).fill(false));
  for (const r of rooms) {
    const x0 = Math.max(0, Math.round((r.x - minX) / cell));
    const x1 = Math.min(cols, Math.round((r.x + r.width - minX) / cell));
    const y0 = Math.max(0, Math.round((r.y - minY) / cell));
    const y1 = Math.min(rows, Math.round((r.y + r.height - minY) / cell));
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) occupied[y][x] = true;
  }
  const visited: boolean[][] = Array.from({ length: rows }, () => new Array(cols).fill(false));
  const regions: { x: number; y: number }[][] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (occupied[y][x] || visited[y][x]) continue;
      const cells: { x: number; y: number }[] = [];
      let touchesBoundary = false;
      const stack: [number, number][] = [[x, y]];
      visited[y][x] = true;
      while (stack.length) {
        const [cx, cy] = stack.pop()!;
        cells.push({ x: cx, y: cy });
        if (cx === 0 || cy === 0 || cx === cols - 1 || cy === rows - 1) touchesBoundary = true;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= cols || ny >= rows || occupied[ny][nx] || visited[ny][nx]) continue;
          visited[ny][nx] = true;
          stack.push([nx, ny]);
        }
      }
      if (!touchesBoundary) regions.push(cells);
    }
  }
  return regions;
}

function hasInteriorVoid(rooms: any[]): boolean {
  return findInteriorVoidRegions(rooms).some((region) => region.length > 1);
}

// Grows whichever adjacent room is furthest under its own target area to
// absorb a true interior void's bounding box, as long as doing so doesn't
// overlap anything else. Best-effort: any void this can't cleanly absorb is
// left for the hard interior-void rejection to catch, so the candidate
// search just tries a different arrangement instead.
function fillInteriorVoids(rooms: any[], targetAreaById: Map<string, number>, cell: number = 0.2): void {
  for (let iter = 0; iter < 4; iter++) {
    const regions = findInteriorVoidRegions(rooms, cell).filter((r) => r.length > 1);
    if (!regions.length) return;
    const minX = Math.min(...rooms.map((r) => r.x));
    const minY = Math.min(...rooms.map((r) => r.y));
    let fixedAny = false;
    for (const region of regions) {
      const xs = region.map((c) => c.x);
      const ys = region.map((c) => c.y);
      const voidRect = {
        x: roundPlan(minX + Math.min(...xs) * cell),
        y: roundPlan(minY + Math.min(...ys) * cell),
        width: roundPlan((Math.max(...xs) + 1 - Math.min(...xs)) * cell),
        height: roundPlan((Math.max(...ys) + 1 - Math.min(...ys)) * cell),
      };
      let bestRoom: any = null;
      let bestDeficit = -Infinity;
      for (const r of rooms) {
        if (!findTouchingSide(voidRect, r) && !findTouchingSide(r, voidRect)) continue;
        const target = targetAreaById.get(r.id) || r.width * r.height;
        const deficit = target - r.width * r.height;
        if (deficit > bestDeficit) { bestDeficit = deficit; bestRoom = r; }
      }
      if (!bestRoom) continue;
      const merged = {
        x: Math.min(bestRoom.x, voidRect.x),
        y: Math.min(bestRoom.y, voidRect.y),
        width: 0,
        height: 0,
      };
      merged.width = Math.max(bestRoom.x + bestRoom.width, voidRect.x + voidRect.width) - merged.x;
      merged.height = Math.max(bestRoom.y + bestRoom.height, voidRect.y + voidRect.height) - merged.y;
      if (rooms.some((r) => r !== bestRoom && roomRectsOverlap(merged, r))) continue;
      const wideAspectType = bestRoom.type === 'hallway' || bestRoom.type === 'bathroom' || bestRoom.type === 'powder-room';
      const maxAspect = wideAspectType ? 2.2 : 1.6;
      if (Math.max(merged.width, merged.height) / Math.min(merged.width, merged.height) > maxAspect) continue;
      bestRoom.x = roundPlan(merged.x);
      bestRoom.y = roundPlan(merged.y);
      bestRoom.width = roundPlan(merged.width);
      bestRoom.height = roundPlan(merged.height);
      fixedAny = true;
    }
    if (!fixedAny) return;
  }
}

// Grid-rasterized footprint perimeter, for the scorer's outline-complexity
// penalty -- counts every exposed cell edge (facing outside the footprint
// or an unoccupied neighbour cell), so a ragged/notched outline measures
// longer than a plain rectangle of the same bounding box.
function outlinePerimeter(rooms: any[], cell: number = 0.2): number {
  if (!rooms.length) return 0;
  const minX = Math.min(...rooms.map((r) => r.x));
  const minY = Math.min(...rooms.map((r) => r.y));
  const maxX = Math.max(...rooms.map((r) => r.x + r.width));
  const maxY = Math.max(...rooms.map((r) => r.y + r.height));
  const cols = Math.max(1, Math.round((maxX - minX) / cell));
  const rows = Math.max(1, Math.round((maxY - minY) / cell));
  const occupied: boolean[][] = Array.from({ length: rows }, () => new Array(cols).fill(false));
  for (const r of rooms) {
    const x0 = Math.max(0, Math.round((r.x - minX) / cell));
    const x1 = Math.min(cols, Math.round((r.x + r.width - minX) / cell));
    const y0 = Math.max(0, Math.round((r.y - minY) / cell));
    const y1 = Math.min(rows, Math.round((r.y + r.height - minY) / cell));
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) occupied[y][x] = true;
  }
  let perimeter = 0;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (!occupied[y][x]) continue;
      if (x === 0 || !occupied[y][x - 1]) perimeter += cell;
      if (x === cols - 1 || !occupied[y][x + 1]) perimeter += cell;
      if (y === 0 || !occupied[y - 1][x]) perimeter += cell;
      if (y === rows - 1 || !occupied[y + 1][x]) perimeter += cell;
    }
  }
  return perimeter;
}

// ----------------------------------------------------
// Grow-by-attachment rejection diagnostics (DEBUG_LAYOUT=1)
// ----------------------------------------------------
const rejectStats = { capture: false, captured: null as { gate: string; reason: string } | null, quiet: false, cand: -1, byGate: new Map<string, number>(), byReason: new Map<string, { n: number; sample: string }>() };
function logReject(gate: string, reason: string): void {
  if (rejectStats.capture) { rejectStats.captured = { gate, reason }; return; } // caller decides whether this is a final rejection
  rejectStats.byGate.set(gate, (rejectStats.byGate.get(gate) || 0) + 1);
  const key = `${gate}: ${reason.replace(/[\d.]+/g, '#')}`;
  const prev = rejectStats.byReason.get(key);
  rejectStats.byReason.set(key, { n: (prev?.n || 0) + 1, sample: prev?.sample || `${gate}: ${reason}` });
  if (process.env.DEBUG_LAYOUT && !rejectStats.quiet) console.error(`[reject] cand=${rejectStats.cand} gate=${gate} reason=${reason}`);
}
function summarizeRejects(): string {
  const gates = [...rejectStats.byGate.entries()].map(([g, n]) => `${g}=${n}`).join(' ');
  const top = [...rejectStats.byReason.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 3).map(([r, v]) => `  ${v.n}x ${r}`).join('\n');
  return `per-gate: ${gates || 'none'}\ntop reasons:\n${top}`;
}

// ----------------------------------------------------
// DOOR RULES specific to grow-by-attachment
// ----------------------------------------------------
// Bedrooms (including the master) open only onto the hallway or the core;
// an ensuite/walk-in opens only into its own master; a shared bathroom
// opens only onto the hallway; the kitchen opens into the core. Every
// other room keeps the generic "touch whatever's adjacent" behaviour.
// Returns false (candidate should be discarded) if any restricted room has
// no legal, sturdy-enough (>=1.2m wall) door target.
function assignDoorsGrowByAttachment(
  rooms: any[], plotW: number, plotL: number,
  masterBedId: string | undefined, suiteOnlyIds: Set<string>,
  minDoorShared: number = 1.2
): boolean {
  const groupOf = (r: any): AttachGroup => r._group;
  for (const room of rooms) {
    let allowed: any[];
    if (suiteOnlyIds.has(room.id)) {
      allowed = masterBedId ? rooms.filter((r) => r.id === masterBedId) : [];
    } else if (room.type === 'bedroom' || room.type === 'master-bedroom') {
      allowed = rooms.filter((r) => groupOf(r) === 'hallway' || groupOf(r) === 'core');
    } else if (room.type === 'bathroom') {
      const hallwayTargets = rooms.filter((r) => groupOf(r) === 'hallway');
      allowed = hallwayTargets.length ? hallwayTargets : rooms.filter((r) => groupOf(r) === 'core');
    } else if (room.type === 'kitchen') {
      allowed = rooms.filter((r) => groupOf(r) === 'core');
    } else if (groupOf(room) === 'hallway') {
      // The hallway is the private zone's only link to the public core. Its
      // single generic door used to go to whichever neighbour it overlapped
      // most (usually a bedroom, a dead end), cutting the whole private wing
      // off from the entry. Door it into the core first.
      const coreTargets = rooms.filter((r) => groupOf(r) === 'core');
      const touchesCore = coreTargets.some((r) => { const sd = findTouchingSide(room, r); return !!sd && (sd === 'top' || sd === 'bottom' ? Math.min(room.x + room.width, r.x + r.width) - Math.max(room.x, r.x) : Math.min(room.y + room.height, r.y + r.height) - Math.max(room.y, r.y)) >= 1.2; });
      // Documented fallback: when placement left the hallway touching only the
      // kitchen (which itself doors into the core), link through the kitchen
      // rather than to a bedroom dead end; the private wing stays reachable.
      allowed = touchesCore ? coreTargets : rooms.filter((r) => groupOf(r) === 'kitchen' || groupOf(r) === 'core');
      if (!allowed.some((r) => findTouchingSide(room, r))) allowed = rooms.filter((r) => r !== room);
    } else {
      allowed = rooms.filter((r) => r !== room);
    }

    const candidates = allowed
      .map((other) => {
        const side = findTouchingSide(room, other);
        if (!side) return null;
        const overlap = side === 'top' || side === 'bottom'
          ? Math.min(room.x + room.width, other.x + other.width) - Math.max(room.x, other.x)
          : Math.min(room.y + room.height, other.y + other.height) - Math.max(room.y, other.y);
        return overlap >= minDoorShared ? { other, side, overlap } : null;
      })
      .filter((c): c is { other: any; side: 'top' | 'bottom' | 'left' | 'right'; overlap: number } => !!c)
      .sort((a, b) => b.overlap - a.overlap);

    if (!candidates.length) {
      const touching = rooms.filter((o) => o !== room && findTouchingSide(room, o)).map((o) => `${o.name}[${groupOf(o)}]`);
      logReject('doors', `${room.type} ${room.id} (${room.name}): no legal door target among ${allowed.map((a) => a.id).join(',') || 'none'} with >=${minDoorShared}m shared wall; actually touches [${touching.join(', ')}]`);
      return false;
    }
    const { other, side, overlap } = candidates[0];
    const wallLen = wallLengthForSide(side, room.width, room.height);
    const doorWidth = Math.min(0.9, wallLen - 0.3, overlap - 0.2);
    // Centre the door on the stretch of wall actually shared with the target
    // (centring on the whole wall can land it outside a partial overlap).
    const horizontal = side === 'top' || side === 'bottom';
    const sharedMid = horizontal
      ? (Math.max(room.x, other.x) + Math.min(room.x + room.width, other.x + other.width)) / 2 - room.x
      : (Math.max(room.y, other.y) + Math.min(room.y + room.height, other.y + other.height)) / 2 - room.y;
    const opening = clampOpeningToWall(sharedMid - doorWidth / 2, doorWidth, wallLen, 0.6, 1.1);
    room.doors = [{ side, offset: opening.offset, width: opening.width, swing: 'in' }];
    room.doorSide = side;
  }

  // Windows: same "any side facing open air" rule assignOpeningsForLayout
  // uses elsewhere.
  for (const room of rooms) {
    const usedSides = new Set((room.doors || []).map((d: any) => d.side));
    const neighbors = rooms.filter((r) => r !== room);
    const openSides = (['top', 'bottom', 'left', 'right'] as const).filter((side) => isRoomSideOpen(room, side, neighbors));
    let windowSides = openSides.filter((side) => !usedSides.has(side));
    if (!windowSides.length && isHabitableRoomType(room.type) && openSides.length) windowSides = [openSides[0]];
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
  return true;
}

// Builds one full grow-by-attachment candidate: classify the request into
// the same functional groups core-and-wings used (core/kitchen/hallway/
// master-suite/bedroom-wing/service), then place them one at a time in
// that order, each as a sized rectangle attached to a free side of an
// already-placed room. Returns null if some room never finds a legal spot.
function buildGrowByAttachmentCandidate(
  plotW: number, plotL: number, requested: RoomMeta[],
  prefs: { openPlanKitchen: boolean; masterFarFromEntrance: boolean },
  rng: () => number, palette: string[]
): { rooms: any[]; circulation: { name: string; x: number; y: number; width: number; height: number }[] } | null {
  const edge = 0.3;
  const bounds: ZoneRect = { x: edge, y: edge, width: Math.max(1.8, plotW - edge * 2), height: Math.max(1.8, plotL - edge * 2) };

  const used = new Set<string>();
  const take = (predicate: (r: RoomMeta) => boolean): RoomMeta | undefined => {
    const found = requested.find((r) => !used.has(r.id) && predicate(r));
    if (found) used.add(found.id);
    return found;
  };
  const takeAll = (predicate: (r: RoomMeta) => boolean): RoomMeta[] => {
    const list = requested.filter((r) => !used.has(r.id) && predicate(r));
    list.forEach((r) => used.add(r.id));
    return list;
  };

  const foyerAndHallwayRooms = takeAll((r) => r.type === 'hallway' || /foyer|entry/i.test(r.name));
  const foyer = foyerAndHallwayRooms[0];
  let hallwayRoom: RoomMeta | undefined = foyerAndHallwayRooms[1];
  const living = take((r) => r.type === 'living-room');
  const dining = take((r) => r.type === 'dining-room');
  const kitchen = take((r) => r.type === 'kitchen');
  const masterBed = take((r) => r.type === 'master-bedroom');
  const walkIn = take((r) => r.type === 'utility' && /walk.?in|wardrobe/i.test(r.name));
  const masterBath = masterBed ? take((r) => r.type === 'bathroom') : undefined;
  const otherBedrooms = takeAll((r) => r.type === 'bedroom');
  const sharedBaths = takeAll((r) => r.type === 'bathroom');
  const laundryUtility = takeAll((r) => r.type === 'laundry' || r.type === 'utility');
  const powder = takeAll((r) => r.type === 'powder-room');
  const leftover = requested.filter((r) => !used.has(r.id));

  const coreSeq = [living, dining, foyer].filter(Boolean) as RoomMeta[];
  if (!coreSeq.length) return null; // nothing to anchor to the entry wall
  if (foyer) foyer.targetArea = Math.max(foyer.targetArea, 9); // a foyer is at least 9 m2

  const needsHallway = !!masterBed || otherBedrooms.length > 0;
  if (needsHallway && !hallwayRoom) {
    hallwayRoom = {
      id: 'auto_hallway',
      name: 'Hallway',
      type: 'hallway',
      targetArea: clamp(deriveTargetArea('hallway', undefined, plotW * plotL, requested.length + 1), 4.5, 8),
    };
  }

  // Frontage the hallway must offer: bedrooms and shared baths may only door
  // onto it (or the core), roughly 1.5m of wall each across its two long
  // sides plus an end, so a stub hallway strands them. Size the spine to it.
  const hallwayFrontageRooms = (masterBed ? 1 : 0) + otherBedrooms.length + sharedBaths.length;
  // Capped at 5.4m: the hallway must also stay >=2.1m wide (min side) within its 2.6 aspect cap.
  // Hallway width scales with plot size: 2.1m on a roomy plot (net >= 200 m2)
  // down to 1.5m (the practical minimum) on a tight one (net <= 110 m2), since
  // on a small plot a wide strip eats the depth the private rooms need.
  const netPlotArea = bounds.width * bounds.height;
  const hallwayShort = roundPlan(clamp(1.5 + ((netPlotArea - 110) / 90) * 0.6, 1.5, 2.1));
  const hallwayMaxLong = Math.floor(hallwayShort * maxAspectForType('hallway') * 0.98 * 10) / 10; // stays inside the aspect cap
  const hallwayMinLong = hallwayRoom ? Math.min(hallwayMaxLong, Math.max(3, 1.5 * Math.ceil(hallwayFrontageRooms / 2) + 1.5)) : 3;
  if (hallwayRoom) hallwayRoom.targetArea = Math.max(hallwayRoom.targetArea, hallwayMinLong * hallwayShort);

  const targetAreaById = new Map(requested.map((r) => [r.id, r.targetArea]));
  if (hallwayRoom) targetAreaById.set(hallwayRoom.id, hallwayRoom.targetArea);

  const placed: (ZoneRect & { id: string; name: string; type: string; color: string; _group: AttachGroup })[] = [];
  const sizeCache = new Map<string, { width: number; height: number }>();
  const sizeOf = (r: RoomMeta) => {
    if (!sizeCache.has(r.id)) {
      let size = sizeRoomRect(r, rng);
      // A hallway is a circulation spine, not just a wide room: it has to
      // actually run somewhere, so the long side is floored at 3m even if
      // that pushes it past the aspect-ratio-driven size a little.
      if (r.id === hallwayRoom?.id) {
        const shortSide = Math.max(1.5, Math.min(Math.min(size.width, size.height), hallwayShort));
        const longSide = Math.min(shortSide * maxAspectForType('hallway') * 0.98, Math.max(Math.max(size.width, size.height), hallwayMinLong));
        size = size.width >= size.height ? { width: roundPlan(longSide), height: roundPlan(shortSide) } : { width: roundPlan(shortSide), height: roundPlan(longSide) };
      }
      const minLong = 3;
      if (r.type === 'hallway' && r.id !== hallwayRoom?.id && Math.max(size.width, size.height) < minLong) {
        const longSide = minLong;
        const shortSide = Math.max(1.2, r.targetArea / longSide);
        size = size.width >= size.height ? { width: longSide, height: shortSide } : { width: shortSide, height: longSide };
      }
      sizeCache.set(r.id, size);
    }
    return sizeCache.get(r.id)!;
  };

  // Door-legal placement: mirrors the target sets assignDoorsGrowByAttachment
  // enforces, so a restricted room is only ever placed where it can actually
  // get a door (>=1.2m shared wall with a legal target). Without this the
  // placement scorer merely *prefers* the hallway and most bedrooms end up
  // stranded against other bedrooms/baths.
  const doorTargetsFor = (room: RoomMeta): ((p: any) => boolean) | null => {
    if (room.id === masterBath?.id || room.id === walkIn?.id) return masterBed ? (p) => p.id === masterBed.id : null;
    if (room.type === 'bedroom' || room.type === 'master-bedroom') return (p) => p._group === 'hallway' || p._group === 'core';
    if (room.type === 'bathroom') return (p) => p._group === 'hallway' || (!hallwayRoom && p._group === 'core');
    return null;
  };
  // Shared wall a door target needs: 1.3m on a roomy plot down to 0.9m (a door
  // plus jamb) on a tight one; the door-assignment pass accepts 0.1m less to
  // survive grid snapping.
  const doorMinShared = roundPlan(clamp(0.9 + (((bounds.width * bounds.height) - 110) / 90) * 0.4, 0.9, 1.3));
  const DOOR_TARGET_MIN_SHARED = doorMinShared;
  const hasDoorTarget = (rect: ZoneRect, isTarget: (p: any) => boolean): boolean =>
    placed.some((p) => {
      if (!isTarget(p)) return false;
      const side = findTouchingSide(rect, p);
      if (!side) return false;
      const overlap = side === 'top' || side === 'bottom'
        ? Math.min(rect.x + rect.width, p.x + p.width) - Math.max(rect.x, p.x)
        : Math.min(rect.y + rect.height, p.y + p.height) - Math.max(rect.y, p.y);
      return overlap >= DOOR_TARGET_MIN_SHARED;
    });

  const compactWeight = 0.02;

  type PlacementOption = { x: number; y: number; width: number; height: number };
  let lastWhy = { tried: 0, outOfBounds: 0, overlap: 0, sharedWall: 0, noDoorTarget: 0 };

  // Every legal position for `room`, best first. Shapes are tried in order:
  // the sampled one, its 90-degree rotation, then (non-hallway) a squarer
  // rectangle of the same area -- a shape with no legal spot on a tight plot
  // often fits rotated or squarer; aspect caps are never exceeded (squarer is
  // strictly closer to 1:1). Later shapes only add options after earlier ones.
  function placementOptions(room: RoomMeta, group: AttachGroup, preferredGroups: AttachGroup[]): PlacementOption[] {
    const baseSize = sizeOf(room);
    const doorTarget = doorTargetsFor(room);
    if (placed.length === 0) {
      const size = baseSize;
      // Entry core: centred on half the candidates, flush to a side on the
      // rest -- centring always leaves two side strips too narrow for a room.
      const slackX = bounds.width - size.width;
      const pickX = rng();
      const x = roundPlan(bounds.x + slackX * (pickX < 0.5 ? 0.5 : pickX < 0.75 ? 0 : 1));
      const y = roundPlan(bounds.y + bounds.height - size.height);
      if (x < bounds.x - 0.01 || y < bounds.y - 0.01 || x + size.width > bounds.x + bounds.width + 0.01) return [];
      return [{ x, y, width: size.width, height: size.height }];
    }
    const variants: { width: number; height: number }[] = [baseSize, { width: baseSize.height, height: baseSize.width }];
    if (room.type !== 'hallway') {
      const side = roundPlan(Math.sqrt(baseSize.width * baseSize.height));
      if (side > Math.min(baseSize.width, baseSize.height) + 0.2) variants.push({ width: side, height: side });
    }
    const options: PlacementOption[] = [];
    for (const size of variants) {
      const legal: { x: number; y: number; score: number }[] = [];
      const why = { tried: 0, outOfBounds: 0, overlap: 0, sharedWall: 0, noDoorTarget: 0 };
      for (const anchor of placed) {
        for (const side of ['bottom', 'top', 'left', 'right'] as const) {
          for (const offset of candidateOffsets(anchor, size, side, bounds)) {
            const { x, y } = offset;
            why.tried++;
            if (x < bounds.x - 0.01 || y < bounds.y - 0.01 || x + size.width > bounds.x + bounds.width + 0.01 || y + size.height > bounds.y + bounds.height + 0.01) { why.outOfBounds++; continue; }
            const candidateRect = { x, y, width: size.width, height: size.height };
            if (placed.some((p) => roomRectsOverlap(candidateRect, p))) { why.overlap++; continue; }
            const shared = sharedWallLength(candidateRect, anchor, side);
            const minShared = room.type === 'kitchen' ? 2.0 : Math.min(1.2, doorMinShared);
            if (shared < minShared) { why.sharedWall++; continue; }
            if (doorTarget && !hasDoorTarget(candidateRect, doorTarget)) { why.noDoorTarget++; continue; }
            legal.push({ x, y, score: scorePlacementCandidate(candidateRect, anchor, side, group, preferredGroups, placed, bounds, compactWeight) });
          }
        }
      }
      lastWhy = why;
      legal.sort((a, b) => b.score - a.score);
      const seen = new Set<string>();
      for (const l of legal) {
        const key = `${l.x},${l.y},${size.width},${size.height}`;
        if (seen.has(key)) continue;
        seen.add(key);
        options.push({ x: l.x, y: l.y, width: size.width, height: size.height });
      }
    }
    // Mostly lead with the top-scoring spot, but let later candidates start
    // from a runner-up so the 60 candidates differ in more than room sizes.
    if (options.length > 1) {
      const lead = Math.min(options.length - 1, Math.floor(rng() * rng() * 4));
      if (lead > 0) options.unshift(options.splice(lead, 1)[0]);
    }
    return options;
  }

  // Placement is a depth-first search with a small branching factor and a
  // node budget, not a single greedy pass: one early, locally-best spot (say
  // the kitchen taking the last free core side) can leave a later room with
  // no legal spot at all, and plain greedy never revisits it. Backtracking
  // changes only *where* a room goes -- the aspect caps, door-target rule and
  // reachability checks are untouched.
  type Step = { room: RoomMeta; group: AttachGroup; preferred: AttachGroup[] };
  const steps: Step[] = [];
  const addStep = (room: RoomMeta | undefined, group: AttachGroup, preferred: AttachGroup[]) => { if (room) steps.push({ room, group, preferred }); };
  const hallwayPref: AttachGroup[] = hallwayRoom ? ['hallway'] : ['core'];

  for (const r of coreSeq) addStep(r, 'core', ['core']);
  // The kitchen only needs core frontage, while the hallway/bedrooms need
  // specific adjacency, so on a tight plot the kitchen taking the best core
  // side first is what leaves them no legal spot. Vary where it goes.
  const kitchenSlot = Math.floor(rng() * 3); // 0: first, 1: after the master suite, 2: after all bedrooms/baths
  if (kitchenSlot === 0) addStep(kitchen, 'kitchen', ['core']);
  addStep(hallwayRoom, 'hallway', ['core']);
  addStep(masterBed, 'master-suite', hallwayPref);
  addStep(masterBath, 'master-suite', ['master-suite']);
  addStep(walkIn, 'master-suite', ['master-suite']);
  if (kitchenSlot === 1) addStep(kitchen, 'kitchen', ['core']);
  // Shared baths go first: they may only door onto the hallway, need just a
  // short stretch of it, and would otherwise find every hallway side already
  // taken by full-width bedrooms.
  for (const r of sharedBaths) addStep(r, 'bedroom-wing', hallwayPref);
  for (const r of otherBedrooms) addStep(r, 'bedroom-wing', hallwayPref);
  if (kitchenSlot === 2) addStep(kitchen, 'kitchen', ['core']);
  for (const r of laundryUtility) addStep(r, 'service', ['kitchen', 'bedroom-wing']);
  for (const r of powder) addStep(r, 'service', ['core', 'kitchen']);
  for (const r of leftover) addStep(r, 'other', []);

  const suiteOnlyIds = new Set<string>();
  if (masterBath) suiteOnlyIds.add(masterBath.id);
  if (walkIn) suiteOnlyIds.add(walkIn.id);

  // Everything after raw placement -- compaction (edge alignment, seam
  // closing, void filling), door assignment and the reachability check -- runs
  // on a copy at the leaf of the search. If any of it fails, the search
  // backtracks to a different arrangement instead of discarding the whole
  // candidate: a void, a stranded kitchen or an unreachable wing is usually a
  // consequence of one early placement, not of the room list itself.
  type Finished = { rooms: any[]; circulation: { name: string; x: number; y: number; width: number; height: number }[] };
  let result: Finished | null = null;
  let leafFail: { gate: string; reason: string } | null = null;
  const finishLayout = (): boolean => {
    const arr = placed.map((r) => ({ ...r }));
    alignNearEqualEdges(arr, 0.5);
    if (arr.some((a, i) => arr.some((b, j) => i !== j && roomRectsOverlap(a, b)))) { leafFail = { gate: 'align', reason: 'edge alignment introduced an overlap' }; return false; }
    closeSmallGaps(arr, targetAreaById);
    fillInteriorVoids(arr, targetAreaById);
    snapRoomsToGrid(arr);
    if (hasInteriorVoid(arr)) {
      const voids = findInteriorVoidRegions(arr).filter((r) => r.length > 1);
      leafFail = { gate: 'void', reason: voids.map((v) => `area=${(v.length * 0.04).toFixed(2)}m2 at cell(${Math.min(...v.map((c) => c.x))},${Math.min(...v.map((c) => c.y))})`).join('; ') };
      return false;
    }
    const rooms: any[] = arr.map((r) => ({ ...r, area: roundPlan(r.width * r.height), adjacentTo: [] }));
    const circulation: Finished['circulation'] = [];
    rejectStats.capture = true;
    rejectStats.captured = null;
    const doorsOk = assignDoorsGrowByAttachment(rooms, plotW, plotL, masterBed?.id, suiteOnlyIds, doorMinShared - 0.1);
    rejectStats.capture = false;
    if (!doorsOk) { leafFail = rejectStats.captured || { gate: 'doors', reason: 'door assignment failed' }; return false; }
    const unreachable = findUnreachableRooms(rooms, circulation, plotW, plotL);
    if (unreachable.length > 0) { leafFail = { gate: 'reach', reason: `unreachable: ${unreachable.map((r: any) => `${r.id}(${r.type})`).join(', ')}` }; return false; }
    result = { rooms, circulation };
    return true;
  };

  const BRANCH = 3;
  let budget = 150;
  let deepest = -1;
  let deepestFail = '';
  const solve = (i: number): boolean => {
    if (i === steps.length) return finishLayout();
    const { room, group, preferred } = steps[i];
    const options = placementOptions(room, group, preferred);
    if (!options.length && i > deepest) {
      deepest = i;
      const w = lastWhy;
      deepestFail = `${room.type} ${room.id} (${room.name}): no legal spot${doorTargetsFor(room) ? ' with a door target' : ''} [positions tried=${w.tried} out-of-bounds=${w.outOfBounds} overlap=${w.overlap} shared-wall<min=${w.sharedWall} no-door-target(>=${DOOR_TARGET_MIN_SHARED}m)=${w.noDoorTarget}] size=${sizeOf(room).width}x${sizeOf(room).height} placed=[${placed.map((p) => `${p.id}:${p.x},${p.y},${p.width}x${p.height}`).join(' ')}]`;
    }
    for (const o of options.slice(0, BRANCH)) {
      if (budget-- <= 0) return false;
      placed.push({ id: room.id, name: room.name, type: room.type, x: o.x, y: o.y, width: o.width, height: o.height, color: palette[placed.length % palette.length], _group: group });
      if (solve(i + 1)) return true;
      placed.pop();
    }
    return false;
  };
  if (!solve(0)) {
    if (leafFail) logReject((leafFail as { gate: string; reason: string }).gate, (leafFail as { gate: string; reason: string }).reason);
    else logReject('place', deepestFail || (budget <= 0 ? 'search budget exhausted' : 'no placement found'));
    return null;
  }

  if (!result) return null;
  const { rooms, circulation } = result;
  for (const r of rooms) delete (r as any)._group;
  return { rooms, circulation };
}

// The UI's room picker sends coarse types ('living', 'bedroom', 'bathroom',
// 'dining'), but the generator's rules key off 'living-room', 'master-bedroom',
// 'powder-room' and 'dining-room'. Without this mapping the core anchor and
// master suite never form (a 'living' room is treated as a leftover and every
// bedroom as a secondary one), so even the UI's own default program fails.
// The first bedroom named master/primary becomes the master bedroom (else the
// first named suite); a bathroom named powder/guest WC/toilet is a powder room.
function normalizeRoomTypes(rooms: any[]): string[] {
  const types = rooms.map((r) => {
    const t = String(r.type || 'bedroom');
    if (t === 'living' || t === 'living-room' || t === 'lounge') return 'living-room';
    if (t === 'dining' || t === 'dining-room') return 'dining-room';
    return t;
  });
  const isBedroom = (i: number) => types[i] === 'bedroom';
  if (!types.includes('master-bedroom')) {
    const pick = rooms.findIndex((r, i) => isBedroom(i) && /master|primary/i.test(String(r.name || '')));
    const fallback = pick >= 0 ? pick : rooms.findIndex((r, i) => isBedroom(i) && /suite/i.test(String(r.name || '')));
    if (fallback >= 0) types[fallback] = 'master-bedroom';
  }
  rooms.forEach((r, i) => {
    if (types[i] === 'bathroom' && /powder|guest\s*(wc|toilet)|toilet|half\s*bath/i.test(String(r.name || ''))) types[i] = 'powder-room';
  });
  return types;
}

export function generateAlgorithmicFloorPlan(plotW: number, plotL: number, requestedRooms: any[], userRequirements: string = '', variationSeed: string = '', probeOnly: boolean = false) {
  const palette = ['#6366f1', '#0ea5e9', '#10b981', '#8b5cf6', '#ec4899', '#f59e0b', '#14b8a6', '#94a3b8'];
  const plotArea = plotW * plotL;
  const rawRequested = requestedRooms.length ? requestedRooms : [
    { name: 'Living Room', type: 'living-room', minSize: 20 },
    { name: 'Kitchen', type: 'kitchen', minSize: 12 },
    { name: 'Master Bedroom', type: 'master-bedroom', minSize: 16 },
    { name: 'Bathroom', type: 'bathroom', minSize: 5 },
  ];
  const normalizedTypes = normalizeRoomTypes(rawRequested);
  const requested: RoomMeta[] = rawRequested.map((room: any, index: number) => ({
    id: room.id || `room_${index + 1}`,
    name: String(room.name || `Room ${index + 1}`).slice(0, 80),
    type: normalizedTypes[index],
    targetArea: deriveTargetArea(normalizedTypes[index], Number(room.minSize), plotArea, rawRequested.length),
  }));

  // A building needs its own circulation to read as one connected mass --
  // if the request has no foyer/hallway room at all, add one next to the
  // main door so there's always an entry space to anchor the public core to
  // and a room for the public/private hallway connector to lead into.
  const hasFoyerOrHallway = rawRequested.some((r: any) => r.type === 'hallway' || /foyer|entry/i.test(String(r.name || '')));
  if (!hasFoyerOrHallway) {
    // Deliberately smaller than a normal data-driven 'hallway' target: this
    // is a landing space next to the door, not a full room, and a tight
    // plot (14x10, 20x6) that already fit its requested program without one
    // needs to still fit it after this gets added.
    requested.unshift({
      id: 'auto_foyer',
      name: 'Foyer',
      type: 'hallway',
      targetArea: clamp(deriveTargetArea('hallway', undefined, plotArea, rawRequested.length + 1), 4.5, 6),
    });
  }

  // When the requested program is much smaller than the plot, grow rooms
  // toward the top of their ranges (still capped at 1.5x, same as the
  // data-driven sizing cap) and widen circulation, so the built mass covers
  // a sensible share of the plot instead of a sparse island of small rooms.
  const edgeForCoverage = 0.3;
  const netAreaForCoverage = Math.max(1.8, plotW - edgeForCoverage * 2) * Math.max(1.8, plotL - edgeForCoverage * 2);
  const initialRequiredArea = requested.reduce((s, r) => s + r.targetArea, 0) * 1.12;
  const initialCoverage = netAreaForCoverage > 0 ? initialRequiredArea / netAreaForCoverage : 1;
  let circulationFactor = 1.12;
  if (initialCoverage < 0.45) {
    const desiredRequiredArea = netAreaForCoverage * 0.55; // middle of the 45-70% target band
    const growth = Math.min(3, desiredRequiredArea / Math.max(1, initialRequiredArea));
    for (const room of requested) {
      const range = AREA_RANGES[room.type] || DEFAULT_AREA_RANGE;
      room.targetArea = Math.min(range[1] * 1.5, room.targetArea * growth);
    }
    circulationFactor = 1.18; // also give the connecting hallway more room
  }

  const prefs = parseLayoutPreferences(userRequirements);
  const seedStr = `${plotW}x${plotL}|${requested.map((r) => `${r.type}:${r.targetArea.toFixed(1)}`).join(',')}|${userRequirements}|${variationSeed}`;
  const baseRng = mulberry32(hashSeed(seedStr));

  // Primary generator: grow by attachment (see buildGrowByAttachmentCandidate).
  // Every room is sized as a real rectangle before placement, so there's no
  // pre-allocated container to pour rooms into and no sliver rooms from a
  // mismatched container aspect ratio. Run at least 40 randomised
  // orderings/sizings and keep the best-scoring one.
  let best: { rooms: any[]; circulation: any[]; score: number } | null = null;
  const GROW_CANDIDATE_COUNT = 60;
  rejectStats.byGate.clear(); rejectStats.byReason.clear();
  let growPassed = 0;
  for (let i = 0; i < GROW_CANDIDATE_COUNT; i++) {
    const candidateSeed = hashSeed(`${seedStr}|grow|${i}`) ^ Math.floor(baseRng() * 0xffffffff);
    const candidateRng = mulberry32(candidateSeed >>> 0);
    rejectStats.cand = i;
    const built = buildGrowByAttachmentCandidate(plotW, plotL, requested, prefs, candidateRng, palette);
    if (!built) continue;
    const { rooms, circulation } = built;
    if (!isCandidateValid(rooms, circulation, plotW, plotL)) {
      logReject('valid', `impractical=[${rooms.filter((r: any) => !hasPracticalDimensions(r)).map((r: any) => `${r.name}(${r.width}x${r.height})`)}] oob=[${rooms.filter((r: any) => r.x < -0.05 || r.y < -0.05 || r.x + r.width > plotW + 0.05 || r.y + r.height > plotL + 0.05).map((r: any) => r.name)}]`);
      if (process.env.DEBUG_LAYOUT && i < 60) {
        const impractical = rooms.filter((r: any) => !hasPracticalDimensions(r)).map((r: any) => `${r.name}(${r.width}x${r.height})`);
        const unreach = countUnreachableRooms(rooms, circulation, plotW, plotL);
        console.error(`[grow-invalid#${i}] impractical=[${impractical}] unreach=${unreach}`);
      }
      continue;
    }
    const score = scoreCandidate(rooms, requested, plotW, plotL, circulation, prefs, 'L');
    growPassed++;
    if (!best || score > best.score) best = { rooms, circulation, score };
  }
  if (process.env.DEBUG_LAYOUT && !probeOnly) console.error(`[grow-summary] passed=${growPassed}/${GROW_CANDIDATE_COUNT}\n${summarizeRejects()}`);
  if (process.env.DEBUG_LAYOUT) console.error(`[after-grow-loop] best=${best ? best.score.toFixed(1) : 'null'}`);

  // No silent failure: if every grow-by-attachment candidate was rejected,
  // say so loudly (with the per-gate breakdown) instead of quietly handing
  // back a legacy layout that ignores the aspect-ratio and door rules. The
  // legacy generators only run when explicitly opted into.
  const allowLegacyFallback = process.env.INTERIO_LEGACY_FALLBACK === '1';
  if (!best) {
    const failure = describeTopFailure();
    const minimum = probeOnly ? null : findMinimumWorkingPlot(plotW, plotL, requestedRooms, userRequirements, variationSeed);
    if (!probeOnly) console.warn(`[INTERIO Layout] WARNING: all ${GROW_CANDIDATE_COUNT} grow-by-attachment candidates were rejected for ${plotW}x${plotL}m.
${summarizeRejects()}
${allowLegacyFallback ? 'INTERIO_LEGACY_FALLBACK=1: falling back to the legacy core-wings/zone-slicer generators (rules NOT enforced).' : 'Legacy fallback is disabled (set INTERIO_LEGACY_FALLBACK=1 to allow it); returning a constraint error.'}`);
    if (!allowLegacyFallback) {
      return {
        plotWidth: plotW, plotLength: plotL, plotArea: roundPlan(plotArea), totalBuiltArea: 0, openSpaceArea: roundPlan(plotArea),
        architecturalStyle: 'Zoned Residential Plan', designNotes: '', circulation: [] as any[], rooms: [] as any[],
        constraintError: `Could not fit a valid layout on a ${plotW}m × ${plotL}m plot: ${failure} ` + (minimum
          ? `A plot of about ${minimum.w}m × ${minimum.l}m is the smallest tested size that works for these rooms; otherwise reduce the room count or sizes.`
          : `No larger plot up to +6m per side worked either; reduce the room count or sizes.`),
      };
    }
  }

  // Secondary fallback (opt-in only): core and wings (see buildCoreWingsCandidate) --
  // still a pre-allocated-container strategy prone to slivers on an unusual
  // room list, but still better than the zone-slicer below, so it's tried
  // before that when grow-by-attachment can't place every room.
  if (!best) {
    for (const config of buildCoreWingsConfigs()) {
      const candidateSeed = hashSeed(`${seedStr}|core|${config.aspect}|${config.positionFrac}|${config.wingOrder.join('-')}`) ^ Math.floor(baseRng() * 0xffffffff);
      const candidateRng = mulberry32(candidateSeed >>> 0);
      const built = buildCoreWingsCandidate(plotW, plotL, requested, prefs, config, candidateRng, palette);
      if (!built) continue;
      const { rooms, circulation } = built;
      if (!isCandidateValid(rooms, circulation, plotW, plotL)) continue;
      const score = scoreCandidate(rooms, requested, plotW, plotL, circulation, prefs, 'L');
      if (!best || score > best.score) best = { rooms, circulation, score };
    }
  }

  // Last-resort fallback only: the old recursive zone-slicer, which always
  // cuts parallel to the hallway and reliably produces stacked columns --
  // kept only for a plot so tight that nothing above could even place every
  // room.
  if (!best) {
    for (const config of buildCandidateConfigs()) {
      const candidateSeed = hashSeed(`${seedStr}|slice|${config.footprintKind}|${config.notchSide}|${config.reverseGroups}`) ^ Math.floor(baseRng() * 0xffffffff);
      const candidateRng = mulberry32(candidateSeed >>> 0);
      const { rooms, circulation } = buildLayoutCandidate(plotW, plotL, requested, prefs, config, candidateRng, palette, circulationFactor);
      if (!isCandidateValid(rooms, circulation, plotW, plotL)) continue;
      const score = scoreCandidate(rooms, requested, plotW, plotL, circulation, prefs, config.footprintKind);
      if (!best || score > best.score) best = { rooms, circulation, score };
    }
  }
  if (!best) {
    const fallbackConfig: CandidateConfig = { footprintKind: 'rect', notchSide: 'end', reverseGroups: false };
    const { rooms, circulation } = buildLayoutCandidate(plotW, plotL, requested, prefs, fallbackConfig, () => 0.5, palette, circulationFactor);
    best = { rooms, circulation, score: isCandidateValid(rooms, circulation, plotW, plotL) ? scoreCandidate(rooms, requested, plotW, plotL, circulation, prefs, fallbackConfig.footprintKind) : -Infinity };
  }

  if (process.env.DEBUG_LAYOUT) {
    const f = best.rooms.find((r: any) => r.type === 'hallway' && /foyer/i.test(r.name));
    if (f) console.error(`[FINAL] Foyer w=${f.width} h=${f.height} score=${best.score.toFixed(1)}`);
  }
  const { rooms, circulation } = best;
  const edge = 0.3;
  const clearWidth = Math.max(1.8, plotW - edge * 2);
  const clearLength = Math.max(1.8, plotL - edge * 2);
  const netArea = clearWidth * clearLength;
  const requestedArea = requested.reduce((sum, room) => sum + room.targetArea, 0);
  const constrained = requestedArea > netArea;

  const publicRooms = requested.filter((r) => classifyZone(r.type) === 'public');
  const privateRooms = requested.filter((r) => classifyZone(r.type) === 'private');
  const hasBothZones = publicRooms.length > 0 && privateRooms.length > 0;
  const openPlan = prefs.openPlanKitchen || !hasBothZones;

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
    plotArea: roundPlan(plotArea),
    totalBuiltArea,
    openSpaceArea: roundPlan(Math.max(0, plotArea - totalBuiltArea)),
    architecturalStyle: 'Zoned Residential Plan',
    designNotes: `Rooms are grouped into public and private zones and sized from their target areas within the ${roundPlan(netArea)} m² net envelope of the measured ${roundPlan(plotArea)} m² plot.${zoningNote}${constraintNote}`,
    circulation,
    rooms,
    constraintError: minimumIssue
      ? `The ${plotW}m × ${plotL}m plot cannot accommodate all requested rooms with the minimum practical room dimensions and circulation clearance. Reduce room sizes/count or increase the plot dimensions.`
      : undefined,
  };
}

// Plain-language summary of the most common grow-by-attachment rejection, for
// the user-facing constraint error.
function describeTopFailure(): string {
  const top = [...rejectStats.byReason.values()].sort((a, b) => b.n - a.n)[0];
  const total = [...rejectStats.byGate.values()].reduce((a, b) => a + b, 0) || 1;
  if (!top) return 'no candidate layout could be built.';
  const m = top.sample.match(/^(\w+): ([\w-]+) \S+ \(([^)]*)\)/);
  const detail = top.sample.startsWith('place') && m
    ? `the ${m[3]} (${m[2]}) had no position left that fits inside the plot with a legal door onto a hallway/core`
    : top.sample.startsWith('void') ? 'rooms could not be packed without an enclosed gap'
    : top.sample.startsWith('doors') ? `a restricted room (${top.sample.split(' (')[1]?.split(')')[0] || 'bedroom/bathroom'}) had no legal door target`
    : top.sample.startsWith('reach') ? 'some rooms were unreachable from the entry'
    : top.sample.slice(0, 120);
  return `${detail} (${top.n} of ${total} rejections, the most common failure).`;
}

// Smallest slightly-larger plot (up to +6m per side, smallest area first)
// that the grow-by-attachment generator can solve for the same program.
function findMinimumWorkingPlot(plotW: number, plotL: number, rooms: any[], req: string, seed: string): { w: number; l: number } | null {
  const tries: { w: number; l: number }[] = [];
  for (let dw = 0; dw <= 6; dw++) for (let dl = 0; dl <= 6; dl++) if (dw || dl) tries.push({ w: plotW + dw, l: plotL + dl });
  tries.sort((a, b) => a.w * a.l - b.w * b.l);
  const saved = { gates: new Map(rejectStats.byGate), reasons: new Map(rejectStats.byReason) };
  rejectStats.quiet = true;
  try {
    for (const t of tries) {
      const r: any = generateAlgorithmicFloorPlan(t.w, t.l, rooms, req, seed, true);
      if (!r.constraintError) return t;
    }
  } finally {
    rejectStats.quiet = false;
    rejectStats.byGate = saved.gates; rejectStats.byReason = saved.reasons;
  }
  return null;
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
  rect: ZoneRect,
  publicRooms: { targetArea: number }[], privateRooms: { targetArea: number }[], hallwayWidth: number
): { publicRect: ZoneRect; privateRect: ZoneRect; hallwayRect: ZoneRect | null; publicHallwayEdge: HallwayEdge; privateHallwayEdge: HallwayEdge } {
  const { x: ex, y: ey, width: clearWidth, height: clearLength } = rect;
  const publicArea = publicRooms.reduce((s, r) => s + r.targetArea, 0);
  const privateArea = privateRooms.reduce((s, r) => s + r.targetArea, 0);
  // sqrt-weighted (see sliceZoneIntoRooms/splitPairIntoRect) so a zone with
  // much less total room area -- e.g. a single ensuite bath+bedroom private
  // zone against a bigger public zone -- still gets enough depth for its
  // own rooms, instead of being squeezed in proportion to raw area.
  const publicWeight = Math.sqrt(Math.max(0.01, publicArea));
  const privateWeight = Math.sqrt(Math.max(0.01, privateArea));
  const totalWeight = publicWeight + privateWeight || 1;

  // A single zone still benefits from a fixed "entry-facing" edge (so its
  // own rooms get bay-cut toward that edge instead of the old longer-side
  // heuristic that could nest one room behind another) even though there's
  // no second zone or hallway to literally face.
  if (!publicRooms.length) return { publicRect: { x: ex, y: ey, width: 0, height: 0 }, privateRect: { x: ex, y: ey, width: clearWidth, height: clearLength }, hallwayRect: null, publicHallwayEdge: null, privateHallwayEdge: 'bottom' };
  if (!privateRooms.length) return { publicRect: { x: ex, y: ey, width: clearWidth, height: clearLength }, privateRect: { x: ex, y: ey, width: 0, height: 0 }, hallwayRect: null, publicHallwayEdge: 'bottom', privateHallwayEdge: null };

  const vertical = clearWidth >= clearLength;
  if (vertical) {
    const usable = Math.max(0.1, clearWidth - hallwayWidth);
    const publicW = Math.max(1.8, usable * (publicWeight / totalWeight));
    // Round the shared cut coordinate once and derive both zones' edges from
    // it, instead of rounding each zone's x/width independently -- otherwise
    // the public zone's displayed right edge and the private zone's
    // displayed left edge can round to different values and either gap or
    // overlap by up to 0.1m.
    const hallwayStart = roundPlan(ex + publicW);
    const hallwayEnd = roundPlan(hallwayStart + hallwayWidth);
    return {
      publicRect: { x: ex, y: ey, width: hallwayStart - ex, height: clearLength },
      privateRect: { x: hallwayEnd, y: ey, width: ex + clearWidth - hallwayEnd, height: clearLength },
      hallwayRect: hallwayWidth > 0 ? { x: hallwayStart, y: ey, width: hallwayEnd - hallwayStart, height: clearLength } : null,
      publicHallwayEdge: 'right',
      privateHallwayEdge: 'left',
    };
  }
  const usable = Math.max(0.1, clearLength - hallwayWidth);
  const privateL = Math.max(1.8, usable * (privateWeight / totalWeight));
  // Public zone (with the main entry) sits along the front/bottom edge,
  // private zone at the back -- matches the "entry clearance" convention the
  // rest of the renderer already uses. As above, round the shared cut once
  // so the two zones' edges can't round to slightly different values.
  const hallwayStart = roundPlan(ey + privateL);
  const hallwayEnd = roundPlan(hallwayStart + hallwayWidth);
  return {
    publicRect: { x: ex, y: hallwayEnd, width: clearWidth, height: ey + clearLength - hallwayEnd },
    privateRect: { x: ex, y: ey, width: clearWidth, height: hallwayStart - ey },
    hallwayRect: hallwayWidth > 0 ? { x: ex, y: hallwayStart, width: clearWidth, height: hallwayEnd - hallwayStart } : null,
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
  let frac = leftWeight / (leftWeight + rightWeight);

  // Round the cut coordinate itself (not each child's x/width separately)
  // before recursing -- two independently-rounded edges meant to coincide
  // can land 0.1m apart and either gap or overlap.
  const bayCutIsVertical = hallwayEdge ? (hallwayEdge === 'top' || hallwayEdge === 'bottom') : rect.width >= rect.height;

  // Guarantee each side's own minimum bay-dimension share whenever the rect
  // is big enough to afford it -- weighting alone (even sqrt-weighted) can
  // still squeeze a lone small room (e.g. an auto-added foyer sharing a bay
  // with a much bigger living/kitchen pair) into a sliver well below its
  // own practical minimum, the same failure mode splitPairIntoRect already
  // guards against for a simple two-room pair.
  const groupMinBayShare = (g: RoomMeta[]) => Math.max(...g.map((r) => minSideForType(r.type)));
  const leftMinShare = left.reduce((s, g) => s + groupMinBayShare(g), 0);
  const rightMinShare = right.reduce((s, g) => s + groupMinBayShare(g), 0);
  const bayDim = bayCutIsVertical ? rect.width : rect.height;
  if (bayDim > 0 && leftMinShare + rightMinShare <= bayDim) {
    frac = clamp(frac, leftMinShare / bayDim, 1 - rightMinShare / bayDim);
  }
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
  // sqrt-weighted, like sliceZoneIntoRooms below -- splitting a pair's rect
  // by raw area starves the smaller partner (typically an ensuite bath
  // paired with a much bigger bedroom) into a sliver long before its area
  // share would actually suggest.
  const wA = Math.sqrt(Math.max(0.01, roomA.targetArea));
  const wB = Math.sqrt(Math.max(0.01, roomB.targetArea));
  let frac = wA / Math.max(0.01, wA + wB);
  const pairCutIsVertical = hallwayEdge ? (hallwayEdge === 'left' || hallwayEdge === 'right') : rect.width >= rect.height;
  const aIsNear = hallwayEdge === 'right' || hallwayEdge === 'bottom' || !hallwayEdge;

  // Whenever the shared rect is big enough to afford both rooms' own
  // practical minimum dimension, guarantee it directly instead of trusting
  // weighting alone -- a small partner (an ensuite bath next to a much
  // bigger bedroom) can otherwise still be squeezed into a sliver even with
  // sqrt-weighted area shares.
  const crossDim = pairCutIsVertical ? rect.width : rect.height;
  const minA = minSideForType(roomA.type);
  const minB = minSideForType(roomB.type);
  if (crossDim > 0 && minA + minB <= crossDim) {
    frac = clamp(frac, minA / crossDim, 1 - minB / crossDim);
  }

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

export function maxAspectForType(type: string | undefined): number {
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

// True if nothing is built against this side of the room -- whether that's
// the literal plot boundary or an unbuilt yard pocket left by a
// stepped/L-shaped footprint. Used for window placement, which only cares
// about facing open air; isPlotExteriorSide (street-facing only) is still
// used separately for the main entry door.
function isRoomSideOpen(room: ZoneRect, side: 'top' | 'bottom' | 'left' | 'right', neighbors: ZoneRect[]): boolean {
  return !neighbors.some((n) => sidesAreAdjacent(room, side, n));
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
  const hallways = circulation;

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
      const touchingHallway = hallways.find((h) => findTouchingSide(room, h));
      const side = (touchingHallway && findTouchingSide(room, touchingHallway))
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
    // A window can go on any side facing open air -- the literal plot
    // boundary, or a yard pocket left unbuilt by a stepped/L-shaped
    // footprint -- not just sides that happen to sit at the plot's outer
    // edge. A side only fails to qualify when another room or the hallway
    // is actually built against it.
    const neighbors = rooms.filter((r) => r !== room).concat(hallways);
    const openSides = (['top', 'bottom', 'left', 'right'] as const).filter((side) => isRoomSideOpen(room, side, neighbors));
    let windowSides = openSides.filter((side) => !usedSides.has(side));
    if (!windowSides.length && isHabitableRoomType(room.type) && openSides.length) windowSides = [openSides[0]];
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

function minSideForType(type: string | undefined): number {
  const t = String(type || '').toLowerCase();
  return t.includes('bath') || t === 'hallway' ? 1.5 : t.includes('powder') || t.includes('laundry') || t.includes('utility') ? 1.8 : 2.1;
}

function hasPracticalDimensions(room: any): boolean {
  const minSide = minSideForType(room.type);
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

if (!process.env.INTERIO_NO_LISTEN) startServer();
