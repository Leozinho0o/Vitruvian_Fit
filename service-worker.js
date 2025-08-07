const CACHE_NAME = 'vitruvian-fit-cache-v1';

// On install, cache the app shell and other critical assets.
// This makes the app load faster on subsequent visits and work offline.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Service Worker: Caching App Shell');
      // We pre-cache the main entry points. The rest of the app will be cached on first visit.
      return cache.addAll([
          '/',
          '/index.html',
          '/manifest.json'
      ]);
    }).then(() => {
        // Force the waiting service worker to become the active service worker.
        return self.skipWaiting();
    })
  );
});

// On activate, clean up old caches.
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Service Worker: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
        // Tell the active service worker to take control of the page immediately.
        return self.clients.claim();
    })
  );
});

// On fetch, use a cache-first strategy.
self.addEventListener('fetch', (event) => {
    // We only want to cache GET requests.
    if (event.request.method !== 'GET') {
        return;
    }
    
    event.respondWith(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.match(event.request).then((response) => {
                // If a cached response is found, return it.
                // Otherwise, fetch from the network.
                const fetchPromise = fetch(event.request).then((networkResponse) => {
                    // If the fetch is successful, cache the new response.
                    // We check for valid responses to avoid caching errors or opaque responses from cross-origin requests if not desired.
                    if (networkResponse && networkResponse.status === 200) {
                        cache.put(event.request, networkResponse.clone());
                    }
                    return networkResponse;
                });

                return response || fetchPromise;
            });
        })
    );
});
