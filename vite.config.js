import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const DATA_DIR = 'data';
const PROJECTS_DIR = path.join(DATA_DIR, 'projects');
const META_FILE = path.join(DATA_DIR, 'meta.json');

// Active edit tokens (in-memory, cleared on server restart)
// tokenMap: token -> projectId
const activeTokens = new Map();

function readBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => resolve(body));
  });
}

function hashPassword(pw) {
  return crypto.createHash('sha256').update(pw).digest('hex');
}

function ensureDirs() {
  if (!fs.existsSync(PROJECTS_DIR)) {
    fs.mkdirSync(PROJECTS_DIR, { recursive: true });
  }
}

function readMeta() {
  try {
    if (fs.existsSync(path.resolve(META_FILE))) {
      return JSON.parse(fs.readFileSync(path.resolve(META_FILE), 'utf-8'));
    }
  } catch { /* ignore */ }
  return { darkMode: false };
}

function writeMeta(data) {
  ensureDirs();
  fs.writeFileSync(path.resolve(META_FILE), JSON.stringify(data, null, 2), 'utf-8');
}

function readProject(id) {
  try {
    const filePath = path.resolve(PROJECTS_DIR, `${id}.json`);
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch { /* ignore */ }
  return null;
}

function writeProject(id, data) {
  ensureDirs();
  fs.writeFileSync(path.resolve(PROJECTS_DIR, `${id}.json`), JSON.stringify(data, null, 2), 'utf-8');
}

function deleteProjectFile(id) {
  const filePath = path.resolve(PROJECTS_DIR, `${id}.json`);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

function listProjects() {
  ensureDirs();
  const files = fs.readdirSync(path.resolve(PROJECTS_DIR)).filter(f => f.endsWith('.json'));
  const projects = [];
  for (const f of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.resolve(PROJECTS_DIR, f), 'utf-8'));
      projects.push(data);
    } catch { /* skip corrupt files */ }
  }
  return projects;
}

/**
 * Vite plugin: provides /api/* endpoints in dev mode.
 */
function localDataPlugin() {
  return {
    name: 'local-data-plugin',
    configureServer(server) {
      // POST /api/hash-password — return SHA-256 hash of a password
      server.middlewares.use('/api/hash-password', async (req, res, next) => {
        if (req.method !== 'POST') return next();
        const body = await readBody(req);
        try {
          const { password } = JSON.parse(body);
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ hash: hashPassword(password) }));
        } catch {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'Invalid request' }));
        }
      });

      // POST /api/unlock — verify per-project password, return token
      server.middlewares.use('/api/unlock', async (req, res, next) => {
        if (req.method !== 'POST') return next();
        const body = await readBody(req);
        try {
          const { password, projectId } = JSON.parse(body);
          const inputHash = hashPassword(password);

          const project = readProject(projectId);
          const projectHash = project?.passwordHash || null;

          if (!projectHash) {
            res.statusCode = 403;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: false, error: 'Project has no password set' }));
            return;
          }
          const valid = inputHash === projectHash;

          if (valid) {
            const token = crypto.randomBytes(32).toString('hex');
            activeTokens.set(token, projectId || '__global');
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true, token }));
          } else {
            res.statusCode = 403;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: false, error: 'Wrong password' }));
          }
        } catch {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'Invalid request' }));
        }
      });

      // POST /api/change-password — change per-project password
      server.middlewares.use('/api/change-password', async (req, res, next) => {
        if (req.method !== 'POST') return next();
        const body = await readBody(req);
        try {
          const { oldPassword, newPassword, projectId, token } = JSON.parse(body);
          if (!token || !activeTokens.has(token)) {
            res.statusCode = 403;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: false, error: 'Not authorized' }));
            return;
          }

          const project = readProject(projectId);
          if (!project) {
            res.statusCode = 404;
            res.end(JSON.stringify({ ok: false, error: 'Project not found' }));
            return;
          }

          const oldHash = hashPassword(oldPassword);
          const currentHash = project.passwordHash;
          if (!currentHash) {
            res.statusCode = 400;
            res.end(JSON.stringify({ ok: false, error: 'Project has no password' }));
            return;
          }

          if (oldHash !== currentHash) {
            res.statusCode = 403;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: false, error: 'Wrong old password' }));
            return;
          }

          project.passwordHash = hashPassword(newPassword);
          writeProject(projectId, project);

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: true }));
        } catch {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'Invalid request' }));
        }
      });

      // GET /api/check-token?token=xxx — verify token is valid
      server.middlewares.use('/api/check-token', (req, res, next) => {
        if (req.method !== 'GET') return next();
        const url = new URL(req.url, 'http://localhost');
        const token = url.searchParams.get('token');
        const valid = token && activeTokens.has(token);
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ valid: !!valid }));
      });

      // POST /api/lock — invalidate a token
      server.middlewares.use('/api/lock', async (req, res, next) => {
        if (req.method !== 'POST') return next();
        const body = await readBody(req);
        try {
          const { token } = JSON.parse(body);
          activeTokens.delete(token);
        } catch { /* ignore */ }
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true }));
      });

      // GET /api/meta — read meta (darkMode, etc.)
      // POST /api/meta — write meta
      server.middlewares.use('/api/meta', async (req, res, next) => {
        if (req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(readMeta()));
          return;
        }
        if (req.method === 'POST') {
          const body = await readBody(req);
          try {
            const data = JSON.parse(body);
            writeMeta(data);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true }));
          } catch (err) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: err.message }));
          }
          return;
        }
        next();
      });

      // GET /api/projects — list all projects (summary: id, name, hasPassword)
      server.middlewares.use('/api/projects', async (req, res, next) => {
        if (req.method !== 'GET') return next();
        const projects = listProjects();
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(projects));
      });

      // /api/project/:id — GET read, POST write, DELETE remove
      server.middlewares.use('/api/project', async (req, res, next) => {
        // Extract project ID from URL: /api/project/<id>
        const urlPath = req.url.split('?')[0];
        const projectId = urlPath.replace(/^\//, '');
        if (!projectId) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'Missing project ID' }));
          return;
        }

        if (req.method === 'GET') {
          const project = readProject(projectId);
          if (!project) {
            res.statusCode = 404;
            res.end(JSON.stringify({ error: 'not found' }));
          } else {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(project));
          }
          return;
        }

        if (req.method === 'POST') {
          const authHeader = req.headers['x-edit-token'];
          const hasValidToken = authHeader && activeTokens.has(authHeader);

          // Allow writing without token only if the project file doesn't exist yet (bootstrap/create)
          if (!hasValidToken) {
            const existing = readProject(projectId);
            if (existing) {
              res.statusCode = 403;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Not authorized to edit' }));
              return;
            }
          }

          const body = await readBody(req);
          try {
            const data = JSON.parse(body);
            writeProject(projectId, data);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true }));
          } catch (err) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: err.message }));
          }
          return;
        }

        if (req.method === 'DELETE') {
          const authHeader = req.headers['x-edit-token'];
          if (!authHeader || !activeTokens.has(authHeader)) {
            res.statusCode = 403;
            res.end(JSON.stringify({ error: 'Not authorized' }));
            return;
          }
          deleteProjectFile(projectId);
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: true }));
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), localDataPlugin()],
});
