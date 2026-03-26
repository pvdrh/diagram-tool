/**
 * Share link utilities — save share data on the server, use short ID in URL.
 */

/**
 * Create a share on the server. Returns the short share ID.
 */
export async function createShare(data) {
  try {
    const res = await fetch('/api/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) return null;
    const result = await res.json();
    return result.id || null;
  } catch {
    return null;
  }
}

/**
 * Load share data from the server by ID.
 */
export async function loadShare(id) {
  try {
    const res = await fetch(`/api/share/${id}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
