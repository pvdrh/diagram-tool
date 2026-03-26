/**
 * Share link utilities — encode share data into URL (no server required).
 */
import { compress, decompress } from 'lz-string';

/**
 * Create a share by encoding data into URL hash.
 * Returns a base64 string that will be used as #share=<data>
 */
export async function createShare(data) {
  try {
    const json = JSON.stringify(data);
    // Compress + encode to reduce URL length
    const compressed = compress(json);
    const encoded = btoa(compressed);
    return encoded;
  } catch {
    return null;
  }
}

/**
 * Load share data from encoded URL hash.
 */
export async function loadShare(encoded) {
  try {
    const compressed = atob(encoded);
    const json = decompress(compressed);
    return JSON.parse(json);
  } catch {
    return null;
  }
}
