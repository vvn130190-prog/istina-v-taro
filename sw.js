// ============================================================
// ВАЖНО: Меняйте эту версию каждый раз, когда вносите изменения на сайт!
// ============================================================
const CACHE_NAME = 'istina-taro-v6'; // Обновил версию

const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json'
];

// 1. УСТАНОВКА
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(urlsToCache);
    })
  );
});

// 2. АКТИВАЦИЯ
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('Удаляем старый кэш:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => {
        self.clients.claim();
        // Убрали self.registration.update() во избежание циклов
    })
  );
});

// 3. ОБРАБОТКА ЗАПРОСОВ
self.addEventListener('fetch', event => {
  if (event.request.url.includes('/api/')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseClone);
        });
        return response;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});
