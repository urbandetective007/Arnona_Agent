// Service worker: keeps the installed app usable without signal.
// - Build assets (/_next/static/, content-hashed) → cache first, they never change.
// - Pages and everything else from this site → network first, cached copy when offline.
// - Supabase data reads (GET /rest/v1/…) → network first, last copy when offline,
//   so the surveyor's work plan still opens in a basement.
// Writes (POST/PATCH/…) are never cached; offline reports wait in the app's own
// IndexedDB queue (src/lib/offlineQueue.ts) and are sent when back online.

const CACHE = 'arnona-v1'
const BASE = '/Arnona_Agent'
const SUPABASE_REST = 'https://mcsygsqfyuaexxxwsgem.supabase.co/rest/v1/'

self.addEventListener('install', event => {
  // Pre-cache the two entry pages so an installed app opens even if offline on first launch.
  event.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll([`${BASE}/`, `${BASE}/work-plan`, `${BASE}/login`]))
      .catch(() => {})
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

async function cacheFirst(request) {
  const cached = await caches.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok) (await caches.open(CACHE)).put(request, response.clone())
  return response
}

async function networkFirst(request, { ignoreSearch = false, fallbackPage = false } = {}) {
  try {
    const response = await fetch(request)
    if (response.ok) (await caches.open(CACHE)).put(request, response.clone())
    return response
  } catch (err) {
    const cached = await caches.match(request, { ignoreSearch })
    if (cached) return cached
    if (fallbackPage) {
      const page = await caches.match(`${BASE}/work-plan`) || await caches.match(`${BASE}/`)
      if (page) return page
    }
    throw err
  }
}

self.addEventListener('fetch', event => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)

  if (url.href.startsWith(SUPABASE_REST)) {
    event.respondWith(networkFirst(request))
    return
  }
  if (url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return

  if (url.pathname.startsWith(`${BASE}/_next/static/`)) {
    event.respondWith(cacheFirst(request))
    return
  }
  // Pages, page data (?_rsc=…), icons, manifest.
  event.respondWith(networkFirst(request, { ignoreSearch: url.searchParams.has('_rsc'), fallbackPage: request.mode === 'navigate' }))
})
