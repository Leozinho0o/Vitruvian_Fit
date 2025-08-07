const CACHE_NAME = 'vitruvian-fit-cache-v1';
const NOTIFICATION_TAG = 'vitruvian-fit-workout';

// This will hold the current state of the workout notification
let notificationState = {
  sessionId: null,
  routineName: 'Treino',
  isPaused: false,
};

// --- Helper Functions ---

const showWorkoutNotification = async () => {
    if (!notificationState.sessionId) return;

    const title = notificationState.isPaused ? 'Treino Pausado' : 'Treino em Andamento';
    const body = `Rotina: ${notificationState.routineName}\nToque para ver o progresso.`;
    
    const actions = notificationState.isPaused
        ? [ { action: 'resume', title: 'Continuar' }, { action: 'finish', title: 'Concluir' } ]
        : [ { action: 'pause', title: 'Pausar' }, { action: 'finish', title: 'Concluir' } ];

    const options = {
        body,
        tag: NOTIFICATION_TAG,
        icon: '/assets/icon-192x192.png',
        badge: '/assets/icon-192x192.png', // For Android
        silent: true,
        requireInteraction: true,
        data: {
            workoutSessionId: notificationState.sessionId,
        },
        actions,
    };

    try {
        await self.registration.showNotification(title, options);
    } catch (error) {
        console.error('Error showing notification:', error);
    }
};

const closeWorkoutNotification = async () => {
    const notifications = await self.registration.getNotifications({ tag: NOTIFICATION_TAG });
    notifications.forEach(notification => notification.close());
    notificationState.sessionId = null; // Clear state when closing
};


// --- Event Listeners ---

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Service Worker: Caching App Shell');
      return cache.addAll(['/', '/index.html', '/manifest.json']);
    }).then(() => self.skipWaiting())
  );
});

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
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') {
        return;
    }
    event.respondWith(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.match(event.request).then((response) => {
                const fetchPromise = fetch(event.request).then((networkResponse) => {
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

// Listen for messages from the client (main app)
self.addEventListener('message', (event) => {
    const { command, workoutSessionId, routineName, isPaused } = event.data;

    if (command === 'show') {
        notificationState = { sessionId: workoutSessionId, routineName, isPaused };
        event.waitUntil(showWorkoutNotification());
    } else if (command === 'close') {
        event.waitUntil(closeWorkoutNotification());
    }
});

// Listen for notification clicks and actions
self.addEventListener('notificationclick', (event) => {
    const { workoutSessionId } = event.notification.data || {};
    const { action } = event;

    event.notification.close();

    const updateAndShowPromise = (async () => {
        if (action === 'pause') {
            notificationState.isPaused = true;
            await showWorkoutNotification();
        } else if (action === 'resume') {
            notificationState.isPaused = false;
            await showWorkoutNotification();
        }
    })();

    const messageClientPromise = clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
        for (const client of windowClients) {
            if (client.url.endsWith('/') && 'focus' in client) {
                client.postMessage({
                    type: 'workout-notification-action',
                    action: action,
                    workoutSessionId: workoutSessionId
                });
                return client.focus();
            }
        }
        if (clients.openWindow) {
            return clients.openWindow('/');
        }
    });

    event.waitUntil(Promise.all([updateAndShowPromise, messageClientPromise]));
});
