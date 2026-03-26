const STORAGE_KEY = 'er-diagram-tool';
const TOKEN_KEY = 'er-diagram-edit-token';
const LOCAL_TOKEN_PREFIX = 'local:';

// Detect dev mode (Vite sets this)
const isDev = import.meta.env.DEV;

// ---- Edit token management ----

export function getEditToken() {
  try {
    return sessionStorage.getItem(TOKEN_KEY) || null;
  } catch {
    return null;
  }
}

export function setEditToken(token) {
  try {
    if (token) {
      sessionStorage.setItem(TOKEN_KEY, token);
    } else {
      sessionStorage.removeItem(TOKEN_KEY);
    }
  } catch { /* ignore */ }
}

// ---- Browser-native SHA-256 (works in all modern browsers + Vercel edge) ----

async function hashPasswordBrowser(password) {
  const data = new TextEncoder().encode(password);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// ---- Auth operations ----

export async function unlockEdit(password, projectId) {
  if (isDev) {
    try {
      const res = await fetch('/api/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, projectId }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      if (data.ok && data.token) {
        setEditToken(data.token);
        return true;
      }
    } catch { /* API not available */ }
    return false;
  }
  // Production: verify password against hash stored in localStorage
  const local = loadFromLocalStorage();
  const project = local?.projects?.find(p => p.id === projectId);
  if (!project?.passwordHash) return false;
  const hash = await hashPasswordBrowser(password);
  if (hash !== project.passwordHash) return false;
  setEditToken(`${LOCAL_TOKEN_PREFIX}${projectId}`);
  return true;
}

export async function lockEdit() {
  const token = getEditToken();
  // In dev mode, tell server to invalidate token
  if (isDev && token && !token.startsWith(LOCAL_TOKEN_PREFIX)) {
    await fetch('/api/lock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    }).catch(() => {});
  }
  setEditToken(null);
}

export async function checkEditToken() {
  const token = getEditToken();
  if (!token) return false;
  // Local token (production or local fallback) — just check it exists
  if (token.startsWith(LOCAL_TOKEN_PREFIX)) return true;
  // Dev mode: verify with server
  if (isDev) {
    try {
      const res = await fetch(`/api/check-token?token=${encodeURIComponent(token)}`);
      if (!res.ok) { setEditToken(null); return false; }
      const data = await res.json();
      if (!data.valid) { setEditToken(null); return false; }
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

export async function changePassword(oldPassword, newPassword, projectId) {
  if (isDev) {
    const token = getEditToken();
    if (!token) return false;
    try {
      const res = await fetch('/api/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldPassword, newPassword, projectId, token }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      return data.ok === true;
    } catch {
      return false;
    }
  }
  // Production: verify old password and update hash directly in localStorage
  const local = loadFromLocalStorage();
  const project = local?.projects?.find(p => p.id === projectId);
  if (!project?.passwordHash) return false;
  const oldHash = await hashPasswordBrowser(oldPassword);
  if (oldHash !== project.passwordHash) return false;
  const newHash = await hashPasswordBrowser(newPassword);
  project.passwordHash = newHash;
  saveToLocalStorage(local);
  return newHash; // return new hash so store can update state
}

/**
 * Hash a password. Uses browser crypto.subtle (SHA-256) — same output as
 * the server-side Node.js SHA-256, so hashes are compatible across envs.
 */
export async function hashPasswordClient(password) {
  try {
    return await hashPasswordBrowser(password);
  } catch {
    // Fallback: call server in dev mode
    if (isDev) {
      try {
        const res = await fetch('/api/hash-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password }),
        });
        const data = await res.json();
        if (data.hash) return data.hash;
      } catch { /* ignore */ }
    }
    // Last-resort weak hash
    let h = 0x811c9dc5;
    for (let i = 0; i < password.length; i++) {
      h ^= password.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return 'fnv:' + (h >>> 0).toString(16).padStart(8, '0');
  }
}

// ---- Per-project file-based storage (dev mode via Vite plugin) ----

/** Load list of all projects from server */
async function loadProjectsFromFile() {
  try {
    console.log('[Storage] Fetching /api/projects...');
    const res = await fetch('/api/projects');
    console.log('[Storage] Response status:', res.status);
    if (!res.ok) {
      console.error('[Storage] API returned error:', res.status, res.statusText);
      return [];
    }
    const projects = await res.json();
    console.log('[Storage] Loaded', projects.length, 'projects from API');
    return projects || [];
  } catch (err) {
    // API failed - return empty (no localStorage fallback)
    console.error('[Storage] API fetch failed:', err);
    return [];
  }
}

/** Load a single project from server */
export async function loadProjectFromFile(projectId) {
  try {
    const res = await fetch(`/api/project/${projectId}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** Save a single project to server */
export async function saveProjectToFile(projectId, data) {
  try {
    const res = await fetch(`/api/project/${projectId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data, null, 2),
    });
    if (!res.ok) {
      console.error(`[Storage] Save failed for project ${projectId}: ${res.status} ${res.statusText}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[Storage] Save error:', err);
    return false;
  }
}

/** Delete a project file on server */
export async function deleteProjectFromFile(projectId) {
  try {
    const res = await fetch(`/api/project/${projectId}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      console.error(`[Storage] Delete failed for project ${projectId}: ${res.status} ${res.statusText}`);
    }
  } catch (err) {
    console.error('[Storage] Delete error:', err);
  }
}

/** Load meta (darkMode, etc.) from server */
async function loadMetaFromFile() {
  try {
    const res = await fetch('/api/meta');
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** Save meta to server */
async function saveMetaToFile(data) {
  try {
    await fetch('/api/meta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data, null, 2),
    });
  } catch {
    // API not available
  }
}

// ---- localStorage fallback ----

function loadFromLocalStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveToLocalStorage(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // storage full or unavailable
  }
}

// ---- Public API ----

/**
 * Load all data: in dev mode, loads from per-project files.
 * Returns { projects: [...], meta: { darkMode, ... } }
 */
export async function loadFromStorage() {
  if (isDev) {
    const [projects, meta] = await Promise.all([
      loadProjectsFromFile(),
      loadMetaFromFile(),
    ]);
    return {
      projects: projects || [],
      darkMode: meta?.darkMode || false,
    };
  }
  // Production mode: load from localStorage
  const local = loadFromLocalStorage();
  return {
    projects: local?.projects || [],
    darkMode: local?.darkMode || false,
  };
}

/**
 * Save a single project to storage.
 */
export async function saveProject(projectId, projectData) {
  // Update localStorage (full state)
  const local = loadFromLocalStorage() || { projects: [], darkMode: false };
  const idx = local.projects.findIndex(p => p.id === projectId);
  if (idx >= 0) {
    local.projects[idx] = projectData;
  } else {
    local.projects.push(projectData);
  }
  saveToLocalStorage(local);

  if (isDev) {
    await saveProjectToFile(projectId, projectData);
  }
}

/**
 * Delete a project from storage.
 */
export async function deleteProjectStorage(projectId) {
  const local = loadFromLocalStorage() || { projects: [], darkMode: false };
  local.projects = local.projects.filter(p => p.id !== projectId);
  saveToLocalStorage(local);

  if (isDev) {
    await deleteProjectFromFile(projectId);
  }
}

/**
 * Save meta (darkMode, etc.) to storage.
 */
export async function saveMeta(meta) {
  const local = loadFromLocalStorage() || { projects: [], darkMode: false };
  local.darkMode = meta.darkMode;
  saveToLocalStorage(local);

  if (isDev) {
    await saveMetaToFile(meta);
  }
}
