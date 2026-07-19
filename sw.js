const queryString = self.location.search;
const params = new URLSearchParams(queryString);
const CACHE_NAME = params.get('v');
console.log("ServiceWorker cache version: " + CACHE_NAME);

// assets/asset-manifest.json is the single source of truth for what gets
// precached (#19). This minimal shell is used ONLY if that manifest cannot
// be fetched at install time.
const FALLBACK_CORE_URLS = [
  '.',
  'index.html',
  'manifest.json',
  'assets/script.js',
  'assets/js-mod/SFSS.js',
  'assets/js-mod/Constants.js',
  'assets/css/base.css',
  'assets/css/layout.css',
  'assets/css/components.css',
  'assets/css/reports.css',
  'assets/css/editor.css',
  'assets/css/print.css',
  'assets/css/treatment.css',
  'assets/css/collab.css'
];

// On install, cache the app shell. Core assets fail-hard (a broken install
// never activates); extras + conditional feature modules fail-soft (logged,
// never fatal). No skipWaiting() here: activation waits for the user's
// explicit go-ahead via the SKIP_WAITING message (#20).
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    let core = FALLBACK_CORE_URLS;
    let soft = [];
    try {
      const response = await fetch('assets/asset-manifest.json?v=' + CACHE_NAME);
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const manifest = await response.json();
      core = manifest.core || FALLBACK_CORE_URLS;
      soft = (manifest.extras || []).concat(...Object.values(manifest.conditional || {}));
    } catch (err) {
      console.warn('Asset manifest unavailable, caching fallback shell:', err);
    }
    const coreUrls = [...new Set(core)];
    const softUrls = [...new Set(soft)].filter(url => !coreUrls.includes(url));
    const cache = await caches.open(CACHE_NAME);
    console.log('Opened cache and caching app shell (' + coreUrls.length + ' core, ' + softUrls.length + ' optional)');
    await cache.addAll(coreUrls); // fail-hard: install rejects if any core asset is missing
    const results = await Promise.allSettled(softUrls.map(url => cache.add(url)));
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.warn('Optional asset not cached:', softUrls[index], result.reason);
      }
    });
  })());
});

// The page posts this when the user clicks "Reload" on the update banner (#20).
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// On activate, clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    Promise.all([
        self.clients.claim(), // Take control immediately
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                if (cacheName !== CACHE_NAME) {
                    console.log('Deleting old cache:', cacheName);
                    return caches.delete(cacheName);
                }
                })
            );
        })
    ])
  );
});

// The "Stale-While-Revalidate" strategy
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.open(CACHE_NAME).then(cache => {
      return cache.match(event.request).then(response => {
        // Return from cache if available
        const fetchPromise = fetch(event.request).then(networkResponse => {
          // If we get a valid response, update the cache
          if (networkResponse && networkResponse.status === 200) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        });

        // Return the cached response immediately, while the fetch happens in the background.
        // If not in cache, the browser waits for the fetch to complete.
        return response || fetchPromise;
      });
    })
  );
});
