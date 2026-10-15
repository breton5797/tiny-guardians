// Offline support. Hashed build files never change, so they are served from the cache;
// everything else (the page itself) prefers the network so updates arrive on the next visit.
const CACHE = 'tiny-guardians-v1'
// Precached copies were fetched without the page's request headers, so a `Vary` header must not hide them.
const MATCH = { ignoreVary: true }

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('tiny-guardians-') && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

async function store(request, response) {
  if (response.ok) (await caches.open(CACHE)).put(request, response.clone())
  return response
}

async function cacheFirst(request) {
  return (await caches.match(request, MATCH)) ?? store(request, await fetch(request))
}

async function networkFirst(request) {
  try {
    return await store(request, await fetch(request))
  } catch (error) {
    const cached = await caches.match(request, MATCH)
    if (cached) return cached
    throw error
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)
  // The page's "is there a new version?" check must reach the network and must not pile up in the cache.
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.searchParams.has('update')) return
  event.respondWith(request.url.includes('/assets/') ? cacheFirst(request) : networkFirst(request))
})

// The first visit loads before this worker controls the page, so the page sends the list of files it used.
// Caching them makes offline play work from the very next launch, and older builds' files are dropped.
self.addEventListener('message', (event) => {
  const urls = event.data?.type === 'precache' && Array.isArray(event.data.urls) ? event.data.urls : null
  if (!urls) return
  const wanted = new Set(urls.filter((url) => typeof url === 'string' && new URL(url).origin === self.location.origin))
  event.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      await Promise.all([...wanted].map((url) => cache.add(url).catch(() => undefined)))
      const stale = (await cache.keys()).filter((request) => request.url.includes('/assets/') && !wanted.has(request.url))
      await Promise.all(stale.map((request) => cache.delete(request)))
    }),
  )
})
