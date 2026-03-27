import fs from 'node:fs';
import path from 'node:path';

const META_FILE = path.resolve('data/meta.json');

function ensureDirs() {
  const dir = path.dirname(META_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function json(res, data, status = 200) {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

export default function handler(req, res) {
  if (req.method === 'GET') {
    try {
      if (fs.existsSync(META_FILE)) {
        return json(res, JSON.parse(fs.readFileSync(META_FILE, 'utf-8')));
      }
    } catch { /* ignore */ }
    return json(res, { darkMode: false });
  }

  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body !== 'object') {
      try { body = JSON.parse(body); } catch { return json(res, { error: 'Invalid JSON' }, 400); }
    }
    ensureDirs();
    fs.writeFileSync(META_FILE, JSON.stringify(body, null, 2), 'utf-8');
    return json(res, { ok: true });
  }

  return json(res, { error: 'Method not allowed' }, 405);
}
