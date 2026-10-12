// Offline support. Hashed build files never change, so they are served from the cache;
// everything else (the page itself) prefers the network so updates arrive on the next visit.
const CACHE = 'tiny-guardians-v1'

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

async function store(request, response) {
  if (response.ok) (await caches.open(CACHE)).put(request, response.clone())
  return response
}

async function cacheFirst(request) {
  return (await caches.match(request)) ?? store(request, await fetch(request))
}

async function networkFirst(request) {
  try {
    return await store(request, await fetch(request))
  } catch (error) {
    const cached = await caches.match(request)
    if (cached) return cached
    throw error
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return
  event.respondWith(request.url.includes('/assets/') ? cacheFirst(request) : networkFirst(request))
})
