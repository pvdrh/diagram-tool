import { list, put, del } from '@vercel/blob';

const BLOB_PREFIX = 'projects/';

function json(res, data, status = 200) {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

async function findBlob(blobPath) {
  const { blobs } = await list({ prefix: blobPath });
  return blobs.find(b => b.pathname === blobPath) || null;
}

export default async function handler(req, res) {
  const id = req.query.id;
  if (!id) return json(res, { error: 'Missing project ID' }, 400);

  const blobPath = `${BLOB_PREFIX}${id}.json`;

  if (req.method === 'GET') {
    try {
      const blob = await findBlob(blobPath);
      if (!blob) return json(res, { error: 'Not found' }, 404);
      const r = await fetch(blob.url);
      if (!r.ok) return json(res, { error: 'Failed to fetch blob contents' }, 500);
      const data = await r.json();
      return json(res, data);
    } catch (e) {
      console.error("GET [id] Error:", e);
      return json(res, { error: 'Internal Server Error' }, 500);
    }
  }

  if (req.method === 'POST') {
    try {
      let body = req.body;
      if (typeof body !== 'object') {
        try { body = JSON.parse(body); } catch { return json(res, { error: 'Invalid JSON' }, 400); }
      }
      await put(blobPath, JSON.stringify(body), {
        access: 'public',
        contentType: 'application/json',
        addRandomSuffix: false,
        allowOverwrite: true,
      });
      return json(res, { ok: true });
    } catch (e) {
      console.error("POST [id] Error:", e);
      return json(res, { error: e.message || 'Error saving project' }, 500);
    }
  }

  if (req.method === 'DELETE') {
    try {
      const blob = await findBlob(blobPath);
      if (blob) await del(blob.url);
      return json(res, { ok: true });
    } catch (e) {
      console.error("DELETE [id] Error:", e);
      return json(res, { error: e.message || 'Error deleting project' }, 500);
    }
  }

  return json(res, { error: 'Method not allowed' }, 405);
}
