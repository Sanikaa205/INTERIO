import {
  FloorPlanResult,
  InteriorDesignResult,
  ReconstructionData,
  SavedProject,
  User,
} from '../types';

const API_BASE = '/api';

function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem('interio_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ----------------------------------------------------
// AUTH SERVICES
// ----------------------------------------------------
export async function loginUser(email: string, password: string): Promise<{ user: User; token: string }> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Login failed' }));
    throw new Error(err.error || 'Failed to login');
  }
  const data = await res.json();
  localStorage.setItem('interio_token', data.token);
  localStorage.setItem('interio_user', JSON.stringify(data.user));
  return data;
}

export async function registerUser(email: string, password: string, name?: string): Promise<{ user: User; token: string }> {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Registration failed' }));
    throw new Error(err.error || 'Failed to register');
  }
  const data = await res.json();
  localStorage.setItem('interio_token', data.token);
  localStorage.setItem('interio_user', JSON.stringify(data.user));
  return data;
}

export function getStoredUser(): User | null {
  try {
    const cached = localStorage.getItem('interio_user');
    if (!cached) return null;
    const parsed = JSON.parse(cached);
    if (parsed && typeof parsed === 'object' && (parsed.name || parsed.email)) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export async function getCurrentUser(): Promise<User | null> {
  const token = localStorage.getItem('interio_token');
  if (!token) return null;

  try {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { ...getAuthHeader() },
    });
    if (!res.ok) {
      localStorage.removeItem('interio_token');
      localStorage.removeItem('interio_user');
      return null;
    }
    const data = await res.json();
    if (data.user) {
      localStorage.setItem('interio_user', JSON.stringify(data.user));
      return data.user;
    }
    return null;
  } catch {
    return getStoredUser();
  }
}

export const loginApi = async (email: string, password: string): Promise<User> => {
  const result = await loginUser(email, password);
  return result.user;
};

export const registerApi = async (email: string, password: string, name?: string): Promise<User> => {
  const result = await registerUser(email, password, name);
  return result.user;
};

export function logoutUser(): void {
  localStorage.removeItem('interio_token');
  localStorage.removeItem('interio_user');
}

export const logoutApi = async (): Promise<void> => {
  logoutUser();
};

// ----------------------------------------------------
// PROJECT SERVICES
// ----------------------------------------------------
export async function fetchProjects(): Promise<SavedProject[]> {
  const res = await fetch(`${API_BASE}/projects`, {
    headers: { ...getAuthHeader() },
  });
  if (!res.ok) throw new Error('Failed to load projects');
  const data = await res.json();
  return data.projects || [];
}

export async function createProject(payload: {
  title: string;
  description?: string;
  type: SavedProject['type'];
  data: SavedProject['data'];
}): Promise<SavedProject> {
  const user = localStorage.getItem('interio_user');
  const userId = user ? JSON.parse(user).id : 'usr_demo_01';

  const res = await fetch(`${API_BASE}/projects`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
    },
    body: JSON.stringify({ ...payload, userId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to save project' }));
    throw new Error(err.error || 'Failed to save project');
  }
  const data = await res.json();
  return data.project;
}

export async function deleteProject(id: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}/projects/${id}`, {
    method: 'DELETE',
    headers: { ...getAuthHeader() },
  });
  if (!res.ok) throw new Error('Failed to delete project');
  return true;
}

export const fetchProjectsApi = fetchProjects;
export const saveProjectApi = createProject;
export const deleteProjectApi = deleteProject;

// ----------------------------------------------------
// GEMINI WORKFLOW SERVICES
// ----------------------------------------------------
export async function generateFloorPlanApi(params: {
  plotWidth: number;
  plotLength: number;
  rooms: { name: string; type: string; minSize: number }[];
}): Promise<FloorPlanResult> {
  const res = await fetch(`${API_BASE}/gemini/floorplan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to generate floor plan' }));
    throw new Error(err.error || 'Failed to generate floor plan');
  }
  return res.json();
}

export async function generateInteriorApi(params: {
  roomWidth: number;
  roomLength: number;
  style: string;
  budget: string;
  roomType: string;
}): Promise<InteriorDesignResult> {
  const res = await fetch(`${API_BASE}/gemini/interior`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to generate interior design' }));
    throw new Error(err.error || 'Failed to generate interior design');
  }
  return res.json();
}

export async function reconstructRoomApi(params: {
  imageBase64?: string;
  cornerPoints?: { x: number; y: number }[];
  style: string;
  budget: string;
  roomType: string;
}): Promise<ReconstructionData> {
  const res = await fetch(`${API_BASE}/gemini/reconstruct`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to analyze room' }));
    throw new Error(err.error || 'Failed to analyze room');
  }
  return res.json();
}
