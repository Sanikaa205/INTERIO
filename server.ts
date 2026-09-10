import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
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
