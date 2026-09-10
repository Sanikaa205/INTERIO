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
