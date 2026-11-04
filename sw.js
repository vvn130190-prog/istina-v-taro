const CACHE_NAME = 'istina-v-taro-v2';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Для запросов к API (оплата, ИИ) — не кэшируем, всегда идем в сеть
  if (event.request.url.includes('/api/')) {
    return;
  }

  event.respondWith(
    (async () => {
      try {
        // Пытаемся загрузить из сети
        const response = await fetch(event.request);
        return response;
      } catch (error) {
        // Если сети нет — пытаемся взять из кэша
        const cached = await caches.match(event.request);
        if (cached) {
          return cached;
        }
        // Если ничего нет — возвращаем ошибку (но это лучше, чем падение)
        return new Response('Offline', { status: 503 });
      }
    })()
  );
});
