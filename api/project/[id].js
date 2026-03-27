import fs from 'node:fs';
import path from 'node:path';

const PROJECTS_DIR = path.resolve('data/projects');

function ensureDirs() {
  if (!fs.existsSync(PROJECTS_DIR)) {
    fs.mkdirSync(PROJECTS_DIR, { recursive: true });
  }
}

function json(res, data, status = 200) {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

export default function handler(req, res) {
  const id = req.query.id;
  if (!id) return json(res, { error: 'Missing project ID' }, 400);

  const filePath = path.resolve(PROJECTS_DIR, `${id}.json`);

  if (req.method === 'GET') {
    if (!fs.existsSync(filePath)) return json(res, { error: 'Not found' }, 404);
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      return json(res, data);
    } catch {
      return json(res, { error: 'Not found' }, 404);
    }
  }

  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body !== 'object') {
      try { body = JSON.parse(body); } catch { return json(res, { error: 'Invalid JSON' }, 400); }
    }
    ensureDirs();
    fs.writeFileSync(filePath, JSON.stringify(body, null, 2), 'utf-8');
    return json(res, { ok: true });
  }

  if (req.method === 'DELETE') {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    return json(res, { ok: true });
  }

  return json(res, { error: 'Method not allowed' }, 405);
}
