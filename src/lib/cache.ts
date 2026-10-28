/**
 * Simple in-memory cache for API responses.
 * Works in dev mode + single-instance Vercel (serverless functions may not persist between invocations,
 * but within the same warm function instance, cache hits are ~0ms).
 * 
 * For production-grade caching, upgrade to Upstash Redis (@upstash/redis) — see lib/cache-upstash.ts
 */

interface CacheEntry<T> {
  data: T
  expiry: number
}

const cache = new Map<string, CacheEntry<any>>()

/**
 * Get cached data if still valid
 */
export function getCached<T>(key: string): T | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiry) {
    cache.delete(key)
    return null
  }
  return entry.data as T
}

/**
 * Set cache with TTL (time-to-live) in seconds
 */
export function setCached<T>(key: string, data: T, ttlSeconds: number = 300): void {
  cache.set(key, {
    data,
    expiry: Date.now() + ttlSeconds * 1000,
  })
}

/**
 * Delete cached entry
 */
export function deleteCached(key: string): void {
  cache.delete(key)
}

/**
 * Delete all cached entries matching a pattern (e.g. "hasil:*")
 */
export function invalidatePattern(pattern: string): void {
  const regex = new RegExp(pattern.replace(/\*/g, '.*'))
  for (const key of cache.keys()) {
    if (regex.test(key)) {
      cache.delete(key)
    }
  }
}

/**
 * Cache wrapper for async functions
 * Usage: const data = await cacheable('hasil:overview', () => fetchOverview(), 300)
 */
export async function cacheable<T>(
  key: string,
  fn: () => Promise<T>,
  ttlSeconds: number = 300
): Promise<T> {
  const cached = getCached<T>(key)
  if (cached !== null) {
    return cached
  }
  const data = await fn()
  setCached(key, data, ttlSeconds)
  return data
}
