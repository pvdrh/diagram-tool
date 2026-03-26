import crypto from 'node:crypto';

function json(res, data, status = 200) {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

export default function handler(req, res) {
  if (req.method !== 'POST') return json(res, { error: 'Method not allowed' }, 405);
  const { password } = req.body || {};
  if (!password) return json(res, { error: 'Missing password' }, 400);
  const hash = crypto.createHash('sha256').update(password).digest('hex');
  return json(res, { hash });
}
