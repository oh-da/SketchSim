import {
  compressToEncodedURIComponent,
  decompressFromEncodedURIComponent,
} from 'lz-string';

const MAX_URL_LENGTH = 8000;

export function compressElements(elements: unknown[]): string {
  return compressToEncodedURIComponent(JSON.stringify(elements));
}

export function decompressElements(compressed: string): unknown[] | null {
  try {
    const json = decompressFromEncodedURIComponent(compressed);
    if (!json) return null;
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * Compress elements into URL hash and copy link to clipboard.
 * Returns 'url' if hash was set, 'clipboard' if too long (clipboard only), 'error' on failure.
 */
export async function shareToUrl(
  elements: unknown[],
): Promise<'url' | 'clipboard' | 'error'> {
  try {
    const compressed = compressElements(elements);
    const url = `${window.location.origin}${window.location.pathname}#data=${compressed}`;

    if (url.length <= MAX_URL_LENGTH) {
      window.history.replaceState(null, '', `#data=${compressed}`);
      await navigator.clipboard.writeText(url);
      return 'url';
    } else {
      await navigator.clipboard.writeText(url);
      return 'clipboard';
    }
  } catch {
    return 'error';
  }
}

/**
 * Load elements from URL hash if present. Returns null if no data in hash.
 */
export function loadFromUrl(): unknown[] | null {
  const hash = window.location.hash;
  if (!hash.startsWith('#data=')) return null;

  const compressed = hash.slice(6);
  const result = decompressElements(compressed);

  // Clear hash after loading
  if (result) {
    window.history.replaceState(null, '', window.location.pathname);
  }

  return result;
}
