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
  if (req.method === 'GET') {
    ensureDirs();
    const files = fs.readdirSync(PROJECTS_DIR).filter(f => f.endsWith('.json'));
    const projects = [];
    for (const f of files) {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(PROJECTS_DIR, f), 'utf-8'));
        projects.push(data);
      } catch { /* skip corrupt files */ }
    }
    return json(res, projects);
  }
  return json(res, { error: 'Method not allowed' }, 405);
}
