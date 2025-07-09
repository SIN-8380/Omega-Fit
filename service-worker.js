const ASSETS_TO_CACHE = [
  '/Omega-Fit/index.html',
  '/Omega-Fit/src/css/style.css',
  '/Omega-Fit/src/js/main.js',
  '/Omega-Fit/images/default.jpg',
  '/Omega-Fit/sounds/timer.mp3',
  '/Omega-Fit/manifest.json'
];

// 🔧 Install: cache all essential assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting(); // Activate immediately
});

// 🔁 Activate: delete old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) =>
      Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    )
  );
  self.clients.claim(); // Take control immediately
});

// 🌐 Fetch: serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request);
    }).catch(() => {
      // Optional: fallback to offline.html if needed
    })
  );
});

// 📢 Notification command listener
self.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'showNotification') {
    self.registration.showNotification(event.data.title, event.data.options);
  }
});
