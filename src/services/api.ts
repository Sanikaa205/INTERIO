import { User } from '../types';

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
