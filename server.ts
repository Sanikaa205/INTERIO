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
