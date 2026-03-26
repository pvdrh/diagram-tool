import { list } from '@vercel/blob';

const BLOB_PREFIX = 'projects/';

function json(res, data, status = 200) {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      // List all project blobs
      const { blobs } = await list({ prefix: BLOB_PREFIX });
      const projects = await Promise.all(
        blobs.map(async (blob) => {
          try {
            const r = await fetch(blob.url);
            if (!r.ok) return null;
            return await r.json();
          } catch {
            return null;
          }
        })
      );
      return json(res, projects.filter(Boolean));
    } catch (error) {
      console.error("Vercel Blob API Error:", error);
      return json(res, { error: error.message || 'Internal Server Error' }, 500);
    }
  }
  return json(res, { error: 'Method not allowed' }, 405);
}
