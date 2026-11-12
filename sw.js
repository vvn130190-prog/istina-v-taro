self.addEventListener('fetch', (e) => {
  // Не кэшируем POST-запросы и запросы к API
  if (e.request.method !== 'GET' || e.request.url.includes('/api/')) {
    return; // Просто пропускаем, браузер сделает запрос напрямую
  }
  // ... остальной код для GET-запросов
});
const CACHE_NAME = 'tarot-v2'; // Поменяли версию, чтобы старый кэш сбросился

// 1. Устанавливаем новый Service Worker и сразу его активируем
self.addEventListener('install', (e) => {
  self.skipWaiting(); // Заставляем новый SW включиться немедленно
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(['/']))
  );
});

// 2. Активация: удаляем старые кэши и забираем контроль над страницами
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('Удаляем старый кэш:', cache);
            return caches.delete(cache); // Чистим старое
          }
        })
      );
    }).then(() => self.clients.claim()) // Захватываем контроль над открытыми вкладками
  );
});

// 3. Перехват запросов (Сначала сеть, потом кэш)
self.addEventListener('fetch', (e) => {
  // Пропускаем запросы к API (чтобы не кэшировать ответы ИИ и оплату)
  if (e.request.url.includes('/api/')) {
    return;
  }

  e.respondWith(
    fetch(e.request)
      .then((response) => {
        // Если сеть сработала, сохраняем свежую копию в кэш
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(e.request, responseClone);
        });
        return response;
      })
      .catch(() => {
        // Если сети нет, отдаем из кэша
        return caches.match(e.request);
      })
  );
});
