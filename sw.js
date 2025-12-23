const queryString = self.location.search;
const params = new URLSearchParams(queryString);
const CACHE_NAME = params.get('v');
console.log("ServiceWorker cache version: " + CACHE_NAME);

// Keep this list for the essential "App Shell"
const APP_SHELL_URLS = [
  '.',
  'index.html',
  'manifest.json',
  // CSS
  'assets/css/base.css',
  'assets/css/layout.css',
  'assets/css/components.css',
  'assets/css/reports.css',
  'assets/css/editor.css',
  'assets/css/print.css',
  'assets/fontawesome/css/all.css',
  'assets/googlefonts.css',
  // JS
  'assets/script.js',
  'assets/js-mod/SFSS.js',
  'assets/js-mod/Constants.js',
  'assets/js-mod/EditorHandler.js',
  'assets/js-mod/MediaPlayer.js',
  'assets/js-mod/SidebarManager.js',
  'assets/js-mod/IDBHelper.js',
  'assets/js-mod/ScrollbarManager.js',
  'assets/js-mod/StorageManager.js',
  'assets/js-mod/ReportsManager.js',
  // Images/Icons
  'assets/icons/icon-64.png',
  'assets/icons/icon-512.png',
  // Fonts (Google)
  'assets/googlefonts/u-4n0q2lgwslOqpF_6gQ8kELawRZVsf6lvg.woff2',
  'assets/googlefonts/u-4n0q2lgwslOqpF_6gQ8kELawRZWMf6.woff2',
  'assets/googlefonts/u-4i0q2lgwslOqpF_6gQ8kELawRR4-Lvp9nsBXw.woff2',
  'assets/googlefonts/u-450q2lgwslOqpF_6gQ8kELaw9pWt_-.woff2',
  'assets/googlefonts/u-450q2lgwslOqpF_6gQ8kELawFpWg.woff2',
  'assets/googlefonts/u-4k0q2lgwslOqpF_6gQ8kELY7pMT-7fq8Ho.woff2',
  'assets/googlefonts/u-4k0q2lgwslOqpF_6gQ8kELY7pMT-Dfqw.woff2',
  // Fonts (FontAwesome)
  'assets/fontawesome/webfonts/fa-solid-900.woff2',
  'assets/fontawesome/webfonts/fa-brands-400.woff2',
  'assets/fontawesome/webfonts/fa-regular-400.woff2'
];

// On install, cache the app shell
self.addEventListener('install', event => {
  self.skipWaiting(); // Force update
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache and caching app shell');
        return cache.addAll(APP_SHELL_URLS);
      })
  );
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