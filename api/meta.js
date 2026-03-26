import { list, put } from '@vercel/blob';

const META_BLOB_PATH = 'meta.json';

function json(res, data, status = 200) {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const { blobs } = await list({ prefix: META_BLOB_PATH });
      const blob = blobs.find(b => b.pathname === META_BLOB_PATH);
      if (!blob) return json(res, { darkMode: false });
      const r = await fetch(blob.url);
      return json(res, await r.json());
    } catch (e) {
      console.error("GET Meta Error:", e);
      return json(res, { darkMode: false });
    }
  }

  if (req.method === 'POST') {
    try {
      let body = req.body;
      if (typeof body !== 'object') {
        try { body = JSON.parse(body); } catch { return json(res, { error: 'Invalid JSON' }, 400); }
      }
      await put(META_BLOB_PATH, JSON.stringify(body), {
        access: 'public',
        contentType: 'application/json',
        addRandomSuffix: false,
        allowOverwrite: true,
      });
      return json(res, { ok: true });
    } catch (e) {
      console.error("POST Meta Error:", e);
      return json(res, { error: e.message || 'Error saving meta' }, 500);
    }
  }

  return json(res, { error: 'Method not allowed' }, 405);
}
