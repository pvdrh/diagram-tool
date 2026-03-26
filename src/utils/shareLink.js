/**
 * Share link utilities — compress diagram data into a URL-safe string.
 * Uses pako-free approach: base64 encode raw JSON (small enough for most diagrams).
 * For larger diagrams, uses CompressionStream if available.
 */

/**
 * Compress and encode project data for URL sharing.
 */
export async function encodeShareData(data) {
  const json = JSON.stringify(data);
  // Try CompressionStream (modern browsers)
  if (typeof CompressionStream !== 'undefined') {
    const stream = new Blob([json]).stream().pipeThrough(new CompressionStream('deflate'));
    const compressed = await new Response(stream).arrayBuffer();
    const bytes = new Uint8Array(compressed);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return 'z:' + btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  // Fallback: plain base64
  return 'b:' + btoa(unescape(encodeURIComponent(json))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Decode shared data from URL hash.
 */
export async function decodeShareData(encoded) {
  if (!encoded) return null;
  try {
    if (encoded.startsWith('z:')) {
      // Compressed
      const b64 = encoded.slice(2).replace(/-/g, '+').replace(/_/g, '/');
      const padded = b64 + '='.repeat((4 - b64.length % 4) % 4);
      const binary = atob(padded);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'));
      const text = await new Response(stream).text();
      return JSON.parse(text);
    }
    if (encoded.startsWith('b:')) {
      const b64 = encoded.slice(2).replace(/-/g, '+').replace(/_/g, '/');
      const padded = b64 + '='.repeat((4 - b64.length % 4) % 4);
      return JSON.parse(decodeURIComponent(escape(atob(padded))));
    }
    return null;
  } catch {
    return null;
  }
}
