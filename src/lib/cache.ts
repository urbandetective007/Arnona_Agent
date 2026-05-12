const KEYS = {
  businesses: 'cache_businesses',
  sessions:   'cache_sessions',
} as const

export function getCache<T>(key: keyof typeof KEYS): T | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(KEYS[key])
    return raw ? (JSON.parse(raw) as T) : null
  } catch { return null }
}

export function setCache<T>(key: keyof typeof KEYS, data: T): void {
  if (typeof window === 'undefined') return
  try { sessionStorage.setItem(KEYS[key], JSON.stringify(data)) } catch { /* ignore */ }
}

export function clearCache(...keys: (keyof typeof KEYS)[]): void {
  if (typeof window === 'undefined') return
  keys.forEach(k => sessionStorage.removeItem(KEYS[k]))
}
