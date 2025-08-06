const CACHE_NAME = 'vitruvian-fit-cache-v1';
const NOTIFICATION_TAG = 'vitruvian-fit-workout';

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

// Listen for messages from the client to show/update/close notifications.
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SHOW_WORKOUT_NOTIFICATION') {
        const { title, body } = event.data.payload;
        const options = {
            body: body,
            icon: '/assets/icon-192x192.png',
            badge: '/assets/icon-192x192.png',
            tag: NOTIFICATION_TAG,
            renotify: false, // Don't make a sound/vibration on update
            silent: true,
            requireInteraction: true, // Make it persistent until dismissed or closed
        };
        event.waitUntil(self.registration.showNotification(title, options));
    } else if (event.data && event.data.type === 'CLOSE_WORKOUT_NOTIFICATION') {
        event.waitUntil(
            self.registration.getNotifications({ tag: NOTIFICATION_TAG })
                .then(notifications => {
                    notifications.forEach(notification => notification.close());
                })
        );
    }
});

// Handle notification click events.
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    // This looks for an open tab with the same origin and focuses it.
    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            if (clientList.length > 0) {
                let client = clientList[0];
                // Find a focused client or fall back to the first one.
                for (let i = 0; i < clientList.length; i++) {
                    if (clientList[i].focused) {
                        client = clientList[i];
                    }
                }
                return client.focus();
            }
            // If no tab is open, open a new one.
            return self.clients.openWindow('/');
        })
    );
});
