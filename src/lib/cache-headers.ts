/**
 * Cache-Control header helpers for API responses.
 * Browser caches response → subsequent requests INSTANT (no network).
 * stale-while-revalidate: serve stale + fetch fresh in background.
 */

/** Private cache (per-user browser only, not CDN) */
export function cachePrivate(maxAge: number = 60, swr: number = 300): HeadersInit {
  return {
    'Cache-Control': `private, max-age=${maxAge}, stale-while-revalidate=${swr}`,
  }
}

/** No cache (for dynamic/personalized responses like auth, submit) */
export function noCache(): HeadersInit {
  return {
    'Cache-Control': 'no-store, no-cache, must-revalidate',
  }
}
