// ============================================================
// ВАЖНО: Меняйте эту версию каждый раз, когда вносите изменения на сайт!
// Было v2, стало v3, потом v4 и так далее.
// ============================================================
const CACHE_NAME = 'istina-taro-v3'; 

const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json'
];

// 1. УСТАНОВКА (Скачиваем новые файлы в кэш)
self.addEventListener('install', event => {
  self.skipWaiting(); // Принудительно активируем новый Service Worker
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(urlsToCache);
    })
  );
});

// 2. АКТИВАЦИЯ (Удаляем старый кэш, но НЕ ТРОГАЕМ localStorage с раскладами)
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
        // Принудительная проверка обновлений при каждом запуске
        return self.registration.update(); 
    })
  );
});

// 3. ОБРАБОТКА ЗАПРОСОВ (Стратегия: Сначала сеть, потом кэш)
self.addEventListener('fetch', event => {
  // Не кэшируем API-запросы (оплата, ИИ, check-payment должны идти напрямую)
  if (event.request.url.includes('/api/')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Если сеть работает, возвращаем свежий ответ и обновляем кэш
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseClone);
        });
        return response;
      })
      .catch(() => {
        // Если интернета нет, берем из кэша
        return caches.match(event.request);
      })
  );
});
